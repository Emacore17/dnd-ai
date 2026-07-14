const WORKSPACE_FILE_PATTERN = /^(?:apps|packages)\/[^/]+(?:\/|$)/;

function normalizeRepositoryPath(filePath) {
  if (typeof filePath !== "string") {
    throw new TypeError("changed file paths must be strings");
  }

  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

export function mergeChangedFileOutputs(outputs) {
  if (!Array.isArray(outputs)) {
    throw new TypeError("Git outputs must be an array");
  }

  return [
    ...new Set(
      outputs.flatMap((output) => {
        if (typeof output !== "string") {
          throw new TypeError("Git output must be a string");
        }

        return output.split("\0").filter(Boolean).map(normalizeRepositoryPath);
      }),
    ),
  ].sort();
}

export function createChangedFileSelection({
  localOutputs,
  mergeBase,
  mergeBaseDifferenceOutput = "",
}) {
  const normalizedMergeBase =
    typeof mergeBase === "string" && mergeBase.trim().length > 0
      ? mergeBase.trim()
      : null;

  if (!normalizedMergeBase) {
    throw new Error(
      "verify:affected: origin/main merge-base unavailable; branch changes cannot be determined reliably, failing closed.",
    );
  }

  const files = mergeChangedFileOutputs([
    ...localOutputs,
    mergeBaseDifferenceOutput,
  ]);
  if (files.length === 0) {
    throw new Error(
      "verify:affected: no changed files were found from origin/main merge-base or the working tree; failing closed.",
    );
  }

  return {
    discoveryMode: "merge-base",
    files,
    mergeBase: normalizedMergeBase,
  };
}

export function classifyChangedFiles(changedFiles) {
  if (!Array.isArray(changedFiles)) {
    throw new TypeError("changedFiles must be an array");
  }

  const normalizedFiles = [
    ...new Set(changedFiles.map(normalizeRepositoryPath).filter(Boolean)),
  ].sort();
  const workspaceFiles = normalizedFiles.filter((filePath) =>
    WORKSPACE_FILE_PATTERN.test(filePath),
  );
  const rootFiles = normalizedFiles.filter(
    (filePath) => !WORKSPACE_FILE_PATTERN.test(filePath),
  );

  return {
    changedFiles: normalizedFiles,
    rootFiles,
    workspaceFiles,
  };
}

export function extractTurboTaskIds(turboPlan) {
  if (!turboPlan || !Array.isArray(turboPlan.tasks)) {
    throw new Error("verify:affected: Turbo dry-run returned an invalid plan");
  }

  return turboPlan.tasks.map((task) => {
    if (!task || typeof task.taskId !== "string" || task.taskId.length === 0) {
      throw new Error(
        "verify:affected: Turbo dry-run returned a task without a taskId",
      );
    }

    return task.taskId;
  });
}

export function planAffectedVerification({ changedFiles, turboPlan }) {
  const fileSelection = classifyChangedFiles(changedFiles);
  const taskIds = extractTurboTaskIds(turboPlan);

  if (fileSelection.workspaceFiles.length === 0) {
    return {
      action: "skip-turbo",
      ...fileSelection,
      taskIds,
      message:
        "verify:affected: root-only/no-workspace changes detected; real Turbo run skipped.",
    };
  }

  if (taskIds.length === 0) {
    throw new Error(
      `verify:affected: workspace changes detected (${fileSelection.workspaceFiles.join(", ")}) but Turbo selected zero tasks; failing closed.`,
    );
  }

  return {
    action: "run-turbo",
    ...fileSelection,
    taskIds,
    message: `verify:affected: Turbo selected ${taskIds.length} task(s) for ${fileSelection.workspaceFiles.length} workspace file(s).`,
  };
}
