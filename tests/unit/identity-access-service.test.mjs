import assert from "node:assert/strict";
import test from "node:test";

import {
  IdentityApplicationError,
  createIdentityAccessService,
} from "../../apps/api/dist/index.js";

const NOW = new Date("2026-07-17T08:00:00.000Z");
const USER_ID = "10000000-0000-4000-8000-000000000001";
const CHALLENGE_ID = "20000000-0000-4000-8000-000000000001";
const SESSION_ID = "30000000-0000-4000-8000-000000000001";
const REPLAY_SESSION_ID = "30000000-0000-4000-8000-000000000002";
const TOKEN = "A".repeat(43);
const REPLAY_TOKEN = "B".repeat(43);
const PASSWORD_HASH = { pepperVersion: 1, phc: "$argon2id$credential" };
const DUMMY_HASH = { pepperVersion: 1, phc: "$argon2id$dummy" };

function hex(character) {
  return character.repeat(64);
}

function metadata(overrides = {}) {
  return {
    correlationId: "correlation-access-0001",
    idempotencyKey: "identity-key-access-0001",
    ipSubject: "203.0.113.10",
    requestId: "40000000-0000-4000-8000-000000000001",
    ...overrides,
  };
}

function createHarness(overrides = {}) {
  const calls = [];
  let nextId = 10;
  const store = {
    async consumeRateLimit(command) {
      calls.push(`rate:${command.scope}`);
      return { allowed: true };
    },
    async findSignInCredential(email) {
      calls.push(`find:credential:${email}`);
      return {
        credentialVersion: 1,
        email,
        passwordHash: PASSWORD_HASH,
        status: "active",
        userId: USER_ID,
      };
    },
    async signIn(command) {
      calls.push("store:sign-in");
      return {
        kind: "applied",
        value: {
          absoluteExpiresAt: command.session.absoluteExpiresAt,
          keyVersion: command.session.keyVersion,
          sessionId: command.session.sessionId,
          status: "authenticated",
        },
      };
    },
    async refreshSession() {
      calls.push("store:refresh");
      return {
        kind: "replayed",
        value: {
          absoluteExpiresAt: new Date(NOW.valueOf() + 1_000_000),
          keyVersion: 1,
          sessionId: REPLAY_SESSION_ID,
          status: "authenticated",
        },
      };
    },
    async signOut() {
      calls.push("store:sign-out");
      return { kind: "applied", value: { status: "signed_out" } };
    },
    async revokeAllSessions() {
      calls.push("store:revoke-all");
      return { kind: "applied", value: { status: "sessions_revoked" } };
    },
    async requestPasswordReset() {
      calls.push("store:reset-request");
      return { kind: "applied", value: { accepted: true } };
    },
    async findPasswordResetChallenge(email) {
      calls.push(`find:reset:${email}`);
      return {
        challengeId: CHALLENGE_ID,
        codeDigest: hex("a"),
        credentialVersion: 1,
        keyVersion: 2,
        userId: USER_ID,
      };
    },
    async rejectPasswordReset() {
      calls.push("store:reset-reject");
      return { kind: "applied", value: { status: "invalid" } };
    },
    async confirmPasswordReset() {
      calls.push("store:reset-confirm");
      return { kind: "applied", value: { status: "password_reset" } };
    },
    ...overrides.store,
  };
  const cryptography = {
    createId() {
      nextId += 1;
      return `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
    },
    createSession() {
      calls.push("crypto:session");
      return {
        keyVersion: 1,
        sessionId: SESSION_ID,
        token: TOKEN,
        tokenDigest: hex("b"),
      };
    },
    createPasswordResetChallenge() {
      calls.push("crypto:reset-challenge");
      return {
        challengeId: CHALLENGE_ID,
        code: "012345",
        codeDigest: hex("a"),
        keyVersion: 2,
      };
    },
    deriveSessionToken(sessionId) {
      calls.push(`crypto:token:${sessionId}`);
      return sessionId === REPLAY_SESSION_ID ? REPLAY_TOKEN : TOKEN;
    },
    idempotencyKeyDigest() {
      return hex("c");
    },
    matchesPasswordResetCode() {
      calls.push("crypto:reset-match");
      return true;
    },
    requestFingerprint(endpoint) {
      calls.push(`crypto:fingerprint:${endpoint}`);
      return hex("d");
    },
    sessionTokenDigest() {
      calls.push("crypto:session-digest");
      return hex("e");
    },
    subjectHash(kind) {
      calls.push(`crypto:subject:${kind}`);
      return kind === "ip" ? hex("f") : hex("1");
    },
    ...overrides.cryptography,
  };
  const passwordHasher = {
    async hash(password) {
      calls.push("password:hash");
      assert.equal(password, "una nuova password lunga");
      return { pepperVersion: 2, phc: "$argon2id$new" };
    },
    async verify(_password, stored) {
      calls.push(`password:verify:${stored.phc}`);
      return true;
    },
    ...overrides.passwordHasher,
  };
  const service = createIdentityAccessService({
    blocklist: {
      contains(password) {
        calls.push("policy:blocklist");
        return password === "password comune";
      },
    },
    clock: { now: () => new Date(NOW) },
    cryptography,
    dummyPasswordHash: DUMMY_HASH,
    passwordHasher,
    store,
  });
  return { calls, service, store };
}

function applicationError(error, code) {
  assert.equal(error instanceof IdentityApplicationError, true);
  assert.equal(error.code, code);
  assert.doesNotMatch(
    error.message,
    /example\.test|password corretta|una nuova password|203\.0\.113/u,
  );
  return true;
}

test("sign-in applies both rate gates before uniform password verify and persists a rotated session", async () => {
  let stored;
  const harness = createHarness({
    store: {
      async signIn(command) {
        harness.calls.push("store:sign-in");
        stored = command;
        return {
          kind: "applied",
          value: {
            absoluteExpiresAt: command.session.absoluteExpiresAt,
            keyVersion: 1,
            sessionId: SESSION_ID,
            status: "authenticated",
          },
        };
      },
    },
  });
  assert.deepEqual(
    await harness.service.signIn(
      {
        email: " Player@Example.test ",
        password: "password corretta molto lunga",
      },
      metadata(),
    ),
    {
      absoluteExpiresAt: new Date(NOW.valueOf() + 2_592_000_000),
      sessionToken: TOKEN,
      status: "authenticated",
    },
  );
  assert.ok(
    harness.calls.indexOf("rate:sign_in_email") <
      harness.calls.indexOf(`password:verify:${PASSWORD_HASH.phc}`),
  );
  assert.ok(
    harness.calls.indexOf(`password:verify:${PASSWORD_HASH.phc}`) <
      harness.calls.indexOf("store:sign-in"),
  );
  assert.equal(stored.credentialVersion, 1);
  assert.equal(
    stored.session.idleExpiresAt.valueOf(),
    NOW.valueOf() + 86_400_000,
  );
  assert.equal("password" in stored, false);
});

test("unknown or changed credentials use the dummy hash and return one generic error", async () => {
  const unknown = createHarness({
    store: {
      async findSignInCredential() {
        return null;
      },
    },
  });
  await assert.rejects(
    unknown.service.signIn(
      {
        email: "missing@example.test",
        password: "password corretta molto lunga",
      },
      metadata(),
    ),
    (error) => applicationError(error, "CREDENTIALS_INVALID"),
  );
  assert.ok(unknown.calls.includes(`password:verify:${DUMMY_HASH.phc}`));
  assert.equal(unknown.calls.includes("store:sign-in"), false);

  const changed = createHarness({
    store: {
      async signIn() {
        return { kind: "applied", value: { status: "credentials_invalid" } };
      },
    },
  });
  await assert.rejects(
    changed.service.signIn(
      {
        email: "player@example.test",
        password: "password corretta molto lunga",
      },
      metadata(),
    ),
    (error) => applicationError(error, "CREDENTIALS_INVALID"),
  );
});

test("refresh replays the original token while logout and global revoke stay explicit", async () => {
  const replay = createHarness();
  assert.deepEqual(await replay.service.refreshSession(TOKEN, metadata()), {
    absoluteExpiresAt: new Date(NOW.valueOf() + 1_000_000),
    sessionToken: REPLAY_TOKEN,
    status: "authenticated",
  });
  await replay.service.signOut(null, metadata());
  await replay.service.revokeAllSessions(
    TOKEN,
    { confirmation: "revoke_all" },
    metadata(),
  );
  assert.ok(replay.calls.includes("store:refresh"));
  assert.ok(replay.calls.includes("store:sign-out"));
  assert.ok(replay.calls.includes("store:revoke-all"));

  const invalid = createHarness({
    store: {
      async refreshSession() {
        return { kind: "applied", value: { status: "session_invalid" } };
      },
    },
  });
  await assert.rejects(
    invalid.service.refreshSession(TOKEN, metadata()),
    (error) => applicationError(error, "SESSION_INVALID"),
  );
});

test("reset request is generic and invalid code never hashes a replacement password", async () => {
  const request = createHarness();
  assert.deepEqual(
    await request.service.requestPasswordReset(
      { email: "missing@example.test" },
      metadata(),
    ),
    { status: "password_reset_requested" },
  );
  assert.ok(
    request.calls.indexOf("rate:reset_request_email") <
      request.calls.indexOf("store:reset-request"),
  );

  const invalid = createHarness({
    cryptography: {
      matchesPasswordResetCode() {
        return false;
      },
    },
  });
  await assert.rejects(
    invalid.service.confirmPasswordReset(
      {
        code: "999999",
        email: "player@example.test",
        newPassword: "una nuova password lunga",
      },
      metadata(),
    ),
    (error) => applicationError(error, "PASSWORD_RESET_INVALID"),
  );
  assert.ok(invalid.calls.includes("store:reset-reject"));
  assert.equal(invalid.calls.includes("password:hash"), false);

  const unknown = createHarness({
    store: {
      async findPasswordResetChallenge() {
        return null;
      },
    },
  });
  await assert.rejects(
    unknown.service.confirmPasswordReset(
      {
        code: "999999",
        email: "missing@example.test",
        newPassword: "una nuova password lunga",
      },
      metadata(),
    ),
    (error) => applicationError(error, "PASSWORD_RESET_INVALID"),
  );
  assert.ok(unknown.calls.includes("crypto:reset-challenge"));
  assert.ok(unknown.calls.includes("crypto:reset-match"));
  assert.ok(unknown.calls.includes("store:reset-reject"));
  assert.equal(unknown.calls.includes("password:hash"), false);
});

test("matching reset code applies password policy and maps a concurrent loser generically", async () => {
  const success = createHarness();
  assert.deepEqual(
    await success.service.confirmPasswordReset(
      {
        code: "012345",
        email: "player@example.test",
        newPassword: "una nuova password lunga",
      },
      metadata(),
    ),
    { status: "password_reset" },
  );
  assert.ok(
    success.calls.indexOf("crypto:reset-match") <
      success.calls.indexOf("password:hash"),
  );
  assert.ok(success.calls.includes("store:reset-confirm"));

  const loser = createHarness({
    store: {
      async confirmPasswordReset() {
        return { kind: "applied", value: { status: "invalid" } };
      },
    },
  });
  await assert.rejects(
    loser.service.confirmPasswordReset(
      {
        code: "012345",
        email: "player@example.test",
        newPassword: "una nuova password lunga",
      },
      metadata(),
    ),
    (error) => applicationError(error, "PASSWORD_RESET_INVALID"),
  );
});
