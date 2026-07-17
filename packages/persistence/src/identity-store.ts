import type {
  IdentityEmail,
  IdentityMutationResult,
  IdentityRateLimitCommand,
  IdentityRateLimitDecision,
  IdentityRegistrationRateLimitScope,
  IdentityResendVerificationCommand,
  IdentitySignUpCommand,
  IdentityStore,
  IdentitySessionId,
  IdentityVerificationChallengeReference,
  IdentityVerifyEmailCommand,
  IdentityVerifyEmailValue,
} from "@dnd-ai/domain";
import { Pool, type PoolClient } from "pg";

const CONNECTION_TIMEOUT_MS = 10_000;
const IDLE_TRANSACTION_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 15_000;
const STATEMENT_TIMEOUT_MS = 10_000;
const IDEMPOTENCY_TTL_MS = 86_400_000;
const RESEND_COOLDOWN_MS = 60_000;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/u;

const RATE_LIMIT_POLICIES = Object.freeze({
  signup_ip: Object.freeze({ limit: 5, windowMs: 900_000 }),
  signup_email: Object.freeze({ limit: 3, windowMs: 3_600_000 }),
  verify_ip: Object.freeze({ limit: 10, windowMs: 900_000 }),
  verify_challenge: Object.freeze({ limit: 5, windowMs: 900_000 }),
  resend_ip: Object.freeze({ limit: 10, windowMs: 900_000 }),
  resend_email: Object.freeze({ limit: 5, windowMs: 86_400_000 }),
} satisfies Record<
  IdentityRegistrationRateLimitScope,
  Readonly<{ limit: number; windowMs: number }>
>);

export type IdentityPersistenceErrorCode =
  "IDEMPOTENCY_CONFLICT" | "INVALID_COMMAND" | "STORE_UNAVAILABLE";

export class IdentityPersistenceError extends Error {
  readonly code: IdentityPersistenceErrorCode;

  constructor(code: IdentityPersistenceErrorCode, message: string) {
    super(message);
    this.name = "IdentityPersistenceError";
    this.code = code;
  }
}

interface CreatePostgresIdentityStoreOptions {
  readonly databaseUrl: string;
}

interface UserRow {
  readonly user_id: string;
  readonly status: "active" | "pending";
}

interface ChallengeRow {
  readonly challenge_id: string;
  readonly code_digest: string;
  readonly key_version: number;
  readonly attempt_count: number;
  readonly max_attempts: number;
  readonly expires_at: Date;
  readonly consumed_at: Date | null;
  readonly superseded_at: Date | null;
  readonly created_at: Date;
}

interface IdempotencyRow {
  readonly request_fingerprint: string;
  readonly response_kind:
    | "accepted"
    | "already_verified"
    | "attempts_exhausted"
    | "cooldown"
    | "expired"
    | "invalid_code"
    | "verified";
  readonly result_reference: string | null;
}

interface RateLimitRow {
  readonly hit_count: number;
  readonly window_started_at: Date;
  readonly window_expires_at: Date;
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

function validateContext(command: {
  readonly context: IdentitySignUpCommand["context"];
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

function requireEmail(email: string): void {
  if (
    !EMAIL_PATTERN.test(email) ||
    email !== email.trim().toLowerCase() ||
    email.length > 254
  ) {
    throw invalidCommand();
  }
}

function validateChallenge(command: {
  readonly challenge: IdentitySignUpCommand["challenge"];
  readonly context: IdentitySignUpCommand["context"];
}): void {
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

function validateSignUp(command: IdentitySignUpCommand): void {
  validateContext(command);
  validateChallenge(command);
  requireEmail(command.email);
  requireEmail(command.deliveryEmail);
  requireUuid(command.userId);
  requireUuid(command.outboxId);
  if (
    typeof command.displayName !== "string" ||
    command.displayName.length < 2 ||
    command.displayName.length > 40 ||
    typeof command.passwordHash.phc !== "string" ||
    !command.passwordHash.phc.startsWith("$argon2id$") ||
    !Number.isSafeInteger(command.passwordHash.pepperVersion) ||
    command.passwordHash.pepperVersion <= 0
  ) {
    throw invalidCommand();
  }
}

function validateResend(command: IdentityResendVerificationCommand): void {
  validateContext(command);
  validateChallenge(command);
  requireEmail(command.email);
  requireUuid(command.outboxId);
}

function validateVerify(command: IdentityVerifyEmailCommand): void {
  validateContext(command);
  requireEmail(command.email);
  requireUuid(command.challengeId);
  requireHash(command.codeDigest);
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
  endpoint: "resend_verification" | "sign_up" | "verify_email",
  command: { readonly context: IdentitySignUpCommand["context"] },
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
  endpoint: "resend_verification" | "sign_up" | "verify_email",
  command: { readonly context: IdentitySignUpCommand["context"] },
  responseKind: IdempotencyRow["response_kind"],
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
    | "email_verified"
    | "resend_ignored"
    | "signup_accepted"
    | "signup_existing"
    | "verification_failed"
    | "verification_resent",
  command: { readonly context: IdentitySignUpCommand["context"] },
  userId: string | null,
  metadata: Readonly<Record<string, boolean | string>> = Object.freeze({}),
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

async function findUserForUpdate(
  client: PoolClient,
  email: string,
): Promise<UserRow | null> {
  const result = await client.query<UserRow>(
    `SELECT user_id, status
       FROM app.users
      WHERE canonical_email = $1
      FOR UPDATE`,
    [email],
  );
  return result.rows[0] ?? null;
}

async function insertChallengeAndOutbox(
  client: PoolClient,
  command: Pick<IdentitySignUpCommand, "challenge" | "context" | "outboxId">,
  userId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO app.email_verification_challenges (
       challenge_id, user_id, code_digest, key_version, expires_at, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      command.challenge.challengeId,
      userId,
      command.challenge.codeDigest,
      command.challenge.keyVersion,
      command.challenge.expiresAt,
      command.context.occurredAt,
    ],
  );
  await client.query(
    `INSERT INTO app.identity_email_outbox (
       outbox_id, user_id, challenge_id, template_key,
       next_attempt_at, created_at, updated_at
     ) VALUES ($1, $2, $3, 'email_verification_v1', $4, $4, $4)`,
    [
      command.outboxId,
      userId,
      command.challenge.challengeId,
      command.context.occurredAt,
    ],
  );
}

async function supersedeChallengeAndOutbox(
  client: PoolClient,
  challengeId: string,
  occurredAt: Date,
): Promise<void> {
  await client.query(
    `UPDATE app.email_verification_challenges
        SET superseded_at = $2
      WHERE challenge_id = $1`,
    [challengeId, occurredAt],
  );
  await client.query(
    `UPDATE app.identity_email_outbox
        SET status = 'dead', lease_until = NULL, lease_token = NULL, updated_at = $2
      WHERE challenge_id = $1
        AND status IN ('pending', 'leased')`,
    [challengeId, occurredAt],
  );
}

async function verifyReplayValue(
  client: PoolClient,
  existing: IdempotencyRow,
): Promise<IdentityVerifyEmailValue> {
  if (existing.response_kind !== "verified") {
    if (
      existing.response_kind === "accepted" ||
      existing.response_kind === "cooldown"
    ) {
      throw storeUnavailable();
    }
    return Object.freeze({ status: existing.response_kind });
  }
  if (!existing.result_reference) throw storeUnavailable();
  const session = await client.query<{
    readonly absolute_expires_at: Date;
    readonly key_version: number;
  }>(
    `SELECT key_version, absolute_expires_at
       FROM app.user_sessions
      WHERE session_id = $1`,
    [existing.result_reference],
  );
  const row = session.rows[0];
  if (!row) throw storeUnavailable();
  requireUuid(existing.result_reference);
  return Object.freeze({
    absoluteExpiresAt: row.absolute_expires_at,
    keyVersion: row.key_version,
    sessionId: existing.result_reference as IdentitySessionId,
    status: "verified" as const,
  });
}

async function persistVerificationOutcome(
  client: PoolClient,
  command: IdentityVerifyEmailCommand,
  userId: string | null,
  status: Exclude<IdentityVerifyEmailValue["status"], "verified">,
): Promise<IdentityMutationResult<IdentityVerifyEmailValue>> {
  await appendAudit(client, "verification_failed", command, userId, {
    reason_code: status,
  });
  await insertIdempotency(client, "verify_email", command, status, null);
  return applied<IdentityVerifyEmailValue>({ status });
}

export function createPostgresIdentityStore(
  options: CreatePostgresIdentityStoreOptions,
): IdentityStore & Readonly<{ close(): Promise<void> }> {
  const pool = new Pool({
    application_name: "dnd-ai-identity",
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idle_in_transaction_session_timeout: IDLE_TRANSACTION_TIMEOUT_MS,
    max: 5,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });

  return Object.freeze({
    async consumeRateLimit(
      command: IdentityRateLimitCommand<IdentityRegistrationRateLimitScope>,
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
        const row = result.rows[0];
        const expiresAt = new Date(
          command.occurredAt.valueOf() + policy.windowMs,
        );
        if (!row) {
          await client.query(
            `INSERT INTO app.identity_rate_limits (
               scope, subject_hash, window_started_at, window_expires_at,
               hit_count, limit_count, updated_at
             ) VALUES ($1, $2, $3, $4, 1, $5, $3)`,
            [
              command.scope,
              command.subjectHash,
              command.occurredAt,
              expiresAt,
              policy.limit,
            ],
          );
          return Object.freeze({ allowed: true });
        }
        if (command.occurredAt >= row.window_expires_at) {
          await client.query(
            `UPDATE app.identity_rate_limits
                SET window_started_at = $3, window_expires_at = $4,
                    hit_count = 1, limit_count = $5, updated_at = $3
              WHERE scope = $1 AND subject_hash = $2`,
            [
              command.scope,
              command.subjectHash,
              command.occurredAt,
              expiresAt,
              policy.limit,
            ],
          );
          return Object.freeze({ allowed: true });
        }
        if (
          command.occurredAt < row.window_started_at ||
          row.hit_count >= policy.limit
        ) {
          return Object.freeze({
            allowed: false,
            retryAfterSeconds: Math.max(
              1,
              Math.ceil(
                (row.window_expires_at.valueOf() -
                  command.occurredAt.valueOf()) /
                  1_000,
              ),
            ),
          });
        }
        await client.query(
          `UPDATE app.identity_rate_limits
              SET hit_count = hit_count + 1, updated_at = $3
            WHERE scope = $1 AND subject_hash = $2`,
          [command.scope, command.subjectHash, command.occurredAt],
        );
        return Object.freeze({ allowed: true });
      });
    },

    async findVerificationChallenge(email: IdentityEmail) {
      requireEmail(email);
      try {
        const result = await pool.query<{
          readonly challenge_id: string;
          readonly key_version: number;
        }>(
          `SELECT c.challenge_id, c.key_version
             FROM app.users u
             JOIN app.email_verification_challenges c ON c.user_id = u.user_id
            WHERE u.canonical_email = $1
              AND u.status = 'pending'
              AND c.consumed_at IS NULL
              AND c.superseded_at IS NULL`,
          [email],
        );
        const row = result.rows[0];
        return row
          ? (Object.freeze({
              challengeId: row.challenge_id,
              keyVersion: row.key_version,
            }) as IdentityVerificationChallengeReference)
          : null;
      } catch (error) {
        wrapStoreError(error);
      }
    },

    async signUp(command: IdentitySignUpCommand) {
      validateSignUp(command);
      return withTransaction(pool, async (client) => {
        const existingIdempotency = await findIdempotency(
          client,
          "sign_up",
          command,
        );
        if (existingIdempotency) return replayed({ accepted: true as const });
        await advisoryLock(client, "identity-email", command.email);
        const existingUser = await findUserForUpdate(client, command.email);
        if (existingUser?.status === "active") {
          await appendAudit(
            client,
            "signup_existing",
            command,
            existingUser.user_id,
          );
          await insertIdempotency(
            client,
            "sign_up",
            command,
            "accepted",
            existingUser.user_id,
          );
          return applied({ accepted: true as const });
        }
        if (existingUser) {
          const currentChallenge = await client.query<{
            readonly challenge_id: string;
          }>(
            `SELECT challenge_id
               FROM app.email_verification_challenges
              WHERE user_id = $1
                AND consumed_at IS NULL
                AND superseded_at IS NULL
              FOR UPDATE`,
            [existingUser.user_id],
          );
          const current = currentChallenge.rows[0];
          if (current) {
            await supersedeChallengeAndOutbox(
              client,
              current.challenge_id,
              command.context.occurredAt,
            );
          }
          await client.query(
            `UPDATE app.users
                SET delivery_email = $2, display_name = $3, updated_at = $4
              WHERE user_id = $1`,
            [
              existingUser.user_id,
              command.deliveryEmail,
              command.displayName,
              command.context.occurredAt,
            ],
          );
          await client.query(
            `UPDATE app.user_credentials
                SET password_hash = $2, pepper_version = $3, updated_at = $4
              WHERE user_id = $1`,
            [
              existingUser.user_id,
              command.passwordHash.phc,
              command.passwordHash.pepperVersion,
              command.context.occurredAt,
            ],
          );
          await insertChallengeAndOutbox(client, command, existingUser.user_id);
          await appendAudit(
            client,
            "signup_accepted",
            command,
            existingUser.user_id,
            {
              challenge_id: command.challenge.challengeId,
            },
          );
          await insertIdempotency(
            client,
            "sign_up",
            command,
            "accepted",
            existingUser.user_id,
          );
          return applied({ accepted: true as const });
        }
        await client.query(
          `INSERT INTO app.users (
             user_id, canonical_email, delivery_email, display_name,
             created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $5)`,
          [
            command.userId,
            command.email,
            command.deliveryEmail,
            command.displayName,
            command.context.occurredAt,
          ],
        );
        await client.query(
          `INSERT INTO app.user_credentials (
             user_id, password_hash, pepper_version, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $4)`,
          [
            command.userId,
            command.passwordHash.phc,
            command.passwordHash.pepperVersion,
            command.context.occurredAt,
          ],
        );
        await insertChallengeAndOutbox(client, command, command.userId);
        await appendAudit(client, "signup_accepted", command, command.userId, {
          challenge_id: command.challenge.challengeId,
        });
        await insertIdempotency(
          client,
          "sign_up",
          command,
          "accepted",
          command.userId,
        );
        return applied({ accepted: true as const });
      });
    },

    async resendVerification(command: IdentityResendVerificationCommand) {
      validateResend(command);
      return withTransaction(pool, async (client) => {
        const existingIdempotency = await findIdempotency(
          client,
          "resend_verification",
          command,
        );
        if (existingIdempotency) return replayed({ accepted: true as const });
        await advisoryLock(client, "identity-email", command.email);
        const user = await findUserForUpdate(client, command.email);
        if (!user || user.status === "active") {
          await appendAudit(
            client,
            "resend_ignored",
            command,
            user?.user_id ?? null,
            {
              reason_code: user ? "already_active" : "unknown_identity",
            },
          );
          await insertIdempotency(
            client,
            "resend_verification",
            command,
            "accepted",
            user?.user_id ?? null,
          );
          return applied({ accepted: true as const });
        }
        const challengeResult = await client.query<ChallengeRow>(
          `SELECT challenge_id, code_digest, key_version, attempt_count,
                  max_attempts, expires_at, consumed_at, superseded_at, created_at
             FROM app.email_verification_challenges
            WHERE user_id = $1
              AND consumed_at IS NULL
              AND superseded_at IS NULL
            FOR UPDATE`,
          [user.user_id],
        );
        const current = challengeResult.rows[0];
        if (
          current &&
          command.context.occurredAt.valueOf() - current.created_at.valueOf() <
            RESEND_COOLDOWN_MS
        ) {
          await appendAudit(client, "resend_ignored", command, user.user_id, {
            reason_code: "cooldown",
          });
          await insertIdempotency(
            client,
            "resend_verification",
            command,
            "accepted",
            user.user_id,
          );
          return applied({ accepted: true as const });
        }
        if (current) {
          await supersedeChallengeAndOutbox(
            client,
            current.challenge_id,
            command.context.occurredAt,
          );
        }
        await insertChallengeAndOutbox(client, command, user.user_id);
        await appendAudit(
          client,
          "verification_resent",
          command,
          user.user_id,
          {
            challenge_id: command.challenge.challengeId,
          },
        );
        await insertIdempotency(
          client,
          "resend_verification",
          command,
          "accepted",
          user.user_id,
        );
        return applied({ accepted: true as const });
      });
    },

    async verifyEmail(command: IdentityVerifyEmailCommand) {
      validateVerify(command);
      return withTransaction(pool, async (client) => {
        const existingIdempotency = await findIdempotency(
          client,
          "verify_email",
          command,
        );
        if (existingIdempotency) {
          return replayed(await verifyReplayValue(client, existingIdempotency));
        }
        await advisoryLock(client, "identity-email", command.email);
        const user = await findUserForUpdate(client, command.email);
        if (!user)
          return persistVerificationOutcome(
            client,
            command,
            null,
            "invalid_code",
          );
        if (user.status === "active") {
          return persistVerificationOutcome(
            client,
            command,
            user.user_id,
            "already_verified",
          );
        }
        const challengeResult = await client.query<ChallengeRow>(
          `SELECT challenge_id, code_digest, key_version, attempt_count,
                  max_attempts, expires_at, consumed_at, superseded_at, created_at
             FROM app.email_verification_challenges
            WHERE challenge_id = $1 AND user_id = $2
            FOR UPDATE`,
          [command.challengeId, user.user_id],
        );
        const challenge = challengeResult.rows[0];
        if (!challenge || challenge.consumed_at || challenge.superseded_at) {
          return persistVerificationOutcome(
            client,
            command,
            user.user_id,
            "invalid_code",
          );
        }
        if (challenge.attempt_count >= challenge.max_attempts) {
          return persistVerificationOutcome(
            client,
            command,
            user.user_id,
            "attempts_exhausted",
          );
        }
        if (command.context.occurredAt >= challenge.expires_at) {
          return persistVerificationOutcome(
            client,
            command,
            user.user_id,
            "expired",
          );
        }
        if (challenge.code_digest !== command.codeDigest) {
          const nextAttempts = challenge.attempt_count + 1;
          await client.query(
            `UPDATE app.email_verification_challenges
                SET attempt_count = $2
              WHERE challenge_id = $1`,
            [challenge.challenge_id, nextAttempts],
          );
          return persistVerificationOutcome(
            client,
            command,
            user.user_id,
            nextAttempts >= challenge.max_attempts
              ? "attempts_exhausted"
              : "invalid_code",
          );
        }
        await client.query(
          `UPDATE app.email_verification_challenges
              SET consumed_at = $2
            WHERE challenge_id = $1`,
          [challenge.challenge_id, command.context.occurredAt],
        );
        await client.query(
          `UPDATE app.identity_email_outbox
              SET status = 'dead', lease_until = NULL, lease_token = NULL,
                  updated_at = $2
            WHERE challenge_id = $1
              AND status IN ('pending', 'leased')`,
          [challenge.challenge_id, command.context.occurredAt],
        );
        await client.query(
          `UPDATE app.users
              SET status = 'active', activated_at = $2, updated_at = $2
            WHERE user_id = $1`,
          [user.user_id, command.context.occurredAt],
        );
        await client.query(
          `INSERT INTO app.user_sessions (
             session_id, user_id, token_digest, key_version,
             created_at, last_seen_at, idle_expires_at, absolute_expires_at
           ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7)`,
          [
            command.session.sessionId,
            user.user_id,
            command.session.tokenDigest,
            command.session.keyVersion,
            command.context.occurredAt,
            command.session.idleExpiresAt,
            command.session.absoluteExpiresAt,
          ],
        );
        await appendAudit(client, "email_verified", command, user.user_id, {
          challenge_id: challenge.challenge_id,
          session_id: command.session.sessionId,
        });
        await insertIdempotency(
          client,
          "verify_email",
          command,
          "verified",
          command.session.sessionId,
        );
        return applied<IdentityVerifyEmailValue>({
          absoluteExpiresAt: command.session.absoluteExpiresAt,
          keyVersion: command.session.keyVersion,
          sessionId: command.session.sessionId,
          status: "verified",
        });
      });
    },

    async close(): Promise<void> {
      await pool.end();
    },
  });
}
