---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-13
last_verified_commit: 2765c49959d6b4094367120e3615a0728a58be0a
source_refs:
  - docs/MVP_SPEC.md#32-criteri-di-accettazione
  - docs/TASKS.md
  - docs/product/UX_UI_DESIGN.md
related_tasks:
  - GOV-001
  - GOV-002
  - BL-001
  - BL-002
  - BL-040
  - BL-079
  - BL-080
code_refs:
  - apps
  - packages
  - scripts/lib/workspace-boundaries.mjs
  - scripts/lib/task-graph.mjs
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/lib/build-artifact.mjs
  - scripts/smoke-build-artifact.mjs
  - apps/web/artifact-runtime/start.mjs
  - apps/web/components.json
  - apps/web/src/app/globals.css
  - apps/web/src/components/ai-elements
  - apps/web/src/components/game
  - apps/web/src/components/motion
  - apps/web/e2e/game-shell.performance.spec.ts
  - apps/web/e2e/performance-budget.mjs
  - apps/web/e2e/start-production-server.mjs
  - apps/web/playwright.config.ts
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
  - docs/testing/BL-001_VERIFICATION.md
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/integration/artifact-runtime.test.mjs
  - docs/testing/BL-002_VERIFICATION.md
  - tests/contracts/bl079-ui-foundation.test.mjs
  - apps/web/src/components/game/choice-set.test.tsx
  - apps/web/src/components/game/domain-view-contracts.test.tsx
  - apps/web/src/components/game/free-action-composer.test.tsx
  - apps/web/src/components/game/game-shell.test.tsx
  - apps/web/src/components/game/narrative-turn.test.tsx
  - apps/web/src/lib/narrative-live-announcement.test.ts
  - apps/web/e2e/game-shell.spec.ts
  - apps/web/e2e/game-shell.performance.spec.ts
  - tests/unit/performance-budget.test.mjs
  - apps/web/e2e/__screenshots__
  - docs/testing/BL-079_VERIFICATION.md
supersedes: null
---

# Tracciabilità MVP

## Stato del registro

Il repository pubblico è versionato e collegato a `Emacore17/dnd-ai`. `BL-001` ha introdotto lo scaffold applicativo e i primi contract test; `BL-002` ha completato pipeline, controlli locali/CI e Ruleset required su `main`. La fondazione `BL-079` è `IN_REVIEW`: contract, component, browser, axe, visual multipiattaforma, build e gate performance production sono verdi. Le run `29271004267` e `29272004975` hanno fallito chiuse col vecchio observer; la seconda, a worker singolo, ha corretto la diagnosi. `2765c49` misura quattro fasi attribuibili con Event Timing/LoAF/CLS, tre campioni senza retry e diagnostica failure-only; calibrazione locale `20/20` e run Ubuntu `29274592866` 5/5 job `PASS`. I gate residui richiedono persone/browser/device reali e lo staging assegnato esplicitamente a `BL-080`. `BL-003` è il prossimo task `READY` e fornisce la config necessaria al provisioning. I riferimenti futuri restano marcati `planned`; `GOV-002` estenderà il controllo task graph a link, front matter, Mermaid e generated-doc drift.

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
| PR CI fail-closed con check stabile | spec §§26.12, 29.4; ADR-0003 | BL-002 | `.github/workflows/ci.yml`, `scripts/lib/ci-gate.mjs` | clean verify head `7c6c707`; PR run `29257544214`; post-merge run `29257721274`; run negativa `29256736728`; Ruleset `18877721`; report BL-002 | PASS |
| Cache e artifact non espongono credenziali e il payload è avviabile | spec §§22.10, 29.4; ADR-0003 | BL-002, BL-079 | setup action pnpm-only, scanner, packager, launcher standalone | remote manifest BL-002; regressioni symlink; checksum/secret verify e boot HTTP locale del payload BL-079; run `29274592866` | PASS locale e CI |
| Log CI non espongono credenziali | spec §§22.10, 29.4; ADR-0003 | BL-002 | workflow senza secret applicativi; output scanner redatto | scan redatto dei 5 job della run `29254494868` | PASS |
| Gate fallito rende la PR non mergeabile | spec §31 `BL-002`; card BL-002 | BL-002 | Ruleset `main-required-ci` `18877721` | PR negativa #3/run `29256736728`: gate FAIL e `mergeStateStatus=BLOCKED`; regole `main` verificate via API | PASS |
| Preview/staging M0 disponibile prima dei consumer deployabili | spec §§29.3–29.4, §30, §31 `BL-080`; DoD §35.1 | BL-003, BL-080, GATE-M0 | provider/IaC, environment e deploy workflow (`planned`) | contract deploy, smoke shell/health, negative config e rollback (`planned`) | planned; BL-003 READY |

## UX/UI P0

| ID | Requisito normativo | Task | Codice | Test | Evidenza corrente |
|---|---|---|---|---|---|
| UX-P0-01 | Core loop completo a 320 px; baseline 360–430 px | BL-079, BL-040 | `apps/web/src/components/game/game-shell.tsx` | matrice Playwright in `apps/web/e2e/game-shell.spec.ts` | `PASS` automatico su otto viewport; device reale ancora manuale |
| UX-P0-02 | Feed conversazionale, decisione e composer dominano il primo livello | BL-079, BL-040 | `game-conversation.tsx`, `narrative-turn.tsx`, `free-action-composer.tsx` | component, long-feed e visual test | `PASS`; risposta alta apre dallo speaker, stream/reconnect restano in coda |
| UX-P0-03 | HUD secondaria in drawer/sheet; desktop senza funzioni esclusive | BL-079, BL-040 | `game-drawer.tsx`, `game-shell.tsx` | focus, safe-area, scroll e viewport matrix | `PASS`; ordine DOM condiviso e grid desktop centrata |
| UX-P0-04 | shadcn/ui `new-york` su Radix e token semantici | BL-079 | `apps/web/components.json`, globals e `components/ui/` | `tests/contracts/bl079-ui-foundation.test.mjs` | `9/9 PASS`, incluso gate performance production separato |
| UX-P0-05 | AI Elements selettivo non sostituisce `TurnView`, REST+SSE o idempotenza | BL-079, BL-040, BL-041 | `components/ai-elements/`, wrapper in `components/game/` | contract negativo su `useChat`/trasporto parallelo | `PASS`; integrazione REST/SSE resta fuori scope BL-079 |
| UX-P0-06 | Motion lazy, reduced-motion e nessuna informazione affidata all'animazione | BL-079, BL-027, BL-040 | `apps/web/src/components/motion/`, `apps/web/playwright.config.ts` | contract, hydration/reduced-motion e performance production Event Timing/LoAF | `PASS`: locale `20/20` (massimo `40 ms`, processing `14,7 ms`, CLS `0.0000246`, zero blocking LoAF) e CI `29274592866` `3/3`; dice tray reale in `BL-040` |
| UX-P0-07 | Touch target ≥44 px, primarie ≥48 px, safe area/tastiera/zoom | BL-079, BL-012, BL-019, BL-040 | token, composer, drawer e Visual Viewport | DOM/CDP/viewport test | target, safe area e keyboard proxy `PASS`; telefono reale e zoom 200% `PENDING MANUAL` |
| UX-P0-08 | Stile premium contemporaneo, non pseudo-medievale | BL-079 | token e shell in `src/app/` e `components/game/` | visual Windows/Linux, axe e review browser | baseline automatiche `PASS`; five-second review `PENDING HUMAN` |
| UX-P0-09 | Dado decorativo riproduce risultato backend e possiede fallback | BL-079, BL-040, BL-043 | `rule-result-card.tsx`, `game-motion.tsx` | domain view e reduced-motion test | fondazione visuale `PASS`; integrazione col risultato server in BL-040/BL-043 |
| UX-P0-10 | Scelte irreversibili one-shot, prerequisiti e conferma | BL-079, BL-040 | `choice-set.tsx`, `ui/alert-dialog.tsx` | `choice-set.test.tsx` | `PASS`; lock resettato soltanto su nuovo `choiceSetId` canonico |

## Criteri globali

Il mapping completo AC-01..AC-25 è definito in `docs/TASKS.md` §19 e verrà sostituito qui con riferimenti reali man mano che codice e suite vengono creati. Fino ad allora, `docs/MVP_SPEC.md` §32.3 resta l’indice normativo sintetico.

## Regola di aggiornamento

Ogni task funzionale aggiunge o aggiorna almeno una riga con path reali. Un task non passa a `DONE` se il test richiesto è soltanto `planned`, salvo che il task sia esclusivamente documentale e disponga della propria evidenza riproducibile.
