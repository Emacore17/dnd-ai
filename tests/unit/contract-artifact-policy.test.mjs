import assert from "node:assert/strict";
import test from "node:test";

import {
  compareContractArtifactFiles,
  normalizeContractArtifactPath,
  renderCanonicalJson,
} from "../../scripts/lib/contract-artifact-policy.mjs";
import { compareContractCompatibilityBaseline } from "../../scripts/lib/contract-compatibility-policy.mjs";

test("canonical JSON sorts every object key and preserves array order", () => {
  const rendered = renderCanonicalJson({
    zeta: 1,
    alpha: { zebra: true, beta: null },
    list: [{ y: 2, x: 1 }, "stable"],
  });

  assert.equal(
    rendered,
    [
      "{",
      '  "alpha": {',
      '    "beta": null,',
      '    "zebra": true',
      "  },",
      '  "list": [',
      "    {",
      '      "x": 1,',
      '      "y": 2',
      "    },",
      '    "stable"',
      "  ],",
      '  "zeta": 1',
      "}",
      "",
    ].join("\n"),
  );
});

test("canonical JSON rejects values that JSON would silently alter", () => {
  assert.throws(
    () => renderCanonicalJson({ unsafe: undefined }),
    /non-JSON value at \$\.unsafe/u,
  );
  assert.throws(
    () => renderCanonicalJson({ unsafe: Number.POSITIVE_INFINITY }),
    /non-finite number at \$\.unsafe/u,
  );
});

test("generated artifact paths cannot escape or use platform-dependent forms", () => {
  assert.equal(
    normalizeContractArtifactPath("v1/schemas/game-event.schema.json"),
    "v1/schemas/game-event.schema.json",
  );
  assert.equal(
    normalizeContractArtifactPath("v2/schemas/game-event.schema.json"),
    "v2/schemas/game-event.schema.json",
  );

  for (const unsafePath of [
    "../secret.json",
    "v1/../../secret.json",
    "/absolute.json",
    "v1\\schema.json",
    "v1//schema.json",
    "v0/schema.json",
    "v01/schema.json",
    "v1/schema.txt",
  ]) {
    assert.throws(
      () => normalizeContractArtifactPath(unsafePath),
      /invalid generated artifact path/u,
      unsafePath,
    );
  }
});

test("artifact comparison reports missing, stale and unexpected files", () => {
  const expected = new Map([
    ["v1/manifest.json", "expected manifest\n"],
    ["v1/openapi.json", "expected openapi\n"],
    ["v1/schemas/game-event.schema.json", "expected schema\n"],
  ]);
  const observed = new Map([
    ["v1/openapi.json", "stale openapi\n"],
    ["v1/schemas/game-event.schema.json", "expected schema\n"],
    ["v1/unexpected.json", "unexpected\n"],
  ]);

  assert.deepEqual(compareContractArtifactFiles(expected, observed), [
    "missing: v1/manifest.json",
    "stale: v1/openapi.json",
    "unexpected: v1/unexpected.json",
  ]);
});

test("published v1 compatibility baseline rejects regenerated breaking output", () => {
  const stableManifest = "stable manifest\n";
  const stableSchema = "stable schema\n";
  const baseline = new Map([
    ["v1/manifest.json", stableManifest],
    ["v1/schemas/game-event.schema.json", stableSchema],
  ]);

  assert.deepEqual(
    compareContractCompatibilityBaseline(
      new Map(),
      new Map([["v1/manifest.json", stableManifest]]),
    ),
    [],
  );

  assert.deepEqual(
    compareContractCompatibilityBaseline(
      baseline,
      new Map([
        ["v1/manifest.json", stableManifest],
        ["v1/schemas/game-event.schema.json", stableSchema],
      ]),
    ),
    [],
  );

  assert.deepEqual(
    compareContractCompatibilityBaseline(
      baseline,
      new Map([
        ["v1/manifest.json", stableManifest],
        ["v1/schemas/game-event.schema.json", "breaking schema\n"],
      ]),
    ),
    ["published artifact changed: v1/schemas/game-event.schema.json"],
  );

  assert.deepEqual(
    compareContractCompatibilityBaseline(
      baseline,
      new Map([
        ["v1/manifest.json", stableManifest],
        ["v1/schemas/game-event.schema.json", stableSchema],
        ["v2/manifest.json", "new major\n"],
      ]),
    ),
    [],
  );

  assert.deepEqual(
    compareContractCompatibilityBaseline(
      baseline,
      new Map([...baseline, ["v3/manifest.json", "skipped major\n"]]),
    ),
    ["new contract major must be v2"],
  );
});
