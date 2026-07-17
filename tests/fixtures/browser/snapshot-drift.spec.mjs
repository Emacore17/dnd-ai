import { expect, test } from "@playwright/test";

test("snapshot drift fixture observes a changed value", () => {
  expect("actual").toMatchSnapshot("snapshot-drift.txt");
});
