import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

const configModule = await import("../../packages/config/dist/index.js");

const API_IDENTITY_ENVIRONMENT = Object.freeze({
  API_PUBLIC_ORIGIN: "http://127.0.0.1:3000",
  API_AUTH_PASSWORD_PEPPER_BASE64:
    "YGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn8=",
  API_AUTH_PASSWORD_PEPPER_VERSION: "3",
  API_AUTH_CHALLENGE_HMAC_KEY_BASE64:
    "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  API_AUTH_CHALLENGE_KEY_VERSION: "7",
  API_AUTH_SESSION_HMAC_KEY_BASE64:
    "ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=",
  API_AUTH_SESSION_KEY_VERSION: "9",
  API_AUTH_SUBJECT_HASH_KEY_BASE64:
    "QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8=",
  API_AUTH_BFF_ASSERTION_KEY_BASE64:
    "gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp8=",
});

const API_LOCAL_ENVIRONMENT = Object.freeze({
  APP_ENV: "local",
  API_HOST: "127.0.0.1",
  API_PORT: "3001",
  API_DATABASE_URL: "postgresql://dnd_api_local@127.0.0.1:5432/dnd_ai_local",
  API_REDIS_URL: "redis://127.0.0.1:6379/0",
  ...API_IDENTITY_ENVIRONMENT,
});

const WORKER_CHALLENGE_ENVIRONMENT = Object.freeze({
  WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64:
    API_IDENTITY_ENVIRONMENT.API_AUTH_CHALLENGE_HMAC_KEY_BASE64,
  WORKER_AUTH_CHALLENGE_KEY_VERSION:
    API_IDENTITY_ENVIRONMENT.API_AUTH_CHALLENGE_KEY_VERSION,
});

function bytesToHex(value) {
  assert.equal(value instanceof Uint8Array, true);
  return Buffer.from(value).toString("hex");
}

test("API identity secrets are decoded, versioned, scoped and deeply frozen", () => {
  const parse = configModule.parseApiRuntimeConfig;
  assert.equal(typeof parse, "function");
  const parsed = parse(API_LOCAL_ENVIRONMENT);

  assert.equal(parsed.publicOrigin, "http://127.0.0.1:3000");
  assert.deepEqual(
    {
      passwordVersion: parsed.identity.passwordPepper.version,
      passwordHex: bytesToHex(parsed.identity.passwordPepper.key),
      challengeVersion: parsed.identity.challenge.version,
      challengeHex: bytesToHex(parsed.identity.challenge.key),
      sessionVersion: parsed.identity.session.version,
      sessionHex: bytesToHex(parsed.identity.session.key),
      subjectHex: bytesToHex(parsed.identity.subjectHashKey),
      bffAssertionHex: bytesToHex(parsed.identity.bffAssertionKey),
    },
    {
      passwordVersion: 3,
      passwordHex:
        "606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f",
      challengeVersion: 7,
      challengeHex:
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      sessionVersion: 9,
      sessionHex:
        "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f",
      subjectHex:
        "404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f",
      bffAssertionHex:
        "808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f",
    },
  );
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.identity), true);
  assert.equal(Object.isFrozen(parsed.identity.passwordPepper), true);
});

test("identity configuration rejects missing, short, malformed or reused secrets without reflection", () => {
  const parse = configModule.parseApiRuntimeConfig;
  const reflectedSecret = "not-valid-secret-that-must-never-appear";

  for (const override of [
    { API_AUTH_PASSWORD_PEPPER_BASE64: undefined },
    { API_AUTH_PASSWORD_PEPPER_BASE64: Buffer.alloc(31).toString("base64") },
    { API_AUTH_PASSWORD_PEPPER_BASE64: reflectedSecret },
    {
      API_AUTH_SESSION_HMAC_KEY_BASE64:
        API_IDENTITY_ENVIRONMENT.API_AUTH_CHALLENGE_HMAC_KEY_BASE64,
    },
  ]) {
    assert.throws(
      () => parse({ ...API_LOCAL_ENVIRONMENT, ...override }),
      (error) => {
        assert.equal(
          error instanceof configModule.RuntimeConfigurationError,
          true,
        );
        assert.doesNotMatch(error.message, new RegExp(reflectedSecret));
        assert.equal(error.invalidKeys.length > 0, true);
        return true;
      },
    );
  }
});

test("public and internal origins reject credentials, query, fragments and insecure managed values", () => {
  const parseApi = configModule.parseApiRuntimeConfig;
  const parseWeb = configModule.parseWebRuntimeConfig;
  assert.equal(
    typeof parseWeb,
    "function",
    "parseWebRuntimeConfig must be exported",
  );

  for (const origin of [
    "https://user:password@example.test",
    "https://example.test/path",
    "https://example.test?debug=true",
    "https://example.test#fragment",
  ]) {
    assert.throws(() =>
      parseApi({ ...API_LOCAL_ENVIRONMENT, API_PUBLIC_ORIGIN: origin }),
    );
    assert.throws(() =>
      parseWeb({
        APP_ENV: "local",
        WEB_API_INTERNAL_ORIGIN: origin,
        WEB_AUTH_BFF_ASSERTION_KEY_BASE64:
          API_IDENTITY_ENVIRONMENT.API_AUTH_BFF_ASSERTION_KEY_BASE64,
      }),
    );
  }

  assert.throws(() =>
    parseWeb({
      APP_ENV: "staging",
      WEB_API_INTERNAL_ORIGIN: "http://api.internal:3001",
      WEB_AUTH_BFF_ASSERTION_KEY_BASE64:
        API_IDENTITY_ENVIRONMENT.API_AUTH_BFF_ASSERTION_KEY_BASE64,
    }),
  );
  assert.deepEqual(
    parseWeb({
      APP_ENV: "staging",
      WEB_API_INTERNAL_ORIGIN: "https://api.internal",
      WEB_AUTH_BFF_ASSERTION_KEY_BASE64:
        API_IDENTITY_ENVIRONMENT.API_AUTH_BFF_ASSERTION_KEY_BASE64,
      API_AUTH_PASSWORD_PEPPER_BASE64: "must-not-cross-web-boundary",
    }),
    {
      environment: "staging",
      apiInternalOrigin: "https://api.internal",
      bffAssertionKey: Uint8Array.from(
        Buffer.from(
          API_IDENTITY_ENVIRONMENT.API_AUTH_BFF_ASSERTION_KEY_BASE64,
          "base64",
        ),
      ),
    },
  );
});

test("worker email delivery is fake only locally and SMTP is complete outside local", () => {
  const parse = configModule.parseWorkerRuntimeConfig;
  const base = {
    APP_ENV: "local",
    WORKER_DATABASE_URL: "postgresql://worker@127.0.0.1:5432/dnd_ai_local",
    WORKER_REDIS_URL: "redis://127.0.0.1:6379/1",
    ...WORKER_CHALLENGE_ENVIRONMENT,
  };

  const local = parse({ ...base, WORKER_EMAIL_DELIVERY_MODE: "fake" });
  assert.deepEqual(local.emailDelivery, { mode: "fake" });
  assert.equal(local.identity.challenge.version, 7);

  const smtp = parse({
    ...base,
    APP_ENV: "staging",
    WORKER_DATABASE_URL:
      "postgresql://worker:password@db.internal:5432/dnd_ai?sslmode=require",
    WORKER_REDIS_URL: "rediss://worker:password@cache.internal:6380/1",
    WORKER_EMAIL_DELIVERY_MODE: "smtp",
    WORKER_SMTP_HOST: "smtp.internal",
    WORKER_SMTP_PORT: "465",
    WORKER_SMTP_SECURE: "true",
    WORKER_SMTP_USERNAME: "mailer",
    WORKER_SMTP_PASSWORD: "smtp-password-not-for-logs",
    WORKER_SMTP_FROM: "AI Adventure <noreply@example.test>",
  });
  assert.deepEqual(smtp.emailDelivery, {
    mode: "smtp",
    host: "smtp.internal",
    port: 465,
    secure: true,
    username: "mailer",
    password: "smtp-password-not-for-logs",
    from: "AI Adventure <noreply@example.test>",
  });

  assert.throws(() =>
    parse({ ...base, APP_ENV: "staging", WORKER_EMAIL_DELIVERY_MODE: "fake" }),
  );
  assert.throws(() =>
    parse({
      ...base,
      APP_ENV: "staging",
      WORKER_EMAIL_DELIVERY_MODE: "smtp",
    }),
  );
});
