import assert from "node:assert/strict";
import test from "node:test";

import {
  IdentityApplicationError,
  createApiApp,
} from "../../apps/api/dist/index.js";

const ORIGIN = "https://game.example.test";
const REQUEST_ID = "30000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-07-16T12:00:00.000Z");
const TOKEN = "A".repeat(43);
const GENERIC_RESPONSE = {
  challengeExpiresInSeconds: 600,
  resendAfterSeconds: 60,
  status: "verification_required",
};

function createHarness(overrides = {}) {
  const calls = [];
  const service = {
    async signUp(request, metadata) {
      calls.push({ metadata, operation: "signup", request });
      return GENERIC_RESPONSE;
    },
    async verifyEmail(request, metadata) {
      calls.push({ metadata, operation: "verify", request });
      return {
        absoluteExpiresAt: new Date(NOW.valueOf() + 3_600_000),
        sessionToken: TOKEN,
        status: "verified",
      };
    },
    async resendVerification(request, metadata) {
      calls.push({ metadata, operation: "resend", request });
      return GENERIC_RESPONSE;
    },
    ...overrides.service,
  };
  const app = createApiApp(
    { logger: false },
    {
      identity: {
        clock: { now: () => new Date(NOW) },
        publicOrigin: ORIGIN,
        service,
        ...overrides.identity,
      },
    },
  );
  return { app, calls, service };
}

function headers(overrides = {}) {
  return {
    "idempotency-key": "identity-key-0001",
    origin: ORIGIN,
    "sec-fetch-site": "same-origin",
    "x-request-id": REQUEST_ID,
    ...overrides,
  };
}

function parse(response) {
  return JSON.parse(response.body);
}

test("identity API exposes generic signup/resend and verified cookie success", async (context) => {
  const { app, calls } = createHarness();
  context.after(() => app.close());

  const signup = await app.inject({
    headers: headers(),
    method: "POST",
    payload: {
      displayName: "Player",
      email: "Player@Example.test",
      password: "una password molto lunga",
    },
    url: "/api/auth/sign-up",
  });
  assert.equal(signup.statusCode, 202);
  assert.deepEqual(parse(signup), GENERIC_RESPONSE);
  assert.equal(signup.headers["x-request-id"], REQUEST_ID);

  const resend = await app.inject({
    headers: headers({ "idempotency-key": "identity-key-0002" }),
    method: "POST",
    payload: { email: "Player@Example.test" },
    url: "/api/auth/resend-verification",
  });
  assert.equal(resend.statusCode, 202);
  assert.deepEqual(parse(resend), GENERIC_RESPONSE);

  const verify = await app.inject({
    headers: headers({ "idempotency-key": "identity-key-0003" }),
    method: "POST",
    payload: { code: "012345", email: "Player@Example.test" },
    url: "/api/auth/verify-email",
  });
  assert.equal(verify.statusCode, 200);
  assert.deepEqual(parse(verify), { status: "verified" });
  assert.equal(
    verify.headers["set-cookie"],
    `__Host-dnd_ai_session=${TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`,
  );
  assert.deepEqual(
    calls.map(({ operation }) => operation),
    ["signup", "resend", "verify"],
  );
  assert.equal(calls[0].request.email, "player@example.test");
  assert.equal(calls[0].metadata.ipSubject, "127.0.0.1");
  assert.equal(calls[0].metadata.idempotencyKey, "identity-key-0001");
});

test("identity API accepts only complete client-subject assertions verified by the BFF trust boundary", async (context) => {
  let observedAssertion;
  const trustedSubject = "b".repeat(64);
  const { app, calls } = createHarness({
    identity: {
      verifyClientSubjectAssertion(assertion, now) {
        observedAssertion = { assertion, now };
        return assertion.signature === "a".repeat(64) ? trustedSubject : null;
      },
    },
  });
  context.after(() => app.close());

  const trusted = await app.inject({
    headers: headers({
      "x-dnd-ai-client-issued-at": "1784203200",
      "x-dnd-ai-client-signature": "a".repeat(64),
      "x-dnd-ai-client-subject": "c".repeat(64),
    }),
    method: "POST",
    payload: { email: "player@example.test" },
    url: "/api/auth/resend-verification",
  });
  assert.equal(trusted.statusCode, 202);
  assert.deepEqual(observedAssertion, {
    assertion: {
      issuedAt: "1784203200",
      signature: "a".repeat(64),
      subject: "c".repeat(64),
    },
    now: NOW,
  });
  assert.equal(calls[0].metadata.ipSubject, trustedSubject);

  for (const assertionHeaders of [
    { "x-dnd-ai-client-subject": "c".repeat(64) },
    {
      "x-dnd-ai-client-issued-at": "1784203200",
      "x-dnd-ai-client-signature": "d".repeat(64),
      "x-dnd-ai-client-subject": "c".repeat(64),
    },
  ]) {
    const rejected = await app.inject({
      headers: headers({
        "idempotency-key": `identity-key-${calls.length + 1}`,
        ...assertionHeaders,
      }),
      method: "POST",
      payload: { email: "player@example.test" },
      url: "/api/auth/resend-verification",
    });
    assert.equal(rejected.statusCode, 403);
    assert.equal(parse(rejected).error.code, "identity.origin_rejected");
  }
  assert.equal(calls.length, 1);
});

test("identity API rejects origin, fetch-site, key and strict body before service", async (context) => {
  const { app, calls } = createHarness();
  context.after(() => app.close());
  const cases = [
    {
      expectedCode: "identity.origin_rejected",
      expectedStatus: 403,
      headers: headers({ origin: "https://evil.example" }),
      payload: { email: "player@example.test" },
    },
    {
      expectedCode: "identity.origin_rejected",
      expectedStatus: 403,
      headers: headers({ "sec-fetch-site": "cross-site" }),
      payload: { email: "player@example.test" },
    },
    {
      expectedCode: "identity.request_invalid",
      expectedStatus: 400,
      headers: headers({ "idempotency-key": "short" }),
      payload: { email: "player@example.test" },
    },
    {
      expectedCode: "identity.request_invalid",
      expectedStatus: 400,
      headers: headers(),
      payload: { email: "player@example.test", unexpected: true },
    },
  ];
  for (const item of cases) {
    const response = await app.inject({
      headers: item.headers,
      method: "POST",
      payload: item.payload,
      url: "/api/auth/resend-verification",
    });
    assert.equal(response.statusCode, item.expectedStatus);
    const body = parse(response);
    assert.equal(body.error.code, item.expectedCode);
    assert.equal(body.error.requestId, REQUEST_ID);
    assert.equal(typeof body.error.retryable, "boolean");
  }
  assert.equal(calls.length, 0);
});

test("identity API maps stable application errors and Retry-After", async (context) => {
  const scenarios = [
    ["REQUEST_INVALID", 400, "identity.request_invalid", false],
    ["PASSWORD_REJECTED", 422, "identity.request_invalid", false],
    ["IDEMPOTENCY_CONFLICT", 409, "identity.idempotency_conflict", false],
    ["VERIFICATION_EXPIRED", 410, "identity.verification_expired", false],
    ["VERIFICATION_INVALID", 422, "identity.verification_invalid", false],
    [
      "VERIFICATION_RATE_LIMITED",
      429,
      "identity.verification_rate_limited",
      false,
    ],
    ["RATE_LIMITED", 429, "identity.rate_limited", false],
    ["DELIVERY_UNAVAILABLE", 503, "identity.delivery_unavailable", true],
  ];
  for (const [applicationCode, status, responseCode, retryable] of scenarios) {
    const { app } = createHarness({
      service: {
        async verifyEmail() {
          throw new IdentityApplicationError(
            applicationCode,
            "internal-message-must-not-be-reflected",
            status === 429 ? 17 : undefined,
          );
        },
      },
    });
    context.after(() => app.close());
    const response = await app.inject({
      headers: headers(),
      method: "POST",
      payload: { code: "012345", email: "player@example.test" },
      url: "/api/auth/verify-email",
    });
    assert.equal(response.statusCode, status);
    const body = parse(response);
    assert.equal(body.error.code, responseCode);
    assert.equal(body.error.retryable, retryable);
    assert.doesNotMatch(
      response.body,
      /internal-message-must-not-be-reflected/u,
    );
    if (status === 429) assert.equal(response.headers["retry-after"], "17");
  }
});

test("identity API bounds request bodies", async (context) => {
  const { app, calls } = createHarness();
  context.after(() => app.close());
  const response = await app.inject({
    headers: headers({ "content-type": "application/json" }),
    method: "POST",
    payload: JSON.stringify({ email: `${"a".repeat(5_000)}@example.test` }),
    url: "/api/auth/resend-verification",
  });
  assert.equal(response.statusCode, 413);
  assert.equal(parse(response).error.code, "identity.request_invalid");
  assert.equal(calls.length, 0);
  assert.doesNotMatch(response.body, /a{100}/u);
});
