import {
  IdempotencyKeySchema,
  ResendVerificationRequestSchema,
  SignUpRequestSchema,
  VerifiedResponseSchema,
  VerifyEmailRequestSchema,
} from "@dnd-ai/contracts";
import { createRequestId } from "@dnd-ai/observability";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  identityRequestError,
  toIdentityHttpError,
  type IdentityHttpError,
} from "./http-errors.js";
import type {
  IdentityRequestMetadata,
  IdentityService,
} from "./identity-service.js";
import {
  isIdentityOriginAllowed,
  readSingleIdentityHeader,
} from "./origin-policy.js";
import type { IdentityClientSubjectAssertion } from "./client-subject-assertion.js";
import { createIdentitySessionCookie } from "./session-cookie.js";

const BODY_LIMIT_BYTES = 4_096;
const CORRELATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

interface SafeParseSchema<Output> {
  safeParse(
    value: unknown,
  ):
    | Readonly<{ readonly data: Output; readonly success: true }>
    | Readonly<{ readonly success: false }>;
}

export interface RegisterIdentityRoutesOptions {
  readonly clock: Readonly<{ now(): Date }>;
  readonly publicOrigin: string;
  readonly service: IdentityService;
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

function parseRequest<Output>(
  schema: SafeParseSchema<Output>,
  value: unknown,
): Output | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function requestMetadata(
  request: FastifyRequest,
  requestId: string,
  ipSubject: string,
): IdentityRequestMetadata | null {
  const idempotencyKey = parseRequest(
    IdempotencyKeySchema,
    readSingleIdentityHeader(request, "idempotency-key"),
  );
  if (idempotencyKey === null) return null;
  const correlationHeader = readSingleIdentityHeader(
    request,
    "x-correlation-id",
  );
  return Object.freeze({
    correlationId:
      correlationHeader !== undefined &&
      CORRELATION_PATTERN.test(correlationHeader)
        ? correlationHeader
        : requestId,
    idempotencyKey,
    ipSubject,
    requestId,
  });
}

function clientSubject(
  request: FastifyRequest,
  options: RegisterIdentityRoutesOptions,
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

async function handleRequest<Input, Output>(
  request: FastifyRequest,
  reply: FastifyReply,
  options: RegisterIdentityRoutesOptions,
  schema: SafeParseSchema<Input>,
  operation: (
    input: Input,
    metadata: IdentityRequestMetadata,
  ) => Promise<Output>,
  successStatus: number,
  sendSuccess: (output: Output) => unknown,
): Promise<void> {
  const requestId = currentRequestId(request, reply);
  if (!isIdentityOriginAllowed(request, options.publicOrigin)) {
    sendError(reply, identityRequestError(requestId, true));
    return;
  }
  const ipSubject = clientSubject(request, options);
  if (ipSubject === null) {
    sendError(reply, identityRequestError(requestId, true));
    return;
  }
  const metadata = requestMetadata(request, requestId, ipSubject);
  const input = parseRequest(schema, request.body);
  if (metadata === null || input === null) {
    sendError(reply, identityRequestError(requestId));
    return;
  }
  try {
    const result = await operation(input, metadata);
    reply.header("cache-control", "no-store");
    void reply.code(successStatus).send(sendSuccess(result));
  } catch (error) {
    sendError(reply, toIdentityHttpError(error, requestId));
  }
}

export function registerIdentityRoutes(
  app: FastifyInstance,
  options: RegisterIdentityRoutesOptions,
): void {
  app.post(
    "/api/auth/sign-up",
    { bodyLimit: BODY_LIMIT_BYTES, errorHandler: routeErrorHandler },
    async (request, reply) =>
      handleRequest(
        request,
        reply,
        options,
        SignUpRequestSchema,
        (input, metadata) => options.service.signUp(input, metadata),
        202,
        (output) => output,
      ),
  );
  app.post(
    "/api/auth/resend-verification",
    { bodyLimit: BODY_LIMIT_BYTES, errorHandler: routeErrorHandler },
    async (request, reply) =>
      handleRequest(
        request,
        reply,
        options,
        ResendVerificationRequestSchema,
        (input, metadata) =>
          options.service.resendVerification(input, metadata),
        202,
        (output) => output,
      ),
  );
  app.post(
    "/api/auth/verify-email",
    { bodyLimit: BODY_LIMIT_BYTES, errorHandler: routeErrorHandler },
    async (request, reply) =>
      handleRequest(
        request,
        reply,
        options,
        VerifyEmailRequestSchema,
        (input, metadata) => options.service.verifyEmail(input, metadata),
        200,
        (output) => {
          reply.header(
            "set-cookie",
            createIdentitySessionCookie({
              absoluteExpiresAt: output.absoluteExpiresAt,
              now: options.clock.now(),
              token: output.sessionToken,
            }),
          );
          return VerifiedResponseSchema.parse({ status: output.status });
        },
      ),
  );
}
