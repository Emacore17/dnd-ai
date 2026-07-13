---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: unversioned
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md
related_tasks:
  - GOV-001
  - BL-001
  - BL-079
code_refs:
  - apps
  - packages
  - scripts/lib/workspace-boundaries.mjs
  - scripts/lib/task-graph.mjs
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
supersedes: null
---

# Contesto operativo corrente

## Baseline verificata

| Campo | Valore |
|---|---|
| Data assoluta | 2026-07-13 |
| Repository | Git inizializzato durante `BL-001` |
| Branch/commit | `main`; initial commit pending |
| Specifica canonica | `docs/MVP_SPEC.md` |
| SHA-256 specifica | `5bdf152a6c535470d239ad72772603d17d53cc82cc3c02f09bf44cbe1ef47e90` |
| Milestone | `M0 — Fondamenta` |
| Task attivo | `BL-001 — IN_REVIEW (90%)` |
| Ultimo task completato | `GOV-001 — DONE/PASSING` |
| Prossimo task READY | `—`; `BL-002` dipende dalla chiusura di `BL-001` |
| Stato programma | `IN_PROGRESS` |

## Stato reale del repository

`BL-001` ha creato il workspace pnpm/Turborepo con tre app, sette package, lockfile e controlli automatici dei confini e del task graph. Le entry point sono intenzionalmente minime: migration, schema di dominio, CI, queue e configurazioni di ambiente restano assenti e non vanno inferiti.

## Decisioni operative vigenti

- Modular monolith TypeScript con `apps/web`, `apps/api`, `apps/worker` e package separati secondo `AGENTS.md` §9.
- PostgreSQL/backend deterministico sono la fonte della verità; l’AI propone e narra.
- REST per comandi/query iniziali, SSE per progress e delivery; idempotenza e `stateVersion` restano obbligatori.
- UI mobile-first e conversation-first; desktop come progressive enhancement.
- shadcn/ui `new-york` su Radix; AI Elements solo presentational layer; Motion per micro-interazioni; Rive opzionale e performance-gated.
- Visual language premium contemporaneo per casual gamer, senza chrome pseudo-medievale/fantasy.
- Workspace e direzioni di dipendenza secondo ADR-0002; manifest/import/cicli falliscono chiuso tramite checker versionato.

Decisioni complete: [`ADR-0001`](adr/0001-mobile-first-conversational-ui.md) e [`ADR-0002`](adr/0002-monorepo-package-boundaries.md). Contratto di design: [`UX_UI_DESIGN.md`](product/UX_UI_DESIGN.md). Architettura implementata: [`SYSTEM_OVERVIEW.md`](architecture/SYSTEM_OVERVIEW.md).

## Versioni e head

| Elemento | Versione/head | Stato |
|---|---|---|
| Migration head | `N/A` | persistence non creata |
| Contract/API/event schema | `N/A` | package contracts non creato |
| Rules version | `N/A` | rules package non creato |
| Prompt version | `N/A` | AI package non creato |
| Eval suite version | `N/A` | harness non creato |
| Design contract | `ux-ui-2026-07-13` | documentato, non implementato |
| ADR UI | `ADR-0001 accepted` | vigente |
| Toolchain | Node `24.11.0`; pnpm `10.34.5`; Turbo `2.10.4`; TypeScript `6.0.3` | pinning e lockfile presenti |
| Web/API | Next `16.2.10`; React `19.2.7`; Fastify `5.10.0` | scaffold buildabile, nessuna feature |
| Package boundary policy | `boundary-policy-v1` | checker + fixture negativa presenti |
| Task graph policy | `task-graph-v1` | ID, range, status, parity spec e consumer UX verificati |

## Comandi disponibili

Sono disponibili i comandi del perimetro `BL-001`:

```powershell
corepack pnpm@10.34.5 lint
corepack pnpm@10.34.5 typecheck
corepack pnpm@10.34.5 build
corepack pnpm@10.34.5 test:contract
corepack pnpm@10.34.5 boundaries:check
corepack pnpm@10.34.5 tasks:check
corepack pnpm@10.34.5 verify
```

Il contratto completo di `docs/TASKS.md` §5 resta pianificato in `BL-002`/`QA-001` e non va dichiarato completo.

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
| CTX-R01 | Repository non ancora versionato durante l’implementazione | inizializzare Git prima della clean-worktree verification di `BL-001` |
| CTX-R02 | `tasks:check` copre il grafo, non l’intero `docs:check` | `GOV-002` estende a link/front matter/Mermaid/generated drift |
| CTX-R03 | App/package sono scaffold senza contratti o feature | task M0 proprietari; non inferire dominio dalle entry point vuote |
| CTX-R04 | Mobile UX potrebbe essere implementata tardi | `BL-079` in M0 e dipendenza documentale per i task UI |
| CTX-R05 | Motion/Rive possono degradare device mobili | Motion lazy/reduced; Rive gated o rimosso in `BL-079` |

## Prossima azione

Completare `BL-001`: scaffold, test negativo dei confini, build/lint/typecheck di ogni workspace, documentazione architetturale ed evidenze. `BL-079` resta `BACKLOG` fino al completamento di `BL-001` e `BL-002`.
