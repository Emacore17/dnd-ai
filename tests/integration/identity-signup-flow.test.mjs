import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import pg from "pg";

import {
  createApiApp,
  createIdentityService,
  createNodeIdentityCryptography,
} from "../../apps/api/dist/index.js";
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

const { Client } = pg;
const ORIGIN = "https://game.example.test";
const START = new Date("2026-07-16T10:00:00.000Z");
const CHALLENGE_KEY = Buffer.alloc(32, 7);
const SESSION_KEY = Buffer.alloc(32, 11);
const SUBJECT_HASH_KEY = Buffer.alloc(32, 13);
const PASSWORD_HASH = {
  pepperVersion: 1,
  phc: `$argon2id$v=19$m=19456,t=2,p=1$${"c2FsdA".repeat(4)}$${"aGFzaA".repeat(8)}`,
};

function uuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function createDeterministicRandomBytes(seed = 1) {
  let next = seed;
  return (length) => {
    assert.equal(length, 16);
    const value = Buffer.alloc(length);
    value.writeUInt32BE(next, length - 4);
    next += 1;
    return value;
  };
}

function identityHeaders(number, idempotencyKey, origin = ORIGIN) {
  return {
    "idempotency-key": idempotencyKey,
    origin,
    "sec-fetch-site": "same-origin",
    "x-correlation-id": `identity-flow-correlation-${number}`,
    "x-request-id": uuid(800_000 + number),
  };
}

async function createHarness(databaseUrl) {
  let now = new Date(START);
  let requestNumber = 1;
  let leaseNumber = 900_000;
  const clock = { now: () => new Date(now) };
  const store = createPostgresIdentityStore({ databaseUrl });
  const cryptography = createNodeIdentityCryptography({
    challengeKey: CHALLENGE_KEY,
    challengeKeyVersion: 1,
    randomBytes: createDeterministicRandomBytes(),
    sessionKey: SESSION_KEY,
    sessionKeyVersion: 1,
    subjectHashKey: SUBJECT_HASH_KEY,
  });
  const service = createIdentityService({
    blocklist: { contains: () => false },
    clock,
    cryptography,
    passwordHasher: {
      async hash() {
        return PASSWORD_HASH;
      },
      async verify() {
        return false;
      },
    },
    store,
  });
  const app = createApiApp(
    { logger: false },
    { identity: { clock, publicOrigin: ORIGIN, service } },
  );
  const outbox = createPostgresIdentityEmailOutbox({
    createLeaseToken: () => uuid(leaseNumber++),
    databaseUrl,
  });

  return {
    app,
    clock,
    outbox,
    setNow(value) {
      now = new Date(value);
    },
    advanceBy(milliseconds) {
      now = new Date(now.valueOf() + milliseconds);
    },
    async post(path, payload, idempotencyKey, origin = ORIGIN) {
      const number = requestNumber++;
      return app.inject({
        headers: identityHeaders(number, idempotencyKey, origin),
        method: "POST",
        payload,
        url: path,
      });
    },
    async close() {
      await Promise.all([app.close(), store.close(), outbox.close()]);
    },
  };
}

async function dispatch(outbox, sender, clock) {
  return dispatchIdentityEmailBatch({
    challengeKey: CHALLENGE_KEY,
    challengeKeyVersion: 1,
    clock,
    jitterMs: () => 0,
    outbox,
    sender,
  });
}

async function inspectIdentity(databaseUrl, email) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT u.status,
              (SELECT count(*)::integer
                 FROM app.email_verification_challenges AS c
                WHERE c.user_id = u.user_id) AS challenges,
              (SELECT count(*)::integer
                 FROM app.email_verification_challenges AS c
                WHERE c.user_id = u.user_id
                  AND c.consumed_at IS NULL
                  AND c.superseded_at IS NULL) AS current_challenges,
              (SELECT count(*)::integer
                 FROM app.identity_email_outbox AS o
                WHERE o.user_id = u.user_id) AS outbox,
              (SELECT count(*)::integer
                 FROM app.user_sessions AS s
                WHERE s.user_id = u.user_id) AS sessions
         FROM app.users AS u
        WHERE u.canonical_email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function inspectLatestOutbox(databaseUrl, email) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT o.status, o.attempt_count
         FROM app.identity_email_outbox AS o
         JOIN app.users AS u ON u.user_id = o.user_id
        WHERE u.canonical_email = $1
        ORDER BY o.created_at DESC, o.outbox_id DESC
        LIMIT 1`,
      [email],
    );
    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

function signUpPayload(email, displayName = "Giocatore") {
  return {
    displayName,
    email,
    password: "una password molto lunga",
  };
}

test(
  "signup, delivery and verification form one idempotent PostgreSQL vertical slice",
  { timeout: 240_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const harness = await createHarness(databaseUrl);
      const sender = createFakeVerificationEmailSender();
      const email = "vertical@example.test";

      try {
        const signupKey = "identity-flow-signup-0001";
        const signups = await Promise.all([
          harness.post("/api/auth/sign-up", signUpPayload(email), signupKey),
          harness.post("/api/auth/sign-up", signUpPayload(email), signupKey),
        ]);
        assert.deepEqual(
          signups.map(({ statusCode }) => statusCode),
          [202, 202],
        );
        assert.deepEqual(await inspectIdentity(databaseUrl, email), {
          challenges: 1,
          current_challenges: 1,
          outbox: 1,
          sessions: 0,
          status: "pending",
        });

        assert.deepEqual(
          await dispatch(harness.outbox, sender, harness.clock),
          {
            claimed: 1,
            dead: 0,
            released: 0,
            retried: 0,
            sent: 1,
          },
        );
        assert.equal(sender.messages.length, 1);
        assert.match(sender.messages[0].code, /^[0-9]{6}$/u);

        const verifyKey = "identity-flow-verify-0001";
        const verificationPayload = {
          code: sender.messages[0].code,
          email,
        };
        const verified = await harness.post(
          "/api/auth/verify-email",
          verificationPayload,
          verifyKey,
        );
        const replay = await harness.post(
          "/api/auth/verify-email",
          verificationPayload,
          verifyKey,
        );
        assert.equal(verified.statusCode, 200);
        assert.equal(replay.statusCode, 200);
        assert.equal(
          replay.headers["set-cookie"],
          verified.headers["set-cookie"],
        );
        assert.match(
          verified.headers["set-cookie"],
          /^__Host-dnd_ai_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/u,
        );
        assert.deepEqual(await inspectIdentity(databaseUrl, email), {
          challenges: 1,
          current_challenges: 0,
          outbox: 1,
          sessions: 1,
          status: "active",
        });
      } finally {
        await harness.close();
      }
    });
  },
);

test(
  "identity flow fails closed across invalid, expired, superseded, abusive and unavailable paths",
  { timeout: 240_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const harness = await createHarness(databaseUrl);

      try {
        const wrongSender = createFakeVerificationEmailSender();
        const wrongEmail = "wrong-code@example.test";
        assert.equal(
          (
            await harness.post(
              "/api/auth/sign-up",
              signUpPayload(wrongEmail),
              "identity-failure-signup-wrong",
            )
          ).statusCode,
          202,
        );
        await dispatch(harness.outbox, wrongSender, harness.clock);
        assert.equal(
          (
            await harness.post(
              "/api/auth/verify-email",
              { code: "999999", email: wrongEmail },
              "identity-failure-verify-wrong",
            )
          ).statusCode,
          422,
        );
        assert.equal(
          (
            await harness.post(
              "/api/auth/verify-email",
              { code: wrongSender.messages[0].code, email: wrongEmail },
              "identity-failure-verify-correct",
            )
          ).statusCode,
          200,
        );

        harness.advanceBy(20 * 60_000);
        const expiredSender = createFakeVerificationEmailSender();
        const expiredEmail = "expired@example.test";
        await harness.post(
          "/api/auth/sign-up",
          signUpPayload(expiredEmail),
          "identity-failure-signup-expired",
        );
        await dispatch(harness.outbox, expiredSender, harness.clock);
        harness.advanceBy(11 * 60_000);
        assert.equal(
          (
            await harness.post(
              "/api/auth/verify-email",
              { code: expiredSender.messages[0].code, email: expiredEmail },
              "identity-failure-verify-expired",
            )
          ).statusCode,
          410,
        );

        harness.advanceBy(20 * 60_000);
        const resendSender = createFakeVerificationEmailSender();
        const resendEmail = "resend@example.test";
        await harness.post(
          "/api/auth/sign-up",
          signUpPayload(resendEmail),
          "identity-failure-signup-resend",
        );
        await dispatch(harness.outbox, resendSender, harness.clock);
        const firstCode = resendSender.messages[0].code;
        harness.advanceBy(61_000);
        assert.equal(
          (
            await harness.post(
              "/api/auth/resend-verification",
              { email: resendEmail },
              "identity-failure-resend-new",
            )
          ).statusCode,
          202,
        );
        await dispatch(harness.outbox, resendSender, harness.clock);
        const secondCode = resendSender.messages[1].code;
        assert.notEqual(secondCode, firstCode);
        assert.equal(
          (
            await harness.post(
              "/api/auth/verify-email",
              { code: firstCode, email: resendEmail },
              "identity-failure-verify-superseded",
            )
          ).statusCode,
          422,
        );
        assert.equal(
          (
            await harness.post(
              "/api/auth/verify-email",
              { code: secondCode, email: resendEmail },
              "identity-failure-verify-resend",
            )
          ).statusCode,
          200,
        );

        harness.advanceBy(20 * 60_000);
        const timeoutEmail = "timeout@example.test";
        const accepted = await harness.post(
          "/api/auth/sign-up",
          signUpPayload(timeoutEmail),
          "identity-failure-signup-timeout",
        );
        assert.equal(accepted.statusCode, 202);
        const timeoutSummary = await dispatch(
          harness.outbox,
          {
            async send() {
              throw new Error("simulated SMTP timeout");
            },
          },
          harness.clock,
        );
        assert.equal(timeoutSummary.retried, 1);
        assert.deepEqual(await inspectLatestOutbox(databaseUrl, timeoutEmail), {
          attempt_count: 1,
          status: "pending",
        });

        harness.advanceBy(20 * 60_000);
        const rejectedEmail = "origin-rejected@example.test";
        assert.equal(
          (
            await harness.post(
              "/api/auth/sign-up",
              signUpPayload(rejectedEmail),
              "identity-failure-origin-rejected",
              "https://evil.example.test",
            )
          ).statusCode,
          403,
        );
        assert.equal(await inspectIdentity(databaseUrl, rejectedEmail), null);

        const conflictEmail = "conflict@example.test";
        const conflictKey = "identity-failure-conflict-key";
        assert.equal(
          (
            await harness.post(
              "/api/auth/sign-up",
              signUpPayload(conflictEmail, "Prima scelta"),
              conflictKey,
            )
          ).statusCode,
          202,
        );
        assert.equal(
          (
            await harness.post(
              "/api/auth/sign-up",
              signUpPayload(conflictEmail, "Seconda scelta"),
              conflictKey,
            )
          ).statusCode,
          409,
        );
        assert.deepEqual(await inspectIdentity(databaseUrl, conflictEmail), {
          challenges: 1,
          current_challenges: 1,
          outbox: 1,
          sessions: 0,
          status: "pending",
        });

        harness.advanceBy(20 * 60_000);
        const rateStatuses = [];
        for (let index = 0; index < 6; index += 1) {
          const response = await harness.post(
            "/api/auth/sign-up",
            signUpPayload(`rate-${index}@example.test`),
            `identity-failure-rate-${String(index).padStart(4, "0")}`,
          );
          rateStatuses.push(response.statusCode);
          if (index === 5) {
            assert.equal(Number(response.headers["retry-after"]), 900);
          }
        }
        assert.deepEqual(rateStatuses, [202, 202, 202, 202, 202, 429]);
      } finally {
        await harness.close();
      }
    });
  },
);
