import { randomUUID } from "node:crypto";

import {
  IdentityErrorResponseSchema,
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

export const IDENTITY_BFF_PATHS = [
  "/api/auth/sign-up",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
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
  readonly status: 413 | 502 | 503;

  constructor(status: 413 | 502 | 503) {
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

function errorResponse(status: 413 | 502 | 503, requestId: string): Response {
  const requestInvalid = status === 413;
  return Response.json(
    {
      error: {
        code: requestInvalid
          ? "identity.request_invalid"
          : "identity.delivery_unavailable",
        message: requestInvalid
          ? "Richiesta non valida."
          : "Servizio di verifica temporaneamente non disponibile.",
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
  return headers;
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
  return Number.isSafeInteger(maxAge) && maxAge <= MAX_SESSION_AGE_SECONDS;
}

function outputHeaders(
  upstream: Response,
  path: IdentityBffPath,
): Headers | null {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
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
  const expectsCookie =
    path === "/api/auth/verify-email" && upstream.status === 200;
  if (expectsCookie) {
    if (cookies.length !== 1 || !validSessionCookie(cookies[0] ?? "")) {
      return null;
    }
    headers.set("set-cookie", cookies[0] ?? "");
  } else if (cookies.length !== 0) {
    return null;
  }
  return headers;
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

  if (status >= 400) {
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
  return null;
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

  let body: string;
  try {
    const contentLength = request.headers.get("content-length");
    if (
      contentLength !== null &&
      Number(contentLength) > REQUEST_BODY_LIMIT_BYTES
    ) {
      throw new BffBoundaryError(413);
    }
    body = await readBoundedBody(request.body, REQUEST_BODY_LIMIT_BYTES, 413);
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
      config,
      (options.now ?? (() => new Date()))(),
    );
    upstream = await (options.fetch ?? globalThis.fetch)(
      new URL(path, config.apiInternalOrigin),
      {
        body,
        cache: "no-store",
        headers,
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
      },
    );
  } catch {
    return errorResponse(503, requestId);
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
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
  const headers = outputHeaders(upstream, path);
  if (payload === null || headers === null) {
    return errorResponse(502, requestId);
  }
  return new Response(JSON.stringify(payload), {
    headers,
    status: upstream.status,
  });
}
