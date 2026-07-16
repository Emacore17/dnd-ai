import process from "node:process";

import { RuntimeConfigurationError } from "@dnd-ai/config";

import { startWorker } from "./runtime.js";

try {
  const worker = await startWorker({ environment: process.env });
  const requestStop = (): void => {
    void worker.stop();
  };
  process.once("SIGINT", requestStop);
  process.once("SIGTERM", requestStop);
  try {
    await worker.completion;
  } finally {
    process.off("SIGINT", requestStop);
    process.off("SIGTERM", requestStop);
    await worker.stop();
  }
} catch (error) {
  const message =
    error instanceof RuntimeConfigurationError
      ? error.message
      : "Worker startup failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
