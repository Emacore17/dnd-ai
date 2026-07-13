import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import { validateTaskDocuments } from "./lib/task-graph.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const taskPath = path.join(repositoryRoot, "docs", "TASKS.md");
const specPath = path.join(repositoryRoot, "docs", "MVP_SPEC.md");
const [taskMarkdown, specMarkdown] = await Promise.all([
  readFile(taskPath, "utf8"),
  readFile(specPath, "utf8"),
]);
const errors = validateTaskDocuments(taskMarkdown, specMarkdown);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }

  process.exitCode = 1;
} else {
  console.log("task-graph: PASS");
}
