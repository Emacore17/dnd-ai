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

export type IdentityRegistrationRateLimitScope =
  | "signup_ip"
  | "signup_email"
  | "verify_ip"
  | "verify_challenge"
  | "resend_ip"
  | "resend_email";

export type IdentityAccessRateLimitScope =
  | "sign_in_ip"
  | "sign_in_email"
  | "refresh_session"
  | "sign_out"
  | "revoke_all"
  | "reset_request_ip"
  | "reset_request_email"
  | "reset_confirm_ip"
  | "reset_challenge";

export type IdentityRateLimitScope =
  IdentityRegistrationRateLimitScope | IdentityAccessRateLimitScope;

export interface IdentityRateLimitCommand<
  Scope extends IdentityRateLimitScope = IdentityRateLimitScope,
> {
  readonly scope: Scope;
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
    command: IdentityRateLimitCommand<IdentityRegistrationRateLimitScope>,
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
  createPasswordResetChallenge(): Readonly<{
    challengeId: IdentityChallengeId;
    code: string;
    codeDigest: string;
    keyVersion: number;
  }>;
  deriveChallengeCodeDigest(
    challengeId: IdentityChallengeId,
    code: string,
    keyVersion: number,
  ): string;
  deriveSessionToken(sessionId: IdentitySessionId, keyVersion: number): string;
  derivePasswordResetCodeDigest(
    challengeId: IdentityChallengeId,
    code: string,
    keyVersion: number,
  ): string;
  matchesPasswordResetCode(
    challengeId: IdentityChallengeId,
    code: string,
    expectedDigest: string,
    keyVersion: number,
  ): boolean;
  sessionTokenDigest(token: string): string;
  subjectHash(
    kind: "challenge" | "email" | "ip" | "session",
    value: string,
  ): string;
  requestFingerprint(endpoint: string, canonicalPayload: string): string;
  idempotencyKeyDigest(key: string): string;
}
