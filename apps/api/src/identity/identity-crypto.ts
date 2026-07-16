import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type {
  IdentityChallengeId,
  IdentityCryptography,
  IdentityId,
  IdentitySessionId,
} from "@dnd-ai/domain";

const IDENTIFIER_BYTES = 16;
const CODE_SPACE = 1_000_000;
const UINT32_ACCEPTANCE_LIMIT =
  Math.floor(0x1_0000_0000 / CODE_SPACE) * CODE_SPACE;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;

export interface NodeIdentityCryptographyOptions {
  readonly challengeKey: Uint8Array;
  readonly challengeKeyVersion: number;
  readonly sessionKey: Uint8Array;
  readonly sessionKeyVersion: number;
  readonly subjectHashKey: Uint8Array;
  readonly randomBytes: (length: number) => Uint8Array;
}

function requireKey(value: Uint8Array, name: string): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength < 32) {
    throw new TypeError(`${name} must contain at least 32 bytes`);
  }
  return Buffer.from(value);
}

function requireVersion(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function domainHmac(key: Uint8Array, ...parts: readonly string[]): Buffer {
  const hmac = createHmac("sha256", key);
  for (const [index, part] of parts.entries()) {
    if (index > 0) hmac.update(Buffer.from([0]));
    hmac.update(part, "utf8");
  }
  return hmac.digest();
}

function uuidV4FromBytes(value: Uint8Array): string {
  if (!(value instanceof Uint8Array) || value.byteLength !== IDENTIFIER_BYTES) {
    throw new TypeError("identity random source must return exactly 16 bytes");
  }

  const bytes = Uint8Array.from(value);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requireChallengeId(challengeId: string): void {
  if (!UUID_PATTERN.test(challengeId)) {
    throw new TypeError("challenge ID must be a canonical UUID v4");
  }
}

function deriveSessionTokenValue(
  sessionKey: Uint8Array,
  sessionId: string,
): Buffer {
  requireChallengeId(sessionId);
  return domainHmac(sessionKey, "identity-session-token-v1", sessionId);
}

export function deriveVerificationCode(
  challengeKey: Uint8Array,
  challengeId: string,
): string {
  const key = requireKey(challengeKey, "challenge key");
  requireChallengeId(challengeId);

  for (let counter = 0; counter < Number.MAX_SAFE_INTEGER; counter += 1) {
    const digest = domainHmac(
      key,
      "identity-email-verification-code-v1",
      challengeId,
      String(counter),
    );
    for (let offset = 0; offset <= digest.byteLength - 4; offset += 4) {
      const candidate = digest.readUInt32BE(offset);
      if (candidate < UINT32_ACCEPTANCE_LIMIT) {
        return String(candidate % CODE_SPACE).padStart(6, "0");
      }
    }
  }

  throw new Error("verification code derivation exhausted counter space");
}

export function deriveVerificationCodeDigest(
  challengeKey: Uint8Array,
  challengeId: string,
  code: string,
): string {
  const key = requireKey(challengeKey, "challenge key");
  requireChallengeId(challengeId);
  if (!/^[0-9]{6}$/u.test(code)) {
    throw new TypeError("verification code must contain six digits");
  }
  return domainHmac(
    key,
    "identity-email-verification-digest-v1",
    challengeId,
    code,
  ).toString("hex");
}

export function createNodeIdentityCryptography(
  options: NodeIdentityCryptographyOptions,
): IdentityCryptography & {
  verifyChallengeCode(
    challengeId: string,
    code: string,
    expectedDigest: string,
  ): boolean;
} {
  const challengeKey = requireKey(options.challengeKey, "challenge key");
  const sessionKey = requireKey(options.sessionKey, "session key");
  const subjectHashKey = requireKey(options.subjectHashKey, "subject hash key");
  const challengeKeyVersion = requireVersion(
    options.challengeKeyVersion,
    "challenge key version",
  );
  const sessionKeyVersion = requireVersion(
    options.sessionKeyVersion,
    "session key version",
  );
  if (typeof options.randomBytes !== "function") {
    throw new TypeError("identity random source is required");
  }

  return Object.freeze({
    createId() {
      return uuidV4FromBytes(
        options.randomBytes(IDENTIFIER_BYTES),
      ) as IdentityId;
    },
    createChallenge() {
      const challengeId = uuidV4FromBytes(
        options.randomBytes(IDENTIFIER_BYTES),
      ) as IdentityChallengeId;
      const code = deriveVerificationCode(challengeKey, challengeId);
      return Object.freeze({
        challengeId,
        code,
        codeDigest: deriveVerificationCodeDigest(
          challengeKey,
          challengeId,
          code,
        ),
        keyVersion: challengeKeyVersion,
      });
    },
    createSession() {
      const sessionId = uuidV4FromBytes(
        options.randomBytes(IDENTIFIER_BYTES),
      ) as IdentitySessionId;
      const tokenBytes = deriveSessionTokenValue(sessionKey, sessionId);
      return Object.freeze({
        sessionId,
        token: tokenBytes.toString("base64url"),
        tokenDigest: createHash("sha256").update(tokenBytes).digest("hex"),
        keyVersion: sessionKeyVersion,
      });
    },
    deriveChallengeCodeDigest(
      challengeId: IdentityChallengeId,
      code: string,
      keyVersion: number,
    ) {
      if (keyVersion !== challengeKeyVersion) {
        throw new TypeError("challenge key version is unavailable");
      }
      return deriveVerificationCodeDigest(challengeKey, challengeId, code);
    },
    deriveSessionToken(sessionId: IdentitySessionId, keyVersion: number) {
      if (keyVersion !== sessionKeyVersion) {
        throw new TypeError("session key version is unavailable");
      }
      return deriveSessionTokenValue(sessionKey, sessionId).toString(
        "base64url",
      );
    },
    subjectHash(kind: "challenge" | "email" | "ip", value: string) {
      return domainHmac(
        subjectHashKey,
        `identity-subject-${kind}-v1`,
        value,
      ).toString("hex");
    },
    requestFingerprint(endpoint: string, canonicalPayload: string) {
      return domainHmac(
        subjectHashKey,
        "identity-request-fingerprint-v1",
        endpoint,
        canonicalPayload,
      ).toString("hex");
    },
    idempotencyKeyDigest(key: string) {
      return domainHmac(
        subjectHashKey,
        "identity-idempotency-key-v1",
        key,
      ).toString("hex");
    },
    verifyChallengeCode(
      challengeId: string,
      code: string,
      expectedDigest: string,
    ) {
      if (!SHA256_HEX_PATTERN.test(expectedDigest)) return false;
      try {
        const observed = Buffer.from(
          deriveVerificationCodeDigest(challengeKey, challengeId, code),
          "hex",
        );
        return timingSafeEqual(observed, Buffer.from(expectedDigest, "hex"));
      } catch {
        return false;
      }
    },
  });
}
