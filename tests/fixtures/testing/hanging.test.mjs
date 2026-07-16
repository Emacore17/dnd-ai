import test from "node:test";

test("QA-001:runner-hanging-fixture", async () => {
  await new Promise(() => {});
});
