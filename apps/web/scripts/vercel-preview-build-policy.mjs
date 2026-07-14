export function validateVercelPreviewBuildEnvironment(
  environment,
  { allowLocal = false } = {},
) {
  const vercel = environment?.VERCEL;
  const deploymentEnvironment = environment?.VERCEL_ENV;
  const targetEnvironment = environment?.VERCEL_TARGET_ENV;
  const metadataAbsent =
    vercel === undefined &&
    deploymentEnvironment === undefined &&
    targetEnvironment === undefined;

  if (metadataAbsent) {
    return allowLocal
      ? { allowed: true, mode: "local" }
      : { allowed: false, code: "missing-vercel-metadata" };
  }

  const metadataComplete =
    vercel === "1" &&
    typeof deploymentEnvironment === "string" &&
    deploymentEnvironment.length > 0 &&
    typeof targetEnvironment === "string" &&
    targetEnvironment.length > 0;
  if (!metadataComplete) {
    return { allowed: false, code: "invalid-vercel-metadata" };
  }

  if (deploymentEnvironment !== "preview" || targetEnvironment !== "preview") {
    return { allowed: false, code: "target-not-preview" };
  }

  return { allowed: true, mode: "preview" };
}
