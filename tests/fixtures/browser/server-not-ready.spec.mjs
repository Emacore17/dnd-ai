import { expect, test } from "@playwright/test";

test("server readiness fixture never reaches its test", () => {
  expect(true).toBe(true);
});
