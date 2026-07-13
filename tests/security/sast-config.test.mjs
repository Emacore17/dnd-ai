import assert from "node:assert/strict";
import test from "node:test";

import { ESLint } from "eslint";

test("SAST config reports an unsafe expression in production source", async () => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText("eval(input);", {
    filePath: "apps/api/src/sast-negative-fixture.ts",
  });

  assert.ok(result);
  assert.equal(
    result.messages.some(
      ({ ruleId, severity }) =>
        ruleId === "security/detect-eval-with-expression" && severity > 0,
    ),
    true,
  );
});
