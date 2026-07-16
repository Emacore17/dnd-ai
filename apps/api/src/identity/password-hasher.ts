import { createHmac } from "node:crypto";

import type { PasswordHash, PasswordHasher } from "@dnd-ai/domain";
import { argon2id, hash, verify } from "argon2";

const ARGON2_OPTIONS = Object.freeze({
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

export interface Argon2PasswordHasherOptions {
  readonly pepper: Uint8Array;
  readonly pepperVersion: number;
}

function prehash(pepper: Uint8Array, password: string): Buffer {
  const hmac = createHmac("sha256", pepper);
  hmac.update("identity-password-v1", "utf8");
  hmac.update(Buffer.from([0]));
  hmac.update(password.normalize("NFC"), "utf8");
  return hmac.digest();
}

export function createArgon2PasswordHasher(
  options: Argon2PasswordHasherOptions,
): PasswordHasher {
  if (
    !(options.pepper instanceof Uint8Array) ||
    options.pepper.byteLength < 32
  ) {
    throw new TypeError("password pepper must contain at least 32 bytes");
  }
  if (
    !Number.isSafeInteger(options.pepperVersion) ||
    options.pepperVersion <= 0
  ) {
    throw new TypeError("password pepper version must be a positive integer");
  }
  const pepper = Buffer.from(options.pepper);

  return Object.freeze({
    async hash(password: string): Promise<PasswordHash> {
      const digest = prehash(pepper, password);
      try {
        return Object.freeze({
          phc: await hash(digest, ARGON2_OPTIONS),
          pepperVersion: options.pepperVersion,
        });
      } finally {
        digest.fill(0);
      }
    },
    async verify(password: string, stored: PasswordHash): Promise<boolean> {
      if (
        stored.pepperVersion !== options.pepperVersion ||
        typeof stored.phc !== "string" ||
        !stored.phc.startsWith("$argon2id$")
      ) {
        return false;
      }

      const digest = prehash(pepper, password);
      try {
        return await verify(stored.phc, digest).catch(() => false);
      } finally {
        digest.fill(0);
      }
    },
  });
}
