import { Buffer } from "node:buffer";
import { isIP } from "node:net";
import { URL } from "node:url";

import { z } from "zod";

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export const runtimeEnvironments = ["local", "staging", "production"] as const;

export type RuntimeEnvironment = (typeof runtimeEnvironments)[number];
export type ConfigurationService = "api" | "migration" | "web" | "worker";

export interface VersionedSecret {
  readonly key: Uint8Array;
  readonly version: number;
}

export interface ApiIdentityRuntimeConfig {
  readonly passwordPepper: VersionedSecret;
  readonly challenge: VersionedSecret;
  readonly session: VersionedSecret;
  readonly subjectHashKey: Uint8Array;
  readonly bffAssertionKey: Uint8Array;
}

export interface ApiRuntimeConfig {
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly publicOrigin: string;
  readonly identity: ApiIdentityRuntimeConfig;
  readonly sentryDsn?: string;
}

export type WorkerEmailDeliveryConfig =
  | Readonly<{ readonly mode: "fake" }>
  | Readonly<{
      readonly mode: "smtp";
      readonly host: string;
      readonly port: number;
      readonly secure: boolean;
      readonly username: string;
      readonly password: string;
      readonly from: string;
    }>;

export interface WorkerRuntimeConfig {
  readonly environment: RuntimeEnvironment;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly identity: Readonly<{ readonly challenge: VersionedSecret }>;
  readonly emailDelivery: WorkerEmailDeliveryConfig;
  readonly sentryDsn?: string;
}

export interface WebRuntimeConfig {
  readonly environment: RuntimeEnvironment;
  readonly apiInternalOrigin: string;
  readonly bffAssertionKey: Uint8Array;
}

export interface MigrationRuntimeConfig {
  readonly environment: RuntimeEnvironment;
  readonly databaseUrl: string;
}

export class RuntimeConfigurationError extends Error {
  readonly service: ConfigurationService;
  readonly invalidKeys: readonly string[];

  constructor(service: ConfigurationService, invalidKeys: readonly string[]) {
    const safeKeys = Object.freeze([...new Set(invalidKeys)].sort());
    super(
      `Invalid runtime configuration for ${service}: ${safeKeys.join(", ")}`,
    );
    this.name = "RuntimeConfigurationError";
    this.service = service;
    this.invalidKeys = safeKeys;
  }
}

const runtimeEnvironmentSchema = z.enum(runtimeEnvironments);
const requiredTextSchema = z.string().trim().min(1);
const portSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,4}$/u)
  .transform(Number)
  .refine((port) => port <= 65_535);
const positiveVersionSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,8}$/u)
  .transform(Number);
const booleanTextSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

function isAsciiAlphaNumeric(character: string): boolean {
  const code = character.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isValidHostLabel(label: string): boolean {
  if (
    label.length === 0 ||
    label.length > 63 ||
    !isAsciiAlphaNumeric(label[0] ?? "") ||
    !isAsciiAlphaNumeric(label.at(-1) ?? "")
  ) {
    return false;
  }

  return [...label].every(
    (character) => character === "-" || isAsciiAlphaNumeric(character),
  );
}

function isValidHost(value: string): boolean {
  if (value === "localhost" || isIP(value) !== 0) {
    return true;
  }

  return (
    value.length <= 253 &&
    value.split(".").every((label) => isValidHostLabel(label))
  );
}

function isValidUrlHost(hostname: string): boolean {
  const unwrappedHostname =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  return isValidHost(unwrappedHostname);
}

function isValidOrigin(value: string): boolean {
  const url = parseUrl(value);
  return (
    url !== null &&
    (url.protocol === "http:" || url.protocol === "https:") &&
    isValidUrlHost(url.hostname) &&
    url.username.length === 0 &&
    url.password.length === 0 &&
    (url.pathname === "" || url.pathname === "/") &&
    url.search.length === 0 &&
    url.hash.length === 0
  );
}

function isCanonicalBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) {
    return false;
  }

  const firstPaddingIndex = value.indexOf("=");
  const content =
    firstPaddingIndex === -1 ? value : value.slice(0, firstPaddingIndex);
  const padding =
    firstPaddingIndex === -1 ? "" : value.slice(firstPaddingIndex);
  if (
    padding.length > 2 ||
    [...padding].some((character) => character !== "=")
  ) {
    return false;
  }
  if (
    [...content].some((character) => {
      const code = character.charCodeAt(0);
      return !(
        (code >= 48 && code <= 57) ||
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        character === "+" ||
        character === "/"
      );
    })
  ) {
    return false;
  }

  const decoded = Buffer.from(value, "base64");
  return decoded.byteLength >= 32 && decoded.toString("base64") === value;
}

const hostSchema = requiredTextSchema.refine(isValidHost);
const originSchema = requiredTextSchema
  .refine(isValidOrigin)
  .transform((value) => new URL(value).origin);
const secretSchema = requiredTextSchema
  .refine(isCanonicalBase64)
  .transform((value) => Uint8Array.from(Buffer.from(value, "base64")));

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isPostgresUrl(value: string): boolean {
  const url = parseUrl(value);
  return (
    url !== null &&
    (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
    isValidUrlHost(url.hostname) &&
    url.username.length > 0 &&
    url.pathname.length > 1
  );
}

function isRedisUrl(value: string): boolean {
  const url = parseUrl(value);
  return (
    url !== null &&
    (url.protocol === "redis:" || url.protocol === "rediss:") &&
    isValidUrlHost(url.hostname)
  );
}

function isSentryDsn(value: string): boolean {
  const url = parseUrl(value);
  const projectId = url?.pathname.split("/").at(-1) ?? "";

  return (
    url !== null &&
    url.protocol === "https:" &&
    isValidUrlHost(url.hostname) &&
    url.username.length > 0 &&
    url.password.length === 0 &&
    /^[1-9]\d*$/u.test(projectId)
  );
}

function requestsPostgresTls(value: string): boolean {
  const sslModes = parseUrl(value)?.searchParams.getAll("sslmode") ?? [];
  const sslMode = sslModes[0];
  return (
    sslModes.length === 1 &&
    (sslMode === "require" ||
      sslMode === "verify-ca" ||
      sslMode === "verify-full")
  );
}

function requestsRedisTls(value: string): boolean {
  return parseUrl(value)?.protocol === "rediss:";
}

function containsPasswordCredential(value: string): boolean {
  return (parseUrl(value)?.password.length ?? 0) > 0;
}

const postgresUrlSchema = requiredTextSchema.refine(isPostgresUrl);
const redisUrlSchema = requiredTextSchema.refine(isRedisUrl);
const optionalSentryDsnSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  requiredTextSchema.refine(isSentryDsn).optional(),
);

function requiresTlsOrigin(
  environment: RuntimeEnvironment,
  value: string,
): boolean {
  return environment === "local" || new URL(value).protocol === "https:";
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

const apiEnvironmentSchema = z
  .object({
    APP_ENV: runtimeEnvironmentSchema,
    API_HOST: hostSchema,
    API_PORT: portSchema,
    API_DATABASE_URL: postgresUrlSchema,
    API_REDIS_URL: redisUrlSchema,
    API_PUBLIC_ORIGIN: originSchema,
    API_AUTH_PASSWORD_PEPPER_BASE64: secretSchema,
    API_AUTH_PASSWORD_PEPPER_VERSION: positiveVersionSchema,
    API_AUTH_CHALLENGE_HMAC_KEY_BASE64: secretSchema,
    API_AUTH_CHALLENGE_KEY_VERSION: positiveVersionSchema,
    API_AUTH_SESSION_HMAC_KEY_BASE64: secretSchema,
    API_AUTH_SESSION_KEY_VERSION: positiveVersionSchema,
    API_AUTH_SUBJECT_HASH_KEY_BASE64: secretSchema,
    API_AUTH_BFF_ASSERTION_KEY_BASE64: secretSchema,
    API_SENTRY_DSN: optionalSentryDsnSchema,
  })
  .superRefine((environment, context) => {
    if (
      !requiresTlsOrigin(environment.APP_ENV, environment.API_PUBLIC_ORIGIN)
    ) {
      context.addIssue({
        code: "custom",
        message: "managed public origins require HTTPS",
        path: ["API_PUBLIC_ORIGIN"],
      });
    }

    const secrets = [
      [
        "API_AUTH_PASSWORD_PEPPER_BASE64",
        environment.API_AUTH_PASSWORD_PEPPER_BASE64,
      ],
      [
        "API_AUTH_CHALLENGE_HMAC_KEY_BASE64",
        environment.API_AUTH_CHALLENGE_HMAC_KEY_BASE64,
      ],
      [
        "API_AUTH_SESSION_HMAC_KEY_BASE64",
        environment.API_AUTH_SESSION_HMAC_KEY_BASE64,
      ],
      [
        "API_AUTH_SUBJECT_HASH_KEY_BASE64",
        environment.API_AUTH_SUBJECT_HASH_KEY_BASE64,
      ],
      [
        "API_AUTH_BFF_ASSERTION_KEY_BASE64",
        environment.API_AUTH_BFF_ASSERTION_KEY_BASE64,
      ],
    ] as const;
    const observedSecrets: Array<(typeof secrets)[number]> = [];
    for (const candidate of secrets) {
      for (const observed of observedSecrets) {
        if (equalBytes(observed[1], candidate[1])) {
          context.addIssue({
            code: "custom",
            message: "identity secrets must be logically distinct",
            path: [candidate[0]],
          });
        }
      }
      observedSecrets.push(candidate);
    }

    if (environment.APP_ENV === "local") {
      return;
    }

    if (
      !requestsPostgresTls(environment.API_DATABASE_URL) ||
      !containsPasswordCredential(environment.API_DATABASE_URL)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "managed PostgreSQL connections require TLS and authentication",
        path: ["API_DATABASE_URL"],
      });
    }

    if (
      !requestsRedisTls(environment.API_REDIS_URL) ||
      !containsPasswordCredential(environment.API_REDIS_URL)
    ) {
      context.addIssue({
        code: "custom",
        message: "managed Redis connections require TLS and authentication",
        path: ["API_REDIS_URL"],
      });
    }
  });

const workerBaseEnvironmentSchema = z.object({
  APP_ENV: runtimeEnvironmentSchema,
  WORKER_DATABASE_URL: postgresUrlSchema,
  WORKER_REDIS_URL: redisUrlSchema,
  WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64: secretSchema,
  WORKER_AUTH_CHALLENGE_KEY_VERSION: positiveVersionSchema,
  WORKER_SENTRY_DSN: optionalSentryDsnSchema,
});

const workerEnvironmentSchema = z
  .discriminatedUnion("WORKER_EMAIL_DELIVERY_MODE", [
    workerBaseEnvironmentSchema.extend({
      WORKER_EMAIL_DELIVERY_MODE: z.literal("fake"),
    }),
    workerBaseEnvironmentSchema.extend({
      WORKER_EMAIL_DELIVERY_MODE: z.literal("smtp"),
      WORKER_SMTP_HOST: hostSchema,
      WORKER_SMTP_PORT: portSchema,
      WORKER_SMTP_SECURE: booleanTextSchema,
      WORKER_SMTP_USERNAME: requiredTextSchema,
      WORKER_SMTP_PASSWORD: requiredTextSchema,
      WORKER_SMTP_FROM: requiredTextSchema.max(320),
    }),
  ])
  .superRefine((environment, context) => {
    if (
      environment.APP_ENV !== "local" &&
      environment.WORKER_EMAIL_DELIVERY_MODE === "fake"
    ) {
      context.addIssue({
        code: "custom",
        message: "managed workers require SMTP delivery",
        path: ["WORKER_EMAIL_DELIVERY_MODE"],
      });
    }

    if (environment.APP_ENV === "local") {
      return;
    }

    if (
      !requestsPostgresTls(environment.WORKER_DATABASE_URL) ||
      !containsPasswordCredential(environment.WORKER_DATABASE_URL)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "managed PostgreSQL connections require TLS and authentication",
        path: ["WORKER_DATABASE_URL"],
      });
    }

    if (
      !requestsRedisTls(environment.WORKER_REDIS_URL) ||
      !containsPasswordCredential(environment.WORKER_REDIS_URL)
    ) {
      context.addIssue({
        code: "custom",
        message: "managed Redis connections require TLS and authentication",
        path: ["WORKER_REDIS_URL"],
      });
    }
  });

const webEnvironmentSchema = z
  .object({
    APP_ENV: runtimeEnvironmentSchema,
    WEB_API_INTERNAL_ORIGIN: originSchema,
    WEB_AUTH_BFF_ASSERTION_KEY_BASE64: secretSchema,
  })
  .superRefine((environment, context) => {
    if (
      !requiresTlsOrigin(
        environment.APP_ENV,
        environment.WEB_API_INTERNAL_ORIGIN,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "managed internal API origins require HTTPS",
        path: ["WEB_API_INTERNAL_ORIGIN"],
      });
    }
  });

const migrationEnvironmentSchema = z
  .object({
    APP_ENV: runtimeEnvironmentSchema,
    MIGRATION_DATABASE_URL: postgresUrlSchema,
  })
  .superRefine((environment, context) => {
    if (
      environment.APP_ENV !== "local" &&
      (!requestsPostgresTls(environment.MIGRATION_DATABASE_URL) ||
        !containsPasswordCredential(environment.MIGRATION_DATABASE_URL))
    ) {
      context.addIssue({
        code: "custom",
        message:
          "managed PostgreSQL connections require TLS and authentication",
        path: ["MIGRATION_DATABASE_URL"],
      });
    }
  });

function invalidKeys(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const key = issue.path[0];
    return typeof key === "string" ? key : "CONFIGURATION";
  });
}

function parseEnvironment<Output>(
  service: ConfigurationService,
  schema: z.ZodType<Output>,
  environment: EnvironmentSource,
): Output {
  const result = schema.safeParse(environment);

  if (!result.success) {
    throw new RuntimeConfigurationError(service, invalidKeys(result.error));
  }

  return result.data;
}

export function parseApiRuntimeConfig(
  environment: EnvironmentSource,
): ApiRuntimeConfig {
  const parsed = parseEnvironment("api", apiEnvironmentSchema, environment);

  return Object.freeze({
    environment: parsed.APP_ENV,
    host: parsed.API_HOST,
    port: parsed.API_PORT,
    databaseUrl: parsed.API_DATABASE_URL,
    redisUrl: parsed.API_REDIS_URL,
    publicOrigin: parsed.API_PUBLIC_ORIGIN,
    identity: Object.freeze({
      passwordPepper: Object.freeze({
        key: parsed.API_AUTH_PASSWORD_PEPPER_BASE64,
        version: parsed.API_AUTH_PASSWORD_PEPPER_VERSION,
      }),
      challenge: Object.freeze({
        key: parsed.API_AUTH_CHALLENGE_HMAC_KEY_BASE64,
        version: parsed.API_AUTH_CHALLENGE_KEY_VERSION,
      }),
      session: Object.freeze({
        key: parsed.API_AUTH_SESSION_HMAC_KEY_BASE64,
        version: parsed.API_AUTH_SESSION_KEY_VERSION,
      }),
      subjectHashKey: parsed.API_AUTH_SUBJECT_HASH_KEY_BASE64,
      bffAssertionKey: parsed.API_AUTH_BFF_ASSERTION_KEY_BASE64,
    }),
    ...(parsed.API_SENTRY_DSN === undefined
      ? {}
      : { sentryDsn: parsed.API_SENTRY_DSN }),
  });
}

export function parseWorkerRuntimeConfig(
  environment: EnvironmentSource,
): WorkerRuntimeConfig {
  const parsed = parseEnvironment(
    "worker",
    workerEnvironmentSchema,
    environment,
  );

  return Object.freeze({
    environment: parsed.APP_ENV,
    databaseUrl: parsed.WORKER_DATABASE_URL,
    redisUrl: parsed.WORKER_REDIS_URL,
    identity: Object.freeze({
      challenge: Object.freeze({
        key: parsed.WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64,
        version: parsed.WORKER_AUTH_CHALLENGE_KEY_VERSION,
      }),
    }),
    emailDelivery:
      parsed.WORKER_EMAIL_DELIVERY_MODE === "fake"
        ? Object.freeze({ mode: "fake" as const })
        : Object.freeze({
            mode: "smtp" as const,
            host: parsed.WORKER_SMTP_HOST,
            port: parsed.WORKER_SMTP_PORT,
            secure: parsed.WORKER_SMTP_SECURE,
            username: parsed.WORKER_SMTP_USERNAME,
            password: parsed.WORKER_SMTP_PASSWORD,
            from: parsed.WORKER_SMTP_FROM,
          }),
    ...(parsed.WORKER_SENTRY_DSN === undefined
      ? {}
      : { sentryDsn: parsed.WORKER_SENTRY_DSN }),
  });
}

export function parseWebRuntimeConfig(
  environment: EnvironmentSource,
): WebRuntimeConfig {
  const parsed = parseEnvironment("web", webEnvironmentSchema, environment);

  return Object.freeze({
    environment: parsed.APP_ENV,
    apiInternalOrigin: parsed.WEB_API_INTERNAL_ORIGIN,
    bffAssertionKey: parsed.WEB_AUTH_BFF_ASSERTION_KEY_BASE64,
  });
}

export function parseMigrationRuntimeConfig(
  environment: EnvironmentSource,
): MigrationRuntimeConfig {
  const parsed = parseEnvironment(
    "migration",
    migrationEnvironmentSchema,
    environment,
  );

  return Object.freeze({
    environment: parsed.APP_ENV,
    databaseUrl: parsed.MIGRATION_DATABASE_URL,
  });
}
