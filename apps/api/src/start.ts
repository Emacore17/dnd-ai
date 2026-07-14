import process from "node:process";

import { RuntimeConfigurationError } from "@dnd-ai/config";

import { startApi } from "./runtime.js";

try {
  await startApi({ environment: process.env });
} catch (error) {
  const message =
    error instanceof RuntimeConfigurationError
      ? error.message
      : "API startup failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
