import assert from "node:assert/strict";
import test from "node:test";

import { validateDocumentIntegrity } from "../../scripts/lib/document-integrity-policy.mjs";

test("accepts canonical anchors, duplicate headings and numeric section lists", async () => {
  const sources = new Map([
    [
      "docs/SOURCE.md",
      [
        "# Source",
        "",
        "[Target](TARGET.md#24-osservabilità)",
        "",
        "`docs/TARGET.md` §§24, 26.12 e 35.1",
      ].join("\n"),
    ],
    [
      "docs/TARGET.md",
      [
        "# Target",
        "",
        "## 24. Osservabilità",
        "## 26.12 CI quality gates",
        "## Duplicate",
        "## Duplicate",
        "## 35.1 Definition of Done",
      ].join("\n"),
    ],
  ]);
  const metadataByPath = new Map([
    ["docs/SOURCE.md", { source_refs: ["docs/TARGET.md#duplicate-1"] }],
    ["docs/TARGET.md", { source_refs: [] }],
  ]);

  const result = await validateDocumentIntegrity({
    metadataByPath,
    sources,
    validateMermaid: async () => [],
  });

  assert.deepEqual(result.errors, []);
});

test("rejects missing fragments and section range endpoints", async () => {
  const sources = new Map([
    [
      "docs/SOURCE.md",
      "# Source\n\n[Missing](TARGET.md#missing)\n\n`docs/TARGET.md` §18.4–18.9\n",
    ],
    ["docs/TARGET.md", "# Target\n\n## 18.4 Relazioni\n"],
  ]);

  const result = await validateDocumentIntegrity({
    metadataByPath: new Map(),
    sources,
    validateMermaid: async () => [],
  });

  assert.deepEqual(result.errors, [
    "docs/SOURCE.md: broken-relative-fragment TARGET.md#missing",
    "docs/SOURCE.md: missing-section-reference docs/TARGET.md §18.9",
  ]);
});

test("ignores section-reference examples wrapped in double backticks", async () => {
  const sources = new Map([
    [
      "docs/SOURCE.md",
      "# Source\n\nExample: `` `path/file.md` §18.4–18.9 ``.\n",
    ],
  ]);

  const result = await validateDocumentIntegrity({
    metadataByPath: new Map(),
    sources,
    validateMermaid: async () => [],
  });

  assert.deepEqual(result.errors, []);
});
