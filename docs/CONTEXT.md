---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: f1be878b291a535ea6c8e0d995ee5e3c80ef164c
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md
related_tasks:
  - GOV-001
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
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/unit/build-artifact.test.mjs
  - tests/security/sast-config.test.mjs
  - tests/security/secret-scanner.test.mjs
  - docs/testing/BL-002_VERIFICATION.md
supersedes: null
---

# Contesto operativo corrente

## Baseline verificata

| Campo | Valore |
|---|---|
| Data assoluta | 2026-07-13 |
| Repository | GitHub pubblico `Emacore17/dnd-ai`; remote `origin` collegato durante `BL-002` |
| Delivery/commit | PR #1 verso `main`; verified CI head `f1be878b291a535ea6c8e0d995ee5e3c80ef164c`; implementation head pulito `7c6c7071d027c55aeffbc7279b8ca3765ea26c37` |
| Specifica canonica | `docs/MVP_SPEC.md` |
| SHA-256 specifica | `ed2c7882f94fa751e30dc6f1c73e279388891d7e0fcd686db30aad3b565096f6` |
| Milestone | `M0 — Fondamenta` |
| Task attivo | `—` |
| Ultimo task completato | `BL-002 — DONE/PASSING` |
| Prossimo task READY | `BL-079 — Fondazione design system e shell conversazionale mobile-first` |
| Stato programma | `IN_PROGRESS` |

## Stato reale del repository

`BL-001` ha creato il workspace pnpm/Turborepo con tre app, sette package, lockfile e controlli automatici dei confini e del task graph. `BL-002` ha aggiunto e verificato localmente e su GitHub la pipeline, inclusi artifact e failure path; la Ruleset di `main` è ora attiva e una PR negativa ha confermato il blocco reale del merge. Le entry point applicative restano intenzionalmente minime: migration, contratti di dominio implementati, queue e configurazioni di ambiente sono assenti e non vanno inferiti.

## Decisioni operative vigenti

- Modular monolith TypeScript con `apps/web`, `apps/api`, `apps/worker` e package separati secondo `AGENTS.md` §9.
- PostgreSQL/backend deterministico sono la fonte della verità; l’AI propone e narra.
- REST per comandi/query iniziali, SSE per progress e delivery; idempotenza e `stateVersion` restano obbligatori.
- UI mobile-first e conversation-first; desktop come progressive enhancement.
- shadcn/ui `new-york` su Radix; AI Elements solo presentational layer; Motion per micro-interazioni; Rive opzionale e performance-gated.
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
| Design contract | `ux-ui-2026-07-13` | documentato, non implementato |
| ADR UI | `ADR-0001 accepted` | vigente |
| Toolchain | Node `24.11.0`; pnpm `10.34.5`; Turbo `2.10.4`; TypeScript `6.0.3` | pinning e lockfile presenti |
| Web/API | Next `16.2.10`; React `19.2.7`; Fastify `5.10.0` | scaffold buildabile, nessuna feature |
| Package boundary policy | `boundary-policy-v1` | checker + fixture negativa presenti |
| Task graph policy | `task-graph-v1` | ID, range, status, parity spec e consumer UX verificati |
| CI policy | `ci-policy-v1` | PR/push/merge queue; action pin; permissions; fan-in `CI / Merge gate`; run `29255261423` PASS |
| Main Ruleset | `main-required-ci` / `18877721` | active, strict, PR richiesta, nessun bypass; check GitHub Actions `integration_id=15368` |
| Artifact schema | `build-artifact-v1` | remote artifact 3.205 file, secret/checksum verification PASS |

## Comandi disponibili

Sono disponibili i comandi locali del perimetro `BL-001`/`BL-002`:

```powershell
corepack pnpm@10.34.5 lint
corepack pnpm@10.34.5 typecheck
corepack pnpm@10.34.5 build
corepack pnpm@10.34.5 format:check
corepack pnpm@10.34.5 test:unit
corepack pnpm@10.34.5 test:integration
corepack pnpm@10.34.5 test:contract
corepack pnpm@10.34.5 test:security
corepack pnpm@10.34.5 boundaries:check
corepack pnpm@10.34.5 tasks:check
corepack pnpm@10.34.5 ci:workflow:check
corepack pnpm@10.34.5 scan:sast
corepack pnpm@10.34.5 scan:secrets
corepack pnpm@10.34.5 artifact:prepare
corepack pnpm@10.34.5 artifact:verify
corepack pnpm@10.34.5 verify
```

E2E, eval, bot, load, migration e il test harness container/browser completo restano pianificati nei task proprietari, soprattutto `QA-001`; non vanno sostituiti da no-op.

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

Il dettaglio cromatico finale e l’eventuale uso di Rive non sono blocchi di prodotto: `BL-079` deve validarli tramite contrast/performance gate e può scegliere il fallback più semplice.

## Rischi correnti

| ID | Rischio | Mitigazione/owner |
|---|---|---|
| CTX-R02 | `tasks:check` copre il grafo, non l’intero `docs:check` | `GOV-002` estende a link/front matter/Mermaid/generated drift |
| CTX-R03 | App/package sono scaffold senza contratti o feature | task M0 proprietari; non inferire dominio dalle entry point vuote |
| CTX-R04 | Mobile UX potrebbe essere implementata tardi | `BL-079` in M0 e dipendenza documentale per i task UI |
| CTX-R05 | Motion/Rive possono degradare device mobili | Motion lazy/reduced; Rive gated o rimosso in `BL-079` |

## Prossima azione

Selezionare `BL-079` e implementare la fondazione UX/UI mobile-first già definita da ADR-0001 e `docs/product/UX_UI_DESIGN.md`, mantenendo shadcn/ui e AI Elements selettivi, HUD on demand, motion ridotta e i gate mobile/accessibilità/performance del task.

## Rischi chiusi

| ID | Chiusura | Evidenza |
|---|---|---|
| CTX-R01 | Git inizializzato e clean-worktree verification completata | commit `6cda07a60022665f321b48dd82fbeb1d9bef586f`; `docs/testing/BL-001_VERIFICATION.md` |
| CTX-R08 | BL-002 verificato da worktree detached pulito con install frozen e cache forzata off | head `7c6c7071d027c55aeffbc7279b8ca3765ea26c37`; `TURBO_FORCE=true pnpm verify` exit `0` in 66,0 s |
| CTX-R06 | Pipeline e failure path verificati realmente su GitHub | PR #1/run `29255261423` tutti verdi; PR #3/run `29256736728` con tests/gate rossi, build skipped e merge state `BLOCKED` |
| CTX-R07 | Blocco del piano privato rimosso dal Product Owner e enforcement attivato | repository pubblico; Ruleset `18877721` active/strict/no bypass; regole applicabili a `main` verificate via API |
