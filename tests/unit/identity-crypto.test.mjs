import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/identity/crypto-golden.json", import.meta.url),
    "utf8",
  ),
);

function decodeBase64(value) {
  return Buffer.from(value, "base64");
}

test("API and worker derive the same unbiased six-digit challenge golden", async () => {
  const [apiCrypto, workerCrypto] = await Promise.all([
    import("../../apps/api/dist/identity/identity-crypto.js"),
    import("../../apps/worker/dist/identity/challenge-code.js"),
  ]);
  const key = decodeBase64(fixture.challengeKeyBase64);

  assert.equal(
    apiCrypto.deriveVerificationCode(key, fixture.challengeId),
    fixture.code,
  );
  assert.equal(
    workerCrypto.deriveWorkerVerificationCode(key, fixture.challengeId),
    fixture.code,
  );
  assert.equal(fixture.code.length, 6);
  assert.match(fixture.code, /^[0-9]{6}$/u);
});

test("identity cryptography creates deterministic challenge, session and pseudonyms", async () => {
  const { createNodeIdentityCryptography } =
    await import("../../apps/api/dist/identity/identity-crypto.js");
  const randomValues = [
    fixture.challengeRandomHex,
    fixture.sessionRandomHex,
  ].map((value) => Buffer.from(value, "hex"));
  const cryptography = createNodeIdentityCryptography({
    challengeKey: decodeBase64(fixture.challengeKeyBase64),
    challengeKeyVersion: fixture.challengeKeyVersion,
    sessionKey: decodeBase64(fixture.sessionKeyBase64),
    sessionKeyVersion: fixture.sessionKeyVersion,
    subjectHashKey: decodeBase64(fixture.subjectKeyBase64),
    randomBytes(length) {
      const value = randomValues.shift();
      assert.equal(length, 16);
      assert.ok(value);
      return value;
    },
  });

  assert.deepEqual(cryptography.createChallenge(), {
    challengeId: fixture.challengeId,
    code: fixture.code,
    codeDigest: fixture.codeDigest,
    keyVersion: fixture.challengeKeyVersion,
  });
  assert.deepEqual(cryptography.createSession(), {
    sessionId: fixture.sessionId,
    token: fixture.token,
    tokenDigest: fixture.tokenDigest,
    keyVersion: fixture.sessionKeyVersion,
  });
  assert.equal(
    cryptography.deriveChallengeCodeDigest(
      fixture.challengeId,
      fixture.code,
      fixture.challengeKeyVersion,
    ),
    fixture.codeDigest,
  );
  assert.equal(
    cryptography.deriveSessionToken(
      fixture.sessionId,
      fixture.sessionKeyVersion,
    ),
    fixture.token,
  );
  assert.throws(
    () =>
      cryptography.deriveSessionToken(
        fixture.sessionId,
        fixture.sessionKeyVersion + 1,
      ),
    /session key version is unavailable/u,
  );
  assert.equal(
    cryptography.subjectHash("email", "player@example.com"),
    fixture.emailSubjectHash,
  );
  assert.equal(
    cryptography.idempotencyKeyDigest("request-key-0001"),
    fixture.idempotencyKeyDigest,
  );
  assert.equal(
    cryptography.requestFingerprint(
      "/api/auth/sign-up",
      '{"displayName":"Ema","email":"player@example.com"}',
    ),
    fixture.requestFingerprint,
  );
  assert.equal(
    cryptography.verifyChallengeCode(
      fixture.challengeId,
      fixture.code,
      fixture.codeDigest,
    ),
    true,
  );
  assert.equal(
    cryptography.verifyChallengeCode(
      fixture.challengeId,
      "000000",
      fixture.codeDigest,
    ),
    false,
  );
  assert.equal(
    cryptography.verifyChallengeCode(fixture.challengeId, fixture.code, "bad"),
    false,
  );
});

test("password blocklist and Argon2id adapter fail closed", async () => {
  const [{ loadCommonPasswordBlocklist }, { createArgon2PasswordHasher }] =
    await Promise.all([
      import("../../apps/api/dist/identity/password-blocklist.js"),
      import("../../apps/api/dist/identity/password-hasher.js"),
    ]);
  const blocklist = await loadCommonPasswordBlocklist();
  assert.equal(blocklist.contains("films+pic+galeries"), true);
  assert.equal(blocklist.contains("correct horse battery staple"), false);

  const hasher = createArgon2PasswordHasher({
    pepper: Buffer.from(
      "YGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn8=",
      "base64",
    ),
    pepperVersion: 3,
  });
  const stored = await hasher.hash("correct horse battery staple");

  assert.equal(stored.pepperVersion, 3);
  assert.match(stored.phc, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/u);
  assert.equal(
    await hasher.verify("correct horse battery staple", stored),
    true,
  );
  assert.equal(
    await hasher.verify("incorrect horse battery staple", stored),
    false,
  );
  assert.equal(
    await hasher.verify("correct horse battery staple", {
      ...stored,
      pepperVersion: 2,
    }),
    false,
  );
  assert.equal(
    await hasher.verify("correct horse battery staple", {
      phc: "malformed",
      pepperVersion: 3,
    }),
    false,
  );
});
