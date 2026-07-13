import assert from "node:assert/strict";
import test from "node:test";

test("BL-002 negative PR proves a failed test reaches the merge gate", () => {
  assert.fail("intentional BL-002 merge-gate failure");
});
