import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

import {
  AuthenticatedResponseSchema,
  IdentityErrorResponseSchema,
  PasswordResetCompletedResponseSchema,
  PasswordResetRequestedResponseSchema,
  VerificationRequiredResponseSchema,
  VerifiedResponseSchema,
} from "@dnd-ai/contracts";

import { createIdentityClientSubjectAssertion } from "./identity-client-subject-assertion.ts";
import {
  parseWebIdentityRuntimeConfig,
  type WebIdentityEnvironmentSource,
  type WebIdentityRuntimeConfig,
} from "./identity-runtime-config.ts";

const REQUEST_BODY_LIMIT_BYTES = 4_096;
const RESPONSE_BODY_LIMIT_BYTES = 16_384;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_SESSION_AGE_SECONDS = 2_592_000;
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const RETRY_AFTER_PATTERN = /^[1-9][0-9]{0,4}$/u;
const SESSION_COOKIE_PATTERN =
  /^__Host-dnd_ai_session=([A-Za-z0-9_-]{43}); Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=([1-9][0-9]{0,6})$/u;
const SESSION_COOKIE_NAME = "__Host-dnd_ai_session";
const CLEARED_SESSION_COOKIE = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export const IDENTITY_BFF_PATHS = [
  "/api/auth/sign-up",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/sign-in",
  "/api/auth/session/refresh",
  "/api/auth/sign-out",
  "/api/auth/sessions/revoke-all",
  "/api/auth/password-reset/request",
  "/api/auth/password-reset/confirm",
] as const;

export type IdentityBffPath = (typeof IDENTITY_BFF_PATHS)[number];

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface ForwardIdentityRequestOptions {
  readonly environment: WebIdentityEnvironmentSource;
  readonly fetch?: FetchImplementation;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

class BffBoundaryError extends Error {
  readonly status: 400 | 413 | 502 | 503;

  constructor(status: 400 | 413 | 502 | 503) {
    super("Identity BFF boundary rejected a request.");
    this.name = "BffBoundaryError";
    this.status = status;
  }
}

function requestIdFrom(headers: Headers): string {
  const candidate = headers.get("x-request-id");
  return candidate !== null && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : randomUUID();
}

function errorResponse(
  status: 400 | 413 | 502 | 503,
  requestId: string,
): Response {
  const requestInvalid = status === 400 || status === 413;
  return Response.json(
    {
      error: {
        code: requestInvalid
          ? "identity.request_invalid"
          : "identity.delivery_unavailable",
        message: requestInvalid
          ? "Richiesta non valida."
          : "Servizio account temporaneamente non disponibile.",
        requestId,
        retryable: !requestInvalid,
      },
    },
    {
      headers: { "cache-control": "no-store" },
      status,
    },
  );
}

async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  limitBytes: number,
  status: 413 | 502,
): Promise<string> {
  if (body === null) throw new BffBoundaryError(status);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > limitBytes) throw new BffBoundaryError(status);
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function trustedClientIp(
  request: Request,
  environment: WebIdentityRuntimeConfig["environment"],
): string {
  const candidate =
    environment === "local"
      ? (request.headers.get("x-forwarded-for") ?? "127.0.0.1")
      : request.headers.get("x-vercel-forwarded-for");
  if (candidate === null || candidate.includes(",")) {
    throw new BffBoundaryError(503);
  }
  return candidate;
}

function forwardedHeaders(
  request: Request,
  path: IdentityBffPath,
  config: WebIdentityRuntimeConfig,
  now: Date,
): Headers {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "idempotency-key",
    "origin",
    "sec-fetch-site",
  ]) {
    if (name === "content-type" && expectsEmptyRequest(path)) continue;
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const requestId = request.headers.get("x-request-id");
  if (requestId !== null && REQUEST_ID_PATTERN.test(requestId)) {
    headers.set("x-request-id", requestId);
  }
  const correlationId = request.headers.get("x-correlation-id");
  if (correlationId !== null && CORRELATION_ID_PATTERN.test(correlationId)) {
    headers.set("x-correlation-id", correlationId);
  }
  const assertion = createIdentityClientSubjectAssertion({
    clientIp: trustedClientIp(request, config.environment),
    issuedAt: now,
    key: config.bffAssertionKey,
  });
  headers.set("x-dnd-ai-client-issued-at", assertion.issuedAt);
  headers.set("x-dnd-ai-client-signature", assertion.signature);
  headers.set("x-dnd-ai-client-subject", assertion.subject);
  const sessionCookie = forwardedSessionCookie(request, path);
  if (sessionCookie !== null) headers.set("cookie", sessionCookie);
  return headers;
}

function isSessionForwardingPath(path: IdentityBffPath): boolean {
  return (
    path === "/api/auth/session/refresh" ||
    path === "/api/auth/sign-out" ||
    path === "/api/auth/sessions/revoke-all"
  );
}

function validSessionToken(token: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) return false;
  try {
    const decoded = Buffer.from(token, "base64url");
    return decoded.byteLength === 32 && decoded.toString("base64url") === token;
  } catch {
    return false;
  }
}

function forwardedSessionCookie(
  request: Request,
  path: IdentityBffPath,
): string | null {
  if (!isSessionForwardingPath(path)) return null;
  const source = request.headers.get("cookie");
  if (source === null) return null;
  const prefix = `${SESSION_COOKIE_NAME}=`;
  const matches = source
    .split(/;\s*/u)
    .filter((candidate) => candidate.startsWith(prefix));
  if (matches.length === 0) return null;
  if (matches.length !== 1) throw new BffBoundaryError(400);
  const token = matches[0]?.slice(prefix.length) ?? "";
  if (!validSessionToken(token)) throw new BffBoundaryError(400);
  return `${prefix}${token}`;
}

function getSetCookies(headers: Headers): readonly string[] {
  const extended = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof extended.getSetCookie === "function") {
    return extended.getSetCookie();
  }
  const value = headers.get("set-cookie");
  return value === null ? [] : [value];
}

function validSessionCookie(cookie: string): boolean {
  const match = SESSION_COOKIE_PATTERN.exec(cookie);
  if (match === null) return false;
  const maxAge = Number(match[2]);
  return (
    validSessionToken(match[1] ?? "") &&
    Number.isSafeInteger(maxAge) &&
    maxAge <= MAX_SESSION_AGE_SECONDS
  );
}

type CookiePolicy = "clear" | "create" | "none" | "optional-clear";

function cookiePolicy(path: IdentityBffPath, status: number): CookiePolicy {
  if (status >= 400) {
    return path === "/api/auth/sign-out" ||
      path === "/api/auth/sessions/revoke-all" ||
      path === "/api/auth/password-reset/confirm"
      ? "optional-clear"
      : "none";
  }
  if (
    path === "/api/auth/verify-email" ||
    path === "/api/auth/sign-in" ||
    path === "/api/auth/session/refresh"
  ) {
    return "create";
  }
  if (
    path === "/api/auth/sign-out" ||
    path === "/api/auth/sessions/revoke-all" ||
    path === "/api/auth/password-reset/confirm"
  ) {
    return "clear";
  }
  return "none";
}

function outputHeaders(
  upstream: Response,
  path: IdentityBffPath,
  json: boolean,
): Headers | null {
  const headers = new Headers({ "cache-control": "no-store" });
  if (json) headers.set("content-type", "application/json; charset=utf-8");
  const requestId = upstream.headers.get("x-request-id");
  if (requestId !== null && REQUEST_ID_PATTERN.test(requestId)) {
    headers.set("x-request-id", requestId);
  }
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter !== null && RETRY_AFTER_PATTERN.test(retryAfter)) {
    const seconds = Number(retryAfter);
    if (seconds <= 86_400) headers.set("retry-after", retryAfter);
  }

  const cookies = getSetCookies(upstream.headers);
  const policy = cookiePolicy(path, upstream.status);
  if (policy === "create") {
    if (cookies.length !== 1 || !validSessionCookie(cookies[0] ?? "")) {
      return null;
    }
    headers.set("set-cookie", cookies[0] ?? "");
  } else if (policy === "clear") {
    if (cookies.length !== 1 || cookies[0] !== CLEARED_SESSION_COOKIE) {
      return null;
    }
    headers.set("set-cookie", CLEARED_SESSION_COOKIE);
  } else if (policy === "optional-clear") {
    if (
      cookies.length > 1 ||
      (cookies.length === 1 && cookies[0] !== CLEARED_SESSION_COOKIE)
    ) {
      return null;
    }
    if (cookies.length === 1) headers.set("set-cookie", CLEARED_SESSION_COOKIE);
  } else if (cookies.length !== 0) {
    return null;
  }
  return headers;
}

const COMMON_ERROR_STATUSES = [400, 403, 409, 429, 503] as const;

function allowedErrorStatus(path: IdentityBffPath, status: number): boolean {
  if (COMMON_ERROR_STATUSES.some((candidate) => candidate === status)) {
    return true;
  }
  if (
    status === 401 &&
    (path === "/api/auth/sign-in" ||
      path === "/api/auth/session/refresh" ||
      path === "/api/auth/sessions/revoke-all")
  ) {
    return true;
  }
  return (
    ((status === 410 || status === 422) && path === "/api/auth/verify-email") ||
    (status === 422 && path === "/api/auth/password-reset/confirm")
  );
}

function parseUpstreamBody(
  serialized: string,
  path: IdentityBffPath,
  status: number,
): unknown | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return null;
  }

  if (status >= 400 && allowedErrorStatus(path, status)) {
    const result = IdentityErrorResponseSchema.safeParse(parsed);
    return result.success ? result.data : null;
  }
  if (
    status === 202 &&
    (path === "/api/auth/sign-up" || path === "/api/auth/resend-verification")
  ) {
    const result = VerificationRequiredResponseSchema.safeParse(parsed);
    return result.success ? result.data : null;
  }
  if (status === 200 && path === "/api/auth/verify-email") {
    const result = VerifiedResponseSchema.safeParse(parsed);
    return result.success ? result.data : null;
  }
  if (
    status === 200 &&
    (path === "/api/auth/sign-in" || path === "/api/auth/session/refresh")
  ) {
    const result = AuthenticatedResponseSchema.safeParse(parsed);
    return result.success ? result.data : null;
  }
  if (status === 202 && path === "/api/auth/password-reset/request") {
    const result = PasswordResetRequestedResponseSchema.safeParse(parsed);
    return result.success ? result.data : null;
  }
  if (status === 200 && path === "/api/auth/password-reset/confirm") {
    const result = PasswordResetCompletedResponseSchema.safeParse(parsed);
    return result.success ? result.data : null;
  }
  return null;
}

function expectsEmptyRequest(path: IdentityBffPath): boolean {
  return path === "/api/auth/session/refresh" || path === "/api/auth/sign-out";
}

function isNoContentSuccess(path: IdentityBffPath, status: number): boolean {
  return (
    status === 204 &&
    (path === "/api/auth/sign-out" || path === "/api/auth/sessions/revoke-all")
  );
}

function timeoutFor(options: ForwardIdentityRequestOptions): number {
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 10_000
    ? timeout
    : DEFAULT_TIMEOUT_MS;
}

function isIdentityPath(path: string): path is IdentityBffPath {
  return IDENTITY_BFF_PATHS.some((candidate) => candidate === path);
}

export async function forwardIdentityRequest(
  request: Request,
  path: IdentityBffPath,
  options: ForwardIdentityRequestOptions,
): Promise<Response> {
  const requestId = requestIdFrom(request.headers);
  if (request.method !== "POST" || !isIdentityPath(path)) {
    return errorResponse(502, requestId);
  }

  let config: WebIdentityRuntimeConfig;
  try {
    config = parseWebIdentityRuntimeConfig(options.environment);
  } catch {
    return errorResponse(503, requestId);
  }

  let body: string | undefined;
  try {
    const contentLength = request.headers.get("content-length");
    if (
      contentLength !== null &&
      Number(contentLength) > REQUEST_BODY_LIMIT_BYTES
    ) {
      throw new BffBoundaryError(413);
    }
    if (expectsEmptyRequest(path)) {
      if (request.body !== null) throw new BffBoundaryError(413);
      body = undefined;
    } else {
      body = await readBoundedBody(request.body, REQUEST_BODY_LIMIT_BYTES, 413);
    }
  } catch {
    return errorResponse(413, requestId);
  }

  const controller = new AbortController();
  const abort = (): void => controller.abort();
  const timeout = setTimeout(abort, timeoutFor(options));
  request.signal.addEventListener("abort", abort, { once: true });
  let upstream: Response;
  try {
    const headers = forwardedHeaders(
      request,
      path,
      config,
      (options.now ?? (() => new Date()))(),
    );
    const init: RequestInit = {
      cache: "no-store",
      headers,
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      ...(body === undefined ? {} : { body }),
    };
    upstream = await (options.fetch ?? globalThis.fetch)(
      new URL(path, config.apiInternalOrigin),
      init,
    );
  } catch (error) {
    return errorResponse(
      error instanceof BffBoundaryError ? error.status : 503,
      requestId,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
  }

  if (isNoContentSuccess(path, upstream.status)) {
    const headers = outputHeaders(upstream, path, false);
    return headers === null
      ? errorResponse(502, requestId)
      : new Response(null, { headers, status: 204 });
  }

  const contentType = upstream.headers.get("content-type");
  if (
    contentType === null ||
    !/^application\/json(?:;|$)/iu.test(contentType)
  ) {
    return errorResponse(502, requestId);
  }
  let serialized: string;
  try {
    serialized = await readBoundedBody(
      upstream.body,
      RESPONSE_BODY_LIMIT_BYTES,
      502,
    );
  } catch {
    return errorResponse(502, requestId);
  }
  const payload = parseUpstreamBody(serialized, path, upstream.status);
  const headers = outputHeaders(upstream, path, true);
  if (payload === null || headers === null) {
    return errorResponse(502, requestId);
  }
  return new Response(JSON.stringify(payload), {
    headers,
    status: upstream.status,
  });
}
