import {
  createWebSentryOptions,
  initializeWebSentry,
  resolveWebRuntimeEnvironment,
} from "./lib/sentry-options";

const configuration = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: resolveWebRuntimeEnvironment({
    nodeEnvironment: process.env.NODE_ENV,
    vercelEnvironment: process.env.NEXT_PUBLIC_VERCEL_ENV,
  }),
};

async function initializeClientSentry(): Promise<void> {
  if (createWebSentryOptions(configuration) === undefined) {
    return;
  }

  try {
    const Sentry = await import("@sentry/nextjs");
    initializeWebSentry(Sentry.init, configuration);
  } catch {
    // Telemetry startup must never prevent the game client from loading.
  }
}

void initializeClientSentry();
