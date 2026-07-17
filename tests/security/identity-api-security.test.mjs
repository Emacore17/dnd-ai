import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { createApiApp } from "../../apps/api/dist/index.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const REQUEST_ID = "30000000-0000-4000-8000-000000000001";

test("identity routes never trust forwarded IP or reflect request canaries", async (context) => {
  let observedMetadata;
  const canaryEmail = "identity-canary@example.test";
  const canaryPassword = "identity-password-canary-very-long";
  const app = createApiApp(
    { logger: false },
    {
      identity: {
        clock: { now: () => new Date("2026-07-16T12:00:00.000Z") },
        publicOrigin: "https://game.example.test",
        service: {
          async signUp(_request, metadata) {
            observedMetadata = metadata;
            throw new Error(`${canaryEmail}:${canaryPassword}:unexpected`);
          },
          async verifyEmail() {
            throw new Error("unexpected");
          },
          async resendVerification() {
            throw new Error("unexpected");
          },
        },
      },
    },
  );
  context.after(() => app.close());
  const response = await app.inject({
    headers: {
      "idempotency-key": "identity-key-canary-0001",
      origin: "https://game.example.test",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": "198.51.100.99",
      "x-request-id": REQUEST_ID,
    },
    method: "POST",
    payload: {
      displayName: "Canary",
      email: canaryEmail,
      password: canaryPassword,
    },
    url: "/api/auth/sign-up",
  });
  assert.equal(response.statusCode, 503);
  assert.equal(observedMetadata.ipSubject, "127.0.0.1");
  assert.doesNotMatch(response.body, new RegExp(canaryEmail, "u"));
  assert.doesNotMatch(response.body, new RegExp(canaryPassword, "u"));
  assert.doesNotMatch(response.body, /198\.51\.100\.99/u);
  assert.doesNotMatch(JSON.stringify(response.headers), /identity-key-canary/u);
});

test("identity route source has fixed paths, bounded bodies and no body logging", async () => {
  const [registrationSource, accessSource] = await Promise.all([
    readFile(
      path.join(repositoryRoot, "apps/api/src/identity/routes.ts"),
      "utf8",
    ),
    readFile(
      path.join(repositoryRoot, "apps/api/src/identity/access-routes.ts"),
      "utf8",
    ),
  ]);
  const source = `${registrationSource}\n${accessSource}`;
  assert.match(source, /\/api\/auth\/sign-up/u);
  assert.match(source, /\/api\/auth\/verify-email/u);
  assert.match(source, /\/api\/auth\/resend-verification/u);
  assert.match(source, /\/api\/auth\/sign-in/u);
  assert.match(source, /\/api\/auth\/session\/refresh/u);
  assert.match(source, /\/api\/auth\/sign-out/u);
  assert.match(source, /\/api\/auth\/sessions\/revoke-all/u);
  assert.match(source, /\/api\/auth\/password-reset\/request/u);
  assert.match(source, /\/api\/auth\/password-reset\/confirm/u);
  assert.match(source, /const BODY_LIMIT_BYTES = 4_096/u);
  assert.equal((source.match(/bodyLimit: BODY_LIMIT_BYTES/gu) ?? []).length, 9);
  assert.doesNotMatch(
    source,
    /request\.body.*(?:log|capture)|(?:log|capture).*request\.body/isu,
  );
  assert.doesNotMatch(source, /x-forwarded-for/iu);
  assert.doesNotMatch(source, /console\.(?:log|error|warn|info)/u);
});
