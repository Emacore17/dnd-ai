import assert from "node:assert/strict";
import test from "node:test";

import { validateVercelPreviewBuildEnvironment } from "../../apps/web/scripts/vercel-preview-build-policy.mjs";

const previewEnvironment = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "preview",
};

test("local builds are allowed only when explicitly enabled and Vercel metadata is absent", () => {
  assert.deepEqual(
    validateVercelPreviewBuildEnvironment({}, { allowLocal: true }),
    {
      allowed: true,
      mode: "local",
    },
  );
  assert.deepEqual(validateVercelPreviewBuildEnvironment({}), {
    allowed: false,
    code: "missing-vercel-metadata",
  });
});

test("an exact Vercel Preview environment is allowed", () => {
  assert.deepEqual(validateVercelPreviewBuildEnvironment(previewEnvironment), {
    allowed: true,
    mode: "preview",
  });
  assert.deepEqual(
    validateVercelPreviewBuildEnvironment(previewEnvironment, {
      allowLocal: true,
    }),
    { allowed: true, mode: "preview" },
  );
});

test("production, development, custom and case-variant targets are rejected", () => {
  for (const [name, environment] of [
    ["production", { ...previewEnvironment, VERCEL_ENV: "production" }],
    [
      "production target",
      { ...previewEnvironment, VERCEL_TARGET_ENV: "production" },
    ],
    ["development", { ...previewEnvironment, VERCEL_ENV: "development" }],
    ["custom", { ...previewEnvironment, VERCEL_TARGET_ENV: "staging" }],
    ["case variant", { ...previewEnvironment, VERCEL_ENV: "Preview" }],
  ]) {
    for (const allowLocal of [false, true]) {
      assert.deepEqual(
        validateVercelPreviewBuildEnvironment(environment, { allowLocal }),
        { allowed: false, code: "target-not-preview" },
        `${name} with allowLocal=${allowLocal}`,
      );
    }
  }
});

test("missing, empty, orphaned and invalid Vercel metadata fail closed", () => {
  for (const [name, environment] of [
    ["missing environment", { VERCEL: "1", VERCEL_TARGET_ENV: "preview" }],
    ["missing target", { VERCEL: "1", VERCEL_ENV: "preview" }],
    ["missing marker", { VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview" }],
    ["empty marker", { ...previewEnvironment, VERCEL: "" }],
    ["invalid marker", { ...previewEnvironment, VERCEL: "true" }],
    ["empty environment", { ...previewEnvironment, VERCEL_ENV: "" }],
    ["empty target", { ...previewEnvironment, VERCEL_TARGET_ENV: "" }],
  ]) {
    assert.deepEqual(
      validateVercelPreviewBuildEnvironment(environment, { allowLocal: true }),
      { allowed: false, code: "invalid-vercel-metadata" },
      name,
    );
  }
});
