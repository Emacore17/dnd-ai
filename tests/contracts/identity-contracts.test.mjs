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

test("session access and password reset requests are strict closed contracts", () => {
  const signIn = requireSchema("SignInRequestSchema");
  const resetRequest = requireSchema("PasswordResetRequestSchema");
  const resetConfirm = requireSchema("PasswordResetConfirmSchema");
  const revokeAll = requireSchema("RevokeAllSessionsRequestSchema");

  assert.deepEqual(
    signIn.parse({
      email: "  PLAYER@example.com ",
      password: "correct horse battery staple",
    }),
    {
      email: "player@example.com",
      password: "correct horse battery staple",
    },
  );
  assert.equal(
    signIn.safeParse({
      email: "player@example.com",
      password: "correct horse battery staple",
      rememberMe: true,
    }).success,
    false,
  );
  assert.deepEqual(resetRequest.parse({ email: " PLAYER@example.com " }), {
    email: "player@example.com",
  });
  assert.equal(
    resetConfirm.safeParse({
      email: "player@example.com",
      code: "012345",
      newPassword: "b".repeat(15),
    }).success,
    true,
  );
  assert.equal(
    resetConfirm.safeParse({
      email: "player@example.com",
      code: 12345,
      newPassword: "b".repeat(15),
    }).success,
    false,
  );
  assert.deepEqual(revokeAll.parse({ confirmation: "revoke_all" }), {
    confirmation: "revoke_all",
  });
  assert.equal(revokeAll.safeParse({ confirmation: "yes" }).success, false);
});

test("identity responses and idempotency header are closed contracts", () => {
  const required = requireSchema("VerificationRequiredResponseSchema");
  const verified = requireSchema("VerifiedResponseSchema");
  const idempotencyKey = requireSchema("IdempotencyKeySchema");
  const identityError = requireSchema("IdentityErrorResponseSchema");
  const authenticated = requireSchema("AuthenticatedResponseSchema");
  const resetRequested = requireSchema("PasswordResetRequestedResponseSchema");
  const resetCompleted = requireSchema("PasswordResetCompletedResponseSchema");

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
  assert.deepEqual(authenticated.parse({ status: "authenticated" }), {
    status: "authenticated",
  });
  assert.deepEqual(
    resetRequested.parse({ status: "password_reset_requested" }),
    { status: "password_reset_requested" },
  );
  assert.deepEqual(resetCompleted.parse({ status: "password_reset" }), {
    status: "password_reset",
  });
  for (const code of [
    "identity.credentials_invalid",
    "identity.session_invalid",
    "identity.password_reset_code_invalid",
  ]) {
    assert.equal(
      identityError.safeParse({
        error: {
          code,
          message: "Messaggio pubblico stabile.",
          requestId: "3b241101-e2bb-4255-8caf-4136c566a962",
          retryable: false,
        },
      }).success,
      true,
    );
  }
});

test("current artifacts publish session access in v3 and preserve earlier baselines", () => {
  assert.equal(contracts.CONTRACT_VERSION, "3.0.0");
  assert.equal(contracts.CONTRACT_SCHEMA_VERSION, 1);
  assert.equal(contracts.CONTRACT_MAJOR_VERSION, "v3");

  const artifacts = contracts.createContractArtifacts();
  const openapi = artifacts["v3/openapi.json"];
  assert.ok(openapi, "v3 OpenAPI must be generated");
  assert.deepEqual(
    Object.keys(openapi.paths).sort(),
    [
      "/api/auth/resend-verification",
      "/api/auth/password-reset/confirm",
      "/api/auth/password-reset/request",
      "/api/auth/session/refresh",
      "/api/auth/sessions/revoke-all",
      "/api/auth/sign-in",
      "/api/auth/sign-out",
      "/api/auth/sign-up",
      "/api/auth/verify-email",
    ].sort(),
  );

  for (const path of Object.keys(openapi.paths)) {
    const operation = openapi.paths[path].post;
    assert.equal(operation.parameters[0].name, "Idempotency-Key");
    assert.equal(operation.parameters[0].required, true);
    if (["/api/auth/session/refresh", "/api/auth/sign-out"].includes(path)) {
      assert.equal(operation.requestBody, undefined);
    } else {
      assert.equal(operation.requestBody.required, true);
    }
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
  assert.ok(openapi.paths["/api/auth/sign-in"].post.responses["200"]);
  assert.ok(openapi.paths["/api/auth/session/refresh"].post.responses["200"]);
  for (const path of ["/api/auth/sign-out", "/api/auth/sessions/revoke-all"]) {
    const noContent = openapi.paths[path].post.responses["204"];
    assert.ok(noContent);
    assert.equal(noContent.content, undefined);
  }
  assert.ok(
    openapi.paths["/api/auth/password-reset/request"].post.responses["202"],
  );
  assert.ok(
    openapi.paths["/api/auth/password-reset/confirm"].post.responses["200"],
  );
});
