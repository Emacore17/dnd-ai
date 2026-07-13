import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { parse } from "yaml";

import { validateCiDocuments } from "../../scripts/lib/ci-workflow-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

test("the GitHub Actions pipeline satisfies the versioned CI policy", async () => {
  const [workflowSource, setupActionSource] = await Promise.all([
    readFile(
      path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
      "utf8",
    ),
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

  assert.deepEqual(
    validateCiDocuments(parse(workflowSource), parse(setupActionSource)),
    [],
  );
});

test("unpinned actions, privileged PR triggers and broad artifacts fail closed", () => {
  const unsafeWorkflow = {
    on: { pull_request_target: {} },
    permissions: { contents: "write" },
    jobs: {
      quality: {
        steps: [{ uses: "actions/checkout@v7" }],
      },
      build: {
        steps: [
          {
            uses: `actions/upload-artifact@${"a".repeat(40)}`,
            with: { path: ".", "include-hidden-files": true },
          },
        ],
      },
    },
  };
  const errors = validateCiDocuments(unsafeWorkflow, {});

  assert.ok(errors.some((error) => error.includes("pull_request_target")));
  assert.ok(errors.some((error) => error.includes("unpinned action")));
  assert.ok(errors.some((error) => error.includes("artifact path")));
});
