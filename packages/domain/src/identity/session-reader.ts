import type { IdentityId, IdentitySessionId } from "./types.js";

export interface ActiveIdentitySession {
  readonly sessionId: IdentitySessionId;
  readonly userId: IdentityId;
}

export interface IdentitySessionReader {
  resolveActiveSession(
    tokenDigest: string,
    occurredAt: Date,
  ): Promise<ActiveIdentitySession | null>;
}
