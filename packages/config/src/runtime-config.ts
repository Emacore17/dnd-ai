import { isIP } from "node:net";
import { URL } from "node:url";

import { z } from "zod";

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export const runtimeEnvironments = ["local", "staging", "production"] as const;

export type RuntimeEnvironment = (typeof runtimeEnvironments)[number];
export type ConfigurationService = "api" | "migration" | "worker";

export interface ApiRuntimeConfig {
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
}

export interface WorkerRuntimeConfig {
  readonly environment: RuntimeEnvironment;
  readonly databaseUrl: string;
  readonly redisUrl: string;
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

const hostSchema = requiredTextSchema.refine(isValidHost);

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

const apiEnvironmentSchema = z
  .object({
    APP_ENV: runtimeEnvironmentSchema,
    API_HOST: hostSchema,
    API_PORT: portSchema,
    API_DATABASE_URL: postgresUrlSchema,
    API_REDIS_URL: redisUrlSchema,
  })
  .superRefine((environment, context) => {
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

const workerEnvironmentSchema = z
  .object({
    APP_ENV: runtimeEnvironmentSchema,
    WORKER_DATABASE_URL: postgresUrlSchema,
    WORKER_REDIS_URL: redisUrlSchema,
  })
  .superRefine((environment, context) => {
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
