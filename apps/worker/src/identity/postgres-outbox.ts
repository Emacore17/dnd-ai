import { Pool, type PoolClient } from "pg";

import type {
  ClaimedIdentityEmail,
  ClaimIdentityEmailBatchCommand,
  CompleteIdentityEmailCommand,
  FailIdentityEmailCommand,
  IdentityEmailOutbox,
} from "./outbox-dispatcher.js";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

interface CreatePostgresIdentityEmailOutboxOptions {
  readonly createLeaseToken: () => string;
  readonly databaseUrl: string;
}

interface OutboxRow {
  readonly attempt_count: number;
  readonly challenge_id: string;
  readonly delivery_email: string;
  readonly display_name: string;
  readonly expires_at: Date;
  readonly key_version: number;
  readonly outbox_id: string;
  readonly template_key: string;
}

function validateClaim(command: ClaimIdentityEmailBatchCommand): void {
  if (
    command.limit !== 25 ||
    command.leaseDurationMs !== 30_000 ||
    !Number.isFinite(command.occurredAt.valueOf())
  ) {
    throw new TypeError("identity email claim command is invalid");
  }
}

function validateCompletion(command: CompleteIdentityEmailCommand): void {
  if (
    !UUID_V4_PATTERN.test(command.outboxId) ||
    !UUID_V4_PATTERN.test(command.leaseToken) ||
    !Number.isFinite(command.occurredAt.valueOf())
  ) {
    throw new TypeError("identity email completion command is invalid");
  }
}

async function transaction<Result>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function createPostgresIdentityEmailOutbox(
  options: CreatePostgresIdentityEmailOutboxOptions,
): IdentityEmailOutbox {
  const pool = new Pool({
    application_name: "dnd-ai-worker-identity-email",
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    max: 4,
    options:
      "-c statement_timeout=10000 -c idle_in_transaction_session_timeout=10000",
  });
  let closePromise: Promise<void> | undefined;

  return Object.freeze({
    async claimBatch(
      command: ClaimIdentityEmailBatchCommand,
    ): Promise<readonly ClaimedIdentityEmail[]> {
      validateClaim(command);
      return transaction(pool, async (client) => {
        await client.query(
          `WITH abandoned AS (
             SELECT o.outbox_id
               FROM app.identity_email_outbox AS o
              WHERE (
                      (o.status = 'pending' AND o.next_attempt_at <= $1)
                      OR (o.status = 'leased' AND o.lease_until <= $1)
                    )
                AND (
                  o.attempt_count >= 5
                  OR NOT EXISTS (
                    SELECT 1
                      FROM app.users AS u
                      LEFT JOIN app.email_verification_challenges AS c
                        ON c.challenge_id = o.challenge_id
                       AND c.user_id = u.user_id
                      LEFT JOIN app.password_reset_challenges AS r
                        ON r.challenge_id = o.password_reset_challenge_id
                       AND r.user_id = u.user_id
                     WHERE u.user_id = o.user_id
                       AND (
                         (o.template_key = 'email_verification_v1'
                           AND u.status = 'pending'
                           AND c.consumed_at IS NULL
                           AND c.superseded_at IS NULL
                           AND c.expires_at > $1)
                         OR
                         (o.template_key = 'password_reset_v1'
                           AND u.status = 'active'
                           AND r.consumed_at IS NULL
                           AND r.superseded_at IS NULL
                           AND r.expires_at > $1)
                       )
                  )
                )
              ORDER BY o.next_attempt_at, o.created_at, o.outbox_id
              FOR UPDATE OF o SKIP LOCKED
              LIMIT $2
           )
           UPDATE app.identity_email_outbox AS o
              SET status = 'dead', lease_until = NULL, lease_token = NULL,
                  updated_at = $1
             FROM abandoned
            WHERE o.outbox_id = abandoned.outbox_id`,
          [command.occurredAt, command.limit],
        );
        const candidates = await client.query<OutboxRow>(
          `SELECT o.outbox_id,
                  COALESCE(o.challenge_id, o.password_reset_challenge_id) AS challenge_id,
                  o.attempt_count, o.template_key,
                  u.delivery_email, u.display_name,
                  COALESCE(c.key_version, r.key_version) AS key_version,
                  COALESCE(c.expires_at, r.expires_at) AS expires_at
             FROM app.identity_email_outbox AS o
             JOIN app.users AS u ON u.user_id = o.user_id
             LEFT JOIN app.email_verification_challenges AS c
               ON c.challenge_id = o.challenge_id AND c.user_id = u.user_id
             LEFT JOIN app.password_reset_challenges AS r
               ON r.challenge_id = o.password_reset_challenge_id
              AND r.user_id = u.user_id
            WHERE (
                    (o.status = 'pending' AND o.next_attempt_at <= $1)
                    OR (o.status = 'leased' AND o.lease_until <= $1)
                  )
              AND o.attempt_count < 5
              AND (
                (o.template_key = 'email_verification_v1'
                  AND u.status = 'pending'
                  AND c.consumed_at IS NULL
                  AND c.superseded_at IS NULL
                  AND c.expires_at > $1)
                OR
                (o.template_key = 'password_reset_v1'
                  AND u.status = 'active'
                  AND r.consumed_at IS NULL
                  AND r.superseded_at IS NULL
                  AND r.expires_at > $1)
              )
            ORDER BY o.next_attempt_at, o.created_at, o.outbox_id
            FOR UPDATE OF o SKIP LOCKED
            LIMIT $2`,
          [command.occurredAt, command.limit],
        );
        const leaseUntil = new Date(
          command.occurredAt.valueOf() + command.leaseDurationMs,
        );
        const claimed: ClaimedIdentityEmail[] = [];

        for (const row of candidates.rows) {
          const leaseToken = options.createLeaseToken();
          if (!UUID_V4_PATTERN.test(leaseToken)) {
            throw new TypeError("identity email lease token is invalid");
          }
          await client.query(
            `UPDATE app.identity_email_outbox
                SET status = 'leased', attempt_count = attempt_count + 1,
                    lease_until = $2, lease_token = $3, updated_at = $4
              WHERE outbox_id = $1`,
            [row.outbox_id, leaseUntil, leaseToken, command.occurredAt],
          );
          const common = {
            attemptNumber: row.attempt_count + 1,
            challengeId: row.challenge_id,
            expiresAt: row.expires_at,
            keyVersion: row.key_version,
            leaseToken,
            outboxId: row.outbox_id,
            recipient: row.delivery_email,
          } as const;
          if (row.template_key === "email_verification_v1") {
            claimed.push(
              Object.freeze({
                ...common,
                displayName: row.display_name,
                kind: "verification",
              }),
            );
          } else if (row.template_key === "password_reset_v1") {
            claimed.push(Object.freeze({ ...common, kind: "password_reset" }));
          } else {
            throw new TypeError("identity email template is unsupported");
          }
        }

        return Object.freeze(claimed);
      });
    },

    async markSent(command: CompleteIdentityEmailCommand): Promise<boolean> {
      validateCompletion(command);
      const result = await pool.query(
        `UPDATE app.identity_email_outbox
            SET status = 'sent', lease_until = NULL, lease_token = NULL,
                sent_at = $3, updated_at = $3
          WHERE outbox_id = $1 AND status = 'leased' AND lease_token = $2`,
        [command.outboxId, command.leaseToken, command.occurredAt],
      );
      return result.rowCount === 1;
    },

    async markFailed(command: FailIdentityEmailCommand): Promise<boolean> {
      validateCompletion(command);
      if (
        !Number.isFinite(command.nextAttemptAt.valueOf()) ||
        command.nextAttemptAt < command.occurredAt
      ) {
        throw new TypeError("identity email retry time is invalid");
      }
      const result = await pool.query(
        `UPDATE app.identity_email_outbox
            SET status = CASE WHEN $4 THEN 'dead' ELSE 'pending' END,
                next_attempt_at = $3, lease_until = NULL, lease_token = NULL,
                updated_at = $5
          WHERE outbox_id = $1 AND status = 'leased' AND lease_token = $2`,
        [
          command.outboxId,
          command.leaseToken,
          command.nextAttemptAt,
          command.terminal,
          command.occurredAt,
        ],
      );
      return result.rowCount === 1;
    },

    async release(command: CompleteIdentityEmailCommand): Promise<boolean> {
      validateCompletion(command);
      const result = await pool.query(
        `UPDATE app.identity_email_outbox
            SET status = 'pending', attempt_count = GREATEST(0, attempt_count - 1),
                next_attempt_at = $3,
                lease_until = NULL, lease_token = NULL, updated_at = $3
          WHERE outbox_id = $1 AND status = 'leased' AND lease_token = $2`,
        [command.outboxId, command.leaseToken, command.occurredAt],
      );
      return result.rowCount === 1;
    },

    close(): Promise<void> {
      closePromise ??= pool.end();
      return closePromise;
    },
  });
}
