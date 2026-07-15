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

test("requires each numbered ADR exactly once with matching status", async () => {
  const sources = new Map([
    [
      "docs/adr/README.md",
      [
        "# ADR",
        "",
        "| ADR | Titolo | Stato |",
        "|---|---|---|",
        "| [ADR-0001](0001-one.md) | One | `accepted` |",
        "| [ADR-0001](0001-one.md) | Duplicate | `accepted` |",
      ].join("\n"),
    ],
    ["docs/adr/0001-one.md", "# ADR-0001 — One\n"],
    ["docs/adr/0002-two.md", "# ADR-0002 — Two\n"],
  ]);
  const metadataByPath = new Map([
    ["docs/adr/README.md", { status: "active" }],
    ["docs/adr/0001-one.md", { status: "accepted" }],
    ["docs/adr/0002-two.md", { status: "proposed" }],
  ]);

  const result = await validateDocumentIntegrity({
    metadataByPath,
    sources,
    validateMermaid: async () => [],
  });

  assert.deepEqual(result.errors, [
    "docs/adr/README.md: duplicate-adr-registration ADR-0001",
    "docs/adr/README.md: missing-adr-registration ADR-0002",
  ]);
});

test("rejects unknown ADR rows and status drift", async () => {
  const sources = new Map([
    [
      "docs/adr/README.md",
      [
        "# ADR",
        "",
        "| ADR | Titolo | Stato |",
        "|---|---|---|",
        "| [ADR-0001](0001-one.md) | One | `proposed` |",
        "| [ADR-0009](0009-unknown.md) | Unknown | `proposed` |",
      ].join("\n"),
    ],
    ["docs/adr/0001-one.md", "# ADR-0001 — One\n"],
  ]);
  const metadataByPath = new Map([
    ["docs/adr/README.md", { status: "active" }],
    ["docs/adr/0001-one.md", { status: "accepted" }],
  ]);

  const result = await validateDocumentIntegrity({
    metadataByPath,
    sources,
    validateMermaid: async () => [],
  });

  assert.deepEqual(result.errors, [
    "docs/adr/README.md: adr-status-mismatch ADR-0001 expected accepted received proposed",
    "docs/adr/README.md: unknown-adr-registration ADR-0009",
  ]);
});
