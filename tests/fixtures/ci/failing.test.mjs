import assert from "node:assert/strict";
import test from "node:test";

test("the intentional CI failure fixture stays red", () => {
  assert.fail("BL-002 intentional failure fixture");
});
