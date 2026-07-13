import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import { parse } from "yaml";

import { validateCiDocuments } from "./lib/ci-workflow-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const [workflowSource, setupActionSource] = await Promise.all([
  readFile(path.join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8"),
  readFile(
    path.join(
      repositoryRoot,
      ".github",
      "actions",
      "setup-workspace",
      "action.yml",
    ),
    "utf8",
  ),
]);
const errors = validateCiDocuments(
  parse(workflowSource),
  parse(setupActionSource),
);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }

  process.exitCode = 1;
} else {
  console.log("ci-workflow-policy: PASS");
}
