import { createHash } from "node:crypto";

import { Pool, type PoolClient } from "pg";

const featureFlagCatalog = [
  Object.freeze({
    key: "campaign.start",
    owner: "platform",
    defaultEnabled: false,
    description: "Controls creation of new campaigns.",
  }),
  Object.freeze({
    key: "turn.new",
    owner: "platform",
    defaultEnabled: false,
    description: "Controls acceptance of new player turns.",
  }),
  Object.freeze({
    key: "model.route.premium",
    owner: "ai-platform",
    defaultEnabled: false,
    description: "Controls the internal premium model route.",
  }),
] as const;

export const FEATURE_FLAG_CATALOG = Object.freeze([...featureFlagCatalog]);

export type FeatureFlagKey = (typeof FEATURE_FLAG_CATALOG)[number]["key"];

export type FeatureFlagReasonCode =
  | "budget_guardrail"
  | "incident_response"
  | "maintenance"
  | "operator_request"
  | "provider_outage"
  | "rollback"
  | "security_response";

export type FeatureGateDecisionReason =
  | "disabled"
  | "enabled"
  | "malformed_store_state"
  | "store_unavailable"
  | "unknown_flag";

export type FeatureGateDecisionSource = "safe_default" | "store";
export type FeatureFlagErrorCode =
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_COMMAND"
  | "STORE_UNAVAILABLE"
  | "UNKNOWN_FLAG"
  | "VERSION_CONFLICT";

export interface FeatureFlagState {
  readonly key: FeatureFlagKey;
  readonly enabled: boolean;
  readonly defaultEnabled: boolean;
  readonly owner: string;
  readonly reasonCode: FeatureFlagReasonCode;
  readonly updatedAt: Date;
  readonly updatedBy: string;
  readonly version: number;
}

export interface FeatureFlagReader {
  readFeatureFlag(key: FeatureFlagKey): Promise<FeatureFlagState>;
}

export interface FeatureFlagChangeCommand {
  readonly key: string;
  readonly enabled: boolean;
  readonly actorId: string;
  readonly reasonCode: FeatureFlagReasonCode;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly expectedVersion?: number;
}

export interface FeatureFlagChangeResult {
  readonly auditEventId: number;
  readonly idempotentReplay: boolean;
  readonly state: FeatureFlagState;
}

export interface FeatureFlagStore extends FeatureFlagReader {
  changeFeatureFlag(
    command: FeatureFlagChangeCommand,
  ): Promise<FeatureFlagChangeResult>;
  close(): Promise<void>;
}

export interface FeatureGateDecision {
  readonly key: string;
  readonly enabled: boolean;
  readonly reason: FeatureGateDecisionReason;
  readonly source: FeatureGateDecisionSource;
  readonly version?: number;
}

const FEATURE_FLAG_KEYS = new Set<string>(
  FEATURE_FLAG_CATALOG.map(({ key }) => key),
);
const FEATURE_FLAG_REASON_CODES = new Set<string>([
  "budget_guardrail",
  "incident_response",
  "maintenance",
  "operator_request",
  "provider_outage",
  "rollback",
  "security_response",
]);
const OPERATOR_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_:@./-]{2,127}$/u;
const REQUEST_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/u;
const CONNECTION_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 15_000;
const IDLE_TRANSACTION_TIMEOUT_MS = 15_000;

export class FeatureFlagError extends Error {
  readonly code: FeatureFlagErrorCode;

  constructor(code: FeatureFlagErrorCode, message: string) {
    super(message);
    this.name = "FeatureFlagError";
    this.code = code;
  }
}

interface FeatureFlagRow {
  readonly flag_key: string;
  readonly enabled: boolean;
  readonly default_enabled: boolean;
  readonly version: string;
  readonly owner: string;
  readonly updated_by: string;
  readonly updated_reason_code: string;
  readonly updated_at: Date;
}

interface FeatureFlagEventRow {
  readonly event_id: string;
  readonly flag_key: string;
  readonly command_hash: string;
  readonly resulting_version: string;
  readonly enabled: boolean;
  readonly actor_id: string;
  readonly reason_code: string;
  readonly created_at: Date;
  readonly default_enabled: boolean;
  readonly owner: string;
}

interface CreatePostgresFeatureFlagStoreOptions {
  readonly databaseUrl: string;
}

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return FEATURE_FLAG_KEYS.has(value);
}

function isFeatureFlagReasonCode(
  value: string,
): value is FeatureFlagReasonCode {
  return FEATURE_FLAG_REASON_CODES.has(value);
}

function safeDefaultDecision(
  key: string,
  reason: Exclude<FeatureGateDecisionReason, "disabled" | "enabled">,
): FeatureGateDecision {
  return Object.freeze({
    enabled: false,
    key,
    reason,
    source: "safe_default",
  });
}

function isWellFormedState(
  state: FeatureFlagState,
  expectedKey: FeatureFlagKey,
): boolean {
  return (
    state.key === expectedKey &&
    typeof state.enabled === "boolean" &&
    state.defaultEnabled === false &&
    Number.isSafeInteger(state.version) &&
    state.version >= 0 &&
    state.updatedAt instanceof Date &&
    !Number.isNaN(state.updatedAt.valueOf())
  );
}

export async function evaluateFeatureGate(
  store: FeatureFlagReader,
  key: string,
): Promise<FeatureGateDecision> {
  if (!isFeatureFlagKey(key)) {
    return safeDefaultDecision(key, "unknown_flag");
  }

  try {
    const state = await store.readFeatureFlag(key);

    if (!isWellFormedState(state, key)) {
      return safeDefaultDecision(key, "malformed_store_state");
    }

    return Object.freeze({
      enabled: state.enabled,
      key,
      reason: state.enabled ? "enabled" : "disabled",
      source: "store",
      version: state.version,
    });
  } catch {
    return safeDefaultDecision(key, "store_unavailable");
  }
}

function redactedError(code: FeatureFlagErrorCode): FeatureFlagError {
  switch (code) {
    case "IDEMPOTENCY_CONFLICT":
      return new FeatureFlagError(
        code,
        "Feature flag command idempotency key conflicts with a previous command.",
      );
    case "INVALID_COMMAND":
      return new FeatureFlagError(code, "Feature flag command is invalid.");
    case "STORE_UNAVAILABLE":
      return new FeatureFlagError(code, "Feature flag store operation failed.");
    case "UNKNOWN_FLAG":
      return new FeatureFlagError(code, "Feature flag key is not cataloged.");
    case "VERSION_CONFLICT":
      return new FeatureFlagError(
        code,
        "Feature flag version does not match the expected value.",
      );
  }
}

function toSafeInteger(value: string | number): number {
  if (typeof value === "string" && !/^(0|[1-9]\d*)$/u.test(value)) {
    throw redactedError("STORE_UNAVAILABLE");
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isSafeInteger(numericValue) || numericValue < 0) {
    throw redactedError("STORE_UNAVAILABLE");
  }

  return numericValue;
}

function stateFromRow(row: FeatureFlagRow): FeatureFlagState {
  if (
    !isFeatureFlagKey(row.flag_key) ||
    !isFeatureFlagReasonCode(row.updated_reason_code)
  ) {
    throw redactedError("STORE_UNAVAILABLE");
  }

  return Object.freeze({
    defaultEnabled: row.default_enabled,
    enabled: row.enabled,
    key: row.flag_key,
    owner: row.owner,
    reasonCode: row.updated_reason_code,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    version: toSafeInteger(row.version),
  });
}

function stateFromReplayEventRow(row: FeatureFlagEventRow): FeatureFlagState {
  if (
    !isFeatureFlagKey(row.flag_key) ||
    !isFeatureFlagReasonCode(row.reason_code)
  ) {
    throw redactedError("STORE_UNAVAILABLE");
  }

  return Object.freeze({
    defaultEnabled: row.default_enabled,
    enabled: row.enabled,
    key: row.flag_key,
    owner: row.owner,
    reasonCode: row.reason_code,
    updatedAt: row.created_at,
    updatedBy: row.actor_id,
    version: toSafeInteger(row.resulting_version),
  });
}

function defaultState(key: FeatureFlagKey): FeatureFlagState {
  const catalogEntry = FEATURE_FLAG_CATALOG.find((entry) => entry.key === key);

  if (!catalogEntry) {
    throw redactedError("UNKNOWN_FLAG");
  }

  return Object.freeze({
    defaultEnabled: false,
    enabled: false,
    key,
    owner: catalogEntry.owner,
    reasonCode: "operator_request",
    updatedAt: new Date(0),
    updatedBy: "system:default",
    version: 0,
  });
}

async function readFeatureFlagWithClient(
  client: PoolClient,
  key: FeatureFlagKey,
  lock: boolean,
): Promise<FeatureFlagState> {
  const result = await client.query<FeatureFlagRow>(
    `
      SELECT flag_key,
             enabled,
             default_enabled,
             version,
             owner,
             updated_by,
             updated_reason_code,
             updated_at
        FROM app.feature_flags
       WHERE flag_key = $1
       ${lock ? "FOR UPDATE" : ""}
    `,
    [key],
  );
  const row = result.rows[0];

  return row ? stateFromRow(row) : defaultState(key);
}

function validateCommand(
  command: FeatureFlagChangeCommand,
): FeatureFlagChangeCommand & { readonly key: FeatureFlagKey } {
  if (!isFeatureFlagKey(command.key)) {
    throw redactedError("UNKNOWN_FLAG");
  }

  if (
    typeof command.enabled !== "boolean" ||
    !OPERATOR_IDENTIFIER_PATTERN.test(command.actorId) ||
    !REQUEST_IDENTIFIER_PATTERN.test(command.idempotencyKey) ||
    !REQUEST_IDENTIFIER_PATTERN.test(command.correlationId) ||
    !isFeatureFlagReasonCode(command.reasonCode) ||
    (command.expectedVersion !== undefined &&
      (!Number.isSafeInteger(command.expectedVersion) ||
        command.expectedVersion < 0))
  ) {
    throw redactedError("INVALID_COMMAND");
  }

  return { ...command, key: command.key };
}

function commandHash(
  command: FeatureFlagChangeCommand & { readonly key: FeatureFlagKey },
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        actorId: command.actorId,
        correlationId: command.correlationId,
        enabled: command.enabled,
        expectedVersion: command.expectedVersion ?? null,
        idempotencyKey: command.idempotencyKey,
        key: command.key,
        reasonCode: command.reasonCode,
      }),
      "utf8",
    )
    .digest("hex");
}

function wrapStoreError(error: unknown): never {
  if (error instanceof FeatureFlagError) {
    throw error;
  }

  throw redactedError("STORE_UNAVAILABLE");
}

export function createPostgresFeatureFlagStore(
  options: CreatePostgresFeatureFlagStoreOptions,
): FeatureFlagStore {
  const pool = new Pool({
    application_name: "dnd-ai-feature-flags",
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idle_in_transaction_session_timeout: IDLE_TRANSACTION_TIMEOUT_MS,
    max: 3,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });

  return Object.freeze({
    async readFeatureFlag(key: FeatureFlagKey): Promise<FeatureFlagState> {
      if (!isFeatureFlagKey(key)) {
        throw redactedError("UNKNOWN_FLAG");
      }

      const client = await pool.connect();

      try {
        return await readFeatureFlagWithClient(client, key, false);
      } catch (error) {
        wrapStoreError(error);
      } finally {
        client.release();
      }
    },

    async changeFeatureFlag(
      rawCommand: FeatureFlagChangeCommand,
    ): Promise<FeatureFlagChangeResult> {
      const command = validateCommand(rawCommand);
      const digest = commandHash(command);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const existingEvent = await client.query<FeatureFlagEventRow>(
          `
            SELECT event.event_id,
                   event.flag_key,
                   event.command_hash,
                   event.resulting_version,
                   event.enabled,
                   event.actor_id,
                   event.reason_code,
                   event.created_at,
                   flag.default_enabled,
                   flag.owner
              FROM app.feature_flag_events event
              JOIN app.feature_flags flag
                ON flag.flag_key = event.flag_key
             WHERE event.idempotency_key = $1
             FOR UPDATE OF event
          `,
          [command.idempotencyKey],
        );
        const existing = existingEvent.rows[0];

        if (existing) {
          if (existing.command_hash !== digest) {
            throw redactedError("IDEMPOTENCY_CONFLICT");
          }

          await client.query("COMMIT");

          return Object.freeze({
            auditEventId: toSafeInteger(existing.event_id),
            idempotentReplay: true,
            state: stateFromReplayEventRow(existing),
          });
        }

        const current = await readFeatureFlagWithClient(
          client,
          command.key,
          true,
        );

        if (
          command.expectedVersion !== undefined &&
          current.version !== command.expectedVersion
        ) {
          throw redactedError("VERSION_CONFLICT");
        }

        const nextVersion = current.version + 1;
        const updated = await client.query<FeatureFlagRow>(
          `
            UPDATE app.feature_flags
               SET enabled = $2,
                   version = $3,
                   updated_by = $4,
                   updated_reason_code = $5,
                   updated_at = CURRENT_TIMESTAMP
             WHERE flag_key = $1
         RETURNING flag_key,
                   enabled,
                   default_enabled,
                   version,
                   owner,
                   updated_by,
                   updated_reason_code,
                   updated_at
          `,
          [
            command.key,
            command.enabled,
            nextVersion,
            command.actorId,
            command.reasonCode,
          ],
        );
        const updatedRow = updated.rows[0];

        if (!updatedRow) {
          throw redactedError("STORE_UNAVAILABLE");
        }

        const event = await client.query<{ readonly event_id: string }>(
          `
            INSERT INTO app.feature_flag_events (
              flag_key,
              idempotency_key,
              command_hash,
              previous_version,
              resulting_version,
              enabled,
              actor_id,
              reason_code,
              correlation_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING event_id
          `,
          [
            command.key,
            command.idempotencyKey,
            digest,
            current.version,
            nextVersion,
            command.enabled,
            command.actorId,
            command.reasonCode,
            command.correlationId,
          ],
        );
        const eventRow = event.rows[0];

        if (!eventRow) {
          throw redactedError("STORE_UNAVAILABLE");
        }

        await client.query("COMMIT");

        return Object.freeze({
          auditEventId: toSafeInteger(eventRow.event_id),
          idempotentReplay: false,
          state: stateFromRow(updatedRow),
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        wrapStoreError(error);
      } finally {
        client.release();
      }
    },

    async close(): Promise<void> {
      await pool.end();
    },
  });
}
