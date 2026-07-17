import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import pg from "pg";

import {
  createApiApp,
  createIdentityAccessService,
  createIdentityService,
  createNodeIdentityCryptography,
} from "../../apps/api/dist/index.js";
import {
  createFakeVerificationEmailSender,
  createPostgresIdentityEmailOutbox,
  dispatchIdentityEmailBatch,
} from "../../apps/worker/dist/index.js";
import {
  createPostgresIdentityAccessStore,
  createPostgresIdentityStore,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const { Client } = pg;
const ORIGIN = "https://game.example.test";
const START = new Date("2026-07-17T08:00:00.000Z");
const CHALLENGE_KEY = Buffer.alloc(32, 7);
const SESSION_KEY = Buffer.alloc(32, 11);
const RESET_KEY = Buffer.alloc(32, 17);
const SUBJECT_HASH_KEY = Buffer.alloc(32, 13);
const INITIAL_PASSWORD = "una password iniziale lunga";
const FIRST_RESET_PASSWORD = "una password rinnovata lunga";
const SECOND_RESET_PASSWORD = "una password finale molto lunga";

function uuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function deterministicRandomBytes(seed = 1) {
  let next = seed;
  return (length) => {
    assert.equal(length, 16);
    const value = Buffer.alloc(length);
    value.writeUInt32BE(next, length - 4);
    next += 1;
    return value;
  };
}

function passwordHash(number) {
  return {
    pepperVersion: 1,
    phc: `$argon2id$v=19$m=19456,t=2,p=1$${Buffer.alloc(16, number).toString("base64")}$${Buffer.alloc(32, number).toString("base64")}`,
  };
}

function createDeterministicPasswordHasher() {
  const passwords = new Map();
  let nextHash = 1;
  let verifyGate = null;

  return {
    async hash(password) {
      const stored = passwordHash(nextHash++);
      passwords.set(stored.phc, password.normalize("NFC"));
      return Object.freeze(stored);
    },
    pauseNextVerify() {
      assert.equal(verifyGate, null);
      let markReached;
      let release;
      const reached = new Promise((resolve) => {
        markReached = resolve;
      });
      const released = new Promise((resolve) => {
        release = resolve;
      });
      verifyGate = { markReached, released };
      return { reached, release };
    },
    async verify(password, stored) {
      const matches = passwords.get(stored.phc) === password.normalize("NFC");
      const gate = verifyGate;
      if (gate !== null) {
        verifyGate = null;
        gate.markReached();
        await gate.released;
      }
      return matches;
    },
  };
}

function sessionToken(response) {
  const cookie = response.headers["set-cookie"];
  assert.equal(typeof cookie, "string");
  const match = /^__Host-dnd_ai_session=([A-Za-z0-9_-]{43});/u.exec(cookie);
  assert.notEqual(match, null);
  return match[1];
}

async function inspectAccessState(databaseUrl, email) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT c.credential_version,
              (SELECT count(*)::integer
                 FROM app.user_sessions AS s
                WHERE s.user_id = u.user_id) AS sessions,
              (SELECT count(*)::integer
                 FROM app.user_sessions AS s
                WHERE s.user_id = u.user_id
                  AND s.revoked_at IS NULL) AS active_sessions,
              (SELECT count(*)::integer
                 FROM app.password_reset_challenges AS r
                WHERE r.user_id = u.user_id
                  AND r.consumed_at IS NOT NULL) AS consumed_resets
         FROM app.users AS u
         JOIN app.user_credentials AS c ON c.user_id = u.user_id
        WHERE u.canonical_email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function createHarness(databaseUrl) {
  let requestNumber = 1;
  let leaseNumber = 900_000;
  let now = new Date(START);
  const clock = Object.freeze({ now: () => new Date(now) });
  const store = createPostgresIdentityStore({ databaseUrl });
  const accessStore = createPostgresIdentityAccessStore({ databaseUrl });
  const outbox = createPostgresIdentityEmailOutbox({
    createLeaseToken: () => uuid(leaseNumber++),
    databaseUrl,
  });
  const passwordHasher = createDeterministicPasswordHasher();
  const cryptography = createNodeIdentityCryptography({
    challengeKey: CHALLENGE_KEY,
    challengeKeyVersion: 1,
    randomBytes: deterministicRandomBytes(),
    resetChallengeKey: RESET_KEY,
    resetChallengeKeyVersion: 1,
    sessionKey: SESSION_KEY,
    sessionKeyVersion: 1,
    subjectHashKey: SUBJECT_HASH_KEY,
  });
  const blocklist = Object.freeze({ contains: () => false });
  const service = createIdentityService({
    blocklist,
    clock,
    cryptography,
    passwordHasher,
    store,
  });
  const accessService = createIdentityAccessService({
    blocklist,
    clock,
    cryptography,
    dummyPasswordHash: await passwordHasher.hash(
      "dnd-ai-uniform-dummy-credential-v1",
    ),
    passwordHasher,
    store: accessStore,
  });
  const app = createApiApp(
    { logger: false },
    {
      identity: { clock, publicOrigin: ORIGIN, service },
      identityAccess: { clock, publicOrigin: ORIGIN, service: accessService },
    },
  );

  return {
    app,
    outbox,
    passwordHasher,
    advanceBy(milliseconds) {
      now = new Date(now.valueOf() + milliseconds);
    },
    async close() {
      await Promise.all([
        app.close(),
        store.close(),
        accessStore.close(),
        outbox.close(),
      ]);
    },
    async dispatch(sender) {
      return dispatchIdentityEmailBatch({
        challengeKey: CHALLENGE_KEY,
        challengeKeyVersion: 1,
        clock,
        jitterMs: () => 0,
        outbox,
        resetKey: RESET_KEY,
        resetKeyVersion: 1,
        sender,
      });
    },
    async post(path, payload, idempotencyKey, token) {
      const number = requestNumber++;
      return app.inject({
        headers: {
          ...(token === undefined
            ? {}
            : { cookie: `__Host-dnd_ai_session=${token}` }),
          "idempotency-key": idempotencyKey,
          origin: ORIGIN,
          "sec-fetch-site": "same-origin",
          "x-correlation-id": `access-flow-correlation-${number}`,
          "x-request-id": uuid(800_000 + number),
        },
        method: "POST",
        ...(payload === undefined ? {} : { payload }),
        url: path,
      });
    },
  };
}

function latestCode(sender, kind) {
  const message = sender.messages.findLast(
    (candidate) => candidate.kind === kind,
  );
  assert.notEqual(message, undefined);
  return message.code;
}

test(
  "identity access is one PostgreSQL lifecycle with rotation, revocation and reset races",
  { timeout: 240_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      const harness = await createHarness(databaseUrl);
      const sender = createFakeVerificationEmailSender();
      const email = "access-flow@example.test";

      try {
        const signup = await harness.post(
          "/api/auth/sign-up",
          { displayName: "Giocatore", email, password: INITIAL_PASSWORD },
          "access-flow-signup-0001",
        );
        assert.equal(signup.statusCode, 202);
        assert.equal((await harness.dispatch(sender)).sent, 1);
        const verification = await harness.post(
          "/api/auth/verify-email",
          { code: latestCode(sender, "verification"), email },
          "access-flow-verify-0001",
        );
        assert.equal(verification.statusCode, 200);

        const signedIn = await harness.post(
          "/api/auth/sign-in",
          { email, password: INITIAL_PASSWORD },
          "access-flow-sign-in-0001",
        );
        assert.equal(signedIn.statusCode, 200);
        const signedInToken = sessionToken(signedIn);
        const refreshed = await harness.post(
          "/api/auth/session/refresh",
          undefined,
          "access-flow-refresh-0001",
          signedInToken,
        );
        assert.equal(refreshed.statusCode, 200);
        const refreshedToken = sessionToken(refreshed);
        assert.notEqual(refreshedToken, signedInToken);
        assert.equal(
          (
            await harness.post(
              "/api/auth/session/refresh",
              undefined,
              "access-flow-refresh-old-0001",
              signedInToken,
            )
          ).statusCode,
          401,
        );

        const signOutKey = "access-flow-sign-out-0001";
        assert.equal(
          (
            await harness.post(
              "/api/auth/sign-out",
              undefined,
              signOutKey,
              refreshedToken,
            )
          ).statusCode,
          204,
        );
        assert.equal(
          (
            await harness.post(
              "/api/auth/sign-out",
              undefined,
              signOutKey,
              refreshedToken,
            )
          ).statusCode,
          204,
        );

        const firstConcurrentSession = sessionToken(
          await harness.post(
            "/api/auth/sign-in",
            { email, password: INITIAL_PASSWORD },
            "access-flow-sign-in-0002",
          ),
        );
        const secondConcurrentSession = sessionToken(
          await harness.post(
            "/api/auth/sign-in",
            { email, password: INITIAL_PASSWORD },
            "access-flow-sign-in-0003",
          ),
        );
        assert.equal(
          (
            await harness.post(
              "/api/auth/sessions/revoke-all",
              { confirmation: "revoke_all" },
              "access-flow-revoke-0001",
              firstConcurrentSession,
            )
          ).statusCode,
          204,
        );
        assert.equal(
          (
            await harness.post(
              "/api/auth/session/refresh",
              undefined,
              "access-flow-refresh-revoked-0001",
              secondConcurrentSession,
            )
          ).statusCode,
          401,
        );

        assert.equal(
          (
            await harness.post(
              "/api/auth/password-reset/request",
              { email },
              "access-flow-reset-request-0001",
            )
          ).statusCode,
          202,
        );
        assert.equal((await harness.dispatch(sender)).sent, 1);
        const firstResetCode = latestCode(sender, "password_reset");
        const resetResults = await Promise.all([
          harness.post(
            "/api/auth/password-reset/confirm",
            { code: firstResetCode, email, newPassword: FIRST_RESET_PASSWORD },
            "access-flow-reset-confirm-0001",
          ),
          harness.post(
            "/api/auth/password-reset/confirm",
            { code: firstResetCode, email, newPassword: FIRST_RESET_PASSWORD },
            "access-flow-reset-confirm-0002",
          ),
        ]);
        assert.deepEqual(
          resetResults.map(({ statusCode }) => statusCode).sort(),
          [200, 422],
        );
        assert.deepEqual(await inspectAccessState(databaseUrl, email), {
          active_sessions: 0,
          consumed_resets: 1,
          credential_version: "2",
          sessions: 5,
        });
        assert.equal(
          (
            await harness.post(
              "/api/auth/sign-in",
              { email, password: INITIAL_PASSWORD },
              "access-flow-old-password-0001",
            )
          ).statusCode,
          401,
        );
        assert.equal(
          (
            await harness.post(
              "/api/auth/sign-in",
              { email, password: FIRST_RESET_PASSWORD },
              "access-flow-new-password-0001",
            )
          ).statusCode,
          200,
        );

        harness.advanceBy(16 * 60_000);
        assert.equal(
          (
            await harness.post(
              "/api/auth/password-reset/request",
              { email },
              "access-flow-reset-request-0002",
            )
          ).statusCode,
          202,
        );
        assert.equal((await harness.dispatch(sender)).sent, 1);
        const secondResetCode = latestCode(sender, "password_reset");
        const gate = harness.passwordHasher.pauseNextVerify();
        const racingLogin = harness.post(
          "/api/auth/sign-in",
          { email, password: FIRST_RESET_PASSWORD },
          "access-flow-racing-login-0001",
        );
        await gate.reached;
        const secondReset = await harness.post(
          "/api/auth/password-reset/confirm",
          {
            code: secondResetCode,
            email,
            newPassword: SECOND_RESET_PASSWORD,
          },
          "access-flow-reset-confirm-0003",
        );
        gate.release();
        const racingLoginResult = await racingLogin;
        assert.equal(secondReset.statusCode, 200);
        assert.equal(racingLoginResult.statusCode, 401);

        assert.equal(
          (
            await harness.post(
              "/api/auth/sign-in",
              { email, password: SECOND_RESET_PASSWORD },
              "access-flow-final-login-0001",
            )
          ).statusCode,
          200,
        );
        assert.deepEqual(await inspectAccessState(databaseUrl, email), {
          active_sessions: 1,
          consumed_resets: 2,
          credential_version: "3",
          sessions: 7,
        });
      } finally {
        await harness.close();
      }
    });
  },
);
