import {
  createNodeObservability,
  type NodeObservability,
} from "@dnd-ai/observability/node";

import { resolveWebRuntimeEnvironment } from "./sentry-options";

let runtime: NodeObservability | undefined;

export function getServerObservability(): NodeObservability {
  runtime ??= createNodeObservability({
    environment: resolveWebRuntimeEnvironment({
      appEnvironment: process.env.APP_ENV,
      nodeEnvironment: process.env.NODE_ENV,
      vercelEnvironment: process.env.VERCEL_ENV,
    }),
    service: "web",
  });

  return runtime;
}
