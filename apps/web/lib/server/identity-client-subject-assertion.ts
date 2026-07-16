import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const KEY_MINIMUM_BYTES = 32;

export interface IdentityClientSubjectAssertion {
  readonly issuedAt: string;
  readonly signature: string;
  readonly subject: string;
}

interface CreateIdentityClientSubjectAssertionOptions {
  readonly clientIp: string;
  readonly issuedAt: Date;
  readonly key: Uint8Array;
}

function requireKey(key: Uint8Array): Buffer {
  if (!(key instanceof Uint8Array) || key.byteLength < KEY_MINIMUM_BYTES) {
    throw new TypeError("BFF assertion key must contain at least 32 bytes");
  }
  return Buffer.from(key);
}

function domainHmac(key: Uint8Array, ...parts: readonly string[]): string {
  const hmac = createHmac("sha256", key);
  for (const [index, part] of parts.entries()) {
    if (index > 0) hmac.update(Buffer.from([0]));
    hmac.update(part, "utf8");
  }
  return hmac.digest("hex");
}

export function createIdentityClientSubjectAssertion(
  options: CreateIdentityClientSubjectAssertionOptions,
): IdentityClientSubjectAssertion {
  const key = requireKey(options.key);
  if (isIP(options.clientIp) === 0) {
    throw new TypeError("trusted client IP is invalid");
  }
  const issuedAtMilliseconds = options.issuedAt.valueOf();
  if (!Number.isFinite(issuedAtMilliseconds)) {
    throw new TypeError("BFF assertion time is invalid");
  }
  const issuedAt = String(Math.floor(issuedAtMilliseconds / 1_000));
  const subject = domainHmac(
    key,
    "identity-bff-client-subject-v1",
    options.clientIp,
  );
  return Object.freeze({
    issuedAt,
    signature: domainHmac(
      key,
      "identity-bff-client-assertion-v1",
      subject,
      issuedAt,
    ),
    subject,
  });
}
