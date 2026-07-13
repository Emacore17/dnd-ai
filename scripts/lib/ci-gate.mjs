export const REQUIRED_CI_JOBS = Object.freeze([
  "quality",
  "tests",
  "security",
  "build",
]);

export function validateRequiredJobResults(results) {
  return REQUIRED_CI_JOBS.flatMap((jobName) => {
    const result = results[jobName] ?? "missing";

    return result === "success" ? [] : [`${jobName} finished with ${result}`];
  });
}
