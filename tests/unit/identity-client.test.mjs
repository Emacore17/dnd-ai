import assert from "node:assert/strict";
import test from "node:test";

import {
  idempotencyKeyFor,
  normalizeVerificationCode,
} from "../../apps/web/components/auth/identity-client.ts";

test("verification code normalization preserves six digits from formatted paste", () => {
  assert.equal(normalizeVerificationCode("012 345"), "012345");
  assert.equal(normalizeVerificationCode("01a23-45x6"), "012345");
  assert.equal(normalizeVerificationCode("1234567"), "123456");
});

test("access operations reuse keys only for an identical operation payload", () => {
  const state = { current: null };
  const payload = { email: "ada@example.test" };
  const first = idempotencyKeyFor(state, "reset-request", payload);
  assert.equal(idempotencyKeyFor(state, "reset-request", payload), first);
  assert.notEqual(idempotencyKeyFor(state, "sign-in", payload), first);
});
