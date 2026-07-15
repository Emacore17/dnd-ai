import { Buffer } from "node:buffer";
import { clearTimeout, setTimeout } from "node:timers";
import { URL } from "node:url";
import { Worker } from "node:worker_threads";

import { extractMermaidBlocks } from "./markdown-document.mjs";

const MAX_BLOCK_BYTES = 128 * 1024;
const MAX_BLOCKS = 64;
const DEFAULT_TIMEOUT_MS = 10_000;

function collectBoundedBlocks(sources) {
  const blocks = [];
  const errors = [];

  for (const [documentPath, source] of sources) {
    for (const block of extractMermaidBlocks(source, documentPath)) {
      blocks.push(block);
      if (!block.closed) {
        errors.push(
          `${documentPath}: mermaid-unclosed block ${block.blockIndex}`,
        );
      } else if (!block.source.trim()) {
        errors.push(`${documentPath}: mermaid-empty block ${block.blockIndex}`);
      } else if (Buffer.byteLength(block.source, "utf8") > MAX_BLOCK_BYTES) {
        errors.push(
          `${documentPath}: mermaid-block-too-large block ${block.blockIndex}`,
        );
      }
    }
  }

  if (blocks.length > MAX_BLOCKS) {
    return {
      blocks: [],
      errors: [
        `documentation: mermaid-block-limit exceeded ${blocks.length}/${MAX_BLOCKS}`,
      ],
    };
  }

  return {
    blocks: errors.length === 0 ? blocks : [],
    errors: errors.sort(),
  };
}

function workerResultsToErrors(message, expectedBlocks) {
  if (!message || !Array.isArray(message.results)) {
    return ["documentation: mermaid-worker-protocol-error"];
  }

  const expected = new Map(
    expectedBlocks.map((block) => [
      `${block.documentPath}:${block.blockIndex}`,
      block,
    ]),
  );
  const received = new Set();
  const errors = [];

  for (const result of message.results) {
    const key = `${String(result?.documentPath)}:${String(result?.blockIndex)}`;
    if (!expected.has(key) || received.has(key)) {
      return ["documentation: mermaid-worker-protocol-error"];
    }
    received.add(key);
    if (result.error) {
      errors.push(
        `${result.documentPath}: mermaid-invalid block ${result.blockIndex}`,
      );
    }
  }

  return received.size === expected.size
    ? errors.sort()
    : ["documentation: mermaid-worker-protocol-error"];
}

function runWorker({ blocks, timeoutMs, workerUrl }) {
  return new Promise((resolve) => {
    const worker = new Worker(workerUrl, { workerData: { blocks } });
    let settled = false;

    const finish = (errors, { terminate = false } = {}) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (terminate) {
        void worker.terminate();
      }
      resolve(errors);
    };

    const timer = setTimeout(() => {
      finish(["documentation: mermaid-worker-timeout"], { terminate: true });
    }, timeoutMs);

    worker.once("message", (message) => {
      finish(workerResultsToErrors(message, blocks), { terminate: true });
    });
    worker.once("error", () => {
      finish(["documentation: mermaid-worker-error"], { terminate: true });
    });
    worker.once("exit", (code) => {
      if (!settled) {
        finish([
          code === 0
            ? "documentation: mermaid-worker-protocol-error"
            : "documentation: mermaid-worker-error",
        ]);
      }
    });
  });
}

export async function validateMermaidDocuments(
  sources,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    workerUrl = new URL("../validate-mermaid-worker.mjs", import.meta.url),
  } = {},
) {
  const { blocks, errors } = collectBoundedBlocks(sources);
  if (errors.length > 0 || blocks.length === 0) {
    return errors;
  }

  return runWorker({ blocks, timeoutMs, workerUrl });
}
