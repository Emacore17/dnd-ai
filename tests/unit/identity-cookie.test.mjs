import assert from "node:assert/strict";
import test from "node:test";

import {
  createIdentitySessionCookie,
  parseIdentitySessionCookie,
} from "../../apps/api/dist/index.js";

const NOW = new Date("2026-07-16T12:00:00.000Z");
const TOKEN = "A".repeat(43);

test("identity cookie has the exact host-only secure contract and bounded lifetime", () => {
  const cookie = createIdentitySessionCookie({
    absoluteExpiresAt: new Date(NOW.valueOf() + 3_600_900),
    now: NOW,
    token: TOKEN,
  });
  assert.equal(
    cookie,
    `__Host-dnd_ai_session=${TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`,
  );
  assert.equal(parseIdentitySessionCookie(cookie), TOKEN);
  assert.doesNotMatch(cookie, /Domain=|Expires=/iu);
});

test("identity cookie never exceeds thirty days", () => {
  const cookie = createIdentitySessionCookie({
    absoluteExpiresAt: new Date(NOW.valueOf() + 90 * 86_400_000),
    now: NOW,
    token: TOKEN,
  });
  assert.match(cookie, /Max-Age=2592000$/u);
});

test("identity cookie factory and parser reject malformed or expired values", () => {
  for (const input of [
    { absoluteExpiresAt: NOW, now: NOW, token: TOKEN },
    { absoluteExpiresAt: new Date("invalid"), now: NOW, token: TOKEN },
    {
      absoluteExpiresAt: new Date(NOW.valueOf() + 1_000),
      now: NOW,
      token: "raw token",
    },
  ]) {
    assert.throws(
      () => createIdentitySessionCookie(input),
      /identity session cookie is invalid/u,
    );
  }
  for (const cookie of [
    `${TOKEN}`,
    `__Host-dnd_ai_session=${TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `__Host-dnd_ai_session=${TOKEN}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=60`,
    `__Host-dnd_ai_session=${TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60; Domain=example.test`,
    `other=value; __Host-dnd_ai_session=${TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`,
  ]) {
    assert.equal(parseIdentitySessionCookie(cookie), null);
  }
});
