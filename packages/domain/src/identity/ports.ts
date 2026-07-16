import type {
  IdentityChallengeId,
  IdentityChallengeMaterial,
  IdentityEmail,
  IdentityMutationResult,
  IdentityRateLimitDecision,
  IdentityRequestContext,
  IdentitySessionMaterial,
  IdentitySessionId,
  IdentityId,
  IdentityVerifyEmailValue,
  PasswordHash,
} from "./types.js";

export interface IdentityRateLimitCommand {
  readonly scope:
    | "signup_ip"
    | "signup_email"
    | "verify_ip"
    | "verify_challenge"
    | "resend_ip"
    | "resend_email";
  readonly subjectHash: string;
  readonly occurredAt: Date;
}

export interface IdentitySignUpCommand {
  readonly context: IdentityRequestContext;
  readonly email: IdentityEmail;
  readonly deliveryEmail: string;
  readonly displayName: string;
  readonly passwordHash: PasswordHash;
  readonly challenge: IdentityChallengeMaterial;
  readonly userId: IdentityId;
  readonly outboxId: IdentityId;
}

export interface IdentityVerifyEmailCommand {
  readonly context: IdentityRequestContext;
  readonly email: IdentityEmail;
  readonly challengeId: IdentityChallengeId;
  readonly codeDigest: string;
  readonly session: IdentitySessionMaterial;
}

export interface IdentityResendVerificationCommand {
  readonly context: IdentityRequestContext;
  readonly email: IdentityEmail;
  readonly challenge: IdentityChallengeMaterial;
  readonly outboxId: IdentityId;
}

export interface IdentityVerificationChallengeReference {
  readonly challengeId: IdentityChallengeId;
  readonly keyVersion: number;
}

export interface IdentityStore {
  consumeRateLimit(
    command: IdentityRateLimitCommand,
  ): Promise<IdentityRateLimitDecision>;
  findVerificationChallenge(
    email: IdentityEmail,
  ): Promise<IdentityVerificationChallengeReference | null>;
  signUp(
    command: IdentitySignUpCommand,
  ): Promise<IdentityMutationResult<Readonly<{ readonly accepted: true }>>>;
  verifyEmail(
    command: IdentityVerifyEmailCommand,
  ): Promise<IdentityMutationResult<IdentityVerifyEmailValue>>;
  resendVerification(
    command: IdentityResendVerificationCommand,
  ): Promise<IdentityMutationResult<Readonly<{ readonly accepted: true }>>>;
}

export interface PasswordBlocklist {
  contains(normalizedPassword: string): boolean;
}

export interface PasswordHasher {
  hash(password: string): Promise<PasswordHash>;
  verify(password: string, stored: PasswordHash): Promise<boolean>;
}

export interface IdentityClock {
  now(): Date;
}

export interface IdentityRandomSource {
  bytes(length: number): Uint8Array;
}

export interface IdentityCryptography {
  createId(): IdentityId;
  createChallenge(): Readonly<{
    challengeId: IdentityChallengeId;
    code: string;
    codeDigest: string;
    keyVersion: number;
  }>;
  createSession(): Readonly<{
    sessionId: IdentitySessionId;
    token: string;
    tokenDigest: string;
    keyVersion: number;
  }>;
  deriveChallengeCodeDigest(
    challengeId: IdentityChallengeId,
    code: string,
    keyVersion: number,
  ): string;
  deriveSessionToken(sessionId: IdentitySessionId, keyVersion: number): string;
  subjectHash(kind: "challenge" | "email" | "ip", value: string): string;
  requestFingerprint(endpoint: string, canonicalPayload: string): string;
  idempotencyKeyDigest(key: string): string;
}
