import assert from "node:assert/strict";
import test from "node:test";

test("BL-002 negative fixture keeps a failed PR unmergeable", () => {
  assert.fail("intentional BL-002 merge-gate failure");
});
