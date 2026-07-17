import type {
  IdentityChallengeId,
  IdentityChallengeMaterial,
  IdentityEmail,
  IdentityId,
  IdentityMutationResult,
  IdentityRateLimitDecision,
  IdentityRequestContext,
  IdentitySessionId,
  IdentitySessionMaterial,
  PasswordHash,
} from "./types.js";
import type {
  IdentityAccessRateLimitScope,
  IdentityRateLimitCommand,
} from "./ports.js";

export interface IdentityAccessCredential {
  readonly userId: IdentityId;
  readonly email: IdentityEmail;
  readonly status: "active" | "pending";
  readonly passwordHash: PasswordHash;
  readonly credentialVersion: number;
}

export interface IdentityPasswordResetReference {
  readonly challengeId: IdentityChallengeId;
  readonly codeDigest: string;
  readonly keyVersion: number;
  readonly userId: IdentityId;
  readonly credentialVersion: number;
}

export type IdentitySessionAccessValue =
  | Readonly<{
      readonly status: "authenticated";
      readonly sessionId: IdentitySessionId;
      readonly keyVersion: number;
      readonly absoluteExpiresAt: Date;
    }>
  | Readonly<{
      readonly status: "credentials_invalid" | "session_invalid";
    }>;

export type IdentitySessionActionValue =
  | Readonly<{ readonly status: "sessions_revoked" }>
  | Readonly<{ readonly status: "session_invalid" }>;

export type IdentityPasswordResetValue =
  | Readonly<{ readonly status: "password_reset" }>
  | Readonly<{ readonly status: "invalid" }>;

export interface IdentitySignInCommand {
  readonly context: IdentityRequestContext;
  readonly userId: IdentityId;
  readonly credentialVersion: number;
  readonly session: IdentitySessionMaterial;
}

export interface IdentityRefreshSessionCommand {
  readonly context: IdentityRequestContext;
  readonly currentTokenDigest: string;
  readonly session: IdentitySessionMaterial;
}

export interface IdentitySignOutCommand {
  readonly context: IdentityRequestContext;
  readonly currentTokenDigest: string | null;
}

export interface IdentityRevokeAllSessionsCommand {
  readonly context: IdentityRequestContext;
  readonly currentTokenDigest: string;
}

export interface IdentityPasswordResetRequestCommand {
  readonly context: IdentityRequestContext;
  readonly email: IdentityEmail;
  readonly deliveryEmail: string;
  readonly challenge: IdentityChallengeMaterial;
  readonly outboxId: IdentityId;
}

export interface IdentityPasswordResetRejectCommand {
  readonly context: IdentityRequestContext;
  readonly challengeId: IdentityChallengeId;
}

export interface IdentityPasswordResetConfirmCommand {
  readonly context: IdentityRequestContext;
  readonly challengeId: IdentityChallengeId;
  readonly credentialVersion: number;
  readonly passwordHash: PasswordHash;
}

export interface IdentityAccessStore {
  consumeRateLimit(
    command: IdentityRateLimitCommand<IdentityAccessRateLimitScope>,
  ): Promise<IdentityRateLimitDecision>;
  findSignInCredential(
    email: IdentityEmail,
  ): Promise<IdentityAccessCredential | null>;
  signIn(
    command: IdentitySignInCommand,
  ): Promise<IdentityMutationResult<IdentitySessionAccessValue>>;
  refreshSession(
    command: IdentityRefreshSessionCommand,
  ): Promise<IdentityMutationResult<IdentitySessionAccessValue>>;
  signOut(
    command: IdentitySignOutCommand,
  ): Promise<
    IdentityMutationResult<Readonly<{ readonly status: "signed_out" }>>
  >;
  revokeAllSessions(
    command: IdentityRevokeAllSessionsCommand,
  ): Promise<IdentityMutationResult<IdentitySessionActionValue>>;
  requestPasswordReset(
    command: IdentityPasswordResetRequestCommand,
  ): Promise<IdentityMutationResult<Readonly<{ readonly accepted: true }>>>;
  findPasswordResetChallenge(
    email: IdentityEmail,
  ): Promise<IdentityPasswordResetReference | null>;
  rejectPasswordReset(
    command: IdentityPasswordResetRejectCommand,
  ): Promise<IdentityMutationResult<Readonly<{ readonly status: "invalid" }>>>;
  confirmPasswordReset(
    command: IdentityPasswordResetConfirmCommand,
  ): Promise<IdentityMutationResult<IdentityPasswordResetValue>>;
}
