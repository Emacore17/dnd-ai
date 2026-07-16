import assert from "node:assert/strict";
import test from "node:test";

test("QA-001:runner-environment-fixture", () => {
  for (const key of [
    "APP_SECRET",
    "DATABASE_URL",
    "NODE_OPTIONS",
    "REDIS_URL",
  ]) {
    assert.equal(process.env[key], undefined);
  }
});
