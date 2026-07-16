import assert from "node:assert/strict";
import test from "node:test";

const contracts = await import("../../packages/contracts/dist/index.js");

function requireSchema(name) {
  const schema = contracts[name];
  assert.equal(
    typeof schema?.safeParse,
    "function",
    `${name} must be exported`,
  );
  return schema;
}

test("identity request contracts normalize safe fields and remain strict", () => {
  const signUp = requireSchema("SignUpRequestSchema");
  const parsed = signUp.safeParse({
    email: "  PLAYER+Quest@Example.COM  ",
    password: `${"a".repeat(14)}🔒`,
    displayName: "  Ema\u0300  ",
  });

  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data, {
    email: "player+quest@example.com",
    password: `${"a".repeat(14)}🔒`,
    displayName: "Emà",
  });
  assert.equal(
    signUp.safeParse({ ...parsed.data, unexpected: true }).success,
    false,
  );
  assert.equal(
    signUp.safeParse({ ...parsed.data, displayName: "A\u0000B" }).success,
    false,
  );
});

test("identity password and email boundaries follow the approved policy", () => {
  const signUp = requireSchema("SignUpRequestSchema");
  const base = { email: "player@example.com", displayName: "Ema" };

  assert.equal(
    signUp.safeParse({ ...base, password: "a".repeat(14) }).success,
    false,
  );
  assert.equal(
    signUp.safeParse({ ...base, password: "a".repeat(15) }).success,
    true,
  );
  assert.equal(
    signUp.safeParse({ ...base, password: "a".repeat(128) }).success,
    true,
  );
  assert.equal(
    signUp.safeParse({ ...base, password: "a".repeat(129) }).success,
    false,
  );
  const oversizedEmail = `a@${"x".repeat(63)}.${"x".repeat(63)}.${"x".repeat(63)}.${"x".repeat(58)}.it`;
  assert.equal(
    signUp.safeParse({
      ...base,
      email: oversizedEmail,
      password: "a".repeat(15),
    }).success,
    false,
  );
});

test("verification code remains a six-character string including leading zero", () => {
  const verify = requireSchema("VerifyEmailRequestSchema");
  const resend = requireSchema("ResendVerificationRequestSchema");

  assert.deepEqual(
    verify.parse({ email: "PLAYER@example.com", code: "012345" }),
    { email: "player@example.com", code: "012345" },
  );
  assert.equal(
    verify.safeParse({ email: "player@example.com", code: 12345 }).success,
    false,
  );
  assert.equal(
    verify.safeParse({ email: "player@example.com", code: "12345" }).success,
    false,
  );
  assert.deepEqual(resend.parse({ email: " PLAYER@example.com " }), {
    email: "player@example.com",
  });
});

test("identity responses and idempotency header are closed contracts", () => {
  const required = requireSchema("VerificationRequiredResponseSchema");
  const verified = requireSchema("VerifiedResponseSchema");
  const idempotencyKey = requireSchema("IdempotencyKeySchema");
  const identityError = requireSchema("IdentityErrorResponseSchema");

  assert.deepEqual(
    required.parse({
      status: "verification_required",
      challengeExpiresInSeconds: 600,
      resendAfterSeconds: 60,
    }),
    {
      status: "verification_required",
      challengeExpiresInSeconds: 600,
      resendAfterSeconds: 60,
    },
  );
  assert.deepEqual(verified.parse({ status: "verified" }), {
    status: "verified",
  });
  assert.equal(idempotencyKey.safeParse("a".repeat(15)).success, false);
  assert.equal(idempotencyKey.safeParse(`key:${"a".repeat(12)}`).success, true);
  assert.equal(idempotencyKey.safeParse("a".repeat(129)).success, false);
  assert.equal(
    idempotencyKey.safeParse("invalid key with spaces").success,
    false,
  );
  assert.equal(
    identityError.safeParse({
      error: {
        code: "identity.idempotency_conflict",
        message: "Richiesta in conflitto.",
        requestId: "3b241101-e2bb-4255-8caf-4136c566a962",
        retryable: false,
      },
    }).success,
    true,
  );
});

test("current artifacts publish identity operations in v2 and leave v1 to the frozen baseline", () => {
  assert.equal(contracts.CONTRACT_VERSION, "2.0.0");
  assert.equal(contracts.CONTRACT_SCHEMA_VERSION, 1);
  assert.equal(contracts.CONTRACT_MAJOR_VERSION, "v2");

  const artifacts = contracts.createContractArtifacts();
  const openapi = artifacts["v2/openapi.json"];
  assert.ok(openapi, "v2 OpenAPI must be generated");
  assert.deepEqual(Object.keys(openapi.paths).sort(), [
    "/api/auth/resend-verification",
    "/api/auth/sign-up",
    "/api/auth/verify-email",
  ]);

  for (const path of Object.keys(openapi.paths)) {
    const operation = openapi.paths[path].post;
    assert.equal(operation.parameters[0].name, "Idempotency-Key");
    assert.equal(operation.parameters[0].required, true);
    assert.equal(operation.requestBody.required, true);
    assert.ok(operation.responses["429"].headers["Retry-After"]);
  }

  assert.ok(openapi.paths["/api/auth/sign-up"].post.responses["202"]);
  assert.ok(
    openapi.paths["/api/auth/verify-email"].post.responses["200"].headers[
      "Set-Cookie"
    ],
  );
  assert.ok(
    openapi.paths["/api/auth/resend-verification"].post.responses["202"],
  );
});
