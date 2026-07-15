---
status: active
owner: engineering
last_reviewed: 2026-07-15
last_verified_commit: f9fbb24be26e45d00f425a762ba90bc559f038b3
source_refs:
  - docs/superpowers/specs/2026-07-15-gov-002-document-integrity-design.md
  - docs/MVP_SPEC.md#2612-ci-quality-gates
  - docs/MVP_SPEC.md#323-traceability-p0
  - docs/TASKS.md#gov-002--validazione-automatica-della-documentazione-e-tracciabilità
related_tasks:
  - GOV-002
  - GOV-003
  - BL-002
  - BL-009
code_refs:
  - scripts/check-docs.mjs
  - scripts/generate-contracts.mjs
  - scripts/lib/document-policy.mjs
  - scripts/lib/document-integrity-policy.mjs
  - scripts/lib/markdown-document.mjs
  - scripts/lib/mermaid-policy.mjs
  - scripts/validate-mermaid-worker.mjs
  - scripts/lib/ci-workflow-policy.mjs
  - .github/workflows/ci.yml
  - package.json
test_refs:
  - tests/contracts/document-policy.test.mjs
  - tests/contracts/document-integrity.test.mjs
  - tests/contracts/agent-workflow-contract.test.mjs
  - tests/contracts/ci-workflow.test.mjs
supersedes: null
---

# GOV-002 Document Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere `pnpm docs:check` il gate unico e deterministico per metadata, link/anchor, section refs, registro ADR, Mermaid, task graph e drift dei contratti generati.

**Architecture:** Un parser Markdown condiviso fornisce front matter, link, heading e fence senza possedere regole. `document-policy.mjs` mantiene i controlli esistenti, mentre `document-integrity-policy.mjs` aggiunge anchor, riferimenti `§`, registro ADR e invoca una policy Mermaid isolata in un worker terminabile. I checker task graph e contract drift restano canonici e vengono composti dai comandi root e dalla CI senza duplicarne la logica.

**Tech Stack:** Node.js ESM/worker_threads, `yaml`, `github-slugger@2.0.0`, `mermaid@11.16.0`, `dompurify@3.4.12`, node:test, pnpm `11.13.0`, GitHub Actions.

## Global Constraints

- Node engine `>=22.13.0`, baseline locale `24.11.0`; pnpm esatto `11.13.0`.
- `github-slugger@2.0.0`, `mermaid@11.16.0` e `dompurify@3.4.12` sono dev dependency esatte; nessun package entra negli artifact runtime.
- Nessun browser headless, rendering SVG/PNG, rete o provider durante i check.
- Mermaid: massimo 64 diagrammi, 128 KiB per blocco, timeout worker complessivo 10 secondi, errore pubblico massimo 240 caratteri.
- `docs:check` deve usare direttamente i checker esistenti, senza invocare un pnpm globale annidato.
- Budget dopo install frozen: prima run `docs:check` ≤30 secondi, seconda run ≤10 secondi.
- Output ordinato e fail-closed; path confinati al repository; input Markdown e Mermaid trattati come non affidabili.
- TDD obbligatorio: ogni comportamento nuovo deve essere osservato RED prima dell'implementazione.
- Corsia `HIGH_RISK`: test mirati, dependency audit, un solo full `verify` finale, clean checkout e review indipendente.
- Nessuna azione Vercel, deploy, staging, provider o modifica di account.

---

### Task 1: Shared Markdown parser, anchor e section-reference policy

**Files:**
- Create: `scripts/lib/markdown-document.mjs`
- Create: `scripts/lib/document-integrity-policy.mjs`
- Create: `tests/contracts/document-integrity.test.mjs`
- Modify: `scripts/lib/document-policy.mjs:1-292`
- Modify: `tests/contracts/document-policy.test.mjs:1-236`
- Modify: `package.json:52-73`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `Map<string, string>` delle sorgenti Markdown e `Map<string, object | null>` dei front matter già letti dalla document policy.
- Produces: `parseFrontMatter(source)`, `referenceTarget(reference)`, `markdownLinkTargets(source)`, `markdownHeadingCatalog(source)`, `extractMermaidBlocks(source)` e `validateDocumentIntegrity({ sources, metadataByPath }) => Promise<{ errors: string[] }> `.

- [x] **Step 1: Confermare il baseline verde del checker esistente**

Run:

```powershell
node --test tests/contracts/document-policy.test.mjs
```

Expected: 3 test passano, 0 fallimenti.

- [x] **Step 2: Scrivere i test RED per anchor e riferimenti numerici**

Creare `tests/contracts/document-integrity.test.mjs` con fixture in memoria e queste asserzioni minime:

```js
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
```

- [x] **Step 3: Eseguire i test e osservare il RED corretto**

Run:

```powershell
node --test tests/contracts/document-integrity.test.mjs
```

Expected: fallisce con `ERR_MODULE_NOT_FOUND` per `document-integrity-policy.mjs`.

- [x] **Step 4: Aggiungere lo slugger esatto dopo il RED**

Run:

```powershell
corepack pnpm@11.13.0 add -DwE github-slugger@2.0.0
```

Expected: `package.json` registra `github-slugger: 2.0.0`; lockfile aggiornato senza altre dipendenze root intenzionali.

- [x] **Step 5: Estrarre il parsing condiviso senza cambiare il comportamento esistente**

Creare `scripts/lib/markdown-document.mjs` con queste API:

```js
import GithubSlugger from "github-slugger";
import { parse } from "yaml";

const PLANNED_SUFFIX = " (planned)";

export function parseFrontMatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) return null;
  try {
    const metadata = parse(match[1]);
    return metadata && typeof metadata === "object" ? metadata : null;
  } catch {
    return null;
  }
}

export function referenceTarget(reference) {
  if (typeof reference !== "string") return null;
  const planned = reference.endsWith(PLANNED_SUFFIX);
  const value = planned
    ? reference.slice(0, -PLANNED_SUFFIX.length)
    : reference;
  const [target, fragment = null] = value.split("#", 2);
  return target.trim()
    ? { fragment: fragment?.trim() || null, planned, target: target.trim() }
    : null;
}

export function markdownHeadingCatalog(source) {
  const slugger = new GithubSlugger();
  const anchors = new Set();
  const sections = new Set();
  for (const { line } of visibleMarkdownLines(source)) {
    const match = line.match(/^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/u);
    if (!match) continue;
    anchors.add(slugger.slug(match[1]));
    const section = match[1].match(/^(\d+(?:\.\d+)*)\b/u)?.[1];
    if (section) sections.add(section);
  }
  return { anchors, sections };
}
```

Nello stesso file spostare senza variazioni semantiche `markdownLinkTargets` e aggiungere `visibleMarkdownLines`/`extractMermaidBlocks` come scanner bounded dei fence. Modificare `document-policy.mjs` affinché importi `parseFrontMatter`, `referenceTarget` e `markdownLinkTargets`; eliminare le tre copie locali. Eseguire subito il test esistente.

Run:

```powershell
node --test tests/contracts/document-policy.test.mjs
```

Expected: ancora 3 pass, 0 fail.

- [x] **Step 6: Implementare la policy minima per anchor e section refs**

Creare `scripts/lib/document-integrity-policy.mjs` con l'interfaccia stabile:

```js
import path from "node:path";

import {
  markdownHeadingCatalog,
  markdownLinkTargets,
  referenceTarget,
} from "./markdown-document.mjs";

export async function validateDocumentIntegrity({
  sources,
  metadataByPath,
  validateMermaid = async () => [],
}) {
  const errors = [];
  const catalogs = new Map(
    [...sources].map(([documentPath, source]) => [
      documentPath,
      markdownHeadingCatalog(source),
    ]),
  );

  validateRelativeFragments({ catalogs, errors, sources });
  validateMetadataFragments({ catalogs, errors, metadataByPath });
  validateSectionReferences({ catalogs, errors, sources });
  validateAdrRegistry({ errors, metadataByPath, sources });
  errors.push(...(await validateMermaid(sources)));

  return { errors: errors.sort() };
}
```

Implementare gli helper nello stesso modulo con queste regole esatte:

- link Markdown relativi: risoluzione con `path.posix.join(dirname(source), target)`, decode URI fail-closed, fragment confrontato col catalogo target;
- metadata: controllare fragment Markdown in `source_refs`, `code_refs`, `test_refs`, ignorando solo riferimenti marcati `(planned)`;
- section refs: leggere soltanto `` `*.md` § ``/`` §§ ``; accettare lista con `,`/`e` e range `-`/`–`; controllare valori singoli ed estremi;
- path backtick senza `./` o `../`: repository-root; path relativo: directory del documento; escape `..` rifiutato;
- fence e inline example non devono produrre section ref.

In `document-policy.mjs`, creare `metadataByPath`, chiamare `validateDocumentIntegrity` dopo i controlli esistenti e unire gli errori prima del sort finale.

- [x] **Step 7: Verificare GREEN e regressioni**

Run:

```powershell
node --test tests/contracts/document-integrity.test.mjs tests/contracts/document-policy.test.mjs
```

Expected: tutti i test passano; nessun warning o stack inatteso.

- [x] **Step 8: Correggere gli anchor accentati già presenti nel repository**

Sostituire soltanto questi fragment con gli slug canonici prodotti da `github-slugger`:

```text
#24-osservabilita -> #24-osservabilità
#195-migrazioni-e-compatibilita -> #195-migrazioni-e-compatibilità
#298-operativita -> #298-disaster-recovery-e-operazioni
#gov-002--validazione-automatica-della-documentazione-e-tracciabilità
  -> #gov-002--validazione-automatica-della-documentazione-e-tracciabilità
```

Applicare le sostituzioni ai soli file riportati dal nuovo checker; aggiornare `last_reviewed` a `2026-07-15` e conservare come `last_verified_commit` un commit esistente.

- [x] **Step 9: Commit atomico del parser e della policy Markdown**

```powershell
git add package.json pnpm-lock.yaml scripts/lib/markdown-document.mjs scripts/lib/document-integrity-policy.mjs scripts/lib/document-policy.mjs tests/contracts/document-integrity.test.mjs tests/contracts/document-policy.test.mjs docs
git commit -m "feat(governance): validate document references"
```

Expected: commit creato; working tree privo dei file del Task 1.

---

### Task 2: Registro ADR completo e validato

**Files:**
- Create: `docs/adr/README.md`
- Modify: `scripts/lib/document-integrity-policy.mjs`
- Modify: `tests/contracts/document-integrity.test.mjs`
- Modify: `docs/README.md:68-96`

**Interfaces:**
- Consumes: documenti `docs/adr/0001-*.md` e front matter già parsati.
- Produces: registro tabellare ADR e errori `missing-adr-registration`, `duplicate-adr-registration`, `unknown-adr-registration`, `adr-status-mismatch`.

- [x] **Step 1: Scrivere il test RED del registro ADR**

Aggiungere a `tests/contracts/document-integrity.test.mjs`:

```js
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
```

- [x] **Step 2: Eseguire RED**

Run:

```powershell
node --test tests/contracts/document-integrity.test.mjs
```

Expected: il nuovo test fallisce perché completezza e duplicati non sono ancora applicati.

- [x] **Step 3: Implementare il parser tabellare bounded**

In `document-integrity-policy.mjs`, riconoscere soltanto righe con forma:

```markdown
| [ADR-0001](0001-mobile-first-conversational-ui.md) | UI conversazionale mobile-first e stack visuale | `accepted` |
```

Confrontare gli ID/target/stati con ogni file `docs/adr/NNNN-*.md` presente in `sources`. Rifiutare ID duplicato, target duplicato, file numerato mancante dal registro, target senza documento e stato diverso dal front matter.

- [x] **Step 4: Creare il registro reale**

Creare `docs/adr/README.md` con front matter completo e questa tabella:

```markdown
| ADR | Titolo | Stato |
|---|---|---|
| [ADR-0001](0001-mobile-first-conversational-ui.md) | UI conversazionale mobile-first e stack visuale | `accepted` |
| [ADR-0002](0002-monorepo-package-boundaries.md) | Monorepo e package boundaries verificabili | `accepted` |
| [ADR-0003](0003-ci-trust-boundary-and-artifacts.md) | Trust boundary, gate e artifact della CI | `accepted` |
| [ADR-0004](0004-runtime-configuration-and-secret-injection.md) | Configurazione runtime e iniezione dei secret | `accepted` |
| [ADR-0005](0005-vercel-web-preview-and-staging.md) | Preview e staging web su Vercel | `proposed` |
| [ADR-0006](0006-postgresql-migration-foundation.md) | Fondazione PostgreSQL e contratto delle migrazioni | `accepted` |
| [ADR-0007](0007-observability-context-and-error-reporting.md) | Contesto osservabile ed error reporting | `accepted` |
| [ADR-0008](0008-zod-first-contract-generation.md) | Contratti Zod-first e artefatti generati | `accepted` |
```

Aggiungere `adr/README.md` alla tabella Documenti attivi in `docs/README.md`.

- [x] **Step 5: Verificare GREEN**

Run:

```powershell
node --test tests/contracts/document-integrity.test.mjs
node scripts/check-docs.mjs
```

Expected: test e repository documentale passano.

- [x] **Step 6: Commit atomico del registro**

```powershell
git add docs/adr/README.md docs/README.md scripts/lib/document-integrity-policy.mjs tests/contracts/document-integrity.test.mjs
git commit -m "docs(adr): add validated decision register"
```

---

### Task 3: Mermaid parse-only in worker bounded

**Files:**
- Create: `scripts/lib/mermaid-policy.mjs`
- Create: `scripts/validate-mermaid-worker.mjs`
- Create: `tests/fixtures/docs/hanging-mermaid-worker.mjs`
- Modify: `scripts/lib/document-integrity-policy.mjs`
- Modify: `scripts/lib/markdown-document.mjs`
- Modify: `tests/contracts/document-integrity.test.mjs`
- Modify: `package.json:52-73`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `extractMermaidBlocks(source)` con `{ blockIndex, documentPath, source }`.
- Produces: `validateMermaidDocuments(sources, options?) => Promise<string[]>`; worker message `{ results: Array<{ blockIndex, documentPath, diagramType?, error? }> }`.

- [x] **Step 1: Scrivere test RED per famiglie reali, limiti e timeout**

Aggiungere test che passano questi diagrammi reali al validator:

```js
const validMermaidSources = new Map([
  ["docs/flow.md", "```mermaid\nflowchart TD\nA --> B\n```\n"],
  ["docs/sequence.md", "```mermaid\nsequenceDiagram\nA->>B: Ping\n```\n"],
  ["docs/state.md", "```mermaid\nstateDiagram-v2\n[*] --> ready\n```\n"],
  ["docs/er.md", "```mermaid\nerDiagram\nA ||--o{ B : owns\n```\n"],
]);
```

Asserire inoltre:

```js
assert.deepEqual(
  await validateMermaidDocuments(
    new Map([["docs/broken.md", "```mermaid\nflowchart TD\nA --\n```\n"]]),
  ),
  ["docs/broken.md: mermaid-invalid block 1"],
);
```

Creare `tests/fixtures/docs/hanging-mermaid-worker.mjs`:

```js
setInterval(() => {}, 1_000);
```

Il test timeout passa `workerUrl` alla fixture e `timeoutMs: 25`, aspettandosi `documentation: mermaid-worker-timeout`. Aggiungere casi per fence vuoto, 128 KiB + 1 byte e 65 blocchi.

- [x] **Step 2: Eseguire RED**

Run:

```powershell
node --test tests/contracts/document-integrity.test.mjs
```

Expected: fallisce con modulo `mermaid-policy.mjs` mancante.

- [x] **Step 3: Aggiungere Mermaid esatto dopo il RED**

Run:

```powershell
corepack pnpm@11.13.0 add -DwE mermaid@11.16.0
corepack pnpm@11.13.0 add -DwE dompurify@3.4.12
corepack pnpm@11.13.0 audit --audit-level=high
```

Expected: dipendenza root esatta; audit `No known vulnerabilities found` oppure finding high concreto che blocca il task.

- [x] **Step 4: Implementare l'estrazione bounded dei fence**

In `markdown-document.mjs`, `extractMermaidBlocks` deve:

```js
export function extractMermaidBlocks(source, documentPath) {
  const blocks = [];
  const lines = source.split(/\r?\n/u);
  let current = null;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!current && /^```mermaid(?:\s|$)/u.test(trimmed)) {
      current = [];
      continue;
    }
    if (current && trimmed.startsWith("```")) {
      blocks.push({
        blockIndex: blocks.length + 1,
        documentPath,
        source: current.join("\n"),
      });
      current = null;
      continue;
    }
    if (current) current.push(line);
  }

  return blocks;
}
```

Un fence Mermaid non chiuso produce `mermaid-unclosed block <n>` prima di avviare il worker.

- [x] **Step 5: Implementare parent e worker**

`scripts/validate-mermaid-worker.mjs` importa Mermaid, inizializza `startOnLoad: false` e `securityLevel: "strict"`, chiama `await mermaid.parse(source)` per ogni blocco e invia risultati normalizzati.

`scripts/lib/mermaid-policy.mjs`:

```js
import { Worker } from "node:worker_threads";

const MAX_BLOCK_BYTES = 128 * 1024;
const MAX_BLOCKS = 64;
const DEFAULT_TIMEOUT_MS = 10_000;

export async function validateMermaidDocuments(
  sources,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    workerUrl = new URL("../validate-mermaid-worker.mjs", import.meta.url),
  } = {},
) {
  const { blocks, errors } = collectBoundedBlocks(sources);
  if (errors.length > 0 || blocks.length === 0) return errors.sort();
  return runWorker({ blocks, timeoutMs, workerUrl });
}
```

`runWorker` deve registrare `message`, `error` ed `exit`, cancellare il timer in ogni terminal path, chiamare `worker.terminate()` sul timeout e restituire solo codici stabili. Il dettaglio parser è una singola riga troncata a 240 caratteri e non include la sorgente completa.

In `validateDocumentIntegrity`, sostituire il default no-op con `validateMermaidDocuments` importato.

- [x] **Step 6: Verificare GREEN e repository reale**

Run:

```powershell
node --test tests/contracts/document-integrity.test.mjs
node scripts/check-docs.mjs
```

Expected: tutte le famiglie Mermaid e i sette diagrammi reali passano; negative path restituiscono errori stabili; nessun processo worker resta attivo.

- [x] **Step 7: Commit atomico Mermaid**

```powershell
git add package.json pnpm-lock.yaml scripts/lib/markdown-document.mjs scripts/lib/document-integrity-policy.mjs scripts/lib/mermaid-policy.mjs scripts/validate-mermaid-worker.mjs tests/contracts/document-integrity.test.mjs tests/fixtures/docs/hanging-mermaid-worker.mjs
git commit -m "feat(governance): validate Mermaid diagrams"
```

---

### Task 4: Comporre docs:check e il Quality gate CI

**Files:**
- Modify: `package.json:15-50`
- Modify: `.github/workflows/ci.yml:29-55`
- Modify: `scripts/lib/ci-workflow-policy.mjs:208-236`
- Modify: `tests/contracts/agent-workflow-contract.test.mjs:12-31`
- Modify: `tests/contracts/ci-workflow.test.mjs:140-180`

**Interfaces:**
- Consumes: checker contratti, documenti e task graph già disponibili.
- Produces: `pnpm docs:check` composto e un unico step CI `pnpm docs:check` con `CONTRACT_BASE_REF=HEAD^1`.

- [x] **Step 1: Aggiornare prima i contract test e osservare RED**

In `agent-workflow-contract.test.mjs` aspettarsi esattamente:

```js
assert.equal(
  manifest.scripts["docs:check"],
  "turbo run build --filter=@dnd-ai/contracts && node scripts/generate-contracts.mjs --check && node scripts/check-docs.mjs && node scripts/check-task-graph.mjs",
);
assert.equal(
  manifest.scripts["verify:docs"],
  "git diff --check HEAD && turbo run build --filter=@dnd-ai/contracts && node scripts/generate-contracts.mjs --check && node scripts/check-docs.mjs && node scripts/check-task-graph.mjs && node scripts/scan-secrets.mjs",
);
```

Nel CI contract test cercare un solo step `pnpm docs:check`, con env `CONTRACT_BASE_REF: HEAD^1`, e zero step `pnpm contracts:check`/`pnpm tasks:check`.

Run:

```powershell
node --test tests/contracts/agent-workflow-contract.test.mjs tests/contracts/ci-workflow.test.mjs
```

Expected: fallisce sugli script e sul workflow correnti.

- [x] **Step 2: Aggiornare i comandi root senza pnpm annidato**

Applicare a `package.json` le due stringhe esatte del test. Lasciare `contracts:check` e `tasks:check` come comandi specialistici pubblici. `verify` mantiene build/generator/document/task primitive dirette una sola volta.

- [x] **Step 3: Consolidare il workflow Quality**

Sostituire i due step separati con:

```yaml
- name: Check documentation integrity
  run: pnpm docs:check
  env:
    CONTRACT_BASE_REF: HEAD^1
```

Mantenere checkout `fetch-depth: 2`, permessi e tutti gli altri step invariati.

- [x] **Step 4: Rendere fail-closed la policy CI**

In `ci-workflow-policy.mjs`, la lista Quality deve contenere `pnpm docs:check` e non i due vecchi comandi. Sostituire `contractCheckSteps` con `documentationCheckSteps` e mantenere i controlli `length === 1` e `CONTRACT_BASE_REF === "HEAD^1"`. Il messaggio stabile diventa `quality documentation check must use CONTRACT_BASE_REF=HEAD^1`.

- [x] **Step 5: Verificare GREEN e drift reale**

Run:

```powershell
node --test tests/contracts/agent-workflow-contract.test.mjs tests/contracts/ci-workflow.test.mjs tests/contracts/contracts-generated.test.mjs
corepack pnpm@11.13.0 docs:check
corepack pnpm@11.13.0 ci:workflow:check
```

Expected: test e checker passano; l'output include `contract-artifacts: PASS`, `documentation-policy: PASS` e `task-graph: PASS` una sola volta.

- [x] **Step 6: Misurare il budget cold/warm**

Run due volte:

```powershell
Measure-Command { corepack pnpm@11.13.0 docs:check } | Select-Object -ExpandProperty TotalSeconds
Measure-Command { corepack pnpm@11.13.0 docs:check } | Select-Object -ExpandProperty TotalSeconds
```

Expected: prima durata ≤30, seconda ≤10. Registrare i due valori nella card GOV-002; nessun retry automatico.

- [x] **Step 7: Commit atomico della composizione CI**

```powershell
git add package.json .github/workflows/ci.yml scripts/lib/ci-workflow-policy.mjs tests/contracts/agent-workflow-contract.test.mjs tests/contracts/ci-workflow.test.mjs
git commit -m "ci: compose document integrity gate"
```

---

### Task 5: Living docs, tracciabilità e candidato HIGH_RISK

**Files:**
- Modify: `AGENTS.md:260-274,522-566`
- Modify: `docs/README.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TASKS.md`
- Modify: `docs/operations/CI_CD.md`
- Modify: `docs/superpowers/specs/2026-07-15-gov-002-document-integrity-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-gov-002-document-integrity.md`

**Interfaces:**
- Consumes: comportamento e risultati verificati dei Task 1-4.
- Produces: snapshot terminale branch-local `DONE/100%/PASSING`, mapping requisito→task→test→evidenza e istruzioni operative aggiornate.

- [x] **Step 1: Aggiornare i documenti semanticamente interessati**

Applicare queste modifiche precise:

- `AGENTS.md`: descrivere `docs:check` come gate composto contract drift + document integrity + task graph; conservare `verify:docs` come corsia FAST con secret scan.
- `docs/operations/CI_CD.md`: Quality usa un solo step `pnpm docs:check` con base `HEAD^1`; nessun cambio a trigger, permessi, cache o merge gate.
- `docs/TRACEABILITY.md`: marcare BL-010 integrato tramite PR #22/merge `15382d5`; aggiungere riga GOV-002 con policy, worker Mermaid, ADR registry e test.
- `docs/CHANGELOG.md`: aggiungere GOV-002 in Added/Changed/Verification senza copiare future evidenze GitHub.
- design e piano: stato `active`, rimuovere `(planned)` dai path creati, registrare `github-slugger@2.0.0` e i budget misurati.
- `docs/CONTEXT.md`: comando/versioni, rischio CTX-R02 chiuso, GOV-002 candidato e freeze Vercel invariato.
- `docs/TASKS.md`: checklist GOV-002 allineata ai test già eseguiti, evidenze locali, diario sintetico e stato `IN_REVIEW/90%/PARTIAL`; il passaggio terminale avviene soltanto dopo il full gate.

- [x] **Step 2: Eseguire i test mirati finali**

Run:

```powershell
node --test tests/contracts/document-policy.test.mjs tests/contracts/document-integrity.test.mjs tests/contracts/agent-workflow-contract.test.mjs tests/contracts/ci-workflow.test.mjs tests/contracts/contracts-generated.test.mjs
corepack pnpm@11.13.0 docs:check
corepack pnpm@11.13.0 ci:workflow:check
corepack pnpm@11.13.0 audit --audit-level=high
```

Expected: tutti exit `0`; audit senza vulnerability high; output deterministico e senza stack/source Mermaid.

- [x] **Step 3: Verificare che Mermaid non entri nell'artifact runtime**

Run:

```powershell
corepack pnpm@11.13.0 artifact:prepare
corepack pnpm@11.13.0 artifact:verify
rg -n -i "(^|[/\\])mermaid([/\\]|$)|github-slugger|dompurify" artifacts\bl002
```

Expected: prepare/verify exit `0`; `rg` exit `1` senza match.

- [x] **Step 4: Invocare la review indipendente prevista**

Usare `superpowers:requesting-code-review` sul diff `15382d5..HEAD`. Correggere soltanto finding P0/P1 con test RED dedicato; un secondo pass controlla esclusivamente quei finding.

- [x] **Step 5: Eseguire l'unico full gate finale**

Run:

```powershell
$env:TURBO_FORCE = "true"
corepack pnpm@11.13.0 verify
```

Expected: exit `0`; lint, typecheck, build, unit, integration, database, contract, security, policy, docs, secret scan e artifact tutti verdi.

- [x] **Step 6: Finalizzare stato ed evidenze dopo il full gate**

Aggiornare `docs/TASKS.md` e `docs/CONTEXT.md` a `DONE/100%/PASSING` proposto, inserendo soltanto comandi e conteggi realmente osservati. Aggiornare design/piano a `active`, rimuovere ogni `(planned)` ormai implementato e registrare i due tempi `docs:check`.

Run:

```powershell
corepack pnpm@11.13.0 verify:docs
```

Expected: exit `0`; metadata, anchor/section refs, ADR, Mermaid, contract drift, task graph e secret scan verdi.

- [ ] **Step 7: Consolidare il candidato funzionale**

```powershell
git add AGENTS.md docs package.json pnpm-lock.yaml scripts tests .github/workflows/ci.yml
git commit -m "feat(governance): complete document integrity gate"
git status --short --branch
```

Expected: commit creato; branch pulita. Il candidato contiene codice, test, stato e documenti; nessun commit successivo deve copiare soltanto evidenze CI.

- [ ] **Step 8: Verificare il commit da checkout pulito**

Creare un worktree detached sul candidate head, quindi:

```powershell
corepack pnpm@11.13.0 install --frozen-lockfile
$env:TURBO_FORCE = "true"
corepack pnpm@11.13.0 verify
```

Expected: install e verify exit `0`; nessun file modificato nel checkout pulito.

- [ ] **Step 9: Delivery protetta senza Vercel**

Push della branch, una sola PR, attesa del check `CI / Merge gate`, merge senza bypass e verifica della run post-merge. Non eseguire deploy, readback o modifiche Vercel.
