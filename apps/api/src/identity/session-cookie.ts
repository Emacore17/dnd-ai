import { Buffer } from "node:buffer";

const COOKIE_NAME = "__Host-dnd_ai_session";
const MAX_AGE_SECONDS = 2_592_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const ERROR_MESSAGE = "identity session cookie is invalid";

export interface CreateIdentitySessionCookieOptions {
  readonly absoluteExpiresAt: Date;
  readonly now: Date;
  readonly token: string;
}

function isDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.valueOf());
}

function isCanonicalToken(value: string): boolean {
  if (!TOKEN_PATTERN.test(value)) return false;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.byteLength === 32 && decoded.toString("base64url") === value;
  } catch {
    return false;
  }
}

export function createIdentitySessionCookie(
  options: CreateIdentitySessionCookieOptions,
): string {
  if (
    !isDate(options.now) ||
    !isDate(options.absoluteExpiresAt) ||
    !isCanonicalToken(options.token)
  ) {
    throw new TypeError(ERROR_MESSAGE);
  }
  const remainingSeconds = Math.floor(
    (options.absoluteExpiresAt.valueOf() - options.now.valueOf()) / 1_000,
  );
  if (remainingSeconds <= 0) throw new TypeError(ERROR_MESSAGE);
  const maxAge = Math.min(MAX_AGE_SECONDS, remainingSeconds);
  return `${COOKIE_NAME}=${options.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function parseIdentitySessionCookie(value: string): string | null {
  if (typeof value !== "string") return null;
  const parts = value.split("; ");
  if (parts.length !== 6) return null;
  const [pair, path, httpOnly, secure, sameSite, maxAge] = parts;
  const prefix = `${COOKIE_NAME}=`;
  if (
    pair === undefined ||
    !pair.startsWith(prefix) ||
    path !== "Path=/" ||
    httpOnly !== "HttpOnly" ||
    secure !== "Secure" ||
    sameSite !== "SameSite=Lax" ||
    maxAge === undefined ||
    !maxAge.startsWith("Max-Age=")
  ) {
    return null;
  }
  const token = pair.slice(prefix.length);
  const seconds = maxAge.slice("Max-Age=".length);
  if (!/^[1-9]\d{0,7}$/u.test(seconds)) return null;
  const numericSeconds = Number(seconds);
  return isCanonicalToken(token) && numericSeconds <= MAX_AGE_SECONDS
    ? token
    : null;
}
