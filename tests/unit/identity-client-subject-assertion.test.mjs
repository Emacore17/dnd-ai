import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { verifyIdentityClientSubjectAssertion } from "../../apps/api/dist/index.js";
import { createIdentityClientSubjectAssertion } from "../../apps/web/lib/server/identity-client-subject-assertion.ts";

const KEY = Buffer.alloc(32, 17);
const NOW = new Date("2026-07-16T12:00:00.000Z");

test("BFF and API share a pseudonymous bounded client-subject assertion", () => {
  const assertion = createIdentityClientSubjectAssertion({
    clientIp: "203.0.113.7",
    issuedAt: NOW,
    key: KEY,
  });

  assert.match(assertion.subject, /^[0-9a-f]{64}$/u);
  assert.match(assertion.signature, /^[0-9a-f]{64}$/u);
  assert.equal(assertion.issuedAt, "1784203200");
  assert.doesNotMatch(JSON.stringify(assertion), /203\.0\.113\.7/u);
  assert.equal(
    verifyIdentityClientSubjectAssertion(assertion, {
      key: KEY,
      now: NOW,
    }),
    assertion.subject,
  );
});

test("client-subject assertions reject tampering, expiry and malformed IPs", () => {
  assert.throws(
    () =>
      createIdentityClientSubjectAssertion({
        clientIp: "not-an-ip",
        issuedAt: NOW,
        key: KEY,
      }),
    /client IP/iu,
  );
  const assertion = createIdentityClientSubjectAssertion({
    clientIp: "2001:db8::7",
    issuedAt: NOW,
    key: KEY,
  });
  for (const candidate of [
    { ...assertion, subject: "f".repeat(64) },
    { ...assertion, signature: "f".repeat(64) },
    { ...assertion, issuedAt: "not-a-time" },
  ]) {
    assert.equal(
      verifyIdentityClientSubjectAssertion(candidate, {
        key: KEY,
        now: NOW,
      }),
      null,
    );
  }
  assert.equal(
    verifyIdentityClientSubjectAssertion(assertion, {
      key: KEY,
      now: new Date(NOW.valueOf() + 31_000),
    }),
    null,
  );
});
