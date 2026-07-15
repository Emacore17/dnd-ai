---
status: active
owner: engineering
last_reviewed: 2026-07-15
last_verified_commit: 8e6e0d3d46daa057ba80999c58c83ad1c92471b1
source_refs:
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#29-infrastruttura-e-deployment
  - AGENTS.md#9-confini-architetturali-e-struttura-target
  - docs/adr/0008-zod-first-contract-generation.md
  - docs/superpowers/specs/2026-07-15-bl-010-feature-flags-design.md
related_tasks:
  - BL-001
  - BL-002
  - BL-003
  - BL-004
  - BL-008
  - BL-009
  - BL-010
  - BL-079
  - BL-080
  - DOC-ARCH-001
code_refs:
  - .vercelignore
  - apps/web
  - apps/api
  - apps/worker
  - packages/observability/src/node.ts
  - packages/observability/src/tracing.ts
  - packages/observability/src/logger.ts
  - packages/observability/src/redaction.ts
  - packages/contracts/src
  - packages/contracts/generated/v1
  - scripts/generate-contracts.mjs
  - scripts/lib/contract-artifact-policy.mjs
  - scripts/lib/contract-compatibility-policy.mjs
  - scripts/lib/owned-path-policy.mjs
  - apps/api/src/observability.ts
  - apps/worker/src/observability.ts
  - apps/web/instrumentation.ts
  - apps/web/instrumentation-client.ts
  - packages/config
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - packages/persistence/src/feature-flags.ts
  - infra/local/postgres.compose.yml
  - scripts/run-database-migrations.mjs
  - scripts/manage-feature-flag.mjs
  - packages
  - scripts/lib/workspace-boundaries.mjs
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
  - apps/web/app/health/route.ts
  - apps/web/package.json
  - apps/web/vercel.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - infra/deployment/vercel-staging.json
  - .github/workflows/deployment-smoke.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/assert-vercel-preview-bootstrap-enabled.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - turbo.json
test_refs:
  - tests/unit/build-artifact.test.mjs
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-preview-bootstrap-policy.test.mjs
  - tests/security/vercel-preview-bootstrap-gate.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/database/database-migration-failure.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/database/feature-flags.test.mjs
  - tests/security/database-migration-security.test.mjs
  - tests/security/feature-flags-security.test.mjs
  - tests/unit/observability-core.test.mjs
  - tests/unit/observability-node.test.mjs
  - tests/integration/observability-flow.test.mjs
  - tests/contracts/observability-contract.test.mjs
  - tests/security/observability-security.test.mjs
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/contracts-runtime.test.mjs
  - tests/contracts/contracts-artifacts.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/unit/owned-path-policy.test.mjs
supersedes: null
---

# System overview

## Stato implementato

`BL-001` introduce un monorepo TypeScript buildabile, `BL-002` la pipeline fail-closed e `BL-003` configurazione runtime server-only con startup fail-fast. `BL-004` completa la fondazione PostgreSQL/pgvector, estesa da `BL-010` con `000002_feature_flags`: store server-side condiviso, audit append-only e CLI operatore redatta. `BL-008` implementa `observability-baseline-v1`; `BL-009` e integrato su `main` e fornisce `api-contract-v1`. `BL-080` resta bloccato e il freeze Vercel invariato. Non esiste staging, quindi `BL-079` resta backlog; nessuna operazione Vercel appartiene a `BL-010`.

```text
apps/
  web/             Next.js App Router; OTel server + Sentry error-only lazy, build guard + `/health`
  api/             Fastify composition root; config e osservabilità prima del bind
  worker/          config e osservabilità prima dell'initializer; BullMQ pianificato
packages/
  config/          parser Zod, profili runtime e CLI redatta
  contracts/       Zod strict, DTO/tipi, JSON Schema/OpenAPI generati v1
  domain/          entità, comandi, porte e invarianti puri
  rules/           Rules Engine deterministico
  ai/              porte, prompt/context e adapter AI futuri
  persistence/     manifest, runner, feature flag store e repository di dominio futuri
  observability/   contratti safe, tracing OTel, logging Pino e Sentry error-only
  testing/         fixture/fake condivisi senza logica di produzione
```

La struttura usa i nomi compatti definiti in `AGENTS.md`: `rules` corrisponde al `rules-engine` raccomandato dalla specifica; `ai` mantiene un solo confine finché `BL-021` non introduce una separazione concreta fra porta e adapter. `config` è un leaf server-only; il dominio non importa configurazione ambientale o SDK provider.

## Direzione delle dipendenze

| Sorgente | Workspace importabili |
|---|---|
| `config` | nessuno |
| `contracts` | nessuno |
| `domain` | nessuno |
| `rules` | `domain` |
| `ai` | `contracts`, `domain` |
| `persistence` | `contracts`, `domain` |
| `observability` | nessuno |
| `testing` | tutti i package, mai le app |
| `web` | `contracts`, `observability` |
| `api`, `worker` | `config`, `contracts`, `domain`, `rules`, `ai`, `persistence`, `observability` |

App→app, package→app, import relativi che escono dal package e cicli workspace sono vietati. `scripts/check-boundaries.mjs` controlla sia le dipendenze dei manifest sia gli import/export TypeScript/JavaScript. Il test contract esegue anche una fixture in cui `domain` dipende da `persistence` e richiede exit code `1`.

## Toolchain riproducibile

| Elemento | Versione pin |
|---|---|
| Node.js | `24.11.0` per il workspace; engine minimo supportato `22.13.0` |
| pnpm | `11.13.0` |
| Turborepo | `2.10.4` |
| TypeScript | `6.0.3` |
| Next.js / React | `16.2.10` / `19.2.7` |
| Fastify | `5.10.0` |
| PostgreSQL / pgvector | `17` / `0.8.2` |
| node-pg-migrate / pg | `8.0.4` / `8.22.0` |
| OpenTelemetry API / SDK | `1.9.1` / `2.9.0` |
| Pino / Sentry | `10.3.1` / `10.65.0` |
| Zod / Ajv test-only | `4.4.3` / `8.20.0` |

TypeScript 7 non è stato selezionato perché `typescript-eslint@8.63.0` dichiara compatibilità `<6.1.0`. ESLint resta sulla linea `9.39.2`, compatibile con i plugin transitivi di Next 16.

La supply-chain policy pnpm permette install script soltanto a `sharp` (runtime immagini di Next) e `unrs-resolver` (resolver nativo usato dal lint); `@sentry/cli` è negato esplicitamente perché BL-008 non carica source map. Ogni nuovo script transitivo resta bloccato finché non viene revisionato e aggiunto esplicitamente ad [`allowBuilds`](https://pnpm.io/settings#allowbuilds). Con pnpm 11 le policy progetto vivono nel manifest workspace, non in `.npmrc`: peer auto-install e global virtual store sono disabilitati, engine/exact pin sono obbligatori e `verifyDepsBeforeRun: error` rifiuta dipendenze incoerenti senza install impliciti.

## Configurazione runtime

Il contratto `runtime-config-v1` distingue API, worker e migration. `APP_ENV` accetta `local`, `staging` e `production`; preview usa lo schema staging con risorse isolate. URL database/Redis sono service-scoped, i profili gestiti richiedono credenziale e trasporto cifrato e gli errori riportano soltanto i nomi delle chiavi invalide.

L'API valida prima di costruire Fastify e aprire il listener. Il worker valida prima dell'inizializzatore iniettato. Il composition root migration valida il profilo prima di passare la sola URL a `@dnd-ai/persistence`; il package persistence non importa config e non legge l'ambiente. API e worker accettano una DSN Sentry service-scoped opzionale. Il web non importa `@dnd-ai/config`: risolve soltanto metadata ambientali e la DSN pubblica opzionale nel proprio composition root.

Template e procedure sono in [`CONFIGURATION.md`](../operations/CONFIGURATION.md). Il web ha desired state `staging-foundation-v1`, health contract `web-health-v1` e progetto Vercel collegato al repository corretto con Root Directory `apps/web`, Next.js e `fra1`. Fork Protection, OIDC e Trusted Source sono configurati; zero variabili applicative. Production Branch Vercel=`release/production`, branch release e Ruleset restano invariati. La policy linked e il comando CLI con `--target=preview` hanno prodotto due record Production poi rimossi. PR #13/#14/#15/#16 hanno riportato il contratto a stato unlinked/fail-closed, aggiunto guard, payload bounded e freeze. Il client Vercel omette l'esplicito target Preview prima della POST, quindi non esiste oggi un percorso first-deployment Preview-only verificato. Git auto-deploy resta spento. `.vercelignore` e `scripts/check-vercel-deploy-dry-run.mjs` consentono soltanto un dry-run bounded dalla root. `source.manualDeployment.enabled=false` e `deploy:bootstrap:check` rendono fail-closed il percorso operativo approvato, ma non sono enforcement provider contro un owner. Lo staging non è disponibile.

## Feature flag e kill switch

`@dnd-ai/persistence` esporta un catalogo chiuso di kill switch: `campaign.start`, `turn.new` e `model.route.premium`. Ogni flag ha default sicuro `enabled=false`. `evaluateFeatureGate` restituisce disabled per chiavi sconosciute, store indisponibile o stato malformato; i consumer reali verranno collegati nei task proprietari ai boundary di side effect.

Lo stato corrente vive in `app.feature_flags`; ogni cambio passa da CAS opzionale, idempotency key, digest del comando e audit in `app.feature_flag_events` nella stessa transazione. `scripts/manage-feature-flag.mjs` e i comandi root `flags:status`/`flags:set` sono l'unica superficie operativa della slice: nessun endpoint admin pubblico, nessun flag client e nessun deploy.

## Contratti runtime e artefatti generati

`@dnd-ai/contracts` è un leaf package browser-safe. Gli schemi Zod strict sono la fonte di request, response, error envelope, lifecycle SSE, `GameEvent`, `DungeonMasterTurnResult` e tool envelope parametrizzati da allowlist; i tipi TypeScript vengono inferiti e nessun DTO può applicare stato canonico.

Il catalogo `api-contract-v1` (`1.0.0`, `schemaVersion: 1`) genera sei JSON Schema Draft 2020-12, manifest e OpenAPI 3.1.1 sotto `packages/contracts/generated/v1`. OpenAPI contiene soltanto componenti e `paths: {}` perché gli handler non sono ancora implementati. `contracts:check` confronta in sola lettura il catalogo con gli otto file versionati, congela i major già pubblicati rispetto alla base Git protetta e fallisce su missing, stale, unexpected, incompatibilità o symlink/junction nella catena. In CI usa `HEAD^1` senza fetch; il writer è soltanto `contracts:generate`. Decisione e uso sono documentati in [`ADR-0008`](../adr/0008-zod-first-contract-generation.md) e [`docs/api/README.md`](../api/README.md).

## Osservabilità implementata

`@dnd-ai/observability` separa il kernel platform-neutral dal subpath `/node`. Il runtime Node usa `AsyncLocalStorage`, propagazione W3C senza baggage, provider OTel esplicito e request ID UUID v4 server-owned. API e worker inizializzano il runtime dopo la config valida e prima degli effetti; Fastify e il wrapper job estraggono/iniettano il carrier e terminano le operazioni una sola volta.

Pino serializza soltanto eventi e metadata allowlisted. Sanitizzazione e filtro Sentry eliminano PII, credenziali, header/body raw, prompt, narrazione e output AI. Sentry usa sampling trace zero e non abilita Replay, profiling, log forwarding, tunnel o source-map upload. Il web importa gli adapter in modo lazy soltanto con DSN valida; l'assenza o malformazione della DSN pubblica disabilita l'adapter senza rompere la UI, mentre DSN server API/worker malformate falliscono lo startup in modo redatto.

Exporter, transport e destination sono best-effort e non modificano risultato HTTP/job; init, end e shutdown sono idempotenti e bounded. La trace fake web→API→queue→worker e due flussi concorrenti sono verificati in-memory, senza rete o risorse provider. La decisione è in [`ADR-0007`](../adr/0007-observability-context-and-error-reporting.md).

## Comandi disponibili in BL-001/BL-002/BL-003/BL-004/BL-008/BL-009/BL-010/BL-080

```bash
corepack pnpm@11.13.0 install --frozen-lockfile
corepack pnpm@11.13.0 lint
corepack pnpm@11.13.0 typecheck
corepack pnpm@11.13.0 build
corepack pnpm@11.13.0 test:contract
corepack pnpm@11.13.0 test:security
corepack pnpm@11.13.0 contracts:generate
corepack pnpm@11.13.0 contracts:check
corepack pnpm@11.13.0 config:check
corepack pnpm@11.13.0 scan:sast
corepack pnpm@11.13.0 boundaries:check
corepack pnpm@11.13.0 tasks:check
corepack pnpm@11.13.0 db:local:up
corepack pnpm@11.13.0 db:migrate:status:local
corepack pnpm@11.13.0 db:migrate:local
corepack pnpm@11.13.0 db:rollback:local
corepack pnpm@11.13.0 db:local:down
corepack pnpm@11.13.0 db:migrate:test
corepack pnpm@11.13.0 flags:status -- turn.new
corepack pnpm@11.13.0 flags:set -- turn.new --enable --actor operator:alice --reason maintenance --idempotency-key idem-feature-cli-0001 --correlation-id corr-feature-cli-0001 --expected-version 0
corepack pnpm@11.13.0 deploy:check
corepack pnpm@11.13.0 verify
```

`verify` copre format, lint, typecheck, build, generated contract drift, unit, integration, database migration, contract, security, package/task/CI/deployment policy e artifact verification. I comandi preparano autonomamente i dist richiesti da un checkout pulito; la suite database usa PostgreSQL reale pin a digest, porta loopback effimera, `tmpfs`, polling bounded e cleanup fail-closed. Il dry-run provider non appartiene a `verify`: usa la sequenza PowerShell fail-closed documentata in [`PREVIEW_STAGING.md`](../operations/PREVIEW_STAGING.md#deploy-e-smoke--gate-chiuso). `deploy:bootstrap:check` deve fallire con exit `1` nello stato vigente. Browser/E2E, eval, bot, load e harness condiviso restano responsabilità dei task proprietari; nessun comando futuro è simulato da un no-op.

## CI e supply chain

`.github/workflows/ci.yml` separa quality, test, security e build. Quality usa checkout depth 2 ed esegue `pnpm contracts:check` in sola lettura con base `HEAD^1`; il job Tests esegue `pnpm db:migrate:test` su container effimero senza secret CI. `CI / Merge gate` usa `always()` e considera valido soltanto `success` per ogni job richiesto, così failure, cancellation e skip non vengono mascherati. Il workflow usa `pull_request`, push `main`, merge queue e dispatch manuale; `pull_request_target` è vietato dalla policy automatica.

Nel workflow CI base le action esterne sono pin a SHA completo, checkout non persiste credenziali e i permessi globali sono read-only. La cache gestita da `setup-node` contiene soltanto lo store pnpm indicizzato dal lockfile. Security esegue SAST locale fail-on-warning, test/secret scan e dependency audit; non riceve secret applicativi.

Il workflow deployment smoke è separato e accetta soltanto payload Preview coerenti. Sul dispatch del primo deployment Production il job è risultato `skipped`, quindi nessun token o fetch è stato eseguito; il secondo record Production non ha generato un nuovo smoke. Il dry-run bounded è passato, ma `@vercel/client` elimina `--target=preview` dal body e il provider ha restituito Production nello stato iniziale senza deployment: nessun altro deploy reale o redeploy è autorizzato finché Vercel non offre un fix/workaround supportato e il percorso non viene riaperto con PR separata. Non usare `--cwd apps/web`, `--prebuilt`, archivi, `--prod`, `promote`, `--skip-domain`, custom target o override manuali `VERCEL*`. Il percorso Preview resta non verificato; API e worker non partecipano finché non hanno packaging operativo.

Il build produce `artifacts/bl002`: `scripts/lib/build-artifact.mjs` copia soltanto output esplicitamente ammessi, incluso `packages/config/dist`, rifiuta link esterni/path sensibili e file ambientali, scansiona i file e registra byte+SHA-256 in `build-artifact-v1`. L’upload usa soltanto questo staging validato.

## Frontend e design

`apps/web` contiene una pagina Server Component minima soltanto per validare il build Next.js. Non è la shell di gioco e non anticipa componenti ad hoc. `BL-079` resta in backlog dietro `BL-080` e installerà shadcn/ui, AI Elements selettivi, Motion e il sistema visuale descritto in `docs/product/UX_UI_DESIGN.md`; la fondazione database `BL-004` è indipendente dallo staging e si chiude senza anticipare UI.
