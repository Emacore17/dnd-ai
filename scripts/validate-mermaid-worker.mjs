import { parentPort, workerData } from "node:worker_threads";

import DOMPurify from "dompurify";

function parserDetail(error) {
  return String(error?.message ?? error)
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 240);
}

function escapeForParse(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// DOMPurify exports a factory in Node without a DOM. Mermaid still sanitizes
// parser labels, so the parse-only worker supplies a conservative text adapter.
if (typeof DOMPurify.sanitize !== "function") {
  DOMPurify.addHook = () => {};
  DOMPurify.sanitize = escapeForParse;
}

const { default: mermaid } = await import("mermaid");

mermaid.initialize({
  securityLevel: "strict",
  startOnLoad: false,
  suppressErrorRendering: true,
});

const results = [];
for (const block of workerData.blocks) {
  try {
    const parsed = await mermaid.parse(block.source, {
      suppressErrors: false,
    });
    if (parsed === false) {
      results.push({
        blockIndex: block.blockIndex,
        documentPath: block.documentPath,
        error: "parse-failed",
      });
      continue;
    }
    results.push({
      blockIndex: block.blockIndex,
      diagramType: parsed.diagramType,
      documentPath: block.documentPath,
    });
  } catch (error) {
    results.push({
      blockIndex: block.blockIndex,
      documentPath: block.documentPath,
      error: parserDetail(error),
    });
  }
}

parentPort.postMessage({ results });
