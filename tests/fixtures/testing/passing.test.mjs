import assert from "node:assert/strict";
import test from "node:test";

test("QA-001:runner-passing-fixture", () => {
  assert.equal(2 + 2, 4);
});
