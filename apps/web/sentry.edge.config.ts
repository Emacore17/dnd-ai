import * as Sentry from "@sentry/nextjs";

import {
  initializeWebSentry,
  resolveWebRuntimeEnvironment,
} from "./lib/sentry-options";

initializeWebSentry(Sentry.init, {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: resolveWebRuntimeEnvironment({
    appEnvironment: process.env.APP_ENV,
    nodeEnvironment: process.env.NODE_ENV,
    vercelEnvironment: process.env.VERCEL_ENV,
  }),
  release: process.env.VERCEL_GIT_COMMIT_SHA,
});
