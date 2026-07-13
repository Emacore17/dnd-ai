---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: d530f3a0bab8cc20b8eee9f63ef222e6c4bb19f8
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md
related_tasks:
  - GOV-001
  - BL-001
  - BL-002
  - BL-003
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
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/integration/artifact-runtime.test.mjs
  - tests/unit/build-artifact.test.mjs
  - tests/security/sast-config.test.mjs
  - tests/security/secret-scanner.test.mjs
  - docs/testing/BL-002_VERIFICATION.md
  - tests/contracts/bl079-ui-foundation.test.mjs
  - apps/web/src/components/game/game-shell.test.tsx
  - apps/web/e2e/game-shell.spec.ts
  - docs/testing/BL-079_VERIFICATION.md
supersedes: null
---

# Contesto operativo corrente

## Baseline verificata

| Campo | Valore |
|---|---|
| Data assoluta | 2026-07-13 |
| Repository | GitHub pubblico `Emacore17/dnd-ai`; remote `origin` collegato durante `BL-002` |
| Delivery/commit | `main` sincronizzato a `d530f3a0bab8cc20b8eee9f63ef222e6c4bb19f8`; branch attivo `codex/bl-079-mobile-shell` |
| Specifica canonica | `docs/MVP_SPEC.md` |
| SHA-256 specifica | `960ac78b25e5c343d53a05bf8e986acfa0e72f9d4884c06127256885260e1599` |
| Milestone | `M0 — Fondamenta` |
| Task attivo | `BL-079 — IN_REVIEW/90%/PARTIAL` |
| Ultimo task completato | `BL-002 — DONE/PASSING` |
| Prossimo task READY | `BL-003`; BL-079 resta in review senza fermare il lavoro indipendente |
| Stato programma | `IN_PROGRESS` |

## Stato reale del repository

`BL-001` ha creato il workspace pnpm/Turborepo con tre app, sette package, lockfile e controlli automatici dei confini e del task graph. `BL-002` ha aggiunto e verificato localmente e su GitHub pipeline, artifact, failure path e Ruleset. `BL-079` ha implementato nel working tree la fondazione web: design system shadcn/Radix, shell conversazionale mobile-first, fixture dei dieci stati, motion riducibile e harness component/browser. Contract, component, Playwright, axe, visual multipiattaforma, build e performance smoke sono verdi; il task è in review perché i gate umani, device/browser reali, commit pulito, CI e lo staging posseduto dal nuovo `BL-080` non sono ancora attestati. `BL-003` è il prossimo task eseguibile e sblocca la configurazione necessaria a `BL-080`.

## Decisioni operative vigenti

- Modular monolith TypeScript con `apps/web`, `apps/api`, `apps/worker` e package separati secondo `AGENTS.md` §9.
- PostgreSQL/backend deterministico sono la fonte della verità; l’AI propone e narra.
- REST per comandi/query iniziali, SSE per progress e delivery; idempotenza e `stateVersion` restano obbligatori.
- UI mobile-first e conversation-first; desktop come progressive enhancement.
- shadcn/ui `new-york` su Radix; AI Elements solo presentational layer; Motion per micro-interazioni; Rive escluso dalla shell P0 dopo il performance gate BL-079.
- Visual language premium contemporaneo per casual gamer, senza chrome pseudo-medievale/fantasy.
- Workspace e direzioni di dipendenza secondo ADR-0002; manifest/import/cicli falliscono chiuso tramite checker versionato.

Decisioni complete: [`ADR-0001`](adr/0001-mobile-first-conversational-ui.md), [`ADR-0002`](adr/0002-monorepo-package-boundaries.md) e [`ADR-0003`](adr/0003-ci-trust-boundary-and-artifacts.md). Contratto di design: [`UX_UI_DESIGN.md`](product/UX_UI_DESIGN.md). Architettura implementata: [`SYSTEM_OVERVIEW.md`](architecture/SYSTEM_OVERVIEW.md).

## Versioni e head

| Elemento | Versione/head | Stato |
|---|---|---|
| Migration head | `N/A` | package persistence presente come scaffold; migration non implementate |
| Contract/API/event schema | `N/A` | package contracts presente come scaffold; schema non implementati |
| Rules version | `N/A` | package rules presente come scaffold; cataloghi/formule non implementati |
| Prompt version | `N/A` | package AI presente come scaffold; prompt/provider non implementati |
| Eval suite version | `N/A` | harness non creato |
| Design contract | `ux-ui-2026-07-13` | implementato e automaticamente verificato; gate manuali BL-079 aperti |
| ADR UI | `ADR-0001 accepted` | vigente |
| Toolchain | Node `24.11.0`; pnpm `10.34.5`; Turbo `2.10.4`; TypeScript `6.0.3` | pinning e lockfile presenti |
| Web/API | Next `16.2.10`; React `19.2.7`; Fastify `5.10.0` | shell fixture web implementata; API ancora scaffold |
| UI foundation | shadcn `4.13.0`; Radix `1.6.2`; Tailwind `4.3.2`; Motion `12.42.2`; Streamdown `2.5.0` | BL-079 automatic gates `PASS`; Rive assente |
| Package boundary policy | `boundary-policy-v1` | checker + fixture negativa presenti |
| Task graph policy | `task-graph-v1` | ID, range, status, parity spec e consumer UX verificati |
| CI policy | `ci-policy-v1` | PR/push/merge queue; action pin; permissions; fan-in `CI / Merge gate`; post-merge run `29257721274` PASS |
| Main Ruleset | `main-required-ci` / `18877721` | active, strict, PR richiesta, nessun bypass; check GitHub Actions `integration_id=15368` |
| Artifact schema | `build-artifact-v1` | baseline remota BL-002 `3.205` file; working tree `3.172` file con secret/checksum e boot HTTP `PASS` |

## Comandi disponibili

Sono disponibili i comandi locali del perimetro `BL-001`/`BL-002`:

```powershell
corepack pnpm@10.34.5 lint
corepack pnpm@10.34.5 typecheck
corepack pnpm@10.34.5 build
corepack pnpm@10.34.5 format:check
corepack pnpm@10.34.5 test:unit
corepack pnpm@10.34.5 test:component
corepack pnpm@10.34.5 test:integration
corepack pnpm@10.34.5 test:contract
corepack pnpm@10.34.5 test:e2e
corepack pnpm@10.34.5 test:security
corepack pnpm@10.34.5 boundaries:check
corepack pnpm@10.34.5 tasks:check
corepack pnpm@10.34.5 ci:workflow:check
corepack pnpm@10.34.5 scan:sast
corepack pnpm@10.34.5 scan:secrets
corepack pnpm@10.34.5 artifact:prepare
corepack pnpm@10.34.5 artifact:verify
corepack pnpm@10.34.5 artifact:smoke
corepack pnpm@10.34.5 verify
corepack pnpm@10.34.5 --filter @dnd-ai/web analyze
```

Il component/browser harness minimo di BL-079 è reale e gira in CI; `QA-001` lo consoliderà per tutte le feature. Eval, bot, load e migration restano pianificati nei task proprietari e non vanno sostituiti da no-op.

Verifiche documentali manuali correnti:

```powershell
Get-FileHash -Algorithm SHA256 docs\MVP_SPEC.md
Get-ChildItem -Recurse -Filter *.md
```

Il report riproducibile di `GOV-001` è `AGENTS_VALIDATION.txt`.

## Decisioni aperte

Le decisioni `OD-01..OD-20` restano in `docs/MVP_SPEC.md` §34. Quelle che possono bloccare M0 sono soprattutto:

- `OD-07` auth build vs managed;
- `OD-08` regione dati/telemetry.

Il dettaglio cromatico può evolvere tramite token. Rive non è adottato nella shell P0 dopo il gate BL-079; una reintroduzione richiede task/ADR, lazy loading isolato e benchmark.

## Rischi correnti

| ID | Rischio | Mitigazione/owner |
|---|---|---|
| CTX-R02 | `tasks:check` copre il grafo, non l’intero `docs:check` | `GOV-002` estende a link/front matter/Mermaid/generated drift |
| CTX-R03 | API, worker e package di dominio restano scaffold; il web contiene la fondazione BL-079 | task M0 proprietari; non inferire comportamento backend dalla shell fixture |
| CTX-R09 | I gate automatici non sostituiscono screen reader, device, browser e comprensione umana | completare la matrice residua del report BL-079 prima di `DONE` |
| CTX-R10 | Baseline UI first-load da 365.057 byte gzip può crescere con i consumer | confronto bundle obbligatorio; crescita >10% richiede misura e review |
| CTX-R11 | Preview/staging M0 non è ancora disponibile; `BL-070` arriverebbe troppo tardi | `BL-003` READY, quindi `BL-080` crea l'ambiente e sblocca lo smoke BL-079/GATE-M0 |

## Prossima azione

Chiudere il gate tecnico e congelare un commit pulito di BL-079; mantenere aperti screen reader, telefono/zoom, browser e five-second review. Avviare quindi `BL-003`, che sblocca `BL-080` per provisioning e smoke preview/staging senza attribuire quel lavoro al tardo hardening `BL-070`.

## Rischi chiusi

| ID | Chiusura | Evidenza |
|---|---|---|
| CTX-R01 | Git inizializzato e clean-worktree verification completata | commit `6cda07a60022665f321b48dd82fbeb1d9bef586f`; `docs/testing/BL-001_VERIFICATION.md` |
| CTX-R08 | BL-002 verificato da worktree detached pulito con install frozen e cache forzata off | head `7c6c7071d027c55aeffbc7279b8ca3765ea26c37`; `TURBO_FORCE=true pnpm verify` exit `0` in 66,0 s |
| CTX-R06 | Pipeline e failure path verificati realmente su GitHub | PR #1/run `29257544214` tutti verdi; PR #3/run `29256736728` con tests/gate rossi, build skipped e merge state `BLOCKED`; post-merge run `29257721274` PASS |
| CTX-R07 | Blocco del piano privato rimosso dal Product Owner e enforcement attivato | repository pubblico; Ruleset `18877721` active/strict/no bypass; regole applicabili a `main` verificate via API |
| CTX-R04 | La fondazione mobile non è più differita | shell 320–1440, landscape, keyboard proxy e safe area automatici `PASS`; report BL-079 |
| CTX-R05 | Runtime visuale contenuto e misurato | Motion lazy/reduced con performance smoke verde; Rive escluso dalla shell P0 |
