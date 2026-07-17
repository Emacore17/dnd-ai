import assert from "node:assert/strict";
import test from "node:test";

import {
  IdentityApplicationError,
  createApiApp,
} from "../../apps/api/dist/index.js";

const ORIGIN = "https://game.example.test";
const NOW = new Date("2026-07-17T08:00:00.000Z");
const TOKEN = "A".repeat(43);
const OLD_TOKEN = "_".repeat(42) + "8";
const COOKIE = `__Host-dnd_ai_session=${OLD_TOKEN}`;
const CLEAR_COOKIE =
  "__Host-dnd_ai_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

function headers(overrides = {}) {
  return {
    "idempotency-key": "identity-access-key-0001",
    origin: ORIGIN,
    "sec-fetch-site": "same-origin",
    "x-request-id": "40000000-0000-4000-8000-000000000001",
    ...overrides,
  };
}

function createHarness(overrides = {}) {
  const calls = [];
  const service = {
    async signIn(request, metadata) {
      calls.push({ metadata, operation: "sign-in", request });
      return {
        absoluteExpiresAt: new Date(NOW.valueOf() + 3_600_000),
        sessionToken: TOKEN,
        status: "authenticated",
      };
    },
    async refreshSession(sessionToken, metadata) {
      calls.push({ metadata, operation: "refresh", sessionToken });
      return {
        absoluteExpiresAt: new Date(NOW.valueOf() + 3_600_000),
        sessionToken: TOKEN,
        status: "authenticated",
      };
    },
    async signOut(sessionToken, metadata) {
      calls.push({ metadata, operation: "sign-out", sessionToken });
    },
    async revokeAllSessions(sessionToken, request, metadata) {
      calls.push({ metadata, operation: "revoke-all", request, sessionToken });
    },
    async requestPasswordReset(request, metadata) {
      calls.push({ metadata, operation: "reset-request", request });
      return { status: "password_reset_requested" };
    },
    async confirmPasswordReset(request, metadata) {
      calls.push({ metadata, operation: "reset-confirm", request });
      return { status: "password_reset" };
    },
    ...overrides.service,
  };
  const app = createApiApp(
    { logger: false },
    {
      identityAccess: {
        clock: { now: () => new Date(NOW) },
        publicOrigin: ORIGIN,
        service,
      },
    },
  );
  return { app, calls };
}

test("access API exposes six secure routes with rotation, clear and body contracts", async (context) => {
  const { app, calls } = createHarness();
  context.after(() => app.close());

  const signIn = await app.inject({
    headers: headers({ cookie: COOKIE }),
    method: "POST",
    payload: { email: "Player@Example.test", password: "password molto lunga" },
    url: "/api/auth/sign-in",
  });
  assert.equal(signIn.statusCode, 200);
  assert.deepEqual(JSON.parse(signIn.body), { status: "authenticated" });
  assert.match(signIn.headers["set-cookie"], new RegExp(`=${TOKEN};`, "u"));
  assert.equal("sessionToken" in calls[0], false);

  const refresh = await app.inject({
    headers: headers({
      cookie: COOKIE,
      "idempotency-key": "identity-access-key-0002",
    }),
    method: "POST",
    url: "/api/auth/session/refresh",
  });
  assert.equal(refresh.statusCode, 200);
  assert.equal(calls[1].sessionToken, OLD_TOKEN);
  assert.match(refresh.headers["set-cookie"], new RegExp(`=${TOKEN};`, "u"));

  const signOut = await app.inject({
    headers: headers({ "idempotency-key": "identity-access-key-0003" }),
    method: "POST",
    url: "/api/auth/sign-out",
  });
  assert.equal(signOut.statusCode, 204);
  assert.equal(signOut.body, "");
  assert.equal(calls[2].sessionToken, null);
  assert.equal(signOut.headers["set-cookie"], CLEAR_COOKIE);

  const revoke = await app.inject({
    headers: headers({
      cookie: COOKIE,
      "idempotency-key": "identity-access-key-0004",
    }),
    method: "POST",
    payload: { confirmation: "revoke_all" },
    url: "/api/auth/sessions/revoke-all",
  });
  assert.equal(revoke.statusCode, 204);
  assert.equal(revoke.body, "");
  assert.equal(calls[3].sessionToken, OLD_TOKEN);
  assert.equal(revoke.headers["set-cookie"], CLEAR_COOKIE);

  const resetRequest = await app.inject({
    headers: headers({
      cookie: COOKIE,
      "idempotency-key": "identity-access-key-0005",
    }),
    method: "POST",
    payload: { email: "player@example.test" },
    url: "/api/auth/password-reset/request",
  });
  assert.equal(resetRequest.statusCode, 202);
  assert.deepEqual(JSON.parse(resetRequest.body), {
    status: "password_reset_requested",
  });
  assert.equal(resetRequest.headers["set-cookie"], undefined);

  const resetConfirm = await app.inject({
    headers: headers({
      cookie: COOKIE,
      "idempotency-key": "identity-access-key-0006",
    }),
    method: "POST",
    payload: {
      code: "012345",
      email: "player@example.test",
      newPassword: "una nuova password lunga",
    },
    url: "/api/auth/password-reset/confirm",
  });
  assert.equal(resetConfirm.statusCode, 200);
  assert.deepEqual(JSON.parse(resetConfirm.body), { status: "password_reset" });
  assert.equal(resetConfirm.headers["set-cookie"], CLEAR_COOKIE);
  assert.deepEqual(
    calls.map(({ operation }) => operation),
    [
      "sign-in",
      "refresh",
      "sign-out",
      "revoke-all",
      "reset-request",
      "reset-confirm",
    ],
  );
  for (const response of [
    signIn,
    refresh,
    signOut,
    revoke,
    resetRequest,
    resetConfirm,
  ]) {
    assert.equal(response.headers["cache-control"], "no-store");
  }
});

test("access API rejects missing sessions, cross-site requests and reflects no internal detail", async (context) => {
  const { app, calls } = createHarness({
    service: {
      async signIn() {
        throw new IdentityApplicationError(
          "CREDENTIALS_INVALID",
          "player@example.test:secret",
        );
      },
    },
  });
  context.after(() => app.close());

  const credentials = await app.inject({
    headers: headers(),
    method: "POST",
    payload: { email: "player@example.test", password: "password molto lunga" },
    url: "/api/auth/sign-in",
  });
  assert.equal(credentials.statusCode, 401);
  assert.equal(
    JSON.parse(credentials.body).error.code,
    "identity.credentials_invalid",
  );
  assert.doesNotMatch(credentials.body, /example\.test|secret/u);

  const missing = await app.inject({
    headers: headers({ "idempotency-key": "identity-access-key-0002" }),
    method: "POST",
    url: "/api/auth/session/refresh",
  });
  assert.equal(missing.statusCode, 401);
  assert.equal(JSON.parse(missing.body).error.code, "identity.session_invalid");

  const rejected = await app.inject({
    headers: headers({ origin: "https://evil.example" }),
    method: "POST",
    payload: { email: "player@example.test" },
    url: "/api/auth/password-reset/request",
  });
  assert.equal(rejected.statusCode, 403);
  assert.equal(calls.length, 0);
});

test("session-destroying routes clear the cookie on safe application failures", async (context) => {
  const { app } = createHarness({
    service: {
      async signOut() {
        throw new IdentityApplicationError("RATE_LIMITED", "internal", 11);
      },
    },
  });
  context.after(() => app.close());
  const response = await app.inject({
    headers: headers({ cookie: COOKIE }),
    method: "POST",
    url: "/api/auth/sign-out",
  });
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["set-cookie"], CLEAR_COOKIE);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["retry-after"], "11");
});
