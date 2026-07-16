import { createHmac, timingSafeEqual } from "node:crypto";

const KEY_MINIMUM_BYTES = 32;
const MAX_ASSERTION_AGE_MS = 30_000;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const ISSUED_AT_PATTERN = /^[1-9][0-9]{9}$/u;

export interface IdentityClientSubjectAssertion {
  readonly issuedAt: string;
  readonly signature: string;
  readonly subject: string;
}

interface VerifyIdentityClientSubjectAssertionOptions {
  readonly key: Uint8Array;
  readonly now: Date;
}

function requireKey(key: Uint8Array): Buffer {
  if (!(key instanceof Uint8Array) || key.byteLength < KEY_MINIMUM_BYTES) {
    throw new TypeError("BFF assertion key must contain at least 32 bytes");
  }
  return Buffer.from(key);
}

function expectedSignature(
  key: Uint8Array,
  subject: string,
  issuedAt: string,
): Buffer {
  const hmac = createHmac("sha256", key);
  hmac.update("identity-bff-client-assertion-v1", "utf8");
  hmac.update(Buffer.from([0]));
  hmac.update(subject, "utf8");
  hmac.update(Buffer.from([0]));
  hmac.update(issuedAt, "utf8");
  return hmac.digest();
}

export function verifyIdentityClientSubjectAssertion(
  assertion: IdentityClientSubjectAssertion,
  options: VerifyIdentityClientSubjectAssertionOptions,
): string | null {
  const key = requireKey(options.key);
  if (
    !HASH_PATTERN.test(assertion.subject) ||
    !HASH_PATTERN.test(assertion.signature) ||
    !ISSUED_AT_PATTERN.test(assertion.issuedAt) ||
    !Number.isFinite(options.now.valueOf())
  ) {
    return null;
  }
  const ageMs = options.now.valueOf() - Number(assertion.issuedAt) * 1_000;
  if (ageMs < 0 || ageMs > MAX_ASSERTION_AGE_MS) return null;

  const expected = expectedSignature(
    key,
    assertion.subject,
    assertion.issuedAt,
  );
  const observed = Buffer.from(assertion.signature, "hex");
  return timingSafeEqual(expected, observed) ? assertion.subject : null;
}
