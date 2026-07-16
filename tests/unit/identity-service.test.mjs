import assert from "node:assert/strict";
import test from "node:test";

import {
  IdentityApplicationError,
  createIdentityService,
} from "../../apps/api/dist/index.js";
import { IdentityPersistenceError } from "../../packages/persistence/dist/index.js";

const NOW = new Date("2026-07-16T12:00:00.000Z");
const CHALLENGE_ID = "10000000-0000-4000-8000-000000000001";
const SESSION_ID = "20000000-0000-4000-8000-000000000001";
const REPLAY_SESSION_ID = "20000000-0000-4000-8000-000000000002";

function uuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function hex(character) {
  return character.repeat(64);
}

function metadata(overrides = {}) {
  return {
    correlationId: "correlation-identity-0001",
    idempotencyKey: "identity-key-0001",
    ipSubject: "203.0.113.10",
    requestId: "30000000-0000-4000-8000-000000000001",
    ...overrides,
  };
}

function createHarness(overrides = {}) {
  const calls = [];
  let nextId = 1;
  const store = {
    async consumeRateLimit(command) {
      calls.push(`rate:${command.scope}`);
      return { allowed: true };
    },
    async findVerificationChallenge(email) {
      calls.push(`find:${email}`);
      return { challengeId: CHALLENGE_ID, keyVersion: 1 };
    },
    async signUp() {
      calls.push("store:signup");
      return { kind: "applied", value: { accepted: true } };
    },
    async verifyEmail(command) {
      calls.push("store:verify");
      return {
        kind: "applied",
        value: {
          absoluteExpiresAt: command.session.absoluteExpiresAt,
          keyVersion: command.session.keyVersion,
          sessionId: command.session.sessionId,
          status: "verified",
        },
      };
    },
    async resendVerification() {
      calls.push("store:resend");
      return { kind: "applied", value: { accepted: true } };
    },
    ...overrides.store,
  };
  const cryptography = {
    createChallenge() {
      calls.push("crypto:challenge");
      return {
        challengeId: CHALLENGE_ID,
        code: "012345",
        codeDigest: hex("a"),
        keyVersion: 1,
      };
    },
    createId() {
      calls.push("crypto:id");
      return uuid(nextId++);
    },
    createSession() {
      calls.push("crypto:session");
      return {
        keyVersion: 1,
        sessionId: SESSION_ID,
        token: "session-token-created",
        tokenDigest: hex("b"),
      };
    },
    deriveChallengeCodeDigest(challengeId, code, keyVersion) {
      calls.push(`crypto:digest:${challengeId}:${code}:${keyVersion}`);
      return hex("c");
    },
    deriveSessionToken(sessionId, keyVersion) {
      calls.push(`crypto:token:${sessionId}:${keyVersion}`);
      return `token-for-${sessionId}`;
    },
    idempotencyKeyDigest(key) {
      calls.push("crypto:idempotency");
      assert.equal(key, "identity-key-0001");
      return hex("d");
    },
    requestFingerprint(endpoint, canonicalPayload) {
      calls.push(`crypto:fingerprint:${endpoint}`);
      assert.equal(typeof canonicalPayload, "string");
      return hex("e");
    },
    subjectHash(kind, value) {
      calls.push(`crypto:subject:${kind}`);
      assert.equal(typeof value, "string");
      return kind === "ip" ? hex("f") : hex("1");
    },
    ...overrides.cryptography,
  };
  const service = createIdentityService({
    blocklist: {
      contains(password) {
        calls.push("policy:blocklist");
        return (
          overrides.commonPassword === true || password === "common-password"
        );
      },
    },
    clock: { now: () => new Date(NOW) },
    cryptography,
    passwordHasher: {
      async hash(password) {
        calls.push("password:hash");
        assert.equal(password, "una password molto lunga");
        return { pepperVersion: 1, phc: "$argon2id$test-hash" };
      },
      async verify() {
        return false;
      },
      ...overrides.passwordHasher,
    },
    store,
  });
  return { calls, cryptography, service, store };
}

function assertApplicationError(error, code, retryAfterSeconds) {
  assert.equal(error instanceof IdentityApplicationError, true);
  assert.equal(error.code, code);
  assert.equal(error.retryAfterSeconds, retryAfterSeconds);
  assert.doesNotMatch(
    error.message,
    /example\.test|una password molto lunga|203\.0\.113/u,
  );
  return true;
}

test("signup consumes both limits before policy and Argon2, then persists normalized data", async () => {
  let stored;
  const { calls, service } = createHarness({
    store: {
      async signUp(command) {
        calls.push("store:signup");
        stored = command;
        return { kind: "applied", value: { accepted: true } };
      },
    },
  });

  assert.deepEqual(
    await service.signUp(
      {
        displayName: "  Giocatore  ",
        email: "  PLAYER@Example.test ",
        password: "una password molto lunga",
      },
      metadata(),
    ),
    {
      challengeExpiresInSeconds: 600,
      resendAfterSeconds: 60,
      status: "verification_required",
    },
  );
  assert.ok(
    calls.indexOf("rate:signup_ip") < calls.indexOf("rate:signup_email"),
  );
  assert.ok(
    calls.indexOf("rate:signup_email") < calls.indexOf("policy:blocklist"),
  );
  assert.ok(calls.indexOf("policy:blocklist") < calls.indexOf("password:hash"));
  assert.ok(calls.indexOf("password:hash") < calls.indexOf("store:signup"));
  assert.equal(stored.email, "player@example.test");
  assert.equal(stored.deliveryEmail, "player@example.test");
  assert.equal(stored.displayName, "Giocatore");
  assert.equal(stored.challenge.expiresAt.valueOf(), NOW.valueOf() + 600_000);
  assert.equal(stored.context.occurredAt.valueOf(), NOW.valueOf());
  assert.equal("password" in stored, false);
  assert.equal("code" in stored.challenge, false);
});

test("signup rejects a rate bucket before blocklist and Argon2", async () => {
  const { calls, service } = createHarness({
    store: {
      async consumeRateLimit(command) {
        calls.push(`rate:${command.scope}`);
        return { allowed: false, retryAfterSeconds: 37 };
      },
    },
  });
  await assert.rejects(
    service.signUp(
      {
        displayName: "Player",
        email: "player@example.test",
        password: "una password molto lunga",
      },
      metadata(),
    ),
    (error) => assertApplicationError(error, "RATE_LIMITED", 37),
  );
  assert.deepEqual(calls, ["crypto:subject:ip", "rate:signup_ip"]);
});

test("signup maps common password and persistence failures without reflection", async () => {
  const common = createHarness({ commonPassword: true });
  await assert.rejects(
    common.service.signUp(
      {
        displayName: "Player",
        email: "player@example.test",
        password: "una password molto lunga",
      },
      metadata(),
    ),
    (error) => assertApplicationError(error, "PASSWORD_REJECTED", undefined),
  );

  for (const [persistenceCode, applicationCode] of [
    ["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT"],
    ["STORE_UNAVAILABLE", "DELIVERY_UNAVAILABLE"],
  ]) {
    const harness = createHarness({
      store: {
        async signUp() {
          throw new IdentityPersistenceError(persistenceCode, "safe");
        },
      },
    });
    await assert.rejects(
      harness.service.signUp(
        {
          displayName: "Player",
          email: "player@example.test",
          password: "una password molto lunga",
        },
        metadata(),
      ),
      (error) => assertApplicationError(error, applicationCode, undefined),
    );
  }
});

test("verify rate-limits IP and challenge, persists one session and derives the returned token", async () => {
  let stored;
  const { calls, service } = createHarness({
    store: {
      async verifyEmail(command) {
        calls.push("store:verify");
        stored = command;
        return {
          kind: "applied",
          value: {
            absoluteExpiresAt: command.session.absoluteExpiresAt,
            keyVersion: 1,
            sessionId: SESSION_ID,
            status: "verified",
          },
        };
      },
    },
  });
  const result = await service.verifyEmail(
    { code: "012345", email: "player@example.test" },
    metadata(),
  );
  assert.deepEqual(result, {
    absoluteExpiresAt: new Date(NOW.valueOf() + 2_592_000_000),
    sessionToken: `token-for-${SESSION_ID}`,
    status: "verified",
  });
  assert.ok(
    calls.indexOf("rate:verify_ip") < calls.indexOf("find:player@example.test"),
  );
  assert.ok(
    calls.indexOf("rate:verify_challenge") < calls.indexOf("crypto:session"),
  );
  assert.equal(stored.codeDigest, hex("c"));
  assert.equal(
    stored.session.idleExpiresAt.valueOf(),
    NOW.valueOf() + 86_400_000,
  );
  assert.equal(
    stored.session.absoluteExpiresAt.valueOf(),
    NOW.valueOf() + 2_592_000_000,
  );
});

test("verify replay derives the original session token and maps terminal outcomes", async () => {
  const replay = createHarness({
    store: {
      async verifyEmail() {
        replay.calls.push("store:verify");
        return {
          kind: "replayed",
          value: {
            absoluteExpiresAt: new Date(NOW.valueOf() + 1_000_000),
            keyVersion: 1,
            sessionId: REPLAY_SESSION_ID,
            status: "verified",
          },
        };
      },
    },
  });
  const result = await replay.service.verifyEmail(
    { code: "012345", email: "player@example.test" },
    metadata(),
  );
  assert.equal(result.sessionToken, `token-for-${REPLAY_SESSION_ID}`);
  assert.match(replay.calls.at(-1), new RegExp(REPLAY_SESSION_ID, "u"));

  for (const [status, code] of [
    ["invalid_code", "VERIFICATION_INVALID"],
    ["already_verified", "VERIFICATION_INVALID"],
    ["expired", "VERIFICATION_EXPIRED"],
    ["attempts_exhausted", "VERIFICATION_RATE_LIMITED"],
  ]) {
    const harness = createHarness({
      store: {
        async verifyEmail() {
          return { kind: "applied", value: { status } };
        },
      },
    });
    await assert.rejects(
      harness.service.verifyEmail(
        { code: "012345", email: "player@example.test" },
        metadata(),
      ),
      (error) => assertApplicationError(error, code, undefined),
    );
  }
});

test("verify uses a bounded dummy challenge when the identity is unknown", async () => {
  let stored;
  const harness = createHarness({
    store: {
      async findVerificationChallenge() {
        harness.calls.push("find:missing");
        return null;
      },
      async verifyEmail(command) {
        harness.calls.push("store:verify");
        stored = command;
        return { kind: "applied", value: { status: "invalid_code" } };
      },
    },
  });
  await assert.rejects(
    harness.service.verifyEmail(
      { code: "999999", email: "missing@example.test" },
      metadata(),
    ),
    (error) => assertApplicationError(error, "VERIFICATION_INVALID", undefined),
  );
  assert.equal(stored.challengeId, CHALLENGE_ID);
  assert.ok(harness.calls.includes("crypto:challenge"));
  assert.ok(harness.calls.includes("crypto:session"));
});

test("resend applies both limits and returns the same generic contract", async () => {
  const { calls, service } = createHarness();
  assert.deepEqual(
    await service.resendVerification(
      { email: "player@example.test" },
      metadata(),
    ),
    {
      challengeExpiresInSeconds: 600,
      resendAfterSeconds: 60,
      status: "verification_required",
    },
  );
  assert.ok(
    calls.indexOf("rate:resend_ip") < calls.indexOf("rate:resend_email"),
  );
  assert.ok(
    calls.indexOf("rate:resend_email") < calls.indexOf("crypto:challenge"),
  );
  assert.ok(calls.includes("store:resend"));
});
