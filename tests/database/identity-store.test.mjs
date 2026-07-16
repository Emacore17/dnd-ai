import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import {
  IdentityPersistenceError,
  createPostgresIdentityStore,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const { Client } = pg;
const START = new Date("2026-07-16T08:00:00.000Z");
const PHC = `$argon2id$v=19$m=19456,t=2,p=1$${"c2FsdA".repeat(4)}$${"aGFzaA".repeat(8)}`;

function uuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function hex(character) {
  return character.repeat(64);
}

function at(milliseconds) {
  return new Date(START.valueOf() + milliseconds);
}

function context(number, overrides = {}) {
  return {
    actorSubjectHash: hex("a"),
    correlationId: `correlation-${String(number).padStart(8, "0")}`,
    idempotencyId: uuid(10_000 + number),
    idempotencyKeyDigest: number.toString(16).padStart(64, "0"),
    occurredAt: START,
    requestFingerprint: (number + 1_000).toString(16).padStart(64, "0"),
    requestId: `request-${String(number).padStart(8, "0")}`,
    ...overrides,
  };
}

function challenge(number, occurredAt = START) {
  return {
    challengeId: uuid(20_000 + number),
    codeDigest: hex("d"),
    expiresAt: new Date(occurredAt.valueOf() + 600_000),
    keyVersion: 1,
  };
}

function session(number, occurredAt = START) {
  return {
    absoluteExpiresAt: new Date(occurredAt.valueOf() + 2_592_000_000),
    idleExpiresAt: new Date(occurredAt.valueOf() + 86_400_000),
    keyVersion: 1,
    sessionId: uuid(30_000 + number),
    tokenDigest: (number + 2_000).toString(16).padStart(64, "0"),
  };
}

function signUp(number, email, overrides = {}) {
  const { context: contextOverrides, ...commandOverrides } = overrides;
  const occurredAt = contextOverrides?.occurredAt ?? START;
  return {
    challenge: challenge(number, occurredAt),
    context: context(number, contextOverrides),
    deliveryEmail: email,
    displayName: `Player ${number}`,
    email,
    outboxId: uuid(40_000 + number),
    passwordHash: { pepperVersion: 1, phc: PHC },
    userId: uuid(50_000 + number),
    ...commandOverrides,
  };
}

function verify(number, email, challengeId, codeDigest, overrides = {}) {
  const { context: contextOverrides, ...commandOverrides } = overrides;
  const occurredAt = contextOverrides?.occurredAt ?? START;
  return {
    challengeId,
    codeDigest,
    context: context(number, contextOverrides),
    email,
    session: session(number, occurredAt),
    ...commandOverrides,
  };
}

function resend(number, email, occurredAt) {
  return {
    challenge: challenge(number, occurredAt),
    context: context(number, {
      actorSubjectHash: hex("8"),
      idempotencyId: uuid(60_000 + number),
      idempotencyKeyDigest: number.toString(16).padStart(64, "0"),
      occurredAt,
      requestFingerprint: (number + 100).toString(16).padStart(64, "0"),
    }),
    email,
    outboxId: uuid(70_000 + number),
  };
}

async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

function assertPersistenceError(error, code) {
  assert.equal(error instanceof IdentityPersistenceError, true);
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//iu);
  assert.doesNotMatch(error.message, /password|example\.test/iu);
  return true;
}

test(
  "identity store is atomic, idempotent, bounded and concurrency safe",
  { timeout: 240_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const store = createPostgresIdentityStore({ databaseUrl });
      const client = await connect(databaseUrl);

      try {
        const email = "first@example.test";
        const first = signUp(1, email);
        assert.deepEqual(await store.signUp(first), {
          kind: "applied",
          value: { accepted: true },
        });
        assert.deepEqual(await store.signUp(first), {
          kind: "replayed",
          value: { accepted: true },
        });
        await assert.rejects(
          store.signUp({
            ...first,
            context: {
              ...first.context,
              requestFingerprint: hex("f"),
            },
          }),
          (error) => assertPersistenceError(error, "IDEMPOTENCY_CONFLICT"),
        );

        const initialCounts = await client.query(
          `SELECT
             (SELECT count(*)::integer FROM app.users WHERE canonical_email = $1) AS users,
             (SELECT count(*)::integer FROM app.user_credentials c JOIN app.users u USING (user_id) WHERE u.canonical_email = $1) AS credentials,
             (SELECT count(*)::integer FROM app.email_verification_challenges c JOIN app.users u USING (user_id) WHERE u.canonical_email = $1) AS challenges,
             (SELECT count(*)::integer FROM app.identity_email_outbox o JOIN app.users u USING (user_id) WHERE u.canonical_email = $1) AS outbox`,
          [email],
        );
        assert.deepEqual(initialCounts.rows[0], {
          challenges: 1,
          credentials: 1,
          outbox: 1,
          users: 1,
        });

        assert.deepEqual(
          await store.resendVerification(resend(2, email, at(59_000))),
          { kind: "applied", value: { accepted: true } },
        );
        assert.equal(
          (
            await client.query(
              `SELECT count(*)::integer AS count
                 FROM app.email_verification_challenges c
                 JOIN app.users u USING (user_id)
                WHERE u.canonical_email = $1`,
              [email],
            )
          ).rows[0].count,
          1,
        );

        const resendCommand = resend(3, email, at(61_000));
        assert.deepEqual(await store.resendVerification(resendCommand), {
          kind: "applied",
          value: { accepted: true },
        });
        assert.deepEqual(await store.resendVerification(resendCommand), {
          kind: "replayed",
          value: { accepted: true },
        });
        const challengeStates = await client.query(
          `SELECT challenge_id, consumed_at, superseded_at
             FROM app.email_verification_challenges c
             JOIN app.users u USING (user_id)
            WHERE u.canonical_email = $1
            ORDER BY c.created_at, challenge_id`,
          [email],
        );
        assert.equal(challengeStates.rowCount, 2);
        assert.equal(
          challengeStates.rows[0].superseded_at instanceof Date,
          true,
        );
        assert.equal(challengeStates.rows[1].superseded_at, null);
        const outboxStates = await client.query(
          `SELECT o.status
             FROM app.identity_email_outbox o
             JOIN app.users u USING (user_id)
            WHERE u.canonical_email = $1
            ORDER BY o.created_at, outbox_id`,
          [email],
        );
        assert.deepEqual(outboxStates.rows, [
          { status: "dead" },
          { status: "pending" },
        ]);

        const current = await store.findVerificationChallenge(email);
        assert.deepEqual(current, {
          challengeId: resendCommand.challenge.challengeId,
          keyVersion: 1,
        });
        const wrong = verify(4, email, current.challengeId, hex("0"), {
          context: { occurredAt: at(62_000) },
        });
        assert.deepEqual(await store.verifyEmail(wrong), {
          kind: "applied",
          value: { status: "invalid_code" },
        });
        assert.deepEqual(await store.verifyEmail(wrong), {
          kind: "replayed",
          value: { status: "invalid_code" },
        });

        const verifiedCommand = verify(
          5,
          email,
          current.challengeId,
          resendCommand.challenge.codeDigest,
          { context: { occurredAt: at(63_000) } },
        );
        assert.deepEqual(await store.verifyEmail(verifiedCommand), {
          kind: "applied",
          value: {
            absoluteExpiresAt: verifiedCommand.session.absoluteExpiresAt,
            keyVersion: 1,
            sessionId: verifiedCommand.session.sessionId,
            status: "verified",
          },
        });
        assert.deepEqual(await store.verifyEmail(verifiedCommand), {
          kind: "replayed",
          value: {
            absoluteExpiresAt: verifiedCommand.session.absoluteExpiresAt,
            keyVersion: 1,
            sessionId: verifiedCommand.session.sessionId,
            status: "verified",
          },
        });
        const activated = await client.query(
          `SELECT u.status,
                  u.activated_at,
                  c.consumed_at,
                  c.attempt_count,
                  s.token_digest
             FROM app.users u
             JOIN app.email_verification_challenges c ON c.user_id = u.user_id
             JOIN app.user_sessions s ON s.user_id = u.user_id
            WHERE u.canonical_email = $1
              AND c.challenge_id = $2`,
          [email, current.challengeId],
        );
        assert.equal(activated.rows[0].status, "active");
        assert.equal(activated.rows[0].activated_at instanceof Date, true);
        assert.equal(activated.rows[0].consumed_at instanceof Date, true);
        assert.equal(activated.rows[0].attempt_count, 1);
        assert.equal(
          activated.rows[0].token_digest,
          verifiedCommand.session.tokenDigest,
        );

        const activeRetry = signUp(6, email, {
          context: {
            actorSubjectHash: hex("0"),
            idempotencyKeyDigest: hex("f"),
            occurredAt: at(64_000),
            requestFingerprint: hex("e"),
          },
        });
        assert.deepEqual(await store.signUp(activeRetry), {
          kind: "applied",
          value: { accepted: true },
        });
        const activeRetryCounts = await client.query(
          `SELECT
             (SELECT count(*)::integer FROM app.email_verification_challenges c JOIN app.users u USING (user_id) WHERE u.canonical_email = $1) AS challenges,
             (SELECT count(*)::integer FROM app.identity_email_outbox o JOIN app.users u USING (user_id) WHERE u.canonical_email = $1) AS outbox,
             (SELECT count(*)::integer FROM app.user_sessions s JOIN app.users u USING (user_id) WHERE u.canonical_email = $1) AS sessions`,
          [email],
        );
        assert.deepEqual(activeRetryCounts.rows[0], {
          challenges: 2,
          outbox: 2,
          sessions: 1,
        });

        const exhaustedEmail = "exhausted@example.test";
        const exhaustedSignup = signUp(10, exhaustedEmail, {
          context: {
            actorSubjectHash: hex("1"),
            idempotencyKeyDigest: hex("2"),
          },
        });
        await store.signUp(exhaustedSignup);
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const result = await store.verifyEmail(
            verify(
              20 + attempt,
              exhaustedEmail,
              exhaustedSignup.challenge.challengeId,
              hex("0"),
              {
                context: {
                  actorSubjectHash: hex("3"),
                  idempotencyKeyDigest: String(attempt + 1).repeat(64),
                  occurredAt: at(attempt * 1_000),
                  requestFingerprint: String(attempt + 4).repeat(64),
                },
              },
            ),
          );
          assert.equal(
            result.value.status,
            attempt === 4 ? "attempts_exhausted" : "invalid_code",
          );
        }
        assert.deepEqual(
          await store.verifyEmail(
            verify(
              30,
              exhaustedEmail,
              exhaustedSignup.challenge.challengeId,
              exhaustedSignup.challenge.codeDigest,
              {
                context: {
                  actorSubjectHash: hex("3"),
                  idempotencyKeyDigest: hex("6"),
                  occurredAt: at(6_000),
                  requestFingerprint: hex("7"),
                },
              },
            ),
          ),
          { kind: "applied", value: { status: "attempts_exhausted" } },
        );

        const expiredEmail = "expired@example.test";
        const expiredSignup = signUp(40, expiredEmail, {
          context: {
            actorSubjectHash: hex("4"),
            idempotencyKeyDigest: hex("5"),
          },
        });
        await store.signUp(expiredSignup);
        assert.deepEqual(
          await store.verifyEmail(
            verify(
              41,
              expiredEmail,
              expiredSignup.challenge.challengeId,
              expiredSignup.challenge.codeDigest,
              {
                context: {
                  actorSubjectHash: hex("4"),
                  idempotencyKeyDigest: hex("6"),
                  occurredAt: at(600_001),
                  requestFingerprint: hex("7"),
                },
              },
            ),
          ),
          { kind: "applied", value: { status: "expired" } },
        );

        const concurrentEmail = "concurrent@example.test";
        const concurrentSignups = await Promise.all([
          store.signUp(
            signUp(50, concurrentEmail, {
              context: {
                actorSubjectHash: hex("8"),
                idempotencyKeyDigest: hex("9"),
              },
            }),
          ),
          store.signUp(
            signUp(51, concurrentEmail, {
              context: {
                actorSubjectHash: hex("a"),
                idempotencyKeyDigest: hex("b"),
              },
            }),
          ),
        ]);
        assert.deepEqual(
          concurrentSignups.map(({ kind }) => kind),
          ["applied", "applied"],
        );
        const concurrentRows = await client.query(
          `SELECT
             (SELECT count(*)::integer FROM app.users WHERE canonical_email = $1) AS users,
             (SELECT count(*)::integer FROM app.email_verification_challenges c JOIN app.users u USING (user_id) WHERE u.canonical_email = $1) AS challenges,
             (SELECT count(*)::integer FROM app.email_verification_challenges c JOIN app.users u USING (user_id) WHERE u.canonical_email = $1 AND c.consumed_at IS NULL AND c.superseded_at IS NULL) AS current_challenges,
             (SELECT count(*)::integer FROM app.identity_email_outbox o JOIN app.users u USING (user_id) WHERE u.canonical_email = $1 AND o.status = 'pending') AS pending_outbox`,
          [concurrentEmail],
        );
        assert.deepEqual(concurrentRows.rows[0], {
          challenges: 2,
          current_challenges: 1,
          pending_outbox: 1,
          users: 1,
        });
        const concurrentChallenge =
          await store.findVerificationChallenge(concurrentEmail);
        const storedDigest = (
          await client.query(
            `SELECT code_digest
               FROM app.email_verification_challenges
              WHERE challenge_id = $1`,
            [concurrentChallenge.challengeId],
          )
        ).rows[0].code_digest;
        const concurrentVerifications = await Promise.all([
          store.verifyEmail(
            verify(
              52,
              concurrentEmail,
              concurrentChallenge.challengeId,
              storedDigest,
              {
                context: {
                  actorSubjectHash: hex("c"),
                  idempotencyKeyDigest: hex("d"),
                  occurredAt: at(1_000),
                },
              },
            ),
          ),
          store.verifyEmail(
            verify(
              53,
              concurrentEmail,
              concurrentChallenge.challengeId,
              storedDigest,
              {
                context: {
                  actorSubjectHash: hex("e"),
                  idempotencyKeyDigest: hex("f"),
                  occurredAt: at(1_000),
                },
                session: { ...session(53, at(1_000)), tokenDigest: hex("f") },
              },
            ),
          ),
        ]);
        assert.deepEqual(
          concurrentVerifications.map(({ value }) => value.status).sort(),
          ["already_verified", "verified"],
        );
        assert.equal(
          (
            await client.query(
              `SELECT count(*)::integer AS count
                 FROM app.user_sessions s
                 JOIN app.users u USING (user_id)
                WHERE u.canonical_email = $1`,
              [concurrentEmail],
            )
          ).rows[0].count,
          1,
        );
      } finally {
        await client.end();
        await store.close();
      }
    });
  },
);

test(
  "identity rate buckets enforce every published limit and reset window",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const store = createPostgresIdentityStore({ databaseUrl });
      try {
        const policies = [
          ["signup_ip", 5, 900_000],
          ["signup_email", 3, 3_600_000],
          ["verify_ip", 10, 900_000],
          ["verify_challenge", 5, 900_000],
          ["resend_ip", 10, 900_000],
          ["resend_email", 5, 86_400_000],
        ];
        for (const [scope, limit, windowMs] of policies) {
          const subjectHash = hex(String((limit % 9) + 1));
          for (let hit = 0; hit < limit; hit += 1) {
            assert.deepEqual(
              await store.consumeRateLimit({
                scope,
                subjectHash,
                occurredAt: START,
              }),
              { allowed: true },
            );
          }
          assert.deepEqual(
            await store.consumeRateLimit({
              scope,
              subjectHash,
              occurredAt: START,
            }),
            { allowed: false, retryAfterSeconds: windowMs / 1_000 },
          );
          assert.deepEqual(
            await store.consumeRateLimit({
              scope,
              subjectHash,
              occurredAt: at(windowMs),
            }),
            { allowed: true },
          );
        }
      } finally {
        await store.close();
      }
    });
  },
);

test(
  "identity lookup indexes serve repository query shapes",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const client = await connect(databaseUrl);
      try {
        await client.query("SET enable_seqscan = off");
        const plans = [];
        plans.push(
          await client.query(
            `EXPLAIN (FORMAT JSON)
             SELECT challenge_id, key_version
               FROM app.email_verification_challenges
              WHERE user_id = $1
                AND consumed_at IS NULL
                AND superseded_at IS NULL`,
            [uuid(1)],
          ),
        );
        plans.push(
          await client.query(
            `EXPLAIN (FORMAT JSON)
             SELECT outbox_id
               FROM app.identity_email_outbox
              WHERE status IN ('pending', 'leased')
                AND next_attempt_at <= $1
              ORDER BY next_attempt_at, created_at
              LIMIT 25`,
            [START],
          ),
        );
        plans.push(
          await client.query(
            `EXPLAIN (FORMAT JSON)
             SELECT request_fingerprint, response_kind, result_reference
               FROM app.identity_idempotency
              WHERE endpoint = 'sign_up'
                AND actor_subject_hash = $1
                AND key_digest = $2`,
            [hex("a"), hex("b")],
          ),
        );
        const rendered = plans.map(({ rows }) => JSON.stringify(rows));
        assert.match(
          rendered[0],
          /email_verification_challenges_one_current_idx/u,
        );
        assert.match(rendered[1], /identity_email_outbox_dispatch_idx/u);
        assert.match(rendered[2], /identity_idempotency_scope_key/u);
      } finally {
        await client.end();
      }
    });
  },
);
