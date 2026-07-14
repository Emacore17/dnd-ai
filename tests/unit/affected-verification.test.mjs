import assert from "node:assert/strict";
import test from "node:test";

import {
  createChangedFileSelection,
  mergeChangedFileOutputs,
  planAffectedVerification,
} from "../../scripts/lib/affected-verification.mjs";

test("tracked, untracked and merge-base Git outputs form one selection", () => {
  const tracked = "docs/TASKS.md\0apps/web/src/app/page.tsx\0";
  const untracked = "scripts/new-script.mjs\0";
  const mergeBaseDifference =
    "packages/domain/src/campaign.ts\0docs/TASKS.md\0";

  assert.deepEqual(
    mergeChangedFileOutputs([tracked, untracked, mergeBaseDifference]),
    [
      "apps/web/src/app/page.tsx",
      "docs/TASKS.md",
      "packages/domain/src/campaign.ts",
      "scripts/new-script.mjs",
    ],
  );
});

test("a clean branch without an origin/main merge-base fails closed", () => {
  assert.throws(
    () =>
      createChangedFileSelection({
        localOutputs: ["", "", ""],
        mergeBase: null,
        mergeBaseDifferenceOutput: "",
      }),
    /merge-base.*unavailable.*failing closed/i,
  );
});

test("local changes do not make a missing origin/main merge-base trustworthy", () => {
  assert.throws(
    () =>
      createChangedFileSelection({
        localOutputs: ["docs/TASKS.md\0", "", "scripts/new-script.mjs\0"],
        mergeBase: null,
        mergeBaseDifferenceOutput: "",
      }),
    /merge-base.*unavailable.*failing closed/i,
  );
});

test("an empty selection from a valid merge-base fails closed", () => {
  assert.throws(
    () =>
      createChangedFileSelection({
        localOutputs: ["", "", ""],
        mergeBase: "6e87034824abeafa76c1da19cba5db81111195f2",
        mergeBaseDifferenceOutput: "",
      }),
    /no changed files.*failing closed/i,
  );
});

test("root-only changes skip the real Turbo run", () => {
  const result = planAffectedVerification({
    changedFiles: ["AGENTS.md", "docs/TASKS.md"],
    turboPlan: { tasks: [] },
  });

  assert.equal(result.action, "skip-turbo");
  assert.match(result.message, /root-only\/no-workspace/);
  assert.deepEqual(result.workspaceFiles, []);
});

test("an apps workspace change runs the tasks selected by Turbo", () => {
  const result = planAffectedVerification({
    changedFiles: ["apps/web/src/app/page.tsx", "docs/TASKS.md"],
    turboPlan: {
      tasks: [
        { taskId: "@dnd-ai/web#lint" },
        { taskId: "@dnd-ai/web#typecheck" },
        { taskId: "@dnd-ai/web#build" },
      ],
    },
  });

  assert.equal(result.action, "run-turbo");
  assert.deepEqual(result.workspaceFiles, ["apps/web/src/app/page.tsx"]);
  assert.deepEqual(result.taskIds, [
    "@dnd-ai/web#lint",
    "@dnd-ai/web#typecheck",
    "@dnd-ai/web#build",
  ]);
});

test("a packages workspace change is detected with Windows separators", () => {
  const result = planAffectedVerification({
    changedFiles: ["packages\\domain\\src\\campaign.ts"],
    turboPlan: { tasks: [{ taskId: "@dnd-ai/domain#typecheck" }] },
  });

  assert.equal(result.action, "run-turbo");
  assert.deepEqual(result.workspaceFiles, ["packages/domain/src/campaign.ts"]);
});

test("a workspace change with an empty Turbo selection fails closed", () => {
  assert.throws(
    () =>
      planAffectedVerification({
        changedFiles: ["apps/web/src/app/page.tsx"],
        turboPlan: { tasks: [] },
      }),
    /workspace changes detected.*selected zero tasks.*failing closed/i,
  );
});
