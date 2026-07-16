import assert from "node:assert/strict";
import test from "node:test";

test("QA-001:runner-failing-fixture", () => {
  assert.fail("intentional runner failure");
});
