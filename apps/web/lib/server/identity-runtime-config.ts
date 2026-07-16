import { Buffer } from "node:buffer";
import { isIP } from "node:net";

export type WebIdentityEnvironmentSource = Readonly<
  Record<string, string | undefined>
>;

export interface WebIdentityRuntimeConfig {
  readonly apiInternalOrigin: string;
  readonly bffAssertionKey: Uint8Array;
  readonly environment: "local" | "production" | "staging";
}

function isAsciiAlphaNumeric(character: string): boolean {
  const code = character.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function validHost(hostname: string): boolean {
  if (isIP(hostname.replace(/^\[|\]$/gu, "")) !== 0) return true;
  if (hostname.length === 0 || hostname.length > 253) return false;
  return hostname.split(".").every((label) => {
    return (
      label.length > 0 &&
      label.length <= 63 &&
      isAsciiAlphaNumeric(label[0] ?? "") &&
      isAsciiAlphaNumeric(label.at(-1) ?? "") &&
      [...label].every(
        (character) => isAsciiAlphaNumeric(character) || character === "-",
      )
    );
  });
}

function parseOrigin(
  value: string | undefined,
  environment: WebIdentityRuntimeConfig["environment"],
): string | null {
  if (value === undefined || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      !validHost(parsed.hostname) ||
      parsed.username.length !== 0 ||
      parsed.password.length !== 0 ||
      parsed.pathname !== "/" ||
      parsed.search.length !== 0 ||
      parsed.hash.length !== 0 ||
      (environment !== "local" && parsed.protocol !== "https:")
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function parseSecret(value: string | undefined): Uint8Array | null {
  if (
    value === undefined ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)
  ) {
    return null;
  }
  const decoded = Buffer.from(value, "base64");
  return decoded.byteLength >= 32 && decoded.toString("base64") === value
    ? Uint8Array.from(decoded)
    : null;
}

export function parseWebIdentityRuntimeConfig(
  environment: WebIdentityEnvironmentSource,
): WebIdentityRuntimeConfig {
  const runtimeEnvironment = environment.APP_ENV;
  if (
    runtimeEnvironment !== "local" &&
    runtimeEnvironment !== "staging" &&
    runtimeEnvironment !== "production"
  ) {
    throw new Error("Invalid identity BFF runtime configuration.");
  }
  const apiInternalOrigin = parseOrigin(
    environment.WEB_API_INTERNAL_ORIGIN,
    runtimeEnvironment,
  );
  const bffAssertionKey = parseSecret(
    environment.WEB_AUTH_BFF_ASSERTION_KEY_BASE64,
  );
  if (apiInternalOrigin === null || bffAssertionKey === null) {
    throw new Error("Invalid identity BFF runtime configuration.");
  }
  return Object.freeze({
    apiInternalOrigin,
    bffAssertionKey,
    environment: runtimeEnvironment,
  });
}
