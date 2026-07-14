---
status: active
owner: engineering
last_reviewed: 2026-07-14
last_verified_commit: aaa17b2ada8a7bab73e3877f263b2c46c5865c13
source_refs:
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#29-infrastruttura-e-deployment
  - AGENTS.md#9-confini-architetturali-e-struttura-target
related_tasks:
  - BL-001
  - BL-002
  - BL-003
  - BL-004
  - BL-079
  - BL-080
  - DOC-ARCH-001
code_refs:
  - .vercelignore
  - apps/web
  - apps/api
  - apps/worker
  - packages/config
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - infra/local/postgres.compose.yml
  - scripts/run-database-migrations.mjs
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
  - tests/security/database-migration-security.test.mjs
supersedes: null
---

# System overview

## Stato implementato

`BL-001` introduce un monorepo TypeScript buildabile, `BL-002` la pipeline fail-closed e `BL-003` configurazione runtime server-only con startup fail-fast. `BL-004` completa la fondazione PostgreSQL/pgvector: migration head e contract versionati, composition root esterno a persistence, rollback local-only e suite container reale in CI. `BL-080` resta bloccato: i due record Production creati dal provider sono stati contenuti e rimossi; freeze, Git auto-deploy spento e gate manuale fail-closed restano invariati. Non esiste ancora uno staging, quindi `BL-079` resta backlog; `BL-008` è il solo task pronto. Nessuna operazione Vercel è stata eseguita da `BL-004`.

```text
apps/
  web/             Next.js App Router; scaffold, build guard Preview-only + `/health`
  api/             Fastify composition root; config prima del bind
  worker/          config prima dell'initializer; BullMQ pianificato
packages/
  config/          parser Zod, profili runtime e CLI redatta
  contracts/       DTO e schemi esterni futuri
  domain/          entità, comandi, porte e invarianti puri
  rules/           Rules Engine deterministico
  ai/              porte, prompt/context e adapter AI futuri
  persistence/     manifest, runner e baseline migration; repository di dominio futuri
  observability/   logging, tracing e metriche condivise future
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
| Node.js | `24.11.0` per il workspace; engine minimo supportato `22.12.0` |
| pnpm | `10.34.5` |
| Turborepo | `2.10.4` |
| TypeScript | `6.0.3` |
| Next.js / React | `16.2.10` / `19.2.7` |
| Fastify | `5.10.0` |
| PostgreSQL / pgvector | `17` / `0.8.2` |
| node-pg-migrate / pg | `8.0.4` / `8.22.0` |

TypeScript 7 non è stato selezionato perché `typescript-eslint@8.63.0` dichiara compatibilità `<6.1.0`. ESLint resta sulla linea `9.39.2`, compatibile con i plugin transitivi di Next 16.

La supply-chain policy pnpm permette install script soltanto a `sharp` (runtime immagini di Next) e `unrs-resolver` (resolver nativo usato dal lint); ogni nuovo script transitive resta bloccato finché non viene revisionato e aggiunto esplicitamente ad [`allowBuilds`](https://pnpm.io/settings#allowbuilds).

## Configurazione runtime

Il contratto `runtime-config-v1` distingue API, worker e migration. `APP_ENV` accetta `local`, `staging` e `production`; preview usa lo schema staging con risorse isolate. URL database/Redis sono service-scoped, i profili gestiti richiedono credenziale e trasporto cifrato e gli errori riportano soltanto i nomi delle chiavi invalide.

L'API valida prima di costruire Fastify e aprire il listener. Il worker valida prima dell'inizializzatore iniettato. Il composition root migration valida il profilo prima di passare la sola URL a `@dnd-ai/persistence`; il package persistence non importa config e non legge l'ambiente. Il web corrente non consuma config runtime e non importa `@dnd-ai/config`.

Template e procedure sono in [`CONFIGURATION.md`](../operations/CONFIGURATION.md). Il web ha desired state `staging-foundation-v1`, health contract `web-health-v1` e progetto Vercel collegato al repository corretto con Root Directory `apps/web`, Next.js e `fra1`. Fork Protection, OIDC e Trusted Source sono configurati; zero variabili applicative. Production Branch Vercel=`release/production`, branch release e Ruleset restano invariati. La policy linked e il comando CLI con `--target=preview` hanno prodotto due record Production poi rimossi. PR #13/#14/#15/#16 hanno riportato il contratto a stato unlinked/fail-closed, aggiunto guard, payload bounded e freeze. Il client Vercel omette l'esplicito target Preview prima della POST, quindi non esiste oggi un percorso first-deployment Preview-only verificato. Git auto-deploy resta spento. `.vercelignore` e `scripts/check-vercel-deploy-dry-run.mjs` consentono soltanto un dry-run bounded dalla root. `source.manualDeployment.enabled=false` e `deploy:bootstrap:check` rendono fail-closed il percorso operativo approvato, ma non sono enforcement provider contro un owner. Lo staging non è disponibile.

## Comandi disponibili in BL-001/BL-002/BL-003/BL-004/BL-080

```bash
corepack pnpm@10.34.5 install --frozen-lockfile
corepack pnpm@10.34.5 lint
corepack pnpm@10.34.5 typecheck
corepack pnpm@10.34.5 build
corepack pnpm@10.34.5 test:contract
corepack pnpm@10.34.5 test:security
corepack pnpm@10.34.5 config:check
corepack pnpm@10.34.5 scan:sast
corepack pnpm@10.34.5 boundaries:check
corepack pnpm@10.34.5 tasks:check
corepack pnpm@10.34.5 db:local:up
corepack pnpm@10.34.5 db:migrate:status:local
corepack pnpm@10.34.5 db:migrate:local
corepack pnpm@10.34.5 db:rollback:local
corepack pnpm@10.34.5 db:local:down
corepack pnpm@10.34.5 db:migrate:test
corepack pnpm@10.34.5 deploy:check
corepack pnpm@10.34.5 verify
```

`verify` copre format, lint, typecheck, build, unit, integration, database migration, contract, security, package/task/CI/deployment policy e artifact verification. I comandi preparano autonomamente i dist richiesti da un checkout pulito; la suite database usa PostgreSQL reale pin a digest, porta loopback effimera, `tmpfs`, polling bounded e cleanup fail-closed. Il dry-run provider non appartiene a `verify`: usa la sequenza PowerShell fail-closed documentata in [`PREVIEW_STAGING.md`](../operations/PREVIEW_STAGING.md#deploy-e-smoke--gate-chiuso). `deploy:bootstrap:check` deve fallire con exit `1` nello stato vigente. Browser/E2E, eval, bot, load e harness condiviso restano responsabilità dei task proprietari; nessun comando futuro è simulato da un no-op.

## CI e supply chain

`.github/workflows/ci.yml` separa quality, test, security e build. Il job Tests esegue anche `pnpm db:migrate:test` su container effimero senza secret CI. `CI / Merge gate` usa `always()` e considera valido soltanto `success` per ogni job richiesto, così failure, cancellation e skip non vengono mascherati. Il workflow usa `pull_request`, push `main`, merge queue e dispatch manuale; `pull_request_target` è vietato dalla policy automatica.

Nel workflow CI base le action esterne sono pin a SHA completo, checkout non persiste credenziali e i permessi globali sono read-only. La cache gestita da `setup-node` contiene soltanto lo store pnpm indicizzato dal lockfile. Security esegue SAST locale fail-on-warning, test/secret scan e dependency audit; non riceve secret applicativi.

Il workflow deployment smoke è separato e accetta soltanto payload Preview coerenti. Sul dispatch del primo deployment Production il job è risultato `skipped`, quindi nessun token o fetch è stato eseguito; il secondo record Production non ha generato un nuovo smoke. Il dry-run bounded è passato, ma `@vercel/client` elimina `--target=preview` dal body e il provider ha restituito Production nello stato iniziale senza deployment: nessun altro deploy reale o redeploy è autorizzato finché Vercel non offre un fix/workaround supportato e il percorso non viene riaperto con PR separata. Non usare `--cwd apps/web`, `--prebuilt`, archivi, `--prod`, `promote`, `--skip-domain`, custom target o override manuali `VERCEL*`. Il percorso Preview resta non verificato; API e worker non partecipano finché non hanno packaging operativo.

Il build produce `artifacts/bl002`: `scripts/lib/build-artifact.mjs` copia soltanto output esplicitamente ammessi, incluso `packages/config/dist`, rifiuta link esterni/path sensibili e file ambientali, scansiona i file e registra byte+SHA-256 in `build-artifact-v1`. L’upload usa soltanto questo staging validato.

## Frontend e design

`apps/web` contiene una pagina Server Component minima soltanto per validare il build Next.js. Non è la shell di gioco e non anticipa componenti ad hoc. `BL-079` resta in backlog dietro `BL-080` e installerà shadcn/ui, AI Elements selettivi, Motion e il sistema visuale descritto in `docs/product/UX_UI_DESIGN.md`; la fondazione database `BL-004` è indipendente dallo staging e si chiude senza anticipare UI.
