import type {
  IdentityAccessCredential,
  IdentityAccessRateLimitScope,
  IdentityAccessStore,
  IdentityChallengeId,
  IdentityEmail,
  IdentityId,
  IdentityMutationResult,
  IdentityPasswordResetConfirmCommand,
  IdentityPasswordResetReference,
  IdentityPasswordResetRejectCommand,
  IdentityPasswordResetRequestCommand,
  IdentityPasswordResetValue,
  IdentityRateLimitCommand,
  IdentityRateLimitDecision,
  IdentityRefreshSessionCommand,
  IdentitySessionAccessValue,
  IdentitySessionActionValue,
  IdentitySessionId,
  IdentitySignInCommand,
} from "@dnd-ai/domain";
import { Pool, type PoolClient } from "pg";

import { IdentityPersistenceError } from "./identity-store.js";

const CONNECTION_TIMEOUT_MS = 10_000;
const IDLE_TRANSACTION_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 15_000;
const STATEMENT_TIMEOUT_MS = 10_000;
const IDEMPOTENCY_TTL_MS = 86_400_000;
const SESSION_IDLE_TTL_MS = 86_400_000;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/u;

const RATE_LIMIT_POLICIES = Object.freeze({
  sign_in_ip: Object.freeze({ limit: 10, windowMs: 900_000 }),
  sign_in_email: Object.freeze({ limit: 5, windowMs: 900_000 }),
  refresh_session: Object.freeze({ limit: 12, windowMs: 3_600_000 }),
  sign_out: Object.freeze({ limit: 30, windowMs: 3_600_000 }),
  revoke_all: Object.freeze({ limit: 5, windowMs: 3_600_000 }),
  reset_request_ip: Object.freeze({ limit: 10, windowMs: 900_000 }),
  reset_request_email: Object.freeze({ limit: 5, windowMs: 86_400_000 }),
  reset_confirm_ip: Object.freeze({ limit: 10, windowMs: 900_000 }),
  reset_challenge: Object.freeze({ limit: 5, windowMs: 600_000 }),
} satisfies Record<
  IdentityAccessRateLimitScope,
  Readonly<{ limit: number; windowMs: number }>
>);

type AccessEndpoint =
  | "confirm_password_reset"
  | "refresh_session"
  | "request_password_reset"
  | "revoke_all_sessions"
  | "sign_in"
  | "sign_out";

type AccessResponseKind =
  | "authenticated"
  | "credentials_invalid"
  | "password_reset"
  | "password_reset_invalid"
  | "password_reset_requested"
  | "session_invalid"
  | "sessions_revoked"
  | "signed_out";

interface IdempotencyRow {
  readonly request_fingerprint: string;
  readonly response_kind: AccessResponseKind;
  readonly result_reference: string | null;
}

interface RateLimitRow {
  readonly hit_count: number;
  readonly window_started_at: Date;
  readonly window_expires_at: Date;
}

interface CredentialRow {
  readonly user_id: string;
  readonly canonical_email: string;
  readonly status: "active" | "pending";
  readonly password_hash: string;
  readonly pepper_version: number;
  readonly credential_version: string;
}

interface SessionRow {
  readonly session_id: string;
  readonly user_id: string;
  readonly key_version: number;
  readonly idle_expires_at: Date;
  readonly absolute_expires_at: Date;
  readonly revoked_at: Date | null;
}

interface ResetRow {
  readonly challenge_id: string;
  readonly user_id: string;
  readonly code_digest: string;
  readonly key_version: number;
  readonly attempt_count: number;
  readonly max_attempts: number;
  readonly expires_at: Date;
  readonly consumed_at: Date | null;
  readonly superseded_at: Date | null;
  readonly credential_version: string;
  readonly status: "active" | "pending";
}

interface CreatePostgresIdentityAccessStoreOptions {
  readonly databaseUrl: string;
}

function invalidCommand(): IdentityPersistenceError {
  return new IdentityPersistenceError(
    "INVALID_COMMAND",
    "Identity persistence command is invalid.",
  );
}

function idempotencyConflict(): IdentityPersistenceError {
  return new IdentityPersistenceError(
    "IDEMPOTENCY_CONFLICT",
    "Identity persistence idempotency key conflicts with a prior request.",
  );
}

function storeUnavailable(): IdentityPersistenceError {
  return new IdentityPersistenceError(
    "STORE_UNAVAILABLE",
    "Identity persistence operation failed.",
  );
}

function wrapStoreError(error: unknown): never {
  if (error instanceof IdentityPersistenceError) throw error;
  throw storeUnavailable();
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.valueOf());
}

function requireUuid(value: string): void {
  if (!UUID_V4_PATTERN.test(value)) throw invalidCommand();
}

function requireHash(value: string): void {
  if (!HASH_PATTERN.test(value)) throw invalidCommand();
}

function requireEmail(value: string): void {
  if (
    !EMAIL_PATTERN.test(value) ||
    value !== value.trim().toLowerCase() ||
    value.length > 254
  ) {
    throw invalidCommand();
  }
}

function validateContext(command: {
  readonly context: IdentitySignInCommand["context"];
}): void {
  const { context } = command;
  requireUuid(context.idempotencyId);
  requireHash(context.actorSubjectHash);
  requireHash(context.idempotencyKeyDigest);
  requireHash(context.requestFingerprint);
  if (
    !REQUEST_ID_PATTERN.test(context.requestId) ||
    !REQUEST_ID_PATTERN.test(context.correlationId) ||
    !isValidDate(context.occurredAt)
  ) {
    throw invalidCommand();
  }
}

function validateSession(
  command: Pick<IdentitySignInCommand, "context" | "session">,
): void {
  requireUuid(command.session.sessionId);
  requireHash(command.session.tokenDigest);
  if (
    !Number.isSafeInteger(command.session.keyVersion) ||
    command.session.keyVersion <= 0 ||
    !isValidDate(command.session.idleExpiresAt) ||
    !isValidDate(command.session.absoluteExpiresAt) ||
    command.session.idleExpiresAt <= command.context.occurredAt ||
    command.session.absoluteExpiresAt < command.session.idleExpiresAt
  ) {
    throw invalidCommand();
  }
}

function validatePasswordHash(command: {
  readonly passwordHash: IdentityPasswordResetConfirmCommand["passwordHash"];
}): void {
  if (
    typeof command.passwordHash.phc !== "string" ||
    !command.passwordHash.phc.startsWith("$argon2id$") ||
    !Number.isSafeInteger(command.passwordHash.pepperVersion) ||
    command.passwordHash.pepperVersion <= 0
  ) {
    throw invalidCommand();
  }
}

function validateSignIn(command: IdentitySignInCommand): void {
  validateContext(command);
  validateSession(command);
  requireUuid(command.userId);
  if (
    !Number.isSafeInteger(command.credentialVersion) ||
    command.credentialVersion <= 0
  ) {
    throw invalidCommand();
  }
}

function validateRefresh(command: IdentityRefreshSessionCommand): void {
  validateContext(command);
  validateSession(command);
  requireHash(command.currentTokenDigest);
}

function validateResetRequest(
  command: IdentityPasswordResetRequestCommand,
): void {
  validateContext(command);
  requireEmail(command.email);
  requireEmail(command.deliveryEmail);
  requireUuid(command.outboxId);
  requireUuid(command.challenge.challengeId);
  requireHash(command.challenge.codeDigest);
  if (
    !Number.isSafeInteger(command.challenge.keyVersion) ||
    command.challenge.keyVersion <= 0 ||
    !isValidDate(command.challenge.expiresAt) ||
    command.challenge.expiresAt <= command.context.occurredAt
  ) {
    throw invalidCommand();
  }
}

function validateResetReject(
  command: IdentityPasswordResetRejectCommand,
): void {
  validateContext(command);
  requireUuid(command.challengeId);
}

function validateResetConfirm(
  command: IdentityPasswordResetConfirmCommand,
): void {
  validateResetReject(command);
  validatePasswordHash(command);
  if (
    !Number.isSafeInteger(command.credentialVersion) ||
    command.credentialVersion <= 0
  ) {
    throw invalidCommand();
  }
}

async function advisoryLock(
  client: PoolClient,
  namespace: string,
  value: string,
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `${namespace}:${value}`,
  ]);
}

async function withTransaction<Result>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect().catch(() => {
    throw storeUnavailable();
  });
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    wrapStoreError(error);
  } finally {
    client.release();
  }
}

function applied<Success>(value: Success): IdentityMutationResult<Success> {
  return Object.freeze({ kind: "applied", value: Object.freeze(value) });
}

function replayed<Success>(value: Success): IdentityMutationResult<Success> {
  return Object.freeze({ kind: "replayed", value: Object.freeze(value) });
}

async function findIdempotency(
  client: PoolClient,
  endpoint: AccessEndpoint,
  command: { readonly context: IdentitySignInCommand["context"] },
): Promise<IdempotencyRow | null> {
  const { context } = command;
  await advisoryLock(
    client,
    "identity-idempotency",
    `${endpoint}:${context.actorSubjectHash}:${context.idempotencyKeyDigest}`,
  );
  await client.query(
    `DELETE FROM app.identity_idempotency
      WHERE endpoint = $1
        AND actor_subject_hash = $2
        AND key_digest = $3
        AND expires_at <= $4`,
    [
      endpoint,
      context.actorSubjectHash,
      context.idempotencyKeyDigest,
      context.occurredAt,
    ],
  );
  const result = await client.query<IdempotencyRow>(
    `SELECT request_fingerprint, response_kind, result_reference
       FROM app.identity_idempotency
      WHERE endpoint = $1
        AND actor_subject_hash = $2
        AND key_digest = $3
      FOR UPDATE`,
    [endpoint, context.actorSubjectHash, context.idempotencyKeyDigest],
  );
  const existing = result.rows[0] ?? null;
  if (existing && existing.request_fingerprint !== context.requestFingerprint) {
    throw idempotencyConflict();
  }
  return existing;
}

async function insertIdempotency(
  client: PoolClient,
  endpoint: AccessEndpoint,
  command: { readonly context: IdentitySignInCommand["context"] },
  responseKind: AccessResponseKind,
  resultReference: string | null,
): Promise<void> {
  const { context } = command;
  await client.query(
    `INSERT INTO app.identity_idempotency (
       idempotency_id, actor_subject_hash, endpoint, key_digest,
       request_fingerprint, response_kind, result_reference,
       created_at, expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      context.idempotencyId,
      context.actorSubjectHash,
      endpoint,
      context.idempotencyKeyDigest,
      context.requestFingerprint,
      responseKind,
      resultReference,
      context.occurredAt,
      new Date(context.occurredAt.valueOf() + IDEMPOTENCY_TTL_MS),
    ],
  );
}

async function appendAudit(
  client: PoolClient,
  eventType:
    | "password_reset_completed"
    | "password_reset_failed"
    | "password_reset_ignored"
    | "password_reset_requested"
    | "session_refreshed"
    | "session_signed_out"
    | "sessions_revoked"
    | "sign_in_succeeded",
  command: { readonly context: IdentitySignInCommand["context"] },
  userId: string | null,
  metadata: Readonly<Record<string, boolean | number | string>> = Object.freeze(
    {},
  ),
): Promise<void> {
  await client.query(
    `INSERT INTO app.identity_audit_events (
       event_type, user_id, request_id, correlation_id, metadata, occurred_at
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [
      eventType,
      userId,
      command.context.requestId,
      command.context.correlationId,
      JSON.stringify(metadata),
      command.context.occurredAt,
    ],
  );
}

async function replaySession(
  client: PoolClient,
  existing: IdempotencyRow,
): Promise<IdentityMutationResult<IdentitySessionAccessValue>> {
  if (existing.response_kind === "credentials_invalid") {
    return replayed({ status: "credentials_invalid" });
  }
  if (existing.response_kind === "session_invalid") {
    return replayed({ status: "session_invalid" });
  }
  if (
    existing.response_kind !== "authenticated" ||
    existing.result_reference === null
  ) {
    throw storeUnavailable();
  }
  const result = await client.query<SessionRow>(
    `SELECT session_id, user_id, key_version, idle_expires_at,
            absolute_expires_at, revoked_at
       FROM app.user_sessions
      WHERE session_id = $1`,
    [existing.result_reference],
  );
  const row = result.rows[0];
  if (!row) throw storeUnavailable();
  return replayed({
    absoluteExpiresAt: row.absolute_expires_at,
    keyVersion: row.key_version,
    sessionId: row.session_id as IdentitySessionId,
    status: "authenticated",
  });
}

async function insertSession(
  client: PoolClient,
  command: Pick<IdentitySignInCommand, "context" | "session">,
  userId: string,
  idleExpiresAt = command.session.idleExpiresAt,
  absoluteExpiresAt = command.session.absoluteExpiresAt,
): Promise<void> {
  await client.query(
    `INSERT INTO app.user_sessions (
       session_id, user_id, token_digest, key_version, created_at,
       last_seen_at, idle_expires_at, absolute_expires_at
     ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7)`,
    [
      command.session.sessionId,
      userId,
      command.session.tokenDigest,
      command.session.keyVersion,
      command.context.occurredAt,
      idleExpiresAt,
      absoluteExpiresAt,
    ],
  );
}

function isCurrentSession(
  row: SessionRow | undefined,
  occurredAt: Date,
): row is SessionRow {
  return (
    row !== undefined &&
    row.revoked_at === null &&
    row.idle_expires_at > occurredAt &&
    row.absolute_expires_at > occurredAt
  );
}

async function replayReset(
  existing: IdempotencyRow,
): Promise<IdentityMutationResult<IdentityPasswordResetValue>> {
  if (existing.response_kind === "password_reset") {
    return replayed({ status: "password_reset" });
  }
  if (existing.response_kind === "password_reset_invalid") {
    return replayed({ status: "invalid" });
  }
  throw storeUnavailable();
}

function replayRejectedReset(
  existing: IdempotencyRow,
): IdentityMutationResult<Readonly<{ readonly status: "invalid" }>> {
  if (existing.response_kind !== "password_reset_invalid") {
    throw storeUnavailable();
  }
  return replayed({ status: "invalid" });
}

export function createPostgresIdentityAccessStore(
  options: CreatePostgresIdentityAccessStoreOptions,
): IdentityAccessStore & Readonly<{ close(): Promise<void> }> {
  const pool = new Pool({
    application_name: "dnd-ai-identity-access",
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idle_in_transaction_session_timeout: IDLE_TRANSACTION_TIMEOUT_MS,
    max: 5,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });
  let closePromise: Promise<void> | undefined;

  const store: IdentityAccessStore & Readonly<{ close(): Promise<void> }> = {
    async consumeRateLimit(
      command: IdentityRateLimitCommand<IdentityAccessRateLimitScope>,
    ): Promise<IdentityRateLimitDecision> {
      const policy = RATE_LIMIT_POLICIES[command.scope];
      if (
        !policy ||
        !HASH_PATTERN.test(command.subjectHash) ||
        !isValidDate(command.occurredAt)
      ) {
        throw invalidCommand();
      }
      return withTransaction(pool, async (client) => {
        await advisoryLock(
          client,
          "identity-rate-limit",
          `${command.scope}:${command.subjectHash}`,
        );
        const result = await client.query<RateLimitRow>(
          `SELECT hit_count, window_started_at, window_expires_at
             FROM app.identity_rate_limits
            WHERE scope = $1 AND subject_hash = $2
            FOR UPDATE`,
          [command.scope, command.subjectHash],
        );
        const current = result.rows[0];
        const windowExpiresAt = new Date(
          command.occurredAt.valueOf() + policy.windowMs,
        );
        if (!current) {
          await client.query(
            `INSERT INTO app.identity_rate_limits (
               scope, subject_hash, window_started_at, window_expires_at,
               hit_count, limit_count, updated_at
             ) VALUES ($1, $2, $3, $4, 1, $5, $3)`,
            [
              command.scope,
              command.subjectHash,
              command.occurredAt,
              windowExpiresAt,
              policy.limit,
            ],
          );
          return Object.freeze({ allowed: true });
        }
        if (current.window_expires_at <= command.occurredAt) {
          await client.query(
            `UPDATE app.identity_rate_limits
                SET window_started_at = $3, window_expires_at = $4,
                    hit_count = 1, limit_count = $5, updated_at = $3
              WHERE scope = $1 AND subject_hash = $2`,
            [
              command.scope,
              command.subjectHash,
              command.occurredAt,
              windowExpiresAt,
              policy.limit,
            ],
          );
          return Object.freeze({ allowed: true });
        }
        if (current.hit_count >= policy.limit) {
          return Object.freeze({
            allowed: false,
            retryAfterSeconds: Math.max(
              1,
              Math.ceil(
                (current.window_expires_at.valueOf() -
                  command.occurredAt.valueOf()) /
                  1000,
              ),
            ),
          });
        }
        await client.query(
          `UPDATE app.identity_rate_limits
              SET hit_count = hit_count + 1, limit_count = $3, updated_at = $4
            WHERE scope = $1 AND subject_hash = $2`,
          [
            command.scope,
            command.subjectHash,
            policy.limit,
            command.occurredAt,
          ],
        );
        return Object.freeze({ allowed: true });
      });
    },

    async findSignInCredential(
      email: IdentityEmail,
    ): Promise<IdentityAccessCredential | null> {
      requireEmail(email);
      try {
        const result = await pool.query<CredentialRow>(
          `SELECT u.user_id, u.canonical_email, u.status,
                  c.password_hash, c.pepper_version, c.credential_version
             FROM app.users AS u
             JOIN app.user_credentials AS c ON c.user_id = u.user_id
            WHERE u.canonical_email = $1`,
          [email],
        );
        const row = result.rows[0];
        return row
          ? Object.freeze({
              credentialVersion: Number(row.credential_version),
              email: row.canonical_email as IdentityEmail,
              passwordHash: Object.freeze({
                pepperVersion: row.pepper_version,
                phc: row.password_hash,
              }),
              status: row.status,
              userId: row.user_id as IdentityId,
            })
          : null;
      } catch (error) {
        wrapStoreError(error);
      }
    },

    async signIn(command) {
      validateSignIn(command);
      return withTransaction(pool, async (client) => {
        const existing = await findIdempotency(client, "sign_in", command);
        if (existing) return replaySession(client, existing);
        const credential = await client.query<CredentialRow>(
          `SELECT u.user_id, u.canonical_email, u.status,
                  c.password_hash, c.pepper_version, c.credential_version
             FROM app.users AS u
             JOIN app.user_credentials AS c ON c.user_id = u.user_id
            WHERE u.user_id = $1
            FOR UPDATE OF u, c`,
          [command.userId],
        );
        const row = credential.rows[0];
        if (
          !row ||
          row.status !== "active" ||
          Number(row.credential_version) !== command.credentialVersion
        ) {
          await insertIdempotency(
            client,
            "sign_in",
            command,
            "credentials_invalid",
            null,
          );
          return applied<IdentitySessionAccessValue>({
            status: "credentials_invalid",
          });
        }
        await insertSession(client, command, row.user_id);
        await appendAudit(client, "sign_in_succeeded", command, row.user_id, {
          session_id: command.session.sessionId,
        });
        await insertIdempotency(
          client,
          "sign_in",
          command,
          "authenticated",
          command.session.sessionId,
        );
        return applied<IdentitySessionAccessValue>({
          absoluteExpiresAt: command.session.absoluteExpiresAt,
          keyVersion: command.session.keyVersion,
          sessionId: command.session.sessionId,
          status: "authenticated",
        });
      });
    },

    async refreshSession(command) {
      validateRefresh(command);
      return withTransaction(pool, async (client) => {
        const existing = await findIdempotency(
          client,
          "refresh_session",
          command,
        );
        if (existing) return replaySession(client, existing);
        const result = await client.query<SessionRow>(
          `SELECT session_id, user_id, key_version, idle_expires_at,
                  absolute_expires_at, revoked_at
             FROM app.user_sessions
            WHERE token_digest = $1
            FOR UPDATE`,
          [command.currentTokenDigest],
        );
        const current = result.rows[0];
        if (!isCurrentSession(current, command.context.occurredAt)) {
          await insertIdempotency(
            client,
            "refresh_session",
            command,
            "session_invalid",
            null,
          );
          return applied<IdentitySessionAccessValue>({
            status: "session_invalid",
          });
        }
        const idleExpiresAt = new Date(
          Math.min(
            command.context.occurredAt.valueOf() + SESSION_IDLE_TTL_MS,
            current.absolute_expires_at.valueOf(),
          ),
        );
        await client.query(
          `UPDATE app.user_sessions
              SET revoked_at = $2, last_seen_at = $2
            WHERE session_id = $1`,
          [current.session_id, command.context.occurredAt],
        );
        await insertSession(
          client,
          command,
          current.user_id,
          idleExpiresAt,
          current.absolute_expires_at,
        );
        await appendAudit(
          client,
          "session_refreshed",
          command,
          current.user_id,
          {
            session_id: command.session.sessionId,
          },
        );
        await insertIdempotency(
          client,
          "refresh_session",
          command,
          "authenticated",
          command.session.sessionId,
        );
        return applied<IdentitySessionAccessValue>({
          absoluteExpiresAt: current.absolute_expires_at,
          keyVersion: command.session.keyVersion,
          sessionId: command.session.sessionId,
          status: "authenticated",
        });
      });
    },

    async signOut(command) {
      validateContext(command);
      if (command.currentTokenDigest !== null)
        requireHash(command.currentTokenDigest);
      return withTransaction(pool, async (client) => {
        const existing = await findIdempotency(client, "sign_out", command);
        if (existing) {
          if (existing.response_kind !== "signed_out") throw storeUnavailable();
          return replayed({ status: "signed_out" as const });
        }
        if (command.currentTokenDigest !== null) {
          const revoked = await client.query<{
            readonly user_id: string;
            readonly session_id: string;
          }>(
            `UPDATE app.user_sessions
                SET revoked_at = $2
              WHERE token_digest = $1 AND revoked_at IS NULL
              RETURNING user_id, session_id`,
            [command.currentTokenDigest, command.context.occurredAt],
          );
          const row = revoked.rows[0];
          if (row) {
            await appendAudit(
              client,
              "session_signed_out",
              command,
              row.user_id,
              {
                session_id: row.session_id,
              },
            );
          }
        }
        await insertIdempotency(
          client,
          "sign_out",
          command,
          "signed_out",
          null,
        );
        return applied({ status: "signed_out" as const });
      });
    },

    async revokeAllSessions(command) {
      validateContext(command);
      requireHash(command.currentTokenDigest);
      return withTransaction(pool, async (client) => {
        const existing = await findIdempotency(
          client,
          "revoke_all_sessions",
          command,
        );
        if (existing) {
          if (existing.response_kind === "session_invalid") {
            return replayed<IdentitySessionActionValue>({
              status: "session_invalid",
            });
          }
          if (existing.response_kind === "sessions_revoked") {
            return replayed<IdentitySessionActionValue>({
              status: "sessions_revoked",
            });
          }
          throw storeUnavailable();
        }
        const session = await client.query<SessionRow>(
          `SELECT session_id, user_id, key_version, idle_expires_at,
                  absolute_expires_at, revoked_at
             FROM app.user_sessions
            WHERE token_digest = $1
            FOR UPDATE`,
          [command.currentTokenDigest],
        );
        const current = session.rows[0];
        if (!isCurrentSession(current, command.context.occurredAt)) {
          await insertIdempotency(
            client,
            "revoke_all_sessions",
            command,
            "session_invalid",
            null,
          );
          return applied<IdentitySessionActionValue>({
            status: "session_invalid",
          });
        }
        const revoked = await client.query(
          `UPDATE app.user_sessions
              SET revoked_at = $2
            WHERE user_id = $1 AND revoked_at IS NULL`,
          [current.user_id, command.context.occurredAt],
        );
        await appendAudit(
          client,
          "sessions_revoked",
          command,
          current.user_id,
          {
            revoked_session_count: revoked.rowCount ?? 0,
          },
        );
        await insertIdempotency(
          client,
          "revoke_all_sessions",
          command,
          "sessions_revoked",
          null,
        );
        return applied<IdentitySessionActionValue>({
          status: "sessions_revoked",
        });
      });
    },

    async requestPasswordReset(command) {
      validateResetRequest(command);
      return withTransaction(pool, async (client) => {
        const existing = await findIdempotency(
          client,
          "request_password_reset",
          command,
        );
        if (existing) {
          if (existing.response_kind !== "password_reset_requested")
            throw storeUnavailable();
          return replayed({ accepted: true as const });
        }
        const user = await client.query<{
          readonly user_id: string;
          readonly status: string;
        }>(
          `SELECT u.user_id, u.status
             FROM app.users AS u
             JOIN app.user_credentials AS c ON c.user_id = u.user_id
            WHERE u.canonical_email = $1
            FOR UPDATE OF u, c`,
          [command.email],
        );
        const row = user.rows[0];
        if (!row || row.status !== "active") {
          await appendAudit(
            client,
            "password_reset_ignored",
            command,
            row?.user_id ?? null,
          );
          await insertIdempotency(
            client,
            "request_password_reset",
            command,
            "password_reset_requested",
            null,
          );
          return applied({ accepted: true as const });
        }
        await client.query(
          `WITH superseded AS (
             UPDATE app.password_reset_challenges
                SET superseded_at = $2
              WHERE user_id = $1
                AND consumed_at IS NULL
                AND superseded_at IS NULL
              RETURNING challenge_id
           )
           UPDATE app.identity_email_outbox
              SET status = 'dead', lease_until = NULL, lease_token = NULL,
                  updated_at = $2
            WHERE password_reset_challenge_id IN (
              SELECT challenge_id FROM superseded
            )`,
          [row.user_id, command.context.occurredAt],
        );
        await client.query(
          `INSERT INTO app.password_reset_challenges (
             challenge_id, user_id, code_digest, key_version,
             expires_at, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            command.challenge.challengeId,
            row.user_id,
            command.challenge.codeDigest,
            command.challenge.keyVersion,
            command.challenge.expiresAt,
            command.context.occurredAt,
          ],
        );
        await client.query(
          `INSERT INTO app.identity_email_outbox (
             outbox_id, user_id, password_reset_challenge_id, template_key,
             next_attempt_at, created_at, updated_at
           ) VALUES ($1, $2, $3, 'password_reset_v1', $4, $4, $4)`,
          [
            command.outboxId,
            row.user_id,
            command.challenge.challengeId,
            command.context.occurredAt,
          ],
        );
        await appendAudit(
          client,
          "password_reset_requested",
          command,
          row.user_id,
          {
            challenge_id: command.challenge.challengeId,
          },
        );
        await insertIdempotency(
          client,
          "request_password_reset",
          command,
          "password_reset_requested",
          command.challenge.challengeId,
        );
        return applied({ accepted: true as const });
      });
    },

    async findPasswordResetChallenge(
      email: IdentityEmail,
    ): Promise<IdentityPasswordResetReference | null> {
      requireEmail(email);
      try {
        const result = await pool.query<ResetRow>(
          `SELECT r.challenge_id, r.user_id, r.code_digest, r.key_version,
                  r.attempt_count, r.max_attempts, r.expires_at,
                  r.consumed_at, r.superseded_at, c.credential_version,
                  u.status
             FROM app.users AS u
             JOIN app.user_credentials AS c ON c.user_id = u.user_id
             JOIN app.password_reset_challenges AS r ON r.user_id = u.user_id
            WHERE u.canonical_email = $1
              AND u.status = 'active'
              AND r.consumed_at IS NULL
              AND r.superseded_at IS NULL
              AND r.attempt_count < r.max_attempts
            ORDER BY r.created_at DESC
            LIMIT 1`,
          [email],
        );
        const row = result.rows[0];
        return row
          ? Object.freeze({
              challengeId: row.challenge_id as IdentityChallengeId,
              codeDigest: row.code_digest,
              credentialVersion: Number(row.credential_version),
              keyVersion: row.key_version,
              userId: row.user_id as IdentityId,
            })
          : null;
      } catch (error) {
        wrapStoreError(error);
      }
    },

    async rejectPasswordReset(command) {
      validateResetReject(command);
      return withTransaction(pool, async (client) => {
        const existing = await findIdempotency(
          client,
          "confirm_password_reset",
          command,
        );
        if (existing) return replayRejectedReset(existing);
        const reset = await client.query<ResetRow>(
          `SELECT r.challenge_id, r.user_id, r.code_digest, r.key_version,
                  r.attempt_count, r.max_attempts, r.expires_at,
                  r.consumed_at, r.superseded_at, c.credential_version,
                  u.status
             FROM app.password_reset_challenges AS r
             JOIN app.users AS u ON u.user_id = r.user_id
             JOIN app.user_credentials AS c ON c.user_id = r.user_id
            WHERE r.challenge_id = $1
            FOR UPDATE OF r, u, c`,
          [command.challengeId],
        );
        const row = reset.rows[0];
        if (
          row &&
          row.status === "active" &&
          row.consumed_at === null &&
          row.superseded_at === null &&
          row.expires_at > command.context.occurredAt &&
          row.attempt_count < row.max_attempts
        ) {
          await client.query(
            `UPDATE app.password_reset_challenges
                SET attempt_count = attempt_count + 1
              WHERE challenge_id = $1`,
            [command.challengeId],
          );
          await appendAudit(
            client,
            "password_reset_failed",
            command,
            row.user_id,
            {
              challenge_id: command.challengeId,
              reason_code: "invalid_code",
            },
          );
        }
        await insertIdempotency(
          client,
          "confirm_password_reset",
          command,
          "password_reset_invalid",
          command.challengeId,
        );
        return applied({ status: "invalid" as const });
      });
    },

    async confirmPasswordReset(command) {
      validateResetConfirm(command);
      return withTransaction(pool, async (client) => {
        const existing = await findIdempotency(
          client,
          "confirm_password_reset",
          command,
        );
        if (existing) return replayReset(existing);
        const reset = await client.query<ResetRow>(
          `SELECT r.challenge_id, r.user_id, r.code_digest, r.key_version,
                  r.attempt_count, r.max_attempts, r.expires_at,
                  r.consumed_at, r.superseded_at, c.credential_version,
                  u.status
             FROM app.password_reset_challenges AS r
             JOIN app.users AS u ON u.user_id = r.user_id
             JOIN app.user_credentials AS c ON c.user_id = r.user_id
            WHERE r.challenge_id = $1
            FOR UPDATE OF r, u, c`,
          [command.challengeId],
        );
        const row = reset.rows[0];
        if (
          !row ||
          row.status !== "active" ||
          row.consumed_at !== null ||
          row.superseded_at !== null ||
          row.expires_at <= command.context.occurredAt ||
          row.attempt_count >= row.max_attempts ||
          Number(row.credential_version) !== command.credentialVersion
        ) {
          await insertIdempotency(
            client,
            "confirm_password_reset",
            command,
            "password_reset_invalid",
            command.challengeId,
          );
          return applied<IdentityPasswordResetValue>({ status: "invalid" });
        }
        await client.query(
          `UPDATE app.user_credentials
              SET password_hash = $2, pepper_version = $3,
                  credential_version = credential_version + 1,
                  updated_at = $4
            WHERE user_id = $1`,
          [
            row.user_id,
            command.passwordHash.phc,
            command.passwordHash.pepperVersion,
            command.context.occurredAt,
          ],
        );
        await client.query(
          `UPDATE app.password_reset_challenges
              SET consumed_at = $2
            WHERE challenge_id = $1`,
          [command.challengeId, command.context.occurredAt],
        );
        const revoked = await client.query(
          `UPDATE app.user_sessions
              SET revoked_at = $2
            WHERE user_id = $1 AND revoked_at IS NULL`,
          [row.user_id, command.context.occurredAt],
        );
        await appendAudit(
          client,
          "password_reset_completed",
          command,
          row.user_id,
          {
            challenge_id: command.challengeId,
            revoked_session_count: revoked.rowCount ?? 0,
          },
        );
        await insertIdempotency(
          client,
          "confirm_password_reset",
          command,
          "password_reset",
          command.challengeId,
        );
        return applied<IdentityPasswordResetValue>({
          status: "password_reset",
        });
      });
    },

    close() {
      closePromise ??= pool.end().catch(() => {
        throw storeUnavailable();
      });
      return closePromise;
    },
  };

  return Object.freeze(store);
}
