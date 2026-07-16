import { createHmac } from "node:crypto";

const CODE_SPACE = 1_000_000;
const UINT32_ACCEPTANCE_LIMIT =
  Math.floor(0x1_0000_0000 / CODE_SPACE) * CODE_SPACE;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function requireKey(value: Uint8Array): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength < 32) {
    throw new TypeError("challenge key must contain at least 32 bytes");
  }
  return Buffer.from(value);
}

function domainHmac(key: Uint8Array, ...parts: readonly string[]): Buffer {
  const hmac = createHmac("sha256", key);
  for (const [index, part] of parts.entries()) {
    if (index > 0) hmac.update(Buffer.from([0]));
    hmac.update(part, "utf8");
  }
  return hmac.digest();
}

export function deriveWorkerVerificationCode(
  challengeKey: Uint8Array,
  challengeId: string,
): string {
  const key = requireKey(challengeKey);
  if (!UUID_PATTERN.test(challengeId)) {
    throw new TypeError("challenge ID must be a canonical UUID v4");
  }

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
