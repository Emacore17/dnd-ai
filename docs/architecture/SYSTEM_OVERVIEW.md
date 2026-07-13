---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: f1be878b291a535ea6c8e0d995ee5e3c80ef164c
source_refs:
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#29-infrastruttura-e-deployment
  - AGENTS.md#9-confini-architetturali-e-struttura-target
related_tasks:
  - BL-001
  - BL-002
  - BL-079
  - BL-080
  - DOC-ARCH-001
code_refs:
  - apps/web
  - apps/web/components.json
  - apps/web/src/app
  - apps/web/src/components/game
  - apps/web/artifact-runtime/start.mjs
  - apps/api
  - apps/worker
  - packages
  - scripts/lib/workspace-boundaries.mjs
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/smoke-build-artifact.mjs
test_refs:
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/contracts/bl079-ui-foundation.test.mjs
  - apps/web/e2e/game-shell.spec.ts
  - tests/integration/artifact-runtime.test.mjs
supersedes: null
---

# System overview

## Stato implementato

`BL-001` introduce un monorepo TypeScript buildabile e `BL-002` la pipeline fail-closed. `BL-079` aggiunge una fondazione frontend reale ma ancora alimentata da fixture: database, queue, contratti di dominio, adapter AI, autenticazione e configurazione runtime restano assegnati ai task M0 successivi.

```text
apps/
  web/             Next.js App Router; design system e shell BL-079 su fixture
  api/             Fastify composition root; nessuna route di prodotto
  worker/          entry point worker vuoto; BullMQ pianificato
packages/
  contracts/       DTO e schemi esterni futuri
  domain/          entità, comandi, porte e invarianti puri
  rules/           Rules Engine deterministico
  ai/              porte, prompt/context e adapter AI futuri
  persistence/     implementazioni repository e migration future
  observability/   logging, tracing e metriche condivise future
  testing/         fixture/fake condivisi senza logica di produzione
```

La struttura usa i nomi compatti definiti in `AGENTS.md`: `rules` corrisponde al `rules-engine` raccomandato dalla specifica; `ai` mantiene un solo confine finché `BL-021` non introduce una separazione concreta fra porta e adapter. Il dominio non importa SDK provider.

## Direzione delle dipendenze

| Sorgente | Workspace importabili |
|---|---|
| `contracts` | nessuno |
| `domain` | nessuno |
| `rules` | `domain` |
| `ai` | `contracts`, `domain` |
| `persistence` | `contracts`, `domain` |
| `observability` | nessuno |
| `testing` | tutti i package, mai le app |
| `web` | `contracts`, `observability` |
| `api`, `worker` | `contracts`, `domain`, `rules`, `ai`, `persistence`, `observability` |

App→app, package→app, import relativi che escono dal package e cicli workspace sono vietati. `scripts/check-boundaries.mjs` controlla sia le dipendenze dei manifest sia gli import/export TypeScript/JavaScript. Il test contract esegue anche una fixture in cui `domain` dipende da `persistence` e richiede exit code `1`.

## Toolchain riproducibile

| Elemento | Versione pin |
|---|---|
| Node.js | `24.11.0` per il workspace; engine minimo `20.9.0` |
| pnpm | `10.34.5` |
| Turborepo | `2.10.4` |
| TypeScript | `6.0.3` |
| Next.js / React | `16.2.10` / `19.2.7` |
| Fastify | `5.10.0` |

TypeScript 7 non è stato selezionato perché `typescript-eslint@8.63.0` dichiara compatibilità `<6.1.0`. ESLint resta sulla linea `9.39.2`, compatibile con i plugin transitivi di Next 16.

La supply-chain policy pnpm permette install script soltanto a `sharp` (runtime immagini di Next) e `unrs-resolver` (resolver nativo usato dal lint); ogni nuovo script transitive resta bloccato finché non viene revisionato e aggiunto esplicitamente ad [`allowBuilds`](https://pnpm.io/settings#allowbuilds).

## Comandi disponibili in BL-001/BL-002/BL-079

```bash
corepack pnpm@10.34.5 install --frozen-lockfile
corepack pnpm@10.34.5 lint
corepack pnpm@10.34.5 typecheck
corepack pnpm@10.34.5 build
corepack pnpm@10.34.5 test:contract
corepack pnpm@10.34.5 test:security
corepack pnpm@10.34.5 test:component
corepack pnpm@10.34.5 test:e2e
corepack pnpm@10.34.5 scan:sast
corepack pnpm@10.34.5 boundaries:check
corepack pnpm@10.34.5 tasks:check
corepack pnpm@10.34.5 verify
```

`verify` copre format, lint, typecheck, unit, component, integration, contract, security, package/task/CI policy, build e artifact verification. La CI BL-079 esegue anche il browser harness; `test:e2e` resta separato dal comando locale aggregato per rendere esplicito il costo. Test container, migration, eval, bot e load restano responsabilità dei task proprietari, soprattutto `QA-001`; nessun comando futuro è simulato da un no-op.

## CI e supply chain

`.github/workflows/ci.yml` separa quality, test, security e build. `CI / Merge gate` usa `always()` e considera valido soltanto `success` per ogni job richiesto, così failure, cancellation e skip non vengono mascherati. Il workflow usa `pull_request`, push `main`, merge queue e dispatch manuale; `pull_request_target` è vietato dalla policy automatica.

Le action esterne sono pin a SHA completo, checkout non persiste credenziali e i permessi globali sono read-only. La cache gestita da `setup-node` contiene soltanto lo store pnpm indicizzato dal lockfile. Security esegue SAST locale fail-on-warning, test/secret scan e dependency audit; non riceve secret applicativi.

Il build produce `artifacts/bl002`: `scripts/lib/build-artifact.mjs` copia soltanto output esplicitamente ammessi, dereferenzia solo i junction pnpm con mirror traced, omette private-hoist non materializzati senza leggere byte esterni, rifiuta link/path sensibili, scansiona i file e registra byte+SHA-256 in `build-artifact-v1`. Il launcher incluso ripristina `NODE_PATH` soltanto verso il mirror pnpm del payload; `artifact:smoke` prova un boot e una risposta HTTP reali prima dell'upload.

## Frontend e design

`apps/web/src/app` monta la shell fixture implementata da `BL-079`. Il design system usa shadcn/ui `new-york` su Radix e token Tailwind 4; AI Elements è limitato alle primitive presentazionali di conversazione, Motion è lazy e rispetta reduced-motion, Rive non entra nel bundle P0. I wrapper `components/game` modellano i dieci stati visivi del turno senza introdurre trasporto o stato canonico parallelo. Vitest/Testing Library verificano i contratti componenti; Playwright/axe copre otto viewport, keyboard, safe area, regressione visuale e performance smoke. REST/SSE e `TurnView` reale appartengono ai consumer BL-039/BL-040/BL-041.

La prima preview/staging M0 non è ancora implementata: `BL-003` fornisce typed config e secret contract, quindi `BL-080` possiede provisioning, deploy automatico, smoke e rollback minimo. `BL-070` resta il task di hardening pre-release per load/chaos, restore e separazione production definitiva.
