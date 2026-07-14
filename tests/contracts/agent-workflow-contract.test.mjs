import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const root = new URL("../../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("agent workflow exposes bounded documentation and affected verification lanes", async () => {
  const manifest = JSON.parse(await read("package.json"));
  const agents = await read("AGENTS.md");
  const tasks = await read("docs/TASKS.md");

  assert.equal(
    manifest.scripts["docs:check"],
    "node scripts/check-docs.mjs && node scripts/check-task-graph.mjs",
  );
  assert.equal(
    manifest.scripts["verify:docs"],
    "git diff --check HEAD && node scripts/check-docs.mjs && node scripts/check-task-graph.mjs && node scripts/scan-secrets.mjs",
  );
  assert.equal(
    manifest.scripts["verify:affected"],
    "git diff --check HEAD && eslint scripts tests eslint.config.mjs && node scripts/verify-affected.mjs && node scripts/check-boundaries.mjs && node scripts/check-task-graph.mjs && node scripts/scan-secrets.mjs",
  );

  for (const lane of ["FAST", "STANDARD", "HIGH_RISK"]) {
    assert.match(agents, new RegExp("`" + lane + "`"));
  }

  assert.match(
    agents,
    /Nessun commit o PR esclusivamente per registrare un run CI/,
  );
  assert.match(agents, /una sola review indipendente/);
  assert.match(agents, /canonico esclusivamente sulla default branch/);
  assert.match(agents, /stato di delivery non viene copiato nei documenti/);
  assert.match(
    tasks,
    /### GOV-003 — Ottimizzazione del ciclo di sviluppo degli agenti/,
  );
});
