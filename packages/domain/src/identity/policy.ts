import { IdentityPolicyError } from "./errors.js";
import type { PasswordBlocklist } from "./ports.js";
import type { IdentityEmail } from "./types.js";

const passwordPolicy = Object.freeze({
  minCharacters: 15,
  maxCharacters: 128,
  normalization: "NFC" as const,
});
const displayNamePolicy = Object.freeze({
  minCharacters: 2,
  maxCharacters: 40,
  normalization: "NFC" as const,
});
const challengePolicy = Object.freeze({
  digits: 6,
  ttlMs: 600_000,
  maxAttempts: 5,
  resendCooldownMs: 60_000,
});
const sessionPolicy = Object.freeze({
  idleTtlMs: 86_400_000,
  absoluteTtlMs: 2_592_000_000,
});
const idempotencyPolicy = Object.freeze({ ttlMs: 86_400_000 });

export const IDENTITY_POLICY = Object.freeze({
  password: passwordPolicy,
  displayName: displayNamePolicy,
  challenge: challengePolicy,
  session: sessionPolicy,
  idempotency: idempotencyPolicy,
});

function characterCount(value: string): number {
  return [...value].length;
}

function utf8ByteCount(value: string): number {
  return [...value].reduce((total, character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) return total + 1;
    if (codePoint <= 0x7ff) return total + 2;
    if (codePoint <= 0xffff) return total + 3;
    return total + 4;
  }, 0);
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    );
  });
}

export function normalizeIdentityDisplayName(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("display name must be a string");
  }

  if (hasControlCharacter(value)) {
    throw new IdentityPolicyError("identity.display_name_control");
  }

  const normalized = value.normalize("NFC").trim();
  const length = characterCount(normalized);
  if (
    length < IDENTITY_POLICY.displayName.minCharacters ||
    length > IDENTITY_POLICY.displayName.maxCharacters
  ) {
    throw new IdentityPolicyError("identity.display_name_length");
  }

  return normalized;
}

export function normalizeIdentityEmail(value: string): IdentityEmail {
  if (typeof value !== "string" || hasControlCharacter(value)) {
    throw new IdentityPolicyError("identity.email_invalid");
  }
  const normalized = value.trim().toLowerCase();
  const segments = normalized.split("@");
  if (
    segments.length !== 2 ||
    segments[0]?.length === 0 ||
    segments[1]?.length === 0 ||
    [...normalized].some((character) => /\s/u.test(character)) ||
    utf8ByteCount(normalized) > 254
  ) {
    throw new IdentityPolicyError("identity.email_invalid");
  }
  return normalized as IdentityEmail;
}

export function normalizeIdentityPassword(
  value: string,
  blocklist: PasswordBlocklist,
): string {
  if (typeof value !== "string") {
    throw new TypeError("password must be a string");
  }
  if (typeof blocklist?.contains !== "function") {
    throw new TypeError("password blocklist is required");
  }

  const normalized = value.normalize("NFC");
  const length = characterCount(normalized);
  if (
    length < IDENTITY_POLICY.password.minCharacters ||
    length > IDENTITY_POLICY.password.maxCharacters
  ) {
    throw new IdentityPolicyError("identity.password_length");
  }
  if (blocklist.contains(normalized)) {
    throw new IdentityPolicyError("identity.password_common");
  }

  return normalized;
}
