---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-13
last_verified_commit: 7c6c7071d027c55aeffbc7279b8ca3765ea26c37
source_refs:
  - docs/MVP_SPEC.md#32-criteri-di-accettazione
  - docs/TASKS.md
related_tasks:
  - GOV-001
  - GOV-002
  - BL-001
  - BL-002
  - BL-079
code_refs:
  - apps
  - packages
  - scripts/lib/workspace-boundaries.mjs
  - scripts/lib/task-graph.mjs
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/lib/build-artifact.mjs
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
  - docs/testing/BL-001_VERIFICATION.md
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - docs/testing/BL-002_VERIFICATION.md
supersedes: null
---

# Tracciabilità MVP

## Stato del registro

Il repository è versionato e collegato a `Emacore17/dnd-ai`. `BL-001` ha introdotto lo scaffold applicativo e i primi contract test; `BL-002` aggiunge la pipeline e i controlli locali/CI. I riferimenti futuri restano marcati `planned`; `GOV-002` estenderà il controllo task graph a link, front matter, Mermaid e generated-doc drift.

## Governance e baseline

| Requisito | Fonte | Task | Artefatto | Test/evidenza | Stato |
|---|---|---|---|---|---|
| Cold start riproducibile | `AGENTS.md` §2; `docs/TASKS.md` §§3, 6 | GOV-001 | `AGENTS.md`, `docs/README.md`, `docs/CONTEXT.md`, `docs/TASKS.md` | `AGENTS_VALIDATION.txt` | implemented |
| Contesto con hash/data/versioni | `docs/TASKS.md` §6.3 | GOV-001 | `docs/CONTEXT.md` | cold-start review in `AGENTS_VALIDATION.txt` | implemented |
| Link e path validi | `AGENTS.md` §12.3 | GOV-001, GOV-002 | documenti attivi | controllo link locale; futuro `pnpm docs:check` (planned) | manual, automation planned |
| Requisito→task→test→evidenza | `docs/TASKS.md` §6 | GOV-001, GOV-002 | questo documento | mapping UX e governance | initial |
| Monorepo buildabile con tre runtime e package puri | spec §§11.2–11.3; `AGENTS.md` §9 | BL-001 | `apps/*`, `packages/*`, `turbo.json` | lint/typecheck/build su 10 workspace; report BL-001 | implemented, clean worktree PASS |
| Import e dipendenze rispettano la allowlist | `AGENTS.md` §§4.6, 9 | BL-001 | `scripts/lib/workspace-boundaries.mjs` | `tests/contracts/workspace-boundaries.test.mjs`, inclusa fixture vietata; report BL-001 | implemented, PASS |
| Task ID, dipendenze, cicli, status, parity spec e riferimenti UI sono verificabili | `docs/TASKS.md` §§2, 7; studio UX §14.1 | BL-001, GOV-002 | `scripts/lib/task-graph.mjs` | `tests/contracts/task-graph.test.mjs`; `pnpm tasks:check`; report BL-001 | implemented (scope task graph), PASS |
| PR CI fail-closed con check stabile | spec §§26.12, 29.4; ADR-0003 | BL-002 | `.github/workflows/ci.yml`, `scripts/lib/ci-gate.mjs` | clean verify head `7c6c707`; run positiva `29254494868`; run negativa `29254866626`; report BL-002 | pipeline PASS; required enforcement BLOCKED by plan |
| Cache e artifact non espongono credenziali | spec §§22.10, 29.4; ADR-0003 | BL-002 | setup action pnpm-only, `scripts/lib/secret-scanner.mjs`, `scripts/lib/build-artifact.mjs` | remote manifest `build-artifact-v1`, 3.205 file e checksum/secret verification; report BL-002 | PASS |
| Log CI non espongono credenziali | spec §§22.10, 29.4; ADR-0003 | BL-002 | workflow senza secret applicativi; output scanner redatto | scan redatto dei 5 job della run `29254494868` | PASS |
| Gate fallito rende la PR non mergeabile | spec §31 `BL-002`; card BL-002 | BL-002 | Ruleset `main` planned | PR negativa #2: gate FAIL ma `MERGEABLE/UNSTABLE`; API Ruleset/protection `403` | BLOCKED: GitHub plan decision |

## UX/UI P0

| ID | Requisito normativo | Task | Codice | Test | Evidenza corrente |
|---|---|---|---|---|---|
| UX-P0-01 | Core loop completo a 320 px; baseline 360–430 px | BL-079, BL-040 | `apps/web` (planned) | `tests/e2e/mobile-game-loop.spec.ts` (planned) | studio e ADR approvati |
| UX-P0-02 | Feed conversazionale, decisione e composer dominano il primo livello | BL-079, BL-040 | `GameConversation`, `FreeActionComposer` (planned) | component + visual regression (planned) | `docs/product/UX_UI_DESIGN.md` §§4–7 |
| UX-P0-03 | HUD secondaria in drawer/sheet; desktop senza funzioni esclusive | BL-079, BL-040 | `GameDrawer`, responsive shell (planned) | viewport/browser matrix (planned) | ADR-0001 |
| UX-P0-04 | shadcn/ui `new-york` su Radix e token semantici | BL-079 | `components.json`, UI primitives (planned) | config/token contract test (planned) | ADR-0001 |
| UX-P0-05 | AI Elements selettivo non sostituisce `TurnView`, REST+SSE o idempotenza | BL-079, BL-040, BL-041 | adapter/wrapper UI (planned) | contract + UI negative test (planned) | spec §§11.4, 21.1 |
| UX-P0-06 | Motion lazy, reduced-motion e nessuna informazione affidata all’animazione | BL-079, BL-027, BL-040 | motion primitives (planned) | `tests/e2e/reduced-motion.spec.ts` (planned) | studio §11 |
| UX-P0-07 | Touch target ≥44 px, primarie ≥48 px, safe area/tastiera/zoom | BL-079, BL-012, BL-019, BL-040 | UI wrappers (planned) | accessibility/device E2E (planned) | spec §§8.4–8.5, 23.1 |
| UX-P0-08 | Stile premium contemporaneo, non pseudo-medievale | BL-079 | theme/tokens (planned) | design review + contrast/visual regression (planned) | studio §9 |
| UX-P0-09 | Dado decorativo riproduce risultato backend e possiede fallback | BL-040, BL-043 | dice tray (planned) | rules contract + reduced-motion UI test (planned) | spec §21.4 |

## Criteri globali

Il mapping completo AC-01..AC-25 è definito in `docs/TASKS.md` §19 e verrà sostituito qui con riferimenti reali man mano che codice e suite vengono creati. Fino ad allora, `docs/MVP_SPEC.md` §32.3 resta l’indice normativo sintetico.

## Regola di aggiornamento

Ogni task funzionale aggiunge o aggiorna almeno una riga con path reali. Un task non passa a `DONE` se il test richiesto è soltanto `planned`, salvo che il task sia esclusivamente documentale e disponga della propria evidenza riproducibile.
