import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { forwardIdentityRequest } from "../../apps/web/lib/server/identity-bff.ts";

const INTERNAL_ORIGIN = "http://127.0.0.1:3001";
const PUBLIC_ORIGIN = "https://game.example.test";
const REQUEST_ID = "30000000-0000-4000-8000-000000000001";
const BFF_ASSERTION_KEY = Buffer.alloc(32, 17).toString("base64");
const { DOMException, Headers, Request, Response } = globalThis;

function environment(overrides = {}) {
  return {
    APP_ENV: "local",
    WEB_API_INTERNAL_ORIGIN: INTERNAL_ORIGIN,
    WEB_AUTH_BFF_ASSERTION_KEY_BASE64: BFF_ASSERTION_KEY,
    ...overrides,
  };
}

function request(path, body, headers = {}) {
  return new Request(`${PUBLIC_ORIGIN}${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      authorization: "Bearer must-not-forward",
      cookie: "must-not-forward=true",
      "content-type": "application/json",
      "idempotency-key": "identity-request-0001",
      origin: PUBLIC_ORIGIN,
      "sec-fetch-site": "same-origin",
      "x-correlation-id": "correlation-request-0001",
      "x-forwarded-for": "203.0.113.7",
      "x-request-id": REQUEST_ID,
      ...headers,
    },
    method: "POST",
  });
}

const SESSION_TOKEN = "A".repeat(43);
const SESSION_COOKIE = `__Host-dnd_ai_session=${SESSION_TOKEN}`;
const CREATED_COOKIE = `${SESSION_COOKIE}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`;
const CLEARED_COOKIE =
  "__Host-dnd_ai_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

function genericResponse() {
  return {
    challengeExpiresInSeconds: 600,
    resendAfterSeconds: 60,
    status: "verification_required",
  };
}

test("BFF forwards a fixed path, bounded body and only allowlisted headers", async () => {
  let observed;
  const response = await forwardIdentityRequest(
    request("/api/auth/sign-up", {
      displayName: "Ada",
      email: "ada@example.test",
      password: "una password molto lunga",
    }),
    "/api/auth/sign-up",
    {
      environment: environment(),
      async fetch(url, init) {
        observed = { init, url: String(url) };
        return Response.json(genericResponse(), {
          headers: {
            "retry-after": "60",
            "x-request-id": REQUEST_ID,
          },
          status: 202,
        });
      },
    },
  );

  assert.equal(observed.url, `${INTERNAL_ORIGIN}/api/auth/sign-up`);
  assert.equal(observed.init.method, "POST");
  assert.equal(observed.init.redirect, "manual");
  assert.equal(observed.init.cache, "no-store");
  assert.deepEqual(JSON.parse(observed.init.body), {
    displayName: "Ada",
    email: "ada@example.test",
    password: "una password molto lunga",
  });
  assert.deepEqual([...new Headers(observed.init.headers).keys()].sort(), [
    "content-type",
    "idempotency-key",
    "origin",
    "sec-fetch-site",
    "x-correlation-id",
    "x-dnd-ai-client-issued-at",
    "x-dnd-ai-client-signature",
    "x-dnd-ai-client-subject",
    "x-request-id",
  ]);
  assert.doesNotMatch(
    JSON.stringify([...new Headers(observed.init.headers)]),
    /203\.0\.113\.7/u,
  );
  assert.equal(response.status, 202);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(response.headers.get("x-request-id"), REQUEST_ID);
  assert.deepEqual(await response.json(), genericResponse());
});

test("managed BFF accepts only the provider-controlled single client IP header", async () => {
  const managedEnvironment = environment({
    APP_ENV: "staging",
    WEB_API_INTERNAL_ORIGIN: "https://api.internal",
  });
  let fetches = 0;
  let forwarded;
  const valid = await forwardIdentityRequest(
    request(
      "/api/auth/resend-verification",
      { email: "ada@example.test" },
      { "x-vercel-forwarded-for": "198.51.100.7" },
    ),
    "/api/auth/resend-verification",
    {
      environment: managedEnvironment,
      async fetch(_url, init) {
        fetches += 1;
        forwarded = new Headers(init.headers);
        return Response.json(genericResponse(), { status: 202 });
      },
    },
  );
  assert.equal(valid.status, 202);
  assert.equal(fetches, 1);
  assert.match(forwarded.get("x-dnd-ai-client-subject"), /^[0-9a-f]{64}$/u);
  assert.doesNotMatch(
    JSON.stringify([...forwarded]),
    /198\.51\.100\.7|203\.0\.113\.7/u,
  );

  for (const incoming of [
    request("/api/auth/resend-verification", {
      email: "ada@example.test",
    }),
    request(
      "/api/auth/resend-verification",
      { email: "ada@example.test" },
      { "x-vercel-forwarded-for": "198.51.100.7, 198.51.100.8" },
    ),
  ]) {
    const rejected = await forwardIdentityRequest(
      incoming,
      "/api/auth/resend-verification",
      {
        environment: managedEnvironment,
        async fetch() {
          fetches += 1;
          return Response.json(genericResponse(), { status: 202 });
        },
      },
    );
    assert.equal(rejected.status, 503);
  }
  assert.equal(fetches, 1);
});

test("BFF rejects oversized request bodies before fetch", async () => {
  let fetches = 0;
  const response = await forwardIdentityRequest(
    request("/api/auth/sign-up", { email: "a".repeat(4_097) }),
    "/api/auth/sign-up",
    {
      environment: environment(),
      async fetch() {
        fetches += 1;
        throw new Error("must not fetch");
      },
    },
  );

  assert.equal(fetches, 0);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "identity.request_invalid");
});

test("BFF fails closed on invalid config and upstream timeout", async () => {
  let fetches = 0;
  const invalid = await forwardIdentityRequest(
    request("/api/auth/resend-verification", { email: "ada@example.test" }),
    "/api/auth/resend-verification",
    {
      environment: environment({ WEB_API_INTERNAL_ORIGIN: "ftp://invalid" }),
      async fetch() {
        fetches += 1;
        return Response.json(genericResponse());
      },
    },
  );
  assert.equal(invalid.status, 503);
  assert.equal(fetches, 0);

  const timedOut = await forwardIdentityRequest(
    request("/api/auth/resend-verification", { email: "ada@example.test" }),
    "/api/auth/resend-verification",
    {
      environment: environment(),
      fetch(_url, init) {
        fetches += 1;
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      },
      timeoutMs: 5,
    },
  );
  assert.equal(timedOut.status, 503);
  assert.equal(
    (await timedOut.json()).error.code,
    "identity.delivery_unavailable",
  );
  assert.equal(fetches, 1);
});

test("BFF bounds and validates JSON responses", async () => {
  for (const upstream of [
    new Response("not-json", {
      headers: { "content-type": "text/plain" },
      status: 202,
    }),
    new Response(JSON.stringify({ value: "x".repeat(20_000) }), {
      headers: { "content-type": "application/json" },
      status: 202,
    }),
    Response.json({ redirect: "https://evil.example" }, { status: 302 }),
  ]) {
    const response = await forwardIdentityRequest(
      request("/api/auth/sign-up", { email: "ada@example.test" }),
      "/api/auth/sign-up",
      {
        environment: environment(),
        async fetch() {
          return upstream;
        },
      },
    );
    assert.equal(response.status, 502);
    assert.equal(
      (await response.json()).error.code,
      "identity.delivery_unavailable",
    );
  }
});

test("verify passes one exact host cookie and rejects missing, multiple or weak cookies", async () => {
  const validCookie = CREATED_COOKIE;
  const valid = await forwardIdentityRequest(
    request("/api/auth/verify-email", {
      code: "012345",
      email: "ada@example.test",
    }),
    "/api/auth/verify-email",
    {
      environment: environment(),
      async fetch() {
        return Response.json(
          { status: "verified" },
          { headers: { "set-cookie": validCookie }, status: 200 },
        );
      },
    },
  );
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("set-cookie"), validCookie);

  const invalidHeaders = [
    [],
    [`${validCookie}; Domain=example.test`],
    [validCookie, "second=value; Path=/; HttpOnly; Secure; SameSite=Lax"],
  ];
  for (const cookies of invalidHeaders) {
    const headers = new Headers({ "content-type": "application/json" });
    for (const cookie of cookies) headers.append("set-cookie", cookie);
    const response = await forwardIdentityRequest(
      request("/api/auth/verify-email", {
        code: "012345",
        email: "ada@example.test",
      }),
      "/api/auth/verify-email",
      {
        environment: environment(),
        async fetch() {
          return new Response(JSON.stringify({ status: "verified" }), {
            headers,
            status: 200,
          });
        },
      },
    );
    assert.equal(response.status, 502);
    assert.equal(response.headers.has("set-cookie"), false);
  }
});

test("access BFF forwards only the canonical session cookie on allowlisted paths", async () => {
  const cases = [
    {
      body: { email: "ada@example.test", password: "una password molto lunga" },
      cookie: null,
      path: "/api/auth/sign-in",
      response: () =>
        Response.json(
          { status: "authenticated" },
          { headers: { "set-cookie": CREATED_COOKIE }, status: 200 },
        ),
      status: 200,
    },
    {
      body: undefined,
      cookie: SESSION_COOKIE,
      path: "/api/auth/session/refresh",
      response: () =>
        Response.json(
          { status: "authenticated" },
          { headers: { "set-cookie": CREATED_COOKIE }, status: 200 },
        ),
      status: 200,
    },
    {
      body: undefined,
      cookie: SESSION_COOKIE,
      path: "/api/auth/sign-out",
      response: () =>
        new Response(null, {
          headers: { "set-cookie": CLEARED_COOKIE },
          status: 204,
        }),
      status: 204,
    },
    {
      body: { confirmation: "revoke_all" },
      cookie: SESSION_COOKIE,
      path: "/api/auth/sessions/revoke-all",
      response: () =>
        new Response(null, {
          headers: { "set-cookie": CLEARED_COOKIE },
          status: 204,
        }),
      status: 204,
    },
    {
      body: { email: "ada@example.test" },
      cookie: null,
      path: "/api/auth/password-reset/request",
      response: () =>
        Response.json({ status: "password_reset_requested" }, { status: 202 }),
      status: 202,
    },
    {
      body: {
        code: "012345",
        email: "ada@example.test",
        newPassword: "una nuova password lunga",
      },
      cookie: null,
      path: "/api/auth/password-reset/confirm",
      response: () =>
        Response.json(
          { status: "password_reset" },
          { headers: { "set-cookie": CLEARED_COOKIE }, status: 200 },
        ),
      status: 200,
    },
  ];

  for (const scenario of cases) {
    let forwarded;
    const incomingCookie = `analytics=ignored; ${SESSION_COOKIE}; theme=dark`;
    const response = await forwardIdentityRequest(
      request(scenario.path, scenario.body, { cookie: incomingCookie }),
      scenario.path,
      {
        environment: environment(),
        async fetch(_url, init) {
          forwarded = new Headers(init.headers);
          if (scenario.body === undefined) {
            assert.equal("body" in init, false);
            assert.equal(forwarded.has("content-type"), false);
          }
          return scenario.response();
        },
      },
    );

    assert.equal(response.status, scenario.status);
    assert.equal(forwarded.get("cookie"), scenario.cookie);
    assert.equal(
      response.headers.get("set-cookie"),
      scenario.status === 202
        ? null
        : scenario.response().headers.get("set-cookie"),
    );
  }
});

test("access BFF rejects unexpected cookie contracts and malformed session input", async () => {
  let fetches = 0;
  const malformed = await forwardIdentityRequest(
    request("/api/auth/session/refresh", undefined, {
      cookie: `${SESSION_COOKIE}; ${SESSION_COOKIE}`,
    }),
    "/api/auth/session/refresh",
    {
      environment: environment(),
      async fetch() {
        fetches += 1;
        return Response.json({ status: "authenticated" });
      },
    },
  );
  assert.equal(malformed.status, 400);
  assert.equal(fetches, 0);

  const unexpected = await forwardIdentityRequest(
    request("/api/auth/password-reset/request", {
      email: "ada@example.test",
    }),
    "/api/auth/password-reset/request",
    {
      environment: environment(),
      async fetch() {
        fetches += 1;
        return Response.json(
          { status: "password_reset_requested" },
          { headers: { "set-cookie": CREATED_COOKIE }, status: 202 },
        );
      },
    },
  );
  assert.equal(unexpected.status, 502);
  assert.equal(unexpected.headers.has("set-cookie"), false);
});

test("BFF drops malformed request and response identifiers", async () => {
  let forwarded;
  const response = await forwardIdentityRequest(
    request(
      "/api/auth/resend-verification",
      { email: "ada@example.test" },
      {
        "x-correlation-id": "short",
        "x-request-id": "not-a-uuid",
      },
    ),
    "/api/auth/resend-verification",
    {
      environment: environment(),
      async fetch(_url, init) {
        forwarded = new Headers(init.headers);
        return Response.json(genericResponse(), {
          headers: { "x-request-id": "invalid" },
          status: 202,
        });
      },
    },
  );

  assert.equal(forwarded.has("x-request-id"), false);
  assert.equal(forwarded.has("x-correlation-id"), false);
  assert.equal(response.headers.has("x-request-id"), false);
});
