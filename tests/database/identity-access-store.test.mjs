import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import {
  IdentityPersistenceError,
  createPostgresIdentityAccessStore,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const { Client } = pg;
const START = new Date("2026-07-17T08:00:00.000Z");
const DAY_MS = 86_400_000;
const MONTH_MS = 2_592_000_000;
const USER_ID = "10000000-0000-4000-8000-000000000001";
const EMAIL = "player@example.test";
const PASSWORD_HASH = Object.freeze({
  pepperVersion: 3,
  phc: `$argon2id$v=19$m=19456,t=2,p=1$${"c2FsdA".repeat(4)}$${"aGFzaA".repeat(8)}`,
});

function uuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function hash(character) {
  return character.repeat(64);
}

function context(number, actor = "a", occurredAt = START) {
  return Object.freeze({
    actorSubjectHash: hash(actor),
    correlationId: `correlation-${String(number).padStart(4, "0")}`,
    idempotencyId: uuid(1000 + number),
    idempotencyKeyDigest: hash(String(number % 10)),
    occurredAt: new Date(occurredAt),
    requestFingerprint: hash("f"),
    requestId: `request-${String(number).padStart(4, "0")}`,
  });
}

function session(number, occurredAt = START) {
  return Object.freeze({
    absoluteExpiresAt: new Date(occurredAt.valueOf() + MONTH_MS),
    idleExpiresAt: new Date(occurredAt.valueOf() + DAY_MS),
    keyVersion: 9,
    sessionId: uuid(2000 + number),
    tokenDigest: hash((number % 16).toString(16)),
  });
}

function resetChallenge(number, occurredAt = START) {
  return Object.freeze({
    challengeId: uuid(3000 + number),
    codeDigest: hash(number % 2 === 0 ? "b" : "e"),
    expiresAt: new Date(occurredAt.valueOf() + 600_000),
    keyVersion: 11,
  });
}

async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function seedActiveUser(databaseUrl) {
  const client = await connect(databaseUrl);
  try {
    await client.query(
      `INSERT INTO app.users (
         user_id, canonical_email, delivery_email, display_name,
         status, created_at, activated_at, updated_at
       ) VALUES ($1, $2, $2, 'Player', 'active', $3, $3, $3)`,
      [USER_ID, EMAIL, START],
    );
    await client.query(
      `INSERT INTO app.user_credentials (
         user_id, password_hash, pepper_version, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $4)`,
      [USER_ID, PASSWORD_HASH.phc, PASSWORD_HASH.pepperVersion, START],
    );
  } finally {
    await client.end();
  }
}

test(
  "access store applies rate, sign-in, refresh, logout and global revocation atomically",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      await seedActiveUser(databaseUrl);
      const store = createPostgresIdentityAccessStore({ databaseUrl });

      try {
        assert.deepEqual(await store.findSignInCredential(EMAIL), {
          credentialVersion: 1,
          email: EMAIL,
          passwordHash: PASSWORD_HASH,
          status: "active",
          userId: USER_ID,
        });
        assert.equal(
          await store.findSignInCredential("missing@example.test"),
          null,
        );

        for (let attempt = 0; attempt < 10; attempt += 1) {
          assert.equal(
            (
              await store.consumeRateLimit({
                occurredAt: START,
                scope: "sign_in_ip",
                subjectHash: hash("a"),
              })
            ).allowed,
            true,
          );
        }
        const limited = await store.consumeRateLimit({
          occurredAt: START,
          scope: "sign_in_ip",
          subjectHash: hash("a"),
        });
        assert.equal(limited.allowed, false);
        assert.equal(limited.retryAfterSeconds, 900);

        const invalidVersion = await store.signIn({
          context: context(1),
          credentialVersion: 2,
          session: session(1),
          userId: USER_ID,
        });
        assert.deepEqual(invalidVersion.value, {
          status: "credentials_invalid",
        });

        const firstCommand = {
          context: context(2),
          credentialVersion: 1,
          session: session(2),
          userId: USER_ID,
        };
        const first = await store.signIn(firstCommand);
        assert.equal(first.kind, "applied");
        assert.equal(first.value.status, "authenticated");
        assert.equal((await store.signIn(firstCommand)).kind, "replayed");
        await assert.rejects(
          store.signIn({
            ...firstCommand,
            context: {
              ...firstCommand.context,
              requestFingerprint: hash("e"),
            },
          }),
          (error) => {
            assert.equal(error instanceof IdentityPersistenceError, true);
            assert.equal(error.code, "IDEMPOTENCY_CONFLICT");
            return true;
          },
        );

        const second = await store.signIn({
          context: context(3, "b"),
          credentialVersion: 1,
          session: session(3),
          userId: USER_ID,
        });
        assert.equal(second.value.status, "authenticated");

        const refreshAt = new Date(START.valueOf() + 3_600_000);
        const refreshCommand = {
          context: context(4, "c", refreshAt),
          currentTokenDigest: session(2).tokenDigest,
          session: session(4, refreshAt),
        };
        const refreshed = await store.refreshSession(refreshCommand);
        assert.equal(refreshed.value.status, "authenticated");
        assert.equal(
          refreshed.value.absoluteExpiresAt.valueOf(),
          first.value.absoluteExpiresAt.valueOf(),
        );
        assert.equal(
          (await store.refreshSession(refreshCommand)).kind,
          "replayed",
        );

        const signedOut = await store.signOut({
          context: context(5, "d", refreshAt),
          currentTokenDigest: session(4).tokenDigest,
        });
        assert.deepEqual(signedOut.value, { status: "signed_out" });
        assert.equal(
          (
            await store.signOut({
              context: context(6, "e", refreshAt),
              currentTokenDigest: null,
            })
          ).value.status,
          "signed_out",
        );

        const revoked = await store.revokeAllSessions({
          context: context(7, "f", refreshAt),
          currentTokenDigest: session(3).tokenDigest,
        });
        assert.deepEqual(revoked.value, { status: "sessions_revoked" });
        const invalidSession = await store.revokeAllSessions({
          context: context(8, "a", refreshAt),
          currentTokenDigest: hash("b"),
        });
        assert.deepEqual(invalidSession.value, { status: "session_invalid" });

        const client = await connect(databaseUrl);
        try {
          const active = await client.query(
            "SELECT count(*)::integer AS count FROM app.user_sessions WHERE user_id = $1 AND revoked_at IS NULL",
            [USER_ID],
          );
          assert.equal(active.rows[0].count, 0);
        } finally {
          await client.end();
        }
      } finally {
        await Promise.all([store.close(), store.close()]);
      }
    });
  },
);

test(
  "access store supersedes reset codes and allows only one concurrent reset commit",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      await seedActiveUser(databaseUrl);
      const store = createPostgresIdentityAccessStore({ databaseUrl });

      try {
        const ignored = await store.requestPasswordReset({
          challenge: resetChallenge(1),
          context: context(11),
          deliveryEmail: "missing@example.test",
          email: "missing@example.test",
          outboxId: uuid(4011),
        });
        assert.deepEqual(ignored.value, { accepted: true });

        const firstRequest = {
          challenge: resetChallenge(2),
          context: context(12, "b"),
          deliveryEmail: EMAIL,
          email: EMAIL,
          outboxId: uuid(4012),
        };
        assert.equal(
          (await store.requestPasswordReset(firstRequest)).kind,
          "applied",
        );
        assert.equal(
          (await store.requestPasswordReset(firstRequest)).kind,
          "replayed",
        );

        const secondRequest = {
          challenge: resetChallenge(3),
          context: context(13, "c"),
          deliveryEmail: EMAIL,
          email: EMAIL,
          outboxId: uuid(4013),
        };
        await store.requestPasswordReset(secondRequest);
        const reference = await store.findPasswordResetChallenge(EMAIL);
        assert.equal(
          reference.challengeId,
          secondRequest.challenge.challengeId,
        );
        assert.equal(reference.credentialVersion, 1);

        const rejectCommand = {
          challengeId: reference.challengeId,
          context: context(14, "d"),
        };
        assert.equal(
          (await store.rejectPasswordReset(rejectCommand)).kind,
          "applied",
        );
        assert.equal(
          (await store.rejectPasswordReset(rejectCommand)).kind,
          "replayed",
        );

        await store.signIn({
          context: context(15, "e"),
          credentialVersion: 1,
          session: session(15),
          userId: USER_ID,
        });
        const thirdRequest = {
          challenge: resetChallenge(4),
          context: context(16, "f"),
          deliveryEmail: EMAIL,
          email: EMAIL,
          outboxId: uuid(4016),
        };
        await store.requestPasswordReset(thirdRequest);
        const current = await store.findPasswordResetChallenge(EMAIL);
        const replacementHash = {
          pepperVersion: 3,
          phc: PASSWORD_HASH.phc.replace("aGFzaA", "bmV3aA"),
        };
        const results = await Promise.all([
          store.confirmPasswordReset({
            challengeId: current.challengeId,
            context: context(17, "a"),
            credentialVersion: current.credentialVersion,
            passwordHash: replacementHash,
          }),
          store.confirmPasswordReset({
            challengeId: current.challengeId,
            context: context(18, "b"),
            credentialVersion: current.credentialVersion,
            passwordHash: replacementHash,
          }),
        ]);
        assert.equal(
          results.filter(({ value }) => value.status === "password_reset")
            .length,
          1,
        );
        assert.equal(
          results.filter(({ value }) => value.status === "invalid").length,
          1,
        );

        const client = await connect(databaseUrl);
        try {
          const credential = await client.query(
            `SELECT password_hash, credential_version
               FROM app.user_credentials
              WHERE user_id = $1`,
            [USER_ID],
          );
          assert.deepEqual(credential.rows[0], {
            credential_version: "2",
            password_hash: replacementHash.phc,
          });
          const activeSessions = await client.query(
            "SELECT count(*)::integer AS count FROM app.user_sessions WHERE user_id = $1 AND revoked_at IS NULL",
            [USER_ID],
          );
          assert.equal(activeSessions.rows[0].count, 0);
          const attempts = await client.query(
            "SELECT attempt_count FROM app.password_reset_challenges WHERE challenge_id = $1",
            [secondRequest.challenge.challengeId],
          );
          assert.equal(attempts.rows[0].attempt_count, 1);
          const resetOutbox = await client.query(
            `SELECT status
               FROM app.identity_email_outbox
              WHERE password_reset_challenge_id = $1`,
            [firstRequest.challenge.challengeId],
          );
          assert.equal(resetOutbox.rows[0].status, "dead");
        } finally {
          await client.end();
        }
      } finally {
        await store.close();
      }
    });
  },
);
