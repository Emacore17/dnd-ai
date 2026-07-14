---
status: active
owner: engineering
last_reviewed: 2026-07-14
last_verified_commit: 1766406b9bd701a9880705b371fdc0b05a73abe1
source_refs:
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#29-infrastruttura-e-deployment
  - AGENTS.md#9-confini-architetturali-e-struttura-target
related_tasks:
  - BL-001
  - BL-002
  - BL-003
  - BL-079
  - BL-080
  - DOC-ARCH-001
code_refs:
  - apps/web
  - apps/api
  - apps/worker
  - packages/config
  - packages
  - scripts/lib/workspace-boundaries.mjs
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
  - apps/web/app/health/route.ts
  - infra/deployment/vercel-staging.json
  - .github/workflows/deployment-smoke.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
test_refs:
  - tests/unit/build-artifact.test.mjs
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
supersedes: null
---

# System overview

## Stato implementato

`BL-001` introduce un monorepo TypeScript buildabile e `BL-002` la pipeline fail-closed. `BL-003` aggiunge configurazione runtime server-only e startup fail-fast. `BL-080` ha implementato la fondazione deploy del web, creato il GitHub environment staging e collegato il progetto Vercel reale con auto-deploy spento. La Trusted Source OIDC è configurata, ma non esiste ancora alcun deployment: Production Branch, grant GitHub App repository-only, binding finali e prove remote restano aperti. La UI resta uno scaffold e database, queue, contratti di dominio, adapter AI e autenticazione restano assegnati ai task M0 successivi.

```text
apps/
  web/             Next.js App Router; scaffold browser + `/health` deploy metadata
  api/             Fastify composition root; config prima del bind
  worker/          config prima dell'initializer; BullMQ pianificato
packages/
  config/          parser Zod, profili runtime e CLI redatta
  contracts/       DTO e schemi esterni futuri
  domain/          entità, comandi, porte e invarianti puri
  rules/           Rules Engine deterministico
  ai/              porte, prompt/context e adapter AI futuri
  persistence/     implementazioni repository e migration future
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

TypeScript 7 non è stato selezionato perché `typescript-eslint@8.63.0` dichiara compatibilità `<6.1.0`. ESLint resta sulla linea `9.39.2`, compatibile con i plugin transitivi di Next 16.

La supply-chain policy pnpm permette install script soltanto a `sharp` (runtime immagini di Next) e `unrs-resolver` (resolver nativo usato dal lint); ogni nuovo script transitive resta bloccato finché non viene revisionato e aggiunto esplicitamente ad [`allowBuilds`](https://pnpm.io/settings#allowbuilds).

## Configurazione runtime

Il contratto `runtime-config-v1` distingue API, worker e migration. `APP_ENV` accetta `local`, `staging` e `production`; preview usa lo schema staging con risorse isolate. URL database/Redis sono service-scoped, i profili gestiti richiedono credenziale e trasporto cifrato e gli errori riportano soltanto i nomi delle chiavi invalide.

L'API valida prima di costruire Fastify e aprire il listener. Il worker valida prima dell'inizializzatore iniettato; il migration profile è pronto per l'executable di `BL-004`. Il web corrente non consuma config runtime e non importa `@dnd-ai/config`.

Template e procedure sono in [`CONFIGURATION.md`](../operations/CONFIGURATION.md). Il web ha desired state `staging-foundation-v1`, health contract `web-health-v1` e progetto Vercel `dnd-ai-web` (`prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`) nello scope `emacore17s-projects`, collegato a `Emacore17/dnd-ai` con Root Directory `apps/web`, Next.js e regione `fra1`. Fork Protection, system environment variables ed emissione OIDC sono abilitate; le variabili applicative sono zero. La Trusted Source GitHub Actions è exact-match sui claim attesi. Auto-deploy resta disabilitato e non esiste alcun deployment. La Production Branch è ancora `main` e l'installazione GitHub App `41079282` vede 8 repository invece del solo target; lo staging non è quindi disponibile. Gli artifact API/worker correnti restano output di build, non immagini/container operativi.

## Comandi disponibili in BL-001/BL-002/BL-003

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
corepack pnpm@10.34.5 deploy:check
corepack pnpm@10.34.5 verify
```

`verify` copre format, lint, typecheck, build, unit, integration, contract, security, package/task/CI/deployment policy e artifact verification. I comandi unit/integration preparano autonomamente i dist richiesti da un checkout pulito; l'integration suite avvia anche il server standalone web e verifica `/health`. Test container, browser/E2E, migration, eval, bot e load restano responsabilità dei task proprietari, soprattutto `QA-001`; nessun comando futuro è simulato da un no-op.

## CI e supply chain

`.github/workflows/ci.yml` separa quality, test, security e build. `CI / Merge gate` usa `always()` e considera valido soltanto `success` per ogni job richiesto, così failure, cancellation e skip non vengono mascherati. Il workflow usa `pull_request`, push `main`, merge queue e dispatch manuale; `pull_request_target` è vietato dalla policy automatica.

Nel workflow CI base le action esterne sono pin a SHA completo, checkout non persiste credenziali e i permessi globali sono read-only. La cache gestita da `setup-node` contiene soltanto lo store pnpm indicizzato dal lockfile. Security esegue SAST locale fail-on-warning, test/secret scan e dependency audit; non riceve secret applicativi.

Il workflow deployment smoke è separato: dopo la chiusura dei blocker provider, riceverà un evento dalla Vercel GitHub App, eseguirà una sequenza chiusa sul verifier trusted di `main` nell'environment GitHub `staging` e userà `id-token: write` soltanto per ottenere un OIDC breve. Il token potrà raggiungere esclusivamente l'origin branch esatta registrata; l'URL dell'evento è ignorato e Standard Protection resta attiva. Installation ID `41079282` e Trusted Source sono acquisiti, ma origin, grant repository-only e Production Branch non lo sono; questo percorso non è stato eseguito. API e worker non partecipano finché non hanno packaging operativo.

Il build produce `artifacts/bl002`: `scripts/lib/build-artifact.mjs` copia soltanto output esplicitamente ammessi, incluso `packages/config/dist`, rifiuta link esterni/path sensibili e file ambientali, scansiona i file e registra byte+SHA-256 in `build-artifact-v1`. L’upload usa soltanto questo staging validato.

## Frontend e design

`apps/web` contiene una pagina Server Component minima soltanto per validare il build Next.js. Non è la shell di gioco e non anticipa componenti ad hoc. `BL-079` resta pianificato dopo `BL-080` e installerà shadcn/ui, AI Elements selettivi, Motion e il sistema visuale descritto in `docs/product/UX_UI_DESIGN.md`.
