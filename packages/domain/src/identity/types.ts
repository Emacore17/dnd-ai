declare const identityEmailBrand: unique symbol;
declare const identityIdBrand: unique symbol;
declare const identitySessionIdBrand: unique symbol;
declare const identityChallengeIdBrand: unique symbol;

export type IdentityEmail = string & { readonly [identityEmailBrand]: true };
export type IdentityId = string & { readonly [identityIdBrand]: true };
export type IdentitySessionId = string & {
  readonly [identitySessionIdBrand]: true;
};
export type IdentityChallengeId = string & {
  readonly [identityChallengeIdBrand]: true;
};

export interface PasswordHash {
  readonly phc: string;
  readonly pepperVersion: number;
}

export interface IdentitySessionExpiry {
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export interface IdentityRateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds?: number;
}

export interface IdentityRequestContext {
  readonly idempotencyId: IdentityId;
  readonly requestId: string;
  readonly correlationId: string;
  readonly actorSubjectHash: string;
  readonly idempotencyKeyDigest: string;
  readonly requestFingerprint: string;
  readonly occurredAt: Date;
}

export interface IdentityChallengeMaterial {
  readonly challengeId: IdentityChallengeId;
  readonly codeDigest: string;
  readonly keyVersion: number;
  readonly expiresAt: Date;
}

export interface IdentitySessionMaterial extends IdentitySessionExpiry {
  readonly sessionId: IdentitySessionId;
  readonly tokenDigest: string;
  readonly keyVersion: number;
}

export type IdentityMutationResult<Success> =
  | Readonly<{ readonly kind: "applied"; readonly value: Success }>
  | Readonly<{ readonly kind: "replayed"; readonly value: Success }>
  | Readonly<{ readonly kind: "idempotency_conflict" }>;

export type IdentityVerifyEmailValue =
  | Readonly<{
      readonly status: "verified";
      readonly sessionId: IdentitySessionId;
      readonly keyVersion: number;
      readonly absoluteExpiresAt: Date;
    }>
  | Readonly<{
      readonly status:
        "already_verified" | "attempts_exhausted" | "expired" | "invalid_code";
    }>;
