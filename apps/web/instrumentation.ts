import type { Instrumentation } from "next";

import {
  createWebSentryOptions,
  resolveWebRuntimeEnvironment,
} from "./lib/sentry-options";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerObservability } =
      await import("./lib/server-observability");
    getServerObservability();
    await import("./sentry.server.config");
    return;
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  ...arguments_
) => {
  const configuration = {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: resolveWebRuntimeEnvironment({
      appEnvironment: process.env.APP_ENV,
      nodeEnvironment: process.env.NODE_ENV,
      vercelEnvironment: process.env.VERCEL_ENV,
    }),
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  };

  if (createWebSentryOptions(configuration) === undefined) {
    return;
  }

  try {
    const { captureRequestError } = await import("@sentry/nextjs");
    await captureRequestError(...arguments_);
  } catch {
    // Error reporting is best-effort and cannot alter the request result.
  }
};
