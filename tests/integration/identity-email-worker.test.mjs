import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import pg from "pg";

import {
  createFakeVerificationEmailSender,
  createPostgresIdentityEmailOutbox,
  dispatchIdentityEmailBatch,
} from "../../apps/worker/dist/index.js";
import {
  createPostgresIdentityStore,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const START = new Date("2026-07-16T10:00:00.000Z");
const CHALLENGE_KEY = Buffer.alloc(32, 7);
const RESET_KEY = Buffer.alloc(32, 17);
const PHC = `$argon2id$v=19$m=19456,t=2,p=1$${"c2FsdA".repeat(4)}$${"aGFzaA".repeat(8)}`;
const { Client } = pg;

function uuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function hex(character) {
  return character.repeat(64);
}

function signUp(number) {
  const email = `worker${number}@example.test`;
  return {
    challenge: {
      challengeId: uuid(10_000 + number),
      codeDigest: hex("d"),
      expiresAt: new Date(START.valueOf() + 600_000),
      keyVersion: 1,
    },
    context: {
      actorSubjectHash: hex("a"),
      correlationId: `correlation-${String(number).padStart(8, "0")}`,
      idempotencyId: uuid(20_000 + number),
      idempotencyKeyDigest: number.toString(16).padStart(64, "0"),
      occurredAt: START,
      requestFingerprint: (number + 100).toString(16).padStart(64, "0"),
      requestId: `request-${String(number).padStart(8, "0")}`,
    },
    deliveryEmail: email,
    displayName: `Worker ${number}`,
    email,
    outboxId: uuid(30_000 + number),
    passwordHash: { pepperVersion: 1, phc: PHC },
    userId: uuid(40_000 + number),
  };
}

function dispatcher(outbox, sender, now) {
  return dispatchIdentityEmailBatch({
    challengeKey: CHALLENGE_KEY,
    challengeKeyVersion: 1,
    clock: { now: () => now },
    jitterMs: () => 0,
    outbox,
    resetKey: RESET_KEY,
    resetKeyVersion: 1,
    sender,
  });
}

async function replaceVerificationWithReset(databaseUrl, command, number) {
  const client = new Client({ connectionString: databaseUrl });
  const challengeId = uuid(80_000 + number);
  const outboxId = uuid(90_000 + number);
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE app.users
          SET status = 'active', activated_at = $2, updated_at = $2
        WHERE user_id = $1`,
      [command.userId, START],
    );
    await client.query(
      `UPDATE app.email_verification_challenges
          SET consumed_at = $2
        WHERE challenge_id = $1`,
      [command.challenge.challengeId, START],
    );
    await client.query(
      `UPDATE app.identity_email_outbox
          SET status = 'dead', updated_at = $2
        WHERE outbox_id = $1`,
      [command.outboxId, START],
    );
    await client.query(
      `INSERT INTO app.password_reset_challenges (
         challenge_id, user_id, code_digest, key_version, expires_at, created_at
       ) VALUES ($1, $2, $3, 1, $4, $5)`,
      [
        challengeId,
        command.userId,
        hex("e"),
        new Date(START.valueOf() + 600_000),
        START,
      ],
    );
    await client.query(
      `INSERT INTO app.identity_email_outbox (
         outbox_id, user_id, password_reset_challenge_id, template_key,
         next_attempt_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'password_reset_v1', $4, $4, $4)`,
      [outboxId, command.userId, challengeId, START],
    );
    await client.query("COMMIT");
    return { challengeId, outboxId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function inspectOutbox(databaseUrl, outboxId) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT status, attempt_count
         FROM app.identity_email_outbox
        WHERE outbox_id = $1`,
      [outboxId],
    );
    return {
      attemptCount: result.rows[0].attempt_count,
      status: result.rows[0].status,
    };
  } finally {
    await client.end();
  }
}

async function inspectIdentityCounts(databaseUrl, userId) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT
         (SELECT count(*)::integer FROM app.users WHERE user_id = $1) AS users,
         (SELECT count(*)::integer FROM app.email_verification_challenges WHERE user_id = $1) AS challenges,
         (SELECT count(*)::integer FROM app.identity_email_outbox WHERE user_id = $1) AS outbox,
         (SELECT count(*)::integer FROM app.user_sessions WHERE user_id = $1) AS sessions`,
      [userId],
    );
    return result.rows[0];
  } finally {
    await client.end();
  }
}

test(
  "PostgreSQL leases are exclusive, reclaimable and stale acknowledgements cannot win",
  { timeout: 240_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const identity = createPostgresIdentityStore({ databaseUrl });
      const outboxA = createPostgresIdentityEmailOutbox({
        createLeaseToken: () => uuid(50_001),
        databaseUrl,
      });
      const outboxB = createPostgresIdentityEmailOutbox({
        createLeaseToken: () => uuid(50_002),
        databaseUrl,
      });

      try {
        await identity.signUp(signUp(1));
        const command = {
          leaseDurationMs: 30_000,
          limit: 25,
          occurredAt: START,
        };
        const [claimedA, claimedB] = await Promise.all([
          outboxA.claimBatch(command),
          outboxB.claimBatch(command),
        ]);
        assert.equal(claimedA.length + claimedB.length, 1);
        const stale = claimedA[0] ?? claimedB[0];
        const reclaiming = claimedA.length === 1 ? outboxB : outboxA;
        const reclaimed = await reclaiming.claimBatch({
          ...command,
          occurredAt: new Date(START.valueOf() + 31_000),
        });
        assert.equal(reclaimed.length, 1);
        assert.equal(reclaimed[0].attemptNumber, 2);
        assert.equal(
          await (claimedA.length === 1 ? outboxA : outboxB).markSent({
            leaseToken: stale.leaseToken,
            occurredAt: new Date(START.valueOf() + 31_001),
            outboxId: stale.outboxId,
          }),
          false,
        );
        assert.equal(
          await reclaiming.markSent({
            leaseToken: reclaimed[0].leaseToken,
            occurredAt: new Date(START.valueOf() + 31_002),
            outboxId: reclaimed[0].outboxId,
          }),
          true,
        );

        const state = await inspectOutbox(databaseUrl, stale.outboxId);
        assert.deepEqual(state, { attemptCount: 2, status: "sent" });

        const releasedCommand = signUp(4);
        await identity.signUp(releasedCommand);
        const [released] = await outboxA.claimBatch({
          ...command,
          occurredAt: new Date(START.valueOf() + 31_003),
        });
        assert.equal(
          await outboxA.release({
            leaseToken: released.leaseToken,
            occurredAt: new Date(START.valueOf() + 31_004),
            outboxId: released.outboxId,
          }),
          true,
        );
        assert.deepEqual(
          await inspectOutbox(databaseUrl, releasedCommand.outboxId),
          { attemptCount: 0, status: "pending" },
        );
      } finally {
        await Promise.all([identity.close(), outboxA.close(), outboxB.close()]);
      }
    });
  },
);

test(
  "password reset rows are discriminated and delivered with the reset key",
  { timeout: 240_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const identity = createPostgresIdentityStore({ databaseUrl });
      const outbox = createPostgresIdentityEmailOutbox({
        createLeaseToken: () => uuid(55_001),
        databaseUrl,
      });
      const sender = createFakeVerificationEmailSender();

      try {
        const command = signUp(5);
        await identity.signUp(command);
        const reset = await replaceVerificationWithReset(
          databaseUrl,
          command,
          5,
        );
        const [claimed] = await outbox.claimBatch({
          leaseDurationMs: 30_000,
          limit: 25,
          occurredAt: START,
        });
        assert.equal(claimed.kind, "password_reset");
        assert.equal(claimed.challengeId, reset.challengeId);
        await outbox.release({
          leaseToken: claimed.leaseToken,
          occurredAt: START,
          outboxId: claimed.outboxId,
        });

        const summary = await dispatcher(outbox, sender, START);
        assert.equal(summary.sent, 1);
        assert.deepEqual(
          sender.messages.map(({ kind, recipient }) => ({ kind, recipient })),
          [{ kind: "password_reset", recipient: command.deliveryEmail }],
        );
        assert.deepEqual(await inspectOutbox(databaseUrl, reset.outboxId), {
          attemptCount: 1,
          status: "sent",
        });
      } finally {
        await Promise.all([identity.close(), outbox.close()]);
      }
    });
  },
);

test(
  "dispatcher retries bounded failures to dead without creating canonical identity mutations",
  { timeout: 240_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const identity = createPostgresIdentityStore({ databaseUrl });
      let lease = 60_000;
      const outbox = createPostgresIdentityEmailOutbox({
        createLeaseToken: () => uuid(lease++),
        databaseUrl,
      });
      const failingSender = {
        async send() {
          throw new Error("simulated timeout");
        },
      };

      try {
        const command = signUp(2);
        await identity.signUp(command);
        let now = START;
        for (let attempt = 1; attempt <= 5; attempt += 1) {
          const summary = await dispatcher(outbox, failingSender, now);
          assert.equal(summary.claimed, 1);
          if (attempt < 5) {
            assert.equal(summary.retried, 1);
            now = new Date(now.valueOf() + 5_000 * 2 ** (attempt - 1));
          } else {
            assert.equal(summary.dead, 1);
          }
        }

        assert.deepEqual(await inspectOutbox(databaseUrl, command.outboxId), {
          attemptCount: 5,
          status: "dead",
        });
        assert.deepEqual(
          await inspectIdentityCounts(databaseUrl, command.userId),
          {
            challenges: 1,
            outbox: 1,
            sessions: 0,
            users: 1,
          },
        );
      } finally {
        await Promise.all([identity.close(), outbox.close()]);
      }
    });
  },
);

test(
  "a crash after send can duplicate delivery but never challenge or user state",
  { timeout: 240_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const identity = createPostgresIdentityStore({ databaseUrl });
      let lease = 70_000;
      const outbox = createPostgresIdentityEmailOutbox({
        createLeaseToken: () => uuid(lease++),
        databaseUrl,
      });
      const sender = createFakeVerificationEmailSender();

      try {
        const command = signUp(3);
        await identity.signUp(command);
        const [crashedJob] = await outbox.claimBatch({
          leaseDurationMs: 30_000,
          limit: 25,
          occurredAt: START,
        });
        await sender.send({
          code: "123456",
          displayName: crashedJob.displayName,
          expiresInMinutes: 10,
          kind: "verification",
          recipient: crashedJob.recipient,
        });

        const summary = await dispatcher(
          outbox,
          sender,
          new Date(START.valueOf() + 31_000),
        );
        assert.equal(summary.sent, 1);
        assert.equal(sender.messages.length, 2);
        assert.deepEqual(
          await inspectIdentityCounts(databaseUrl, command.userId),
          {
            challenges: 1,
            outbox: 1,
            sessions: 0,
            users: 1,
          },
        );
      } finally {
        await Promise.all([identity.close(), outbox.close()]);
      }
    });
  },
);
