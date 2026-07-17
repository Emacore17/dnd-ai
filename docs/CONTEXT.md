---
status: active
owner: engineering
last_reviewed: 2026-07-17
last_verified_commit: e173fd9424ad77330ae8302f68affd4832d66798
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md
  - docs/adr/0007-observability-context-and-error-reporting.md
  - docs/adr/0008-zod-first-contract-generation.md
  - docs/adr/0009-mvp-runtime-data-and-workflow-architecture.md
  - docs/adr/0010-internal-provider-neutral-identity.md
  - docs/superpowers/specs/2026-07-15-bl-008-observability-baseline-design.md
  - docs/superpowers/specs/2026-07-15-bl-009-contract-generation-design.md
  - docs/superpowers/specs/2026-07-15-bl-010-feature-flags-design.md
  - docs/superpowers/specs/2026-07-16-qa-001-test-foundation-design.md
  - docs/superpowers/specs/2026-07-16-doc-arch-001-design.md
  - docs/superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
  - docs/superpowers/specs/2026-07-16-bl-006-session-access-design.md
  - docs/superpowers/plans/2026-07-17-bl-006-session-access.md
related_tasks:
  - GOV-001
  - GOV-002
  - GOV-003
  - GOV-004
  - BL-001
  - BL-002
  - BL-003
  - BL-004
  - BL-005
  - BL-006
  - BL-008
  - BL-009
  - BL-010
  - BL-079
  - BL-080
  - BL-081
  - QA-001
  - QA-002
  - DOC-ARCH-001
code_refs:
  - apps
  - packages
  - packages/observability
  - packages/observability/src/node.ts
  - packages/observability/src/tracing.ts
  - packages/observability/src/logger.ts
  - packages/observability/src/redaction.ts
  - packages/contracts/src
  - packages/contracts/generated/v1
  - packages/contracts/generated/v2
  - packages/contracts/generated/v3
  - scripts/generate-contracts.mjs
  - scripts/lib/contract-artifact-policy.mjs
  - scripts/lib/contract-compatibility-policy.mjs
  - scripts/lib/owned-path-policy.mjs
  - apps/api/src/observability.ts
  - apps/worker/src/observability.ts
  - apps/web/instrumentation.ts
  - apps/web/instrumentation-client.ts
  - packages/config
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/feature-flags.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - packages/persistence/src/migrations/000003_identity_signup.ts
  - packages/persistence/src/identity-store.ts
  - infra/local/postgres.compose.yml
  - scripts/run-database-migrations.mjs
  - scripts/manage-feature-flag.mjs
  - scripts/lib/database-migration-policy.mjs
  - scripts/lib/postgres-test-container.mjs
  - packages/testing/src
  - scripts/run-tests.mjs
  - scripts/lib/test-report-policy.mjs
  - apps/api/src/runtime.ts
  - apps/worker/src/runtime.ts
  - apps/api/src/identity
  - apps/worker/src/identity
  - apps/web/app/sign-up
  - apps/web/app/verify-email
  - apps/web/app/api/auth
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
  - package.json
  - scripts/check-docs.mjs
  - scripts/lib/document-policy.mjs
  - scripts/lib/document-integrity-policy.mjs
  - scripts/lib/markdown-document.mjs
  - scripts/lib/mermaid-policy.mjs
  - scripts/validate-mermaid-worker.mjs
  - scripts/verify-affected.mjs
  - scripts/lib/affected-verification.mjs
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
  - tests/database/feature-flags.test.mjs
  - tests/security/database-migration-security.test.mjs
  - tests/unit/feature-flags.test.mjs
  - tests/security/feature-flags-security.test.mjs
  - docs/testing/BL-004_VERIFICATION.md
  - docs/testing/TEST_STRATEGY.md
  - tests/unit/testing-primitives.test.mjs
  - tests/unit/test-container-lifecycle.test.mjs
  - tests/unit/test-report-policy.test.mjs
  - tests/integration/test-runner.test.mjs
  - tests/integration/testing-containers.test.mjs
  - tests/contracts/testing-package-contract.test.mjs
  - tests/security/test-report-security.test.mjs
  - tests/contracts/agent-workflow-contract.test.mjs
  - tests/contracts/document-policy.test.mjs
  - tests/contracts/document-integrity.test.mjs
  - tests/unit/affected-verification.test.mjs
  - tests/unit/observability-core.test.mjs
  - tests/unit/observability-node.test.mjs
  - tests/integration/observability-flow.test.mjs
  - tests/contracts/observability-contract.test.mjs
  - tests/security/observability-security.test.mjs
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/contracts-runtime.test.mjs
  - tests/contracts/contracts-artifacts.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/contracts/identity-contracts.test.mjs
  - tests/contracts/web-identity-ui.test.mjs
  - tests/integration/identity-signup-flow.test.mjs
  - tests/security/identity-api-security.test.mjs
  - tests/security/identity-email-security.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/unit/owned-path-policy.test.mjs
  - tests/contracts/architecture-documentation.test.mjs
supersedes: null
---

# Contesto operativo corrente

## Baseline verificata

| Campo | Valore |
|---|---|
| Data assoluta | 2026-07-16 |
| Repository | GitHub pubblico `Emacore17/dnd-ai`; remote `origin` collegato durante `BL-002` |
| Delivery/commit | `BL-005` è integrato su `main` tramite [PR #28](https://github.com/Emacore17/dnd-ai/pull/28), candidate corretto `c2e4332b408f1cac3e2c69920cd18e5e772e87bf`, merge `e173fd9424ad77330ae8302f68affd4832d66798` e CI PR/post-merge `29525777416`/`29526030389` con cinque job `SUCCESS`. `BL-006` usa questa baseline in una worktree isolata; il primo batch contract/config/domain/crypto è implementato e verificato localmente, senza delivery remota. `BL-080` resta bloccato/congelato e nessun deploy Production è autorizzato. |
| Specifica canonica | `docs/MVP_SPEC.md` |
| SHA-256 specifica | `737fcb7380282c0e36e8aa4d0c310ae5b257b27ab38cd24ac46b06d80e69d80b` |
| Milestone | `M0 — Fondamenta` |
| Task attivo | `BL-006 — IN_PROGRESS/25%/PARTIAL`; contract artifact `v3`, config/domain e primitive reset verdi; migration `000004` successiva |
| Ultimo task completato | `BL-005 — DONE/100%/PASSING`, integrato tramite PR #28 e CI post-merge `29526030389` |
| Prossimo task READY | `BL-081`; non avviarlo mentre `BL-006` è attivo |
| Migration head | `000003_identity_signup` / `database-identity-signup-v1` su `main`; BL-006 pianifica `000004_identity_access` / `database-identity-access-v1` |
| Stato programma | `IN_PROGRESS` |

## Stato reale del repository

`BL-001` ha creato il workspace pnpm/Turborepo con tre app; `BL-002` ha verificato pipeline/Ruleset, `BL-003` implementa `runtime-config-v1` e `BL-004` la baseline PostgreSQL. `GOV-002`, `GOV-003`, `GOV-004`, `BL-005`, `BL-008`, `BL-009`, `BL-010`, `BL-079`, `QA-001` e `DOC-ARCH-001` sono integrati e verificati su `main`. `BL-079` fornisce Tailwind v4, shadcn `new-york`/Radix, Geist/Lucide, token semantic-first e shell statica server-rendered; `BL-081` resta owner di AI Elements, interazione e Motion. `BL-005` implementa signup/verify/resend, sessione iniziale, migration PostgreSQL, outbox email, BFF e form shadcn. `BL-006` ha pubblicato sulla branch il contract `v3`, le porte pure, la config reset service-scoped e le primitive HMAC/token; store, migration, route, outbox reset e UI restano da implementare. Redis locale applicativo, BullMQ, route di gioco, SSE e staging **non sono disponibili**. Il Redis effimero di `QA-001` è soltanto una risorsa del test harness. Non sono stati creati account applicativi, exporter remoti o nuovi deploy.

## Decisioni operative vigenti

- Modular monolith TypeScript con `apps/web`, `apps/api`, `apps/worker` e package separati secondo `AGENTS.md` §9.
- PostgreSQL/backend deterministico sono la fonte della verità; l’AI propone e narra.
- REST per comandi/query iniziali, SSE per progress e delivery; idempotenza e `stateVersion` restano obbligatori.
- UI mobile-first e conversation-first; desktop come progressive enhancement.
- shadcn/ui `new-york` su Radix; AI Elements solo presentational layer; Motion per micro-interazioni; Rive opzionale e performance-gated.
- Visual language premium contemporaneo per casual gamer, senza chrome pseudo-medievale/fantasy.
- Workspace e direzioni di dipendenza secondo ADR-0002; manifest/import/cicli falliscono chiuso tramite checker versionato.
- Configurazione runtime server-only validata ai composition root; il BFF web valida inoltre la propria superficie minima senza dipendere dal package `config`. Il subject client attraversa BFF→API soltanto come HMAC firmato a vita breve; nessun IP raw o valore secret entra nel client, nei default, nei log o nei documenti. ADR-0004 accepted durante `BL-003`.
- OpenTelemetry è l'unica autorità trace; Pino usa un vocabolario allowlisted e Sentry resta error-only opzionale/off-by-default, con export browser/Node separati e failure containment secondo ADR-0007.
- Fondazione database secondo ADR-0006: migration forward-only negli ambienti gestiti, `down` soltanto local/disposable con conferma, manifest/checksum immutabili, transazione singola e advisory lock fail-fast.
- Contratti Zod-first secondo ADR-0008: JSON Schema 2020-12 e OpenAPI 3.1.1 vengono generati dallo stesso catalogo; `v1` e `v2` restano immutabili. La branch BL-006 genera `v3` con le nove operazioni auth senza modificare i major esistenti; finché la slice non è terminale, l'artifact descrive il contratto candidato e non disponibilità runtime completa. La CI rifiuta drift o modifiche a major già pubblicati rispetto alla base protetta.
- Architettura runtime/data/workflow secondo ADR-0009: processi separabili dello stesso modular monolith, Fastify, REST+SSE, PostgreSQL autorevole, Redis non autorevole, eventi+proiezioni atomici e BullMQ/outbox come target. L'ADR espone lo stato di adozione e non trasforma capability pianificate in runtime disponibile.
- Identità P0 interna provider-neutral secondo ADR-0010: PostgreSQL autorevole, password Argon2id con pepper versionato, codici email one-time e SMTP dietro adapter/outbox. BL-006 adotta sessioni idle 24 h/absolute 30 giorni, rotazione esplicita, logout/revoca globale e reset a sei cifre senza auto-login; nessun provider o account remoto è richiesto.
- Preview/staging web non disponibile su Vercel Hobby. Root Directory, regione, Production Branch riservata e Trusted Source sono configurate, ma il grant condiviso `41079282` non viene ristretto per decisione PO ed è un rischio residuo accettato. Vercel CLI `55.0.0` elimina il target Preview dal body e il provider ha restituito Production; l'applicazione della regola first-deployment, coerente con `vercel/vercel#17069`, resta un'ipotesi non confermata. Finché non esiste un fix/workaround supportato, Git auto-deploy e creazione manuale approvata restano disabilitati. Sono ammessi solo dry-run/readback/contenimento; `--archive`, `--prebuilt`, `--prod`, `promote`, `redeploy`, `--cwd apps/web` e override dei metadata sono vietati. ADR-0005 resta proposed.

Decisioni vigenti: [`ADR-0001`](adr/0001-mobile-first-conversational-ui.md), [`ADR-0002`](adr/0002-monorepo-package-boundaries.md), [`ADR-0003`](adr/0003-ci-trust-boundary-and-artifacts.md), [`ADR-0004`](adr/0004-runtime-configuration-and-secret-injection.md), [`ADR-0006`](adr/0006-postgresql-migration-foundation.md), [`ADR-0007`](adr/0007-observability-context-and-error-reporting.md), [`ADR-0008`](adr/0008-zod-first-contract-generation.md), [`ADR-0009`](adr/0009-mvp-runtime-data-and-workflow-architecture.md) e [`ADR-0010`](adr/0010-internal-provider-neutral-identity.md). ADR-0005 è [`proposed`](adr/0005-vercel-web-preview-and-staging.md). Contratti di design: [`UX_UI_DESIGN.md`](product/UX_UI_DESIGN.md), [`identity-signup-v1`](superpowers/specs/2026-07-16-bl-005-signup-verification-design.md) e [`identity-access-v1`](superpowers/specs/2026-07-16-bl-006-session-access-design.md). Configurazione operativa: [`CONFIGURATION.md`](operations/CONFIGURATION.md), [`DATABASE_MIGRATIONS.md`](operations/DATABASE_MIGRATIONS.md), [`LOCAL_DEVELOPMENT.md`](operations/LOCAL_DEVELOPMENT.md), [`PREVIEW_STAGING.md`](operations/PREVIEW_STAGING.md) e [`api/README.md`](api/README.md). Stato architetturale e dati: [`SYSTEM_OVERVIEW.md`](architecture/SYSTEM_OVERVIEW.md) e [`DATA_MODEL.md`](data/DATA_MODEL.md).

## Versioni e head

| Elemento | Versione/head | Stato |
|---|---|---|
| Migration head | `000003_identity_signup` | integrato e verificato su PostgreSQL reale; contract `database-identity-signup-v1`, compatibilità minima `000001`; target BL-006 `000004_identity_access` non ancora implementato |
| Contract/API/event schema | su `main`: `v1` immutabile + `v2`/SemVer `2.0.0`; su branch BL-006: candidato `v3`/SemVer `3.0.0`; event `schemaVersion: 1` invariato | Zod strict come fonte; `v3` contiene 20 JSON Schema e OpenAPI 3.1.1 con nove POST auth; v1/v2 senza diff, generated drift e compatibilità major testati |
| Rules version | `N/A` | package rules presente come scaffold; cataloghi/formule non implementati |
| Prompt version | `N/A` | package AI presente come scaffold; prompt/provider non implementati |
| Eval suite version | `N/A` | harness non creato |
| Test foundation contract | `testing-foundation-v1` | integrato su `main` tramite PR #24: runner isolato, primitive deterministiche, container PostgreSQL/Redis, JUnit/LCOV e manifest |
| Runtime config contract | `runtime-config-v1` | parser/config CLI e composition root implementati; test mirati PASS; nessun secret reale |
| Observability contract | `observability-baseline-v1` | implementato e integrato tramite PR #20; run post-merge `29415397361` 5/5 `SUCCESS`; provider remoti assenti |
| Identity contract | `identity-signup-v1` implementato; `identity-access-v1` in corso | signup integrato; contract `v3`, porte/config/crypto access-reset verdi sulla branch. Migration `000004`, store/API/worker/UI e gate terminali restano aperti; SMTP/provider/account remoti assenti |
| Deploy/health contract | `staging-foundation-v1` / `web-health-v1` | contenimento, guard, payload policy e freeze integrati tramite PR #13/#14/#15/#16; manifest unlinked/fail-closed, Git e manual deploy spenti; BL-080 bloccato su fix/workaround provider Preview-only; smoke/failure/rollback-redeploy restano aperti |
| Design contract | `ux-ui-2026-07-13` | foundation statica BL-079 e form auth BL-005 implementate; shell di gioco interattiva/Motion restano BL-081 |
| ADR UI | `ADR-0001 accepted` | vigente |
| Toolchain | Node `24.11.0` (engine `>=22.13.0`); pnpm `11.13.0`; Turbo `2.10.4`; TypeScript `6.0.3`; Zod `4.4.3`; Ajv `8.20.0`/formats `3.0.1` test-only; github-slugger `2.0.0`; Mermaid `11.16.0`/DOMPurify `3.4.12` docs-only; OTel API `1.9.1`/SDK `2.9.0`; Pino `10.3.1`; Sentry `10.65.0`; Argon2 `0.44.0`; Nodemailer `9.0.3`; PostgreSQL `17`; pgvector `0.8.2`; node-pg-migrate `8.0.4`; pg `8.22.0`; Docker `29.2.1` | pinning e lockfile presenti; `argon2` è l'unica nuova dipendenza nativa allowlisted; immagine DB pin a digest |
| Web/API | Next `16.2.10`; React `19.2.7`; Fastify `5.10.0` | web con shell statica e form/BFF auth; API espone le sole route identity, validate-before-bind e shutdown del pool; nessuna route di gioco |
| Package boundary policy | `boundary-policy-v1` | checker + fixture negativa presenti |
| Task graph policy | `task-graph-v1` | ID, range, status, parity spec e consumer UX verificati |
| Agent workflow policy | `agent-workflow-v1` / task schema `1.1.0` | corsie di rischio, delivery derivata, budget e gate rapidi fail-closed verificati |
| CI policy | `ci-policy-v1` | Quality usa un solo `docs:check`; Tests usa le quattro corsie non-security e pubblica soltanto `artifacts/testing` dopo prepare/verify; Security resta separato |
| Main Ruleset | `main-required-ci` / `18877721` | active, strict, PR richiesta, nessun bypass; check GitHub Actions `integration_id=15368` |
| Release Ruleset | `release-production-required-ci` / `18926413` | branch `release/production` creato da `ef803add249d16ded6f94936c59531047c8a92fa`; active, `CI / Merge gate` strict, `current_user_can_bypass=never`; Ruleset main invariata |
| Artifact schema | `build-artifact-v1` | baseline remota BL-002 `3.205` file; checkout pulito BL-003 `3.554` file e CI Ubuntu `3.233` file, secret/checksum verification PASS |

## Comandi disponibili

Sono disponibili i comandi locali del perimetro `BL-001`/`BL-002`/`BL-003`/`BL-004`/`BL-008`/`BL-009`/`BL-010`/`BL-080`:

```powershell
corepack pnpm@11.13.0 lint
corepack pnpm@11.13.0 typecheck
corepack pnpm@11.13.0 build
corepack pnpm@11.13.0 format:check
corepack pnpm@11.13.0 test:unit
corepack pnpm@11.13.0 test:integration
corepack pnpm@11.13.0 test:contract
corepack pnpm@11.13.0 test:security
corepack pnpm@11.13.0 test:all
corepack pnpm@11.13.0 test:reports:prepare --required=unit,integration,database,contract,security
corepack pnpm@11.13.0 test:reports:verify --required=unit,integration,database,contract,security
corepack pnpm@11.13.0 contracts:generate
corepack pnpm@11.13.0 contracts:check
corepack pnpm@11.13.0 docs:check
corepack pnpm@11.13.0 boundaries:check
corepack pnpm@11.13.0 tasks:check
corepack pnpm@11.13.0 ci:workflow:check
corepack pnpm@11.13.0 deploy:check
corepack pnpm@11.13.0 deploy:check:linked
corepack pnpm@11.13.0 deploy:smoke
corepack pnpm@11.13.0 scan:sast
corepack pnpm@11.13.0 scan:secrets
corepack pnpm@11.13.0 artifact:prepare
corepack pnpm@11.13.0 artifact:verify
corepack pnpm@11.13.0 config:check
corepack pnpm@11.13.0 db:local:up
corepack pnpm@11.13.0 db:migrate:status:local
corepack pnpm@11.13.0 db:migrate:local
corepack pnpm@11.13.0 db:rollback:local
corepack pnpm@11.13.0 flags:status -- turn.new
corepack pnpm@11.13.0 flags:set -- turn.new --enable --actor operator:alice --reason maintenance --idempotency-key idem-feature-cli-0001 --correlation-id corr-feature-cli-0001 --expected-version 0
corepack pnpm@11.13.0 db:local:down
corepack pnpm@11.13.0 db:migrate:test
corepack pnpm@11.13.0 verify:docs
corepack pnpm@11.13.0 verify:affected
corepack pnpm@11.13.0 verify
```

Eval, bot e load restano pianificati nei task proprietari e non vanno sostituiti da no-op. `QA-001` implementa il test harness container non-browser; `BL-079` verifica localmente design system e shell statica, `BL-081` aggiunge interazione/stati/Motion e `QA-002` consolida il browser/accessibility/visual regression harness. La suite migration è reale e fa parte di `verify`/CI; il lifecycle condiviso ne conserva il contratto e aggiunge Redis isolato.

Verifiche documentali manuali correnti:

```powershell
Get-FileHash -Algorithm SHA256 docs\MVP_SPEC.md
Get-ChildItem -Recurse -Filter *.md
```

Il report riproducibile di `GOV-001` è `AGENTS_VALIDATION.txt`.

## Decisioni aperte

Le decisioni ancora aperte restano in `docs/MVP_SPEC.md` §34. `OD-07` è chiusa da ADR-0010; quella che può ancora bloccare M0 è soprattutto `OD-08` su regione dati/telemetry.
- Il target provider effettivo blocca `BL-080`: il client Vercel `17.6.4` omette intenzionalmente il target Preview dalla POST e il provider ha restituito Production. L'issue pubblica `vercel/vercel#17069` conferma una riproduzione CLI indipendente, ma non contiene ancora risposta/fix del maintainer né prova la causa server. Nessuna riattivazione Git o manuale è ammessa finché **non** esiste un percorso Preview-only supportato e verificabile in PR separata. Il piano/account Hobby resta vincolato all'identità esclusiva e l'installazione condivisa non viene ristretta per decisione PO.

Il dettaglio cromatico finale non è un blocco di prodotto. `BL-079` definisce token e contrasto; l’eventuale uso di Rive resta fuori dal bundle iniziale e può essere valutato soltanto nel performance gate di `BL-081`.

## Rischi correnti

| ID | Rischio | Mitigazione/owner |
|---|---|---|
| CTX-R03 | App e package di gioco restano in gran parte scaffold; esiste soltanto il verticale identity oltre alla foundation UI | non inferire loop di gioco, API turni o stato campagna dalla shell fixture o dalle route auth; BL-081/BL-028 possiedono i passi successivi |
| CTX-R04 | La shell interattiva e il browser harness comune restano successivi alla foundation | `BL-081` è ora READY per stati/interazione/Motion; `QA-002` consolida il browser gate dopo la shell interattiva |
| CTX-R05 | Motion/Rive possono degradare device mobili | Motion lazy/reduced e Rive assente dal bundle iniziale in `BL-081`; `QA-002` verifica reduced-motion e visual/performance regression |
| CTX-R11 | Preview/staging M0 non è ancora disponibile; `BL-070` arriverebbe troppo tardi | `BL-080` è `BLOCKED/50%/PARTIAL` sull'assenza di un percorso first-deployment Preview-only supportato; freeze e `GATE-M0` restano chiusi, mentre i slice UI locali avanzano senza deploy |
| CTX-R13 | Config errata o troppo ampia può esporre credenziali fra servizi o negli errori | `BL-003` usa parser service-scoped, messaggi redatti, template separati e scanner path-based/ignore-aware |
| CTX-R14 | L'installazione condivisa `41079282` vede 8 repository e non può essere ristretta senza togliere accesso ad altri progetti; un owner può bypassare l'interlock procedurale e invocare direttamente CLI/UI | Controlli project-level, Git disabilitato, `manualDeployment.enabled=false`, runbook fail-closed e divieto esplicito di deploy reale; l'interlock non viene presentato come enforcement provider |
| CTX-R16 | Il client Vercel omette il target Preview e il provider ha restituito due record Production; la causa server resta non confermata | Entrambi rimossi; freeze PR #16 integrato; riapertura solo con fix/workaround provider supportato, containment testato e PR separata |
| CTX-R17 | Il CLI dalla root può includere cache/output ignorati da Git e superare limiti o ampliare il payload | `.vercelignore` root-only e dry-run JSON fail-closed con budget/path/input obbligatori; contratto integrato in PR #15 e dry-run corrente PASS |
| CTX-R20 | La nuova baseline può causare context bleed, leakage di PII/secret, doppia autorità trace o dipendenze Node nel bundle client | `BL-008` applica OTel come unica autorità trace, redazione allowlisted, Sentry error-only, test concorrenti/security e contract test del bundle prima della delivery |
| CTX-R22 | L'identità interna amplia la superficie security con hashing costoso, challenge replay, session cookie, email side effect ed enumeration | BL-005 applica rate limit pre-hash, Argon2id/pepper, digest HMAC e outbox; BL-006 estende test/transaction boundary a fixation, rotazione, expiry, revoca e reset concorrente. SMTP reale resta fuori scope locale |

## Prossima azione

Eseguire migration `000004_identity_access` in TDD con upgrade `000003`→head, vincoli e runner concorrenti; poi implementare `PostgresIdentityAccessStore`, API/worker e UI shadcn. `BL-081` resta READY ma non viene avviato in parallelo. `BL-080` resta congelato e non sono autorizzate azioni Vercel.

## Rischi chiusi

| ID | Chiusura | Evidenza |
|---|---|---|
| CTX-R01 | Git inizializzato e clean-worktree verification completata | commit `6cda07a60022665f321b48dd82fbeb1d9bef586f`; `docs/testing/BL-001_VERIFICATION.md` |
| CTX-R08 | BL-002 verificato da worktree detached pulito con install frozen e cache forzata off | head `7c6c7071d027c55aeffbc7279b8ca3765ea26c37`; `TURBO_FORCE=true pnpm verify` exit `0` in 66,0 s |
| CTX-R06 | Pipeline e failure path verificati realmente su GitHub | PR #1/run `29257544214` tutti verdi; PR #3/run `29256736728` con tests/gate rossi, build skipped e merge state `BLOCKED`; post-merge run `29257721274` PASS |
| CTX-R07 | Blocco del piano privato rimosso dal Product Owner e enforcement attivato | repository pubblico; Ruleset `18877721` active/strict/no bypass; regole applicabili a `main` verificate via API |
| CTX-R12 | Configurazione runtime BL-003 verificata localmente, da checkout pulito e su Linux | head `f571413`; clean verify `61,0 s`; run `29285998646` 5/5 job PASS; failure path FIFO `29285442650` registrato e corretto |
| CTX-R15 | Production Branch Vercel separata da `main` prima dell'attivazione | CLI Vercel `55.0.0`: `Production → release/production`; lista deployment vuota; branch GitHub protetta da Ruleset `18926413` |
| CTX-R19 | Duplicazione del ciclo agente contenuta con corsie, budget, candidato unico, delivery derivata e gate fail-closed | Audit 60,7% docs-only; candidate `GOV-003` in 43 minuti; `verify:docs` 2,65 s, `verify:affected` 6,96 s, full gate unico 72,70 s; review senza P0/P1 |
| CTX-R02 | Drift documentale residuo coperto senza duplicare i checker canonici | `docs:check` compone 8 artifact contrattuali, document integrity e task graph; 11 test policy/document integrity e 9 workflow/generated verdi; budget 3,136 s / 3,130 s |
| CTX-R18 | Upgrade database precedente→head ora rappresentato da `000001`→`000002` | `BL-010`: suite PostgreSQL reale copre zero→head, previous→head, replay, rollback e re-apply; migration head `000002_feature_flags` |
| CTX-R21 | Cold start documentale e pin del package manager verificati da checkout pulito | Functional head `30f611e`: install frozen, config, migration head, build 11/11, integration 20/20 e `web-health-v1` reali `PASS`; full HIGH_RISK senza cache exit `0` in 143,4 s; worktree e Compose rimossi |
