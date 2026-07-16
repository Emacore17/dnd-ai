import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const domain = await import("../../packages/domain/dist/index.js");

function requireFunction(name) {
  assert.equal(typeof domain[name], "function", `${name} must be exported`);
  return domain[name];
}

test("identity policy constants are frozen and match identity-signup-v1", () => {
  const policy = domain.IDENTITY_POLICY;
  assert.ok(policy, "IDENTITY_POLICY must be exported");
  assert.equal(Object.isFrozen(policy), true);
  assert.deepEqual(policy.password, {
    minCharacters: 15,
    maxCharacters: 128,
    normalization: "NFC",
  });
  assert.deepEqual(policy.displayName, {
    minCharacters: 2,
    maxCharacters: 40,
    normalization: "NFC",
  });
  assert.deepEqual(policy.challenge, {
    digits: 6,
    ttlMs: 600_000,
    maxAttempts: 5,
    resendCooldownMs: 60_000,
  });
  assert.deepEqual(policy.session, {
    idleTtlMs: 86_400_000,
    absoluteTtlMs: 2_592_000_000,
  });
  assert.deepEqual(policy.idempotency, { ttlMs: 86_400_000 });
});

test("display names are trimmed, NFC-normalized and reject control characters", () => {
  const normalize = requireFunction("normalizeIdentityDisplayName");
  assert.equal(normalize("  Ema\u0300  "), "Emà");
  assert.throws(
    () => normalize("A"),
    (error) => error?.code === "identity.display_name_length",
  );
  assert.throws(
    () => normalize("Ema\u0000nuele"),
    (error) => error?.code === "identity.display_name_control",
  );
});

test("identity email normalization is canonical and bounded", () => {
  const normalize = requireFunction("normalizeIdentityEmail");
  assert.equal(normalize("  Player@Example.test "), "player@example.test");
  for (const value of [
    "missing-at.example.test",
    "two@@example.test",
    "player @example.test",
    `player@${"é".repeat(250)}.test`,
  ]) {
    assert.throws(
      () => normalize(value),
      (error) => error?.code === "identity.email_invalid",
    );
  }
});

test("password policy counts Unicode code points, preserves spaces and has no composition rule", () => {
  const normalize = requireFunction("normalizeIdentityPassword");
  const allowAll = { contains: () => false };

  assert.equal(
    normalize(`${"a".repeat(14)}🔒`, allowAll),
    `${"a".repeat(14)}🔒`,
  );
  assert.equal(
    normalize("correct horse battery staple", allowAll),
    "correct horse battery staple",
  );
  assert.equal(normalize("               ", allowAll), "               ");
  assert.equal(
    normalize(`${"a".repeat(14)}e\u0301`, allowAll),
    `${"a".repeat(14)}é`,
  );
  assert.throws(
    () => normalize("a".repeat(14), allowAll),
    (error) => error?.code === "identity.password_length",
  );
  assert.throws(
    () => normalize("a".repeat(129), allowAll),
    (error) => error?.code === "identity.password_length",
  );
});

test("password policy rejects an injected exact blocklist match after normalization", () => {
  const normalize = requireFunction("normalizeIdentityPassword");
  const blocked = { contains: (value) => value === "passwordpassword" };

  assert.throws(
    () => normalize("passwordpassword", blocked),
    (error) => error?.code === "identity.password_common",
  );
  assert.throws(
    () => normalize("passwordpassword", undefined),
    (error) => error instanceof TypeError,
  );
});

test("the server-only common password digest asset is versioned and complete", async () => {
  const assetPath = path.join(
    repositoryRoot,
    "apps",
    "api",
    "assets",
    "common-passwords-top-10000.sha256",
  );
  const noticePath = path.join(path.dirname(assetPath), "NOTICE.md");
  const [asset, notice] = await Promise.all([
    readFile(assetPath, "utf8"),
    readFile(noticePath, "utf8"),
  ]);
  const digests = asset.trimEnd().split("\n");

  assert.equal(digests.length >= 10_000, true);
  assert.equal(new Set(digests).size, digests.length);
  assert.equal(
    digests.every((digest) => /^[0-9a-f]{64}$/u.test(digest)),
    true,
  );
  assert.deepEqual([...digests].sort(), digests);
  assert.match(notice, /SecLists/u);
  assert.match(notice, /2026\.1/u);
  assert.match(notice, /MIT/u);
  assert.match(notice, /source sha-256:/iu);
  assert.match(notice, /output sha-256:/iu);
});
