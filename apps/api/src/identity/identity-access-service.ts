import type {
  AuthenticatedResponse,
  PasswordResetCompletedResponse,
  PasswordResetConfirm,
  PasswordResetRequest,
  PasswordResetRequestedResponse,
  RevokeAllSessionsRequest,
  SignInRequest,
} from "@dnd-ai/contracts";
import {
  IDENTITY_POLICY,
  IdentityPolicyError,
  normalizeIdentityEmail,
  normalizeIdentityPassword,
  type IdentityAccessRateLimitScope,
  type IdentityAccessStore,
  type IdentityClock,
  type IdentityCryptography,
  type IdentityMutationResult,
  type IdentityRequestContext,
  type IdentitySessionAccessValue,
  type PasswordBlocklist,
  type PasswordHash,
  type PasswordHasher,
} from "@dnd-ai/domain";
import { IdentityPersistenceError } from "@dnd-ai/persistence";

import {
  IdentityApplicationError,
  type IdentityRequestMetadata,
} from "./identity-service.js";

export interface AuthenticatedIdentityResult extends AuthenticatedResponse {
  readonly absoluteExpiresAt: Date;
  readonly sessionToken: string;
}

export interface IdentityAccessService {
  signIn(
    request: SignInRequest,
    metadata: IdentityRequestMetadata,
  ): Promise<AuthenticatedIdentityResult>;
  refreshSession(
    sessionToken: string,
    metadata: IdentityRequestMetadata,
  ): Promise<AuthenticatedIdentityResult>;
  signOut(
    sessionToken: string | null,
    metadata: IdentityRequestMetadata,
  ): Promise<void>;
  revokeAllSessions(
    sessionToken: string,
    request: RevokeAllSessionsRequest,
    metadata: IdentityRequestMetadata,
  ): Promise<void>;
  requestPasswordReset(
    request: PasswordResetRequest,
    metadata: IdentityRequestMetadata,
  ): Promise<PasswordResetRequestedResponse>;
  confirmPasswordReset(
    request: PasswordResetConfirm,
    metadata: IdentityRequestMetadata,
  ): Promise<PasswordResetCompletedResponse>;
}

export interface CreateIdentityAccessServiceOptions {
  readonly blocklist: PasswordBlocklist;
  readonly clock: IdentityClock;
  readonly cryptography: IdentityCryptography;
  readonly dummyPasswordHash: PasswordHash;
  readonly passwordHasher: PasswordHasher;
  readonly store: IdentityAccessStore;
}

const AUTHENTICATED_STATUS = "authenticated" as const;
const PASSWORD_RESET_REQUESTED = Object.freeze({
  status: "password_reset_requested" as const,
});
const PASSWORD_RESET_COMPLETED = Object.freeze({
  status: "password_reset" as const,
});

function accessError(
  code:
    | "CREDENTIALS_INVALID"
    | "DELIVERY_UNAVAILABLE"
    | "IDEMPOTENCY_CONFLICT"
    | "PASSWORD_REJECTED"
    | "PASSWORD_RESET_INVALID"
    | "RATE_LIMITED"
    | "REQUEST_INVALID"
    | "SESSION_INVALID",
  retryAfterSeconds?: number,
): IdentityApplicationError {
  let message: string;
  switch (code) {
    case "CREDENTIALS_INVALID":
      message = "Identity credentials are invalid.";
      break;
    case "DELIVERY_UNAVAILABLE":
      message = "Identity service is temporarily unavailable.";
      break;
    case "IDEMPOTENCY_CONFLICT":
      message = "Identity request conflicts with a prior request.";
      break;
    case "PASSWORD_REJECTED":
      message = "The password does not meet the identity policy.";
      break;
    case "PASSWORD_RESET_INVALID":
      message = "Identity password reset code is invalid.";
      break;
    case "RATE_LIMITED":
      message = "Identity request rate limit exceeded.";
      break;
    case "REQUEST_INVALID":
      message = "Identity request is invalid.";
      break;
    case "SESSION_INVALID":
      message = "Identity session is invalid.";
      break;
  }
  return new IdentityApplicationError(code, message, retryAfterSeconds);
}

function mapAccessError(error: unknown): never {
  if (error instanceof IdentityApplicationError) throw error;
  if (error instanceof IdentityPolicyError) {
    throw accessError(
      error.code.startsWith("identity.password")
        ? "PASSWORD_REJECTED"
        : "REQUEST_INVALID",
    );
  }
  if (error instanceof IdentityPersistenceError) {
    throw accessError(
      error.code === "IDEMPOTENCY_CONFLICT"
        ? "IDEMPOTENCY_CONFLICT"
        : error.code === "INVALID_COMMAND"
          ? "REQUEST_INVALID"
          : "DELIVERY_UNAVAILABLE",
    );
  }
  throw accessError("DELIVERY_UNAVAILABLE");
}

function buildContext(
  options: CreateIdentityAccessServiceOptions,
  metadata: IdentityRequestMetadata,
  occurredAt: Date,
  endpoint: string,
  canonicalPayload: string,
  actorSubjectHash: string,
): IdentityRequestContext {
  return Object.freeze({
    actorSubjectHash,
    correlationId: metadata.correlationId,
    idempotencyId: options.cryptography.createId(),
    idempotencyKeyDigest: options.cryptography.idempotencyKeyDigest(
      metadata.idempotencyKey,
    ),
    occurredAt,
    requestFingerprint: options.cryptography.requestFingerprint(
      endpoint,
      canonicalPayload,
    ),
    requestId: metadata.requestId,
  });
}

async function requireRateLimit(
  options: CreateIdentityAccessServiceOptions,
  scope: IdentityAccessRateLimitScope,
  subjectHash: string,
  occurredAt: Date,
): Promise<void> {
  const decision = await options.store.consumeRateLimit({
    occurredAt,
    scope,
    subjectHash,
  });
  if (!decision.allowed) {
    throw accessError("RATE_LIMITED", decision.retryAfterSeconds);
  }
}

function requireApplied<Success>(
  result: IdentityMutationResult<Success>,
): Exclude<typeof result, Readonly<{ readonly kind: "idempotency_conflict" }>> {
  if (result.kind === "idempotency_conflict") {
    throw accessError("IDEMPOTENCY_CONFLICT");
  }
  return result;
}

function authenticatedResult(
  options: CreateIdentityAccessServiceOptions,
  value: Extract<
    IdentitySessionAccessValue,
    { readonly status: "authenticated" }
  >,
): AuthenticatedIdentityResult {
  return Object.freeze({
    absoluteExpiresAt: value.absoluteExpiresAt,
    sessionToken: options.cryptography.deriveSessionToken(
      value.sessionId,
      value.keyVersion,
    ),
    status: AUTHENTICATED_STATUS,
  });
}

function sessionIdentity(
  options: CreateIdentityAccessServiceOptions,
  sessionToken: string,
): Readonly<{ actorSubjectHash: string; tokenDigest: string }> {
  try {
    const tokenDigest = options.cryptography.sessionTokenDigest(sessionToken);
    return Object.freeze({
      actorSubjectHash: options.cryptography.subjectHash(
        "session",
        tokenDigest,
      ),
      tokenDigest,
    });
  } catch {
    throw accessError("SESSION_INVALID");
  }
}

export function createIdentityAccessService(
  options: CreateIdentityAccessServiceOptions,
): IdentityAccessService {
  const service: IdentityAccessService = {
    async signIn(request, metadata) {
      try {
        const occurredAt = options.clock.now();
        const email = normalizeIdentityEmail(request.email);
        const ipSubjectHash = options.cryptography.subjectHash(
          "ip",
          metadata.ipSubject,
        );
        await requireRateLimit(
          options,
          "sign_in_ip",
          ipSubjectHash,
          occurredAt,
        );
        const emailSubjectHash = options.cryptography.subjectHash(
          "email",
          email,
        );
        await requireRateLimit(
          options,
          "sign_in_email",
          emailSubjectHash,
          occurredAt,
        );
        const credential = await options.store.findSignInCredential(email);
        const eligible = credential?.status === "active";
        const password = request.password.normalize("NFC");
        const verified = await options.passwordHasher.verify(
          password,
          eligible ? credential.passwordHash : options.dummyPasswordHash,
        );
        if (!eligible || !verified || credential === null) {
          throw accessError("CREDENTIALS_INVALID");
        }
        const generatedSession = options.cryptography.createSession();
        const result = requireApplied(
          await options.store.signIn({
            context: buildContext(
              options,
              metadata,
              occurredAt,
              "sign_in",
              JSON.stringify({ email, password }),
              emailSubjectHash,
            ),
            credentialVersion: credential.credentialVersion,
            session: Object.freeze({
              absoluteExpiresAt: new Date(
                occurredAt.valueOf() + IDENTITY_POLICY.session.absoluteTtlMs,
              ),
              idleExpiresAt: new Date(
                occurredAt.valueOf() + IDENTITY_POLICY.session.idleTtlMs,
              ),
              keyVersion: generatedSession.keyVersion,
              sessionId: generatedSession.sessionId,
              tokenDigest: generatedSession.tokenDigest,
            }),
            userId: credential.userId,
          }),
        );
        if (result.value.status !== "authenticated") {
          throw accessError("CREDENTIALS_INVALID");
        }
        return authenticatedResult(options, result.value);
      } catch (error) {
        mapAccessError(error);
      }
    },

    async refreshSession(sessionToken, metadata) {
      try {
        const occurredAt = options.clock.now();
        const current = sessionIdentity(options, sessionToken);
        await requireRateLimit(
          options,
          "refresh_session",
          current.actorSubjectHash,
          occurredAt,
        );
        const generatedSession = options.cryptography.createSession();
        const result = requireApplied(
          await options.store.refreshSession({
            context: buildContext(
              options,
              metadata,
              occurredAt,
              "refresh_session",
              JSON.stringify({ tokenDigest: current.tokenDigest }),
              current.actorSubjectHash,
            ),
            currentTokenDigest: current.tokenDigest,
            session: Object.freeze({
              absoluteExpiresAt: new Date(
                occurredAt.valueOf() + IDENTITY_POLICY.session.absoluteTtlMs,
              ),
              idleExpiresAt: new Date(
                occurredAt.valueOf() + IDENTITY_POLICY.session.idleTtlMs,
              ),
              keyVersion: generatedSession.keyVersion,
              sessionId: generatedSession.sessionId,
              tokenDigest: generatedSession.tokenDigest,
            }),
          }),
        );
        if (result.value.status !== "authenticated") {
          throw accessError("SESSION_INVALID");
        }
        return authenticatedResult(options, result.value);
      } catch (error) {
        mapAccessError(error);
      }
    },

    async signOut(sessionToken, metadata) {
      try {
        const occurredAt = options.clock.now();
        const current =
          sessionToken === null ? null : sessionIdentity(options, sessionToken);
        const actorSubjectHash =
          current?.actorSubjectHash ??
          options.cryptography.subjectHash("ip", metadata.ipSubject);
        await requireRateLimit(
          options,
          "sign_out",
          actorSubjectHash,
          occurredAt,
        );
        requireApplied(
          await options.store.signOut({
            context: buildContext(
              options,
              metadata,
              occurredAt,
              "sign_out",
              JSON.stringify({ tokenDigest: current?.tokenDigest ?? null }),
              actorSubjectHash,
            ),
            currentTokenDigest: current?.tokenDigest ?? null,
          }),
        );
      } catch (error) {
        mapAccessError(error);
      }
    },

    async revokeAllSessions(sessionToken, request, metadata) {
      try {
        if (request.confirmation !== "revoke_all") {
          throw accessError("REQUEST_INVALID");
        }
        const occurredAt = options.clock.now();
        const current = sessionIdentity(options, sessionToken);
        await requireRateLimit(
          options,
          "revoke_all",
          current.actorSubjectHash,
          occurredAt,
        );
        const result = requireApplied(
          await options.store.revokeAllSessions({
            context: buildContext(
              options,
              metadata,
              occurredAt,
              "revoke_all_sessions",
              JSON.stringify(request),
              current.actorSubjectHash,
            ),
            currentTokenDigest: current.tokenDigest,
          }),
        );
        if (result.value.status !== "sessions_revoked") {
          throw accessError("SESSION_INVALID");
        }
      } catch (error) {
        mapAccessError(error);
      }
    },

    async requestPasswordReset(request, metadata) {
      try {
        const occurredAt = options.clock.now();
        const email = normalizeIdentityEmail(request.email);
        await requireRateLimit(
          options,
          "reset_request_ip",
          options.cryptography.subjectHash("ip", metadata.ipSubject),
          occurredAt,
        );
        const emailSubjectHash = options.cryptography.subjectHash(
          "email",
          email,
        );
        await requireRateLimit(
          options,
          "reset_request_email",
          emailSubjectHash,
          occurredAt,
        );
        const generated = options.cryptography.createPasswordResetChallenge();
        requireApplied(
          await options.store.requestPasswordReset({
            challenge: Object.freeze({
              challengeId: generated.challengeId,
              codeDigest: generated.codeDigest,
              expiresAt: new Date(
                occurredAt.valueOf() + IDENTITY_POLICY.challenge.ttlMs,
              ),
              keyVersion: generated.keyVersion,
            }),
            context: buildContext(
              options,
              metadata,
              occurredAt,
              "request_password_reset",
              JSON.stringify({ email }),
              emailSubjectHash,
            ),
            deliveryEmail: email,
            email,
            outboxId: options.cryptography.createId(),
          }),
        );
        return PASSWORD_RESET_REQUESTED;
      } catch (error) {
        mapAccessError(error);
      }
    },

    async confirmPasswordReset(request, metadata) {
      try {
        const occurredAt = options.clock.now();
        const email = normalizeIdentityEmail(request.email);
        await requireRateLimit(
          options,
          "reset_confirm_ip",
          options.cryptography.subjectHash("ip", metadata.ipSubject),
          occurredAt,
        );
        const reference = await options.store.findPasswordResetChallenge(email);
        const dummy =
          reference === null
            ? options.cryptography.createPasswordResetChallenge()
            : null;
        const challengeId = reference?.challengeId ?? dummy?.challengeId;
        const keyVersion = reference?.keyVersion ?? dummy?.keyVersion;
        if (challengeId === undefined || keyVersion === undefined) {
          throw accessError("DELIVERY_UNAVAILABLE");
        }
        const challengeSubjectHash = options.cryptography.subjectHash(
          "challenge",
          challengeId,
        );
        await requireRateLimit(
          options,
          "reset_challenge",
          challengeSubjectHash,
          occurredAt,
        );
        const context = buildContext(
          options,
          metadata,
          occurredAt,
          "confirm_password_reset",
          JSON.stringify(request),
          challengeSubjectHash,
        );
        const observedMatch = options.cryptography.matchesPasswordResetCode(
          challengeId,
          request.code,
          reference?.codeDigest ?? dummy?.codeDigest ?? "",
          keyVersion,
        );
        const matches = reference !== null && observedMatch;
        if (!matches) {
          requireApplied(
            await options.store.rejectPasswordReset({ challengeId, context }),
          );
          throw accessError("PASSWORD_RESET_INVALID");
        }
        const password = normalizeIdentityPassword(
          request.newPassword,
          options.blocklist,
        );
        const passwordHash = await options.passwordHasher.hash(password);
        const result = requireApplied(
          await options.store.confirmPasswordReset({
            challengeId,
            context,
            credentialVersion: reference.credentialVersion,
            passwordHash,
          }),
        );
        if (result.value.status !== "password_reset") {
          throw accessError("PASSWORD_RESET_INVALID");
        }
        return PASSWORD_RESET_COMPLETED;
      } catch (error) {
        mapAccessError(error);
      }
    },
  };

  return Object.freeze(service);
}
