---
status: active
owner: engineering
last_reviewed: 2026-07-14
last_verified_commit: b1030501fd82d0396add5ff4f9df10fbaa405d0b
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md
related_tasks:
  - GOV-001
  - BL-001
  - BL-002
  - BL-003
  - BL-004
  - BL-079
  - BL-080
code_refs:
  - apps
  - packages
  - packages/config
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - infra/local/postgres.compose.yml
  - scripts/run-database-migrations.mjs
  - scripts/lib/database-migration-policy.mjs
  - scripts/lib/postgres-test-container.mjs
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
  - scripts/check-deployment-foundation.mjs
  - scripts/assert-vercel-preview-bootstrap-enabled.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - apps/web/app/health/route.ts
  - .github/workflows/deployment-smoke.yml
  - scripts/lib/deployment-smoke.mjs
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
  - tests/unit/database-migration-policy.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/database/database-migration-failure.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/security/database-migration-security.test.mjs
  - docs/testing/BL-004_VERIFICATION.md
supersedes: null
---

# Contesto operativo corrente

## Baseline verificata

| Campo | Valore |
|---|---|
| Data assoluta | 2026-07-14 |
| Repository | GitHub pubblico `Emacore17/dnd-ai`; remote `origin` collegato durante `BL-002` |
| Delivery/commit | `BL-080` chiuso nella documentazione tramite [PR #17](https://github.com/Emacore17/dnd-ai/pull/17): CI PR `29346630165`, merge `c72c78bbae06ebb02c7de7d63844f17065354c06` e CI post-merge `29346792492`, tutti 5/5 `SUCCESS`; readback Vercel finale project-scoped con zero deployment/alias. Il freeze resta attivo e nessun deploy Production è autorizzato. `BL-004` parte dal merge pulito `c72c78bbae06ebb02c7de7d63844f17065354c06` sul branch dedicato `codex/bl-004-persistence-baseline` |
| Specifica canonica | `docs/MVP_SPEC.md` |
| SHA-256 specifica | `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c` |
| Milestone | `M0 — Fondamenta` |
| Task attivo | `BL-004 — IN_REVIEW/90%/PARTIAL` |
| Ultimo task completato | `BL-003 — DONE/100%/PASSING` |
| Prossimo task READY | `—`; `BL-079` resta `BACKLOG` fino alla chiusura di `BL-080` |
| Stato programma | `IN_PROGRESS` |

## Stato reale del repository

`BL-001` ha creato il workspace pnpm/Turborepo con tre app; `BL-002` ha verificato pipeline/Ruleset e `BL-003` implementa `runtime-config-v1`. `BL-080` resta bloccato sul percorso Preview-only del provider e il freeze integrato non viene modificato; lo stato Vercel finale resta zero deployment/alias. `BL-004` ha ora implementato la baseline infrastrutturale: `@dnd-ai/persistence` espone manifest/status/runner a input esplicito, il composition root valida `APP_ENV` e `MIGRATION_DATABASE_URL`, PostgreSQL 17 + pgvector 0.8.2 sono pin a digest e CI usa un container reale isolato. Head, contract, source SHA e checksum vengono verificati prima del DDL; file sconosciuti e symlink falliscono chiusi. Non sono state anticipate tabelle di dominio. `BL-079` resta `BACKLOG` fino a uno staging reale.

## Decisioni operative vigenti

- Modular monolith TypeScript con `apps/web`, `apps/api`, `apps/worker` e package separati secondo `AGENTS.md` §9.
- PostgreSQL/backend deterministico sono la fonte della verità; l’AI propone e narra.
- REST per comandi/query iniziali, SSE per progress e delivery; idempotenza e `stateVersion` restano obbligatori.
- UI mobile-first e conversation-first; desktop come progressive enhancement.
- shadcn/ui `new-york` su Radix; AI Elements solo presentational layer; Motion per micro-interazioni; Rive opzionale e performance-gated.
- Visual language premium contemporaneo per casual gamer, senza chrome pseudo-medievale/fantasy.
- Workspace e direzioni di dipendenza secondo ADR-0002; manifest/import/cicli falliscono chiuso tramite checker versionato.
- Configurazione runtime server-only validata ai composition root; nessun valore secret nel client, nei default, nei log o nei documenti. ADR-0004 accepted durante `BL-003`.
- Fondazione database secondo ADR-0006: migration forward-only negli ambienti gestiti, `down` soltanto local/disposable con conferma, manifest/checksum immutabili, transazione singola e advisory lock fail-fast.
- Preview/staging web in preparazione su Vercel Hobby con Root Directory `apps/web`, compute `fra1`, Git Integration nativa, Production Branch riservata e Trusted Source exact-match. Il grant condiviso `41079282` non viene ristretto per decisione PO ed è un rischio residuo accettato. Vercel CLI `55.0.0` elimina il target Preview dal body e il provider ha restituito Production; l'applicazione della regola first-deployment, coerente con `vercel/vercel#17069`, resta un'ipotesi non confermata. Finché non esiste un fix/workaround supportato, Git auto-deploy e creazione manuale approvata restano disabilitati. Sono ammessi solo dry-run/readback/contenimento; `--archive`, `--prebuilt`, `--prod`, `promote`, `redeploy`, `--cwd apps/web` e override dei metadata sono vietati. ADR-0005 resta proposed.

Decisioni vigenti: [`ADR-0001`](adr/0001-mobile-first-conversational-ui.md), [`ADR-0002`](adr/0002-monorepo-package-boundaries.md), [`ADR-0003`](adr/0003-ci-trust-boundary-and-artifacts.md), [`ADR-0004`](adr/0004-runtime-configuration-and-secret-injection.md) e [`ADR-0006`](adr/0006-postgresql-migration-foundation.md). ADR-0005 è [`proposed`](adr/0005-vercel-web-preview-and-staging.md). Contratto di design: [`UX_UI_DESIGN.md`](product/UX_UI_DESIGN.md). Configurazione operativa: [`CONFIGURATION.md`](operations/CONFIGURATION.md), [`DATABASE_MIGRATIONS.md`](operations/DATABASE_MIGRATIONS.md) e [`PREVIEW_STAGING.md`](operations/PREVIEW_STAGING.md). Architettura implementata: [`SYSTEM_OVERVIEW.md`](architecture/SYSTEM_OVERVIEW.md).

## Versioni e head

| Elemento | Versione/head | Stato |
|---|---|---|
| Migration head | `000001_postgresql_foundation` | baseline infrastrutturale implementata e testata su PostgreSQL reale; contract `database-baseline-v1`, source SHA `e8543d84…45fc7`, checksum `46a2bb9c…dc449` |
| Contract/API/event schema | `N/A` | package contracts presente come scaffold; schema non implementati |
| Rules version | `N/A` | package rules presente come scaffold; cataloghi/formule non implementati |
| Prompt version | `N/A` | package AI presente come scaffold; prompt/provider non implementati |
| Eval suite version | `N/A` | harness non creato |
| Runtime config contract | `runtime-config-v1` | parser/config CLI e composition root implementati; test mirati PASS; nessun secret reale |
| Deploy/health contract | `staging-foundation-v1` / `web-health-v1` | contenimento, guard, payload policy e freeze integrati tramite PR #13/#14/#15/#16; manifest unlinked/fail-closed, Git e manual deploy spenti; BL-080 bloccato su fix/workaround provider Preview-only; smoke/failure/rollback-redeploy restano aperti |
| Design contract | `ux-ui-2026-07-13` | documentato, non implementato |
| ADR UI | `ADR-0001 accepted` | vigente |
| Toolchain | Node `24.11.0` (engine `>=22.12.0`); pnpm `10.34.5`; Turbo `2.10.4`; TypeScript `6.0.3`; PostgreSQL `17`; pgvector `0.8.2`; node-pg-migrate `8.0.4`; pg `8.22.0`; Docker `29.2.1` | pinning e lockfile presenti; immagine DB pin a digest |
| Web/API | Next `16.2.10`; React `19.2.7`; Fastify `5.10.0` | web scaffold; API senza route ma con startup validate-before-bind |
| Package boundary policy | `boundary-policy-v1` | checker + fixture negativa presenti |
| Task graph policy | `task-graph-v1` | ID, range, status, parity spec e consumer UX verificati |
| CI policy | `ci-policy-v1` | contenimento integrato con PR #13; run `29332953627` e `29333105276` 5/5 `SUCCESS`; gate base + `deploy:check`, workflow smoke Production rifiutato e target metadata inclusi nella chiave cache del build |
| Main Ruleset | `main-required-ci` / `18877721` | active, strict, PR richiesta, nessun bypass; check GitHub Actions `integration_id=15368` |
| Release Ruleset | `release-production-required-ci` / `18926413` | branch `release/production` creato da `ef803add249d16ded6f94936c59531047c8a92fa`; active, `CI / Merge gate` strict, `current_user_can_bypass=never`; Ruleset main invariata |
| Artifact schema | `build-artifact-v1` | baseline remota BL-002 `3.205` file; checkout pulito BL-003 `3.554` file e CI Ubuntu `3.233` file, secret/checksum verification PASS |

## Comandi disponibili

Sono disponibili i comandi locali del perimetro `BL-001`/`BL-002`/`BL-003`/`BL-004`/`BL-080`:

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
corepack pnpm@10.34.5 deploy:check
corepack pnpm@10.34.5 deploy:check:linked
corepack pnpm@10.34.5 deploy:smoke
corepack pnpm@10.34.5 scan:sast
corepack pnpm@10.34.5 scan:secrets
corepack pnpm@10.34.5 artifact:prepare
corepack pnpm@10.34.5 artifact:verify
corepack pnpm@10.34.5 config:check
corepack pnpm@10.34.5 db:local:up
corepack pnpm@10.34.5 db:migrate:status:local
corepack pnpm@10.34.5 db:migrate:local
corepack pnpm@10.34.5 db:rollback:local
corepack pnpm@10.34.5 db:local:down
corepack pnpm@10.34.5 db:migrate:test
corepack pnpm@10.34.5 verify
```

E2E, eval, bot, load e il test harness container/browser generale restano pianificati nei task proprietari, soprattutto `QA-001`; non vanno sostituiti da no-op. La suite migration è reale e fa parte di `verify`/CI; il harness condiviso futuro potrà consolidarne il lifecycle senza cambiare il contratto.

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
- Il target provider effettivo blocca `BL-080`: il client Vercel `17.6.4` omette intenzionalmente il target Preview dalla POST e il provider ha restituito Production. L'issue pubblica `vercel/vercel#17069` conferma una riproduzione CLI indipendente, ma non contiene ancora risposta/fix del maintainer né prova la causa server. Nessuna riattivazione Git o manuale è ammessa finché **non** esiste un percorso Preview-only supportato e verificabile in PR separata. Il piano/account Hobby resta vincolato all'identità esclusiva e l'installazione condivisa non viene ristretta per decisione PO.

Il dettaglio cromatico finale e l’eventuale uso di Rive non sono blocchi di prodotto: `BL-079` deve validarli tramite contrast/performance gate e può scegliere il fallback più semplice.

## Rischi correnti

| ID | Rischio | Mitigazione/owner |
|---|---|---|
| CTX-R02 | `tasks:check` copre il grafo, non l’intero `docs:check` | `GOV-002` estende a link/front matter/Mermaid/generated drift |
| CTX-R03 | App e package di dominio restano scaffold; il web non contiene ancora la foundation UX/UI | task M0 proprietari; non inferire comportamento applicativo dalle entry point minime |
| CTX-R04 | Mobile UX potrebbe essere implementata tardi | `BL-079` resta in M0 e dipende dalla foundation operativa `BL-080` |
| CTX-R05 | Motion/Rive possono degradare device mobili | Motion lazy/reduced e Rive gated o rimosso nel task `BL-079` |
| CTX-R11 | Preview/staging M0 non è ancora disponibile; `BL-070` arriverebbe troppo tardi | `BL-080` è `BLOCKED/50%/PARTIAL` sull'assenza di un percorso first-deployment Preview-only supportato; freeze integrato e BL-079/GATE-M0 non sbloccati |
| CTX-R13 | Config errata o troppo ampia può esporre credenziali fra servizi o negli errori | `BL-003` usa parser service-scoped, messaggi redatti, template separati e scanner path-based/ignore-aware |
| CTX-R14 | L'installazione condivisa `41079282` vede 8 repository e non può essere ristretta senza togliere accesso ad altri progetti; un owner può bypassare l'interlock procedurale e invocare direttamente CLI/UI | Controlli project-level, Git disabilitato, `manualDeployment.enabled=false`, runbook fail-closed e divieto esplicito di deploy reale; l'interlock non viene presentato come enforcement provider |
| CTX-R16 | Il client Vercel omette il target Preview e il provider ha restituito due record Production; la causa server resta non confermata | Entrambi rimossi; freeze PR #16 integrato; riapertura solo con fix/workaround provider supportato, containment testato e PR separata |
| CTX-R17 | Il CLI dalla root può includere cache/output ignorati da Git e superare limiti o ampliare il payload | `.vercelignore` root-only e dry-run JSON fail-closed con budget/path/input obbligatori; contratto integrato in PR #15 e dry-run corrente PASS |
| CTX-R18 | La suite migration richiede Docker e il primo upgrade da una versione applicata non è rappresentabile finché esiste soltanto `000001` | Harness bounded con cleanup fail-closed; zero→head/replay/rollback coperti ora, previous→head obbligatorio all'introduzione di `000002` |

## Prossima azione

Completare `BL-004` sul branch `codex/bl-004-persistence-baseline`: commit `b103050` verificato da worktree pulito con install frozen e full gate senza cache; resta pubblicare la PR protetta e acquisire CI verde. Conservare invariati freeze Vercel e stato `BACKLOG` di `BL-079`; dopo la chiusura rendere `BL-008` il solo task `READY`.

## Rischi chiusi

| ID | Chiusura | Evidenza |
|---|---|---|
| CTX-R01 | Git inizializzato e clean-worktree verification completata | commit `6cda07a60022665f321b48dd82fbeb1d9bef586f`; `docs/testing/BL-001_VERIFICATION.md` |
| CTX-R08 | BL-002 verificato da worktree detached pulito con install frozen e cache forzata off | head `7c6c7071d027c55aeffbc7279b8ca3765ea26c37`; `TURBO_FORCE=true pnpm verify` exit `0` in 66,0 s |
| CTX-R06 | Pipeline e failure path verificati realmente su GitHub | PR #1/run `29257544214` tutti verdi; PR #3/run `29256736728` con tests/gate rossi, build skipped e merge state `BLOCKED`; post-merge run `29257721274` PASS |
| CTX-R07 | Blocco del piano privato rimosso dal Product Owner e enforcement attivato | repository pubblico; Ruleset `18877721` active/strict/no bypass; regole applicabili a `main` verificate via API |
| CTX-R12 | Configurazione runtime BL-003 verificata localmente, da checkout pulito e su Linux | head `f571413`; clean verify `61,0 s`; run `29285998646` 5/5 job PASS; failure path FIFO `29285442650` registrato e corretto |
| CTX-R15 | Production Branch Vercel separata da `main` prima dell'attivazione | CLI Vercel `55.0.0`: `Production → release/production`; lista deployment vuota; branch GitHub protetta da Ruleset `18926413` |
