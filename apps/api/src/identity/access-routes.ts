import {
  AuthenticatedResponseSchema,
  IdempotencyKeySchema,
  PasswordResetCompletedResponseSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  PasswordResetRequestedResponseSchema,
  RevokeAllSessionsRequestSchema,
  SignInRequestSchema,
} from "@dnd-ai/contracts";
import { createRequestId } from "@dnd-ai/observability";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { IdentityClientSubjectAssertion } from "./client-subject-assertion.js";
import {
  identityRequestError,
  toIdentityHttpError,
  type IdentityHttpError,
} from "./http-errors.js";
import type { IdentityAccessService } from "./identity-access-service.js";
import {
  IdentityApplicationError,
  type IdentityRequestMetadata,
} from "./identity-service.js";
import {
  isIdentityOriginAllowed,
  readSingleIdentityHeader,
} from "./origin-policy.js";
import {
  clearIdentitySessionCookie,
  createIdentitySessionCookie,
  readIdentitySessionToken,
} from "./session-cookie.js";

const BODY_LIMIT_BYTES = 4_096;
const CORRELATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

interface SafeParseSchema<Output> {
  safeParse(
    value: unknown,
  ):
    | Readonly<{ readonly data: Output; readonly success: true }>
    | Readonly<{ readonly success: false }>;
}

export interface RegisterIdentityAccessRoutesOptions {
  readonly clock: Readonly<{ now(): Date }>;
  readonly publicOrigin: string;
  readonly service: IdentityAccessService;
  readonly verifyClientSubjectAssertion?: (
    assertion: IdentityClientSubjectAssertion,
    now: Date,
  ) => string | null;
}

function currentRequestId(
  request: FastifyRequest,
  reply: FastifyReply,
): string {
  const replyRequestId = reply.getHeader("x-request-id");
  const candidate =
    typeof replyRequestId === "string"
      ? replyRequestId
      : readSingleIdentityHeader(request, "x-request-id");
  const requestId = createRequestId(candidate);
  reply.header("x-request-id", requestId);
  return requestId;
}

function sendError(reply: FastifyReply, error: IdentityHttpError): void {
  reply.header("cache-control", "no-store");
  if (error.retryAfterSeconds !== undefined) {
    reply.header("retry-after", String(error.retryAfterSeconds));
  }
  void reply.code(error.statusCode).send(error.body);
}

function routeErrorHandler(
  error: Error & Readonly<{ code?: string; statusCode?: number }>,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const requestId = currentRequestId(request, reply);
  if (
    error.code === "FST_ERR_CTP_BODY_TOO_LARGE" ||
    error.code === "FST_ERR_CTP_INVALID_JSON_BODY"
  ) {
    const invalid = identityRequestError(requestId);
    sendError(
      reply,
      Object.freeze({
        ...invalid,
        statusCode: error.statusCode === 413 ? 413 : 400,
      }),
    );
    return;
  }
  sendError(reply, toIdentityHttpError(error, requestId));
}

function clientSubject(
  request: FastifyRequest,
  options: RegisterIdentityAccessRoutesOptions,
): string | null {
  const issuedAt = readSingleIdentityHeader(
    request,
    "x-dnd-ai-client-issued-at",
  );
  const signature = readSingleIdentityHeader(
    request,
    "x-dnd-ai-client-signature",
  );
  const subject = readSingleIdentityHeader(request, "x-dnd-ai-client-subject");
  if (
    issuedAt === undefined &&
    signature === undefined &&
    subject === undefined
  ) {
    return request.socket.remoteAddress ?? null;
  }
  if (
    issuedAt === undefined ||
    signature === undefined ||
    subject === undefined ||
    options.verifyClientSubjectAssertion === undefined
  ) {
    return null;
  }
  return options.verifyClientSubjectAssertion(
    Object.freeze({ issuedAt, signature, subject }),
    options.clock.now(),
  );
}

function prepareRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  options: RegisterIdentityAccessRoutesOptions,
): Readonly<{
  metadata: IdentityRequestMetadata;
  requestId: string;
}> | null {
  const requestId = currentRequestId(request, reply);
  if (!isIdentityOriginAllowed(request, options.publicOrigin)) {
    sendError(reply, identityRequestError(requestId, true));
    return null;
  }
  const ipSubject = clientSubject(request, options);
  if (ipSubject === null) {
    sendError(reply, identityRequestError(requestId, true));
    return null;
  }
  const idempotencyKey = IdempotencyKeySchema.safeParse(
    readSingleIdentityHeader(request, "idempotency-key"),
  );
  if (!idempotencyKey.success) {
    sendError(reply, identityRequestError(requestId));
    return null;
  }
  const correlationHeader = readSingleIdentityHeader(
    request,
    "x-correlation-id",
  );
  return Object.freeze({
    metadata: Object.freeze({
      correlationId:
        correlationHeader !== undefined &&
        CORRELATION_PATTERN.test(correlationHeader)
          ? correlationHeader
          : requestId,
      idempotencyKey: idempotencyKey.data,
      ipSubject,
      requestId,
    }),
    requestId,
  });
}

function parseBody<Output>(
  schema: SafeParseSchema<Output>,
  value: unknown,
): Output | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function requestCookie(request: FastifyRequest): string | null {
  return readIdentitySessionToken(
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined,
  );
}

function sessionError(requestId: string): IdentityHttpError {
  return toIdentityHttpError(
    new IdentityApplicationError("SESSION_INVALID", "Identity session failed."),
    requestId,
  );
}

async function handleFailure(
  reply: FastifyReply,
  requestId: string,
  operation: () => Promise<void>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    sendError(reply, toIdentityHttpError(error, requestId));
  }
}

function sendNoContent(reply: FastifyReply): void {
  reply.header("cache-control", "no-store");
  void reply.code(204).send();
}

export function registerIdentityAccessRoutes(
  app: FastifyInstance,
  options: RegisterIdentityAccessRoutesOptions,
): void {
  app.post(
    "/api/auth/sign-in",
    { bodyLimit: BODY_LIMIT_BYTES, errorHandler: routeErrorHandler },
    async (request, reply) => {
      const prepared = prepareRequest(request, reply, options);
      const input = parseBody(SignInRequestSchema, request.body);
      if (prepared === null || input === null) {
        if (prepared !== null)
          sendError(reply, identityRequestError(prepared.requestId));
        return;
      }
      await handleFailure(reply, prepared.requestId, async () => {
        const result = await options.service.signIn(input, prepared.metadata);
        reply.header("cache-control", "no-store");
        reply.header(
          "set-cookie",
          createIdentitySessionCookie({
            absoluteExpiresAt: result.absoluteExpiresAt,
            now: options.clock.now(),
            token: result.sessionToken,
          }),
        );
        void reply
          .code(200)
          .send(AuthenticatedResponseSchema.parse({ status: result.status }));
      });
    },
  );

  app.post(
    "/api/auth/session/refresh",
    { bodyLimit: BODY_LIMIT_BYTES, errorHandler: routeErrorHandler },
    async (request, reply) => {
      const prepared = prepareRequest(request, reply, options);
      if (prepared === null) return;
      if (request.body !== undefined) {
        sendError(reply, identityRequestError(prepared.requestId));
        return;
      }
      const token = requestCookie(request);
      if (!token) {
        sendError(reply, sessionError(prepared.requestId));
        return;
      }
      await handleFailure(reply, prepared.requestId, async () => {
        const result = await options.service.refreshSession(
          token,
          prepared.metadata,
        );
        reply.header("cache-control", "no-store");
        reply.header(
          "set-cookie",
          createIdentitySessionCookie({
            absoluteExpiresAt: result.absoluteExpiresAt,
            now: options.clock.now(),
            token: result.sessionToken,
          }),
        );
        void reply
          .code(200)
          .send(AuthenticatedResponseSchema.parse({ status: result.status }));
      });
    },
  );

  app.post(
    "/api/auth/sign-out",
    { bodyLimit: BODY_LIMIT_BYTES, errorHandler: routeErrorHandler },
    async (request, reply) => {
      const prepared = prepareRequest(request, reply, options);
      if (prepared === null) return;
      reply.header("set-cookie", clearIdentitySessionCookie());
      if (request.body !== undefined) {
        sendError(reply, identityRequestError(prepared.requestId));
        return;
      }
      await handleFailure(reply, prepared.requestId, async () => {
        await options.service.signOut(
          requestCookie(request),
          prepared.metadata,
        );
        sendNoContent(reply);
      });
    },
  );

  app.post(
    "/api/auth/sessions/revoke-all",
    { bodyLimit: BODY_LIMIT_BYTES, errorHandler: routeErrorHandler },
    async (request, reply) => {
      const prepared = prepareRequest(request, reply, options);
      if (prepared !== null) {
        reply.header("set-cookie", clearIdentitySessionCookie());
      }
      const input = parseBody(RevokeAllSessionsRequestSchema, request.body);
      if (prepared === null || input === null) {
        if (prepared !== null)
          sendError(reply, identityRequestError(prepared.requestId));
        return;
      }
      const token = requestCookie(request);
      if (!token) {
        sendError(reply, sessionError(prepared.requestId));
        return;
      }
      await handleFailure(reply, prepared.requestId, async () => {
        await options.service.revokeAllSessions(
          token,
          input,
          prepared.metadata,
        );
        sendNoContent(reply);
      });
    },
  );

  app.post(
    "/api/auth/password-reset/request",
    { bodyLimit: BODY_LIMIT_BYTES, errorHandler: routeErrorHandler },
    async (request, reply) => {
      const prepared = prepareRequest(request, reply, options);
      const input = parseBody(PasswordResetRequestSchema, request.body);
      if (prepared === null || input === null) {
        if (prepared !== null)
          sendError(reply, identityRequestError(prepared.requestId));
        return;
      }
      await handleFailure(reply, prepared.requestId, async () => {
        const result = await options.service.requestPasswordReset(
          input,
          prepared.metadata,
        );
        reply.header("cache-control", "no-store");
        void reply
          .code(202)
          .send(PasswordResetRequestedResponseSchema.parse(result));
      });
    },
  );

  app.post(
    "/api/auth/password-reset/confirm",
    { bodyLimit: BODY_LIMIT_BYTES, errorHandler: routeErrorHandler },
    async (request, reply) => {
      const prepared = prepareRequest(request, reply, options);
      if (prepared !== null) {
        reply.header("set-cookie", clearIdentitySessionCookie());
      }
      const input = parseBody(PasswordResetConfirmSchema, request.body);
      if (prepared === null || input === null) {
        if (prepared !== null)
          sendError(reply, identityRequestError(prepared.requestId));
        return;
      }
      await handleFailure(reply, prepared.requestId, async () => {
        const result = await options.service.confirmPasswordReset(
          input,
          prepared.metadata,
        );
        reply.header("cache-control", "no-store");
        void reply
          .code(200)
          .send(PasswordResetCompletedResponseSchema.parse(result));
      });
    },
  );
}
