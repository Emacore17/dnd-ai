export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    {
      contract: "web-health-v1",
      service: "web",
      status: "ok",
      deployment: {
        provider: process.env.VERCEL === "1" ? "vercel" : "local",
        projectId: process.env.VERCEL_PROJECT_ID ?? null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        gitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        repoOwner: process.env.VERCEL_GIT_REPO_OWNER ?? null,
        repoSlug: process.env.VERCEL_GIT_REPO_SLUG ?? null,
        repoId: process.env.VERCEL_GIT_REPO_ID ?? null,
        environment: process.env.VERCEL_ENV ?? "local",
        region: process.env.VERCEL_REGION ?? "local",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
