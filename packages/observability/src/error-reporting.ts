import type { ErrorReporter } from "./contracts.js";

const INVALID_FLUSH_TIMEOUT_MESSAGE =
  "Error reporter flush timeout must be a finite non-negative number.";

const noopErrorReporter = Object.freeze({
  capture(): void {},
  flush(timeoutMs: number): Promise<boolean> {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      return Promise.reject(new TypeError(INVALID_FLUSH_TIMEOUT_MESSAGE));
    }

    return Promise.resolve(true);
  },
}) satisfies ErrorReporter;

export function createNoopErrorReporter(): ErrorReporter {
  return noopErrorReporter;
}
