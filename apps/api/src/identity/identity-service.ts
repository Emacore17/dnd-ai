import type {
  ResendVerificationRequest,
  SignUpRequest,
  VerificationRequiredResponse,
  VerifyEmailRequest,
} from "@dnd-ai/contracts";
import {
  IDENTITY_POLICY,
  IdentityPolicyError,
  normalizeIdentityDisplayName,
  normalizeIdentityEmail,
  normalizeIdentityPassword,
  type IdentityChallengeId,
  type IdentityClock,
  type IdentityCryptography,
  type IdentityRequestContext,
  type IdentityStore,
  type PasswordBlocklist,
  type PasswordHasher,
} from "@dnd-ai/domain";
import { IdentityPersistenceError } from "@dnd-ai/persistence";

export type IdentityApplicationErrorCode =
  | "CREDENTIALS_INVALID"
  | "DELIVERY_UNAVAILABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "PASSWORD_REJECTED"
  | "PASSWORD_RESET_INVALID"
  | "RATE_LIMITED"
  | "REQUEST_INVALID"
  | "SESSION_INVALID"
  | "VERIFICATION_EXPIRED"
  | "VERIFICATION_INVALID"
  | "VERIFICATION_RATE_LIMITED";

export class IdentityApplicationError extends Error {
  readonly code: IdentityApplicationErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(
    code: IdentityApplicationErrorCode,
    message: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "IdentityApplicationError";
    this.code = code;
    if (retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
}

export interface IdentityRequestMetadata {
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly ipSubject: string;
  readonly requestId: string;
}

export interface VerifiedIdentityResult {
  readonly absoluteExpiresAt: Date;
  readonly sessionToken: string;
  readonly status: "verified";
}

export interface IdentityService {
  signUp(
    request: SignUpRequest,
    metadata: IdentityRequestMetadata,
  ): Promise<VerificationRequiredResponse>;
  verifyEmail(
    request: VerifyEmailRequest,
    metadata: IdentityRequestMetadata,
  ): Promise<VerifiedIdentityResult>;
  resendVerification(
    request: ResendVerificationRequest,
    metadata: IdentityRequestMetadata,
  ): Promise<VerificationRequiredResponse>;
}

interface CreateIdentityServiceOptions {
  readonly blocklist: PasswordBlocklist;
  readonly clock: IdentityClock;
  readonly cryptography: IdentityCryptography;
  readonly passwordHasher: PasswordHasher;
  readonly store: IdentityStore;
}

const VERIFICATION_REQUIRED_RESPONSE = Object.freeze({
  challengeExpiresInSeconds: 600,
  resendAfterSeconds: 60,
  status: "verification_required" as const,
});

function applicationError(
  code: IdentityApplicationErrorCode,
  retryAfterSeconds?: number,
): IdentityApplicationError {
  switch (code) {
    case "CREDENTIALS_INVALID":
      return new IdentityApplicationError(
        code,
        "Identity credentials are invalid.",
      );
    case "DELIVERY_UNAVAILABLE":
      return new IdentityApplicationError(
        code,
        "Identity delivery is temporarily unavailable.",
      );
    case "IDEMPOTENCY_CONFLICT":
      return new IdentityApplicationError(
        code,
        "Identity request conflicts with a prior request.",
      );
    case "PASSWORD_REJECTED":
      return new IdentityApplicationError(
        code,
        "The password does not meet the identity policy.",
      );
    case "PASSWORD_RESET_INVALID":
      return new IdentityApplicationError(
        code,
        "Identity password reset code is invalid.",
      );
    case "RATE_LIMITED":
      return new IdentityApplicationError(
        code,
        "Identity request rate limit exceeded.",
        retryAfterSeconds,
      );
    case "REQUEST_INVALID":
      return new IdentityApplicationError(code, "Identity request is invalid.");
    case "SESSION_INVALID":
      return new IdentityApplicationError(code, "Identity session is invalid.");
    case "VERIFICATION_EXPIRED":
      return new IdentityApplicationError(
        code,
        "Identity verification has expired.",
      );
    case "VERIFICATION_INVALID":
      return new IdentityApplicationError(
        code,
        "Identity verification is invalid.",
      );
    case "VERIFICATION_RATE_LIMITED":
      return new IdentityApplicationError(
        code,
        "Identity verification rate limit exceeded.",
        retryAfterSeconds,
      );
  }
}

function mapInfrastructureError(error: unknown): never {
  if (error instanceof IdentityApplicationError) throw error;
  if (error instanceof IdentityPolicyError) {
    throw applicationError(
      error.code.startsWith("identity.password")
        ? "PASSWORD_REJECTED"
        : "REQUEST_INVALID",
    );
  }
  if (error instanceof IdentityPersistenceError) {
    throw applicationError(
      error.code === "IDEMPOTENCY_CONFLICT"
        ? "IDEMPOTENCY_CONFLICT"
        : error.code === "INVALID_COMMAND"
          ? "REQUEST_INVALID"
          : "DELIVERY_UNAVAILABLE",
    );
  }
  throw applicationError("DELIVERY_UNAVAILABLE");
}

function buildContext(
  options: CreateIdentityServiceOptions,
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
  options: CreateIdentityServiceOptions,
  scope: Parameters<IdentityStore["consumeRateLimit"]>[0]["scope"],
  subjectHash: string,
  occurredAt: Date,
  errorCode: "RATE_LIMITED" | "VERIFICATION_RATE_LIMITED",
): Promise<void> {
  const decision = await options.store.consumeRateLimit({
    occurredAt,
    scope,
    subjectHash,
  });
  if (!decision.allowed) {
    throw applicationError(errorCode, decision.retryAfterSeconds);
  }
}

export function createIdentityService(
  options: CreateIdentityServiceOptions,
): IdentityService {
  return Object.freeze({
    async signUp(
      request: SignUpRequest,
      metadata: IdentityRequestMetadata,
    ): Promise<VerificationRequiredResponse> {
      try {
        const occurredAt = options.clock.now();
        const email = normalizeIdentityEmail(request.email);
        await requireRateLimit(
          options,
          "signup_ip",
          options.cryptography.subjectHash("ip", metadata.ipSubject),
          occurredAt,
          "RATE_LIMITED",
        );
        const emailSubjectHash = options.cryptography.subjectHash(
          "email",
          email,
        );
        await requireRateLimit(
          options,
          "signup_email",
          emailSubjectHash,
          occurredAt,
          "RATE_LIMITED",
        );
        const displayName = normalizeIdentityDisplayName(request.displayName);
        const password = normalizeIdentityPassword(
          request.password,
          options.blocklist,
        );
        const passwordHash = await options.passwordHasher.hash(password);
        const generatedChallenge = options.cryptography.createChallenge();
        const context = buildContext(
          options,
          metadata,
          occurredAt,
          "sign_up",
          JSON.stringify({ displayName, email, password }),
          emailSubjectHash,
        );
        const result = await options.store.signUp({
          challenge: Object.freeze({
            challengeId: generatedChallenge.challengeId,
            codeDigest: generatedChallenge.codeDigest,
            expiresAt: new Date(
              occurredAt.valueOf() + IDENTITY_POLICY.challenge.ttlMs,
            ),
            keyVersion: generatedChallenge.keyVersion,
          }),
          context,
          deliveryEmail: email,
          displayName,
          email,
          outboxId: options.cryptography.createId(),
          passwordHash,
          userId: options.cryptography.createId(),
        });
        if (result.kind === "idempotency_conflict") {
          throw applicationError("IDEMPOTENCY_CONFLICT");
        }
        return VERIFICATION_REQUIRED_RESPONSE;
      } catch (error) {
        mapInfrastructureError(error);
      }
    },

    async verifyEmail(
      request: VerifyEmailRequest,
      metadata: IdentityRequestMetadata,
    ): Promise<VerifiedIdentityResult> {
      try {
        const occurredAt = options.clock.now();
        const email = normalizeIdentityEmail(request.email);
        await requireRateLimit(
          options,
          "verify_ip",
          options.cryptography.subjectHash("ip", metadata.ipSubject),
          occurredAt,
          "VERIFICATION_RATE_LIMITED",
        );
        const reference = await options.store.findVerificationChallenge(email);
        const dummy =
          reference === null ? options.cryptography.createChallenge() : null;
        const challengeId = (reference?.challengeId ??
          dummy?.challengeId) as IdentityChallengeId;
        const keyVersion = reference?.keyVersion ?? dummy?.keyVersion;
        if (keyVersion === undefined) {
          throw applicationError("DELIVERY_UNAVAILABLE");
        }
        await requireRateLimit(
          options,
          "verify_challenge",
          options.cryptography.subjectHash("challenge", challengeId),
          occurredAt,
          "VERIFICATION_RATE_LIMITED",
        );
        const generatedSession = options.cryptography.createSession();
        const context = buildContext(
          options,
          metadata,
          occurredAt,
          "verify_email",
          JSON.stringify({ code: request.code, email }),
          options.cryptography.subjectHash("email", email),
        );
        const result = await options.store.verifyEmail({
          challengeId,
          codeDigest: options.cryptography.deriveChallengeCodeDigest(
            challengeId,
            request.code,
            keyVersion,
          ),
          context,
          email,
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
        });
        if (result.kind === "idempotency_conflict") {
          throw applicationError("IDEMPOTENCY_CONFLICT");
        }
        switch (result.value.status) {
          case "verified":
            return Object.freeze({
              absoluteExpiresAt: result.value.absoluteExpiresAt,
              sessionToken: options.cryptography.deriveSessionToken(
                result.value.sessionId,
                result.value.keyVersion,
              ),
              status: "verified" as const,
            });
          case "expired":
            throw applicationError("VERIFICATION_EXPIRED");
          case "attempts_exhausted":
            throw applicationError("VERIFICATION_RATE_LIMITED");
          case "already_verified":
          case "invalid_code":
            throw applicationError("VERIFICATION_INVALID");
        }
      } catch (error) {
        mapInfrastructureError(error);
      }
    },

    async resendVerification(
      request: ResendVerificationRequest,
      metadata: IdentityRequestMetadata,
    ): Promise<VerificationRequiredResponse> {
      try {
        const occurredAt = options.clock.now();
        const email = normalizeIdentityEmail(request.email);
        await requireRateLimit(
          options,
          "resend_ip",
          options.cryptography.subjectHash("ip", metadata.ipSubject),
          occurredAt,
          "RATE_LIMITED",
        );
        const emailSubjectHash = options.cryptography.subjectHash(
          "email",
          email,
        );
        await requireRateLimit(
          options,
          "resend_email",
          emailSubjectHash,
          occurredAt,
          "RATE_LIMITED",
        );
        const generatedChallenge = options.cryptography.createChallenge();
        const context = buildContext(
          options,
          metadata,
          occurredAt,
          "resend_verification",
          JSON.stringify({ email }),
          emailSubjectHash,
        );
        const result = await options.store.resendVerification({
          challenge: Object.freeze({
            challengeId: generatedChallenge.challengeId,
            codeDigest: generatedChallenge.codeDigest,
            expiresAt: new Date(
              occurredAt.valueOf() + IDENTITY_POLICY.challenge.ttlMs,
            ),
            keyVersion: generatedChallenge.keyVersion,
          }),
          context,
          email,
          outboxId: options.cryptography.createId(),
        });
        if (result.kind === "idempotency_conflict") {
          throw applicationError("IDEMPOTENCY_CONFLICT");
        }
        return VERIFICATION_REQUIRED_RESPONSE;
      } catch (error) {
        mapInfrastructureError(error);
      }
    },
  });
}
