---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-14
last_verified_commit: 13032743552654f9f68d87050eb11cabbdd92325
source_refs:
  - docs/MVP_SPEC.md#32-criteri-di-accettazione
  - docs/TASKS.md
  - docs/product/UX_UI_DESIGN.md
related_tasks:
  - GOV-001
  - GOV-002
  - BL-001
  - BL-002
  - BL-003
  - BL-040
  - BL-079
  - BL-080
code_refs:
  - apps
  - packages
  - packages/config
  - apps/api/src/runtime.ts
  - apps/worker/src/runtime.ts
  - scripts/lib/workspace-boundaries.mjs
  - scripts/lib/task-graph.mjs
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/lib/build-artifact.mjs
  - scripts/lib/secret-scanner.mjs
  - infra/deployment/vercel-staging.json
  - apps/web/package.json
  - apps/web/vercel.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - .vercelignore
  - turbo.json
  - .github/workflows/deployment-smoke.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/assert-vercel-preview-bootstrap-enabled.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-smoke.mjs
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
  - docs/testing/BL-001_VERIFICATION.md
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - docs/testing/BL-002_VERIFICATION.md
  - tests/unit/build-artifact.test.mjs
  - tests/unit/runtime-config.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/security/environment-file-policy.test.mjs
  - docs/testing/BL-003_VERIFICATION.md
  - tests/unit/deployment-smoke.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-preview-bootstrap-policy.test.mjs
  - tests/security/vercel-preview-bootstrap-gate.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
  - docs/testing/BL-080_VERIFICATION.md
supersedes: null
---

# Tracciabilità MVP

## Stato del registro

Il repository pubblico è versionato e collegato a `Emacore17/dnd-ai`. `BL-001` ha introdotto lo scaffold applicativo, `BL-002` pipeline/Ruleset e `BL-003` config/startup fail-fast. `BL-080` è `IN_PROGRESS/50%/FAILING`: contenimento PR #13, guard PR #14 e policy payload PR #15 sono integrati; le CI PR/post-merge della PR #15 (`29339984834`, `29340214947`) sono 5/5 verdi. Il dry-run da `main` pulita ha accettato 158 entry/1.093.594 byte, ma il successivo CLI con `--target=preview` ha creato un secondo record `target=production`, osservato `ERROR` e rimosso per ID esatto. L'activity log attribuisce il target Production alla CLI sul commit `1060228`; zero deployment/alias project-scoped per `dnd-ai-web` e origin `404` sono il readback finale. Il percorso manuale approvato è ora fail-closed tramite policy versionata, mentre Git auto-deploy resta spento. Preview/smoke/failure/redeploy restano aperti e ADR-0005 è proposed. Il grant GitHub App condiviso resta un rischio accettato, non una causa dimostrata. `BL-079` resta `BACKLOG` fino allo staging reale.

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
| Cache e artifact non espongono credenziali | spec §§22.10, 29.4; ADR-0003 | BL-002 | setup action pnpm-only, `scripts/lib/secret-scanner.mjs`, `scripts/lib/build-artifact.mjs` | remote manifest `build-artifact-v1`, 3.205 file e checksum/secret verification; report BL-002 | PASS |
| Log CI non espongono credenziali | spec §§22.10, 29.4; ADR-0003 | BL-002 | workflow senza secret applicativi; output scanner redatto | scan redatto dei 5 job della run `29254494868` | PASS |
| Gate fallito rende la PR non mergeabile | spec §31 `BL-002`; card BL-002 | BL-002 | Ruleset `main-required-ci` `18877721` | PR negativa #3/run `29256736728`: gate FAIL e `mergeStateStatus=BLOCKED`; regole `main` verificate via API | PASS |
| Config runtime tipizzata e service-scoped | spec §§5, 22.10, 29.3; ADR-0004 | BL-003 | `packages/config`, API/worker composition root | unit 7/7; integration process 5/5; full verify locale/clean; CI `29285998646`; report BL-003 | DONE; PASS locale/clean/CI |
| Startup fallisce prima degli effetti su config mancante/malformata | spec §31 `BL-003`; card BL-003 | BL-003 | `apps/api/src/runtime.ts`, `apps/api/src/start.ts`, `apps/worker/src/runtime.ts` | listener reale, factory/initializer ordering, exit non-zero | PASS mirato |
| Secret template/injection senza leakage | spec §22.10; ADR-0004 | BL-003, BL-080 | template service-scoped, scanner fail-closed; web con zero secret/variabili applicative; Git Integration reale senza token Vercel persistente; emissione OIDC e Trusted Source exact-match abilitate | config/security suite; environment GitHub e progetto Vercel con zero secret applicativi; token mancante/malformato fail-before-fetch | BL-003 PASS; BL-080 boundary/trust OIDC PASS, activation parziale |
| Preview/staging M0 disponibile prima dei consumer deployabili | spec §§29.3–29.4, §30, §31 `BL-080`; DoD §35.1 | BL-003, BL-080, GATE-M0 | foundation, `/health`, progetto collegato, protezioni, Git auto-deploy spento e guard Preview-only | PR #12 e CLI su `1060228` entrambi Production/rimossi; PR #13/#14/#15 integrate; run PR15 `29339984834` e post-merge `29340214947` verdi; `dnd-ai-web` project-scoped a zero deployment/alias | BL-080 FAILING; nessuno staging; prova Preview ancora aperta; BL-079 BACKLOG |
| Build provider limitato a Preview senza leakage | spec §§22.10, 29.3–29.4; ADR-0005 proposed | BL-080 | `apps/web/vercel.json`, build script dedicato, policy pura e target metadata nella cache Turbo | unit policy, security subprocess e contract deployment versionati; build Vercel richiede `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`; locale ammesso solo con tutti assenti | guard integrato; secondo record Production `ERROR`, ma log post-rimozione insufficienti per attribuire l'errore al guard |
| Payload CLI minimo e verificato prima di creare deployment | spec §§22.10, 29.3–29.4; ADR-0005 proposed | BL-080 | `.vercelignore`, dry-run parser e deployment foundation contract | test unit/security/contract; dry-run `nextjs` dalla root con 158 entry e 1.093.594 byte; mode/hash/symlink, cache/output/env/path non relativi e budget oltre soglia falliscono chiusi | PR #15/merge `1060228`, CI PR/post-merge verdi; contratto payload PASS |
| Creazione manuale fail-closed nel percorso approvato | spec §§29.3–29.4, §31 `BL-080`; ADR-0005 proposed | BL-080 | `source.manualDeployment.enabled=false`, `scripts/assert-vercel-preview-bootstrap-enabled.mjs` | unit policy, security subprocess statico e contract manifest; `deploy:bootstrap:check` expected exit `1` | interlock procedurale PASS; non è enforcement provider contro owner; nuovo deploy vietato fino a PR di riapertura |
| Deploy web riconducibile a project/deployment/SHA/ref/repository/regione | spec §29.4; ADR-0005 proposed | BL-080 | `web-health-v1`, smoke fail-closed, manifest unlinked dopo PR #13 | dispatch Production rifiutato; run `29331534774` skipped; secondo record senza nuovo smoke; URL/alias rimossi `404` | controllo di rifiuto PASS; requisito Preview FAILING |

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
