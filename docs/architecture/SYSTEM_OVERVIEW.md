---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: 6cda07a60022665f321b48dd82fbeb1d9bef586f
source_refs:
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#29-infrastruttura-e-deployment
  - AGENTS.md#9-confini-architetturali-e-struttura-target
related_tasks:
  - BL-001
  - DOC-ARCH-001
code_refs:
  - apps/web
  - apps/api
  - apps/worker
  - packages
  - scripts/lib/workspace-boundaries.mjs
test_refs:
  - tests/contracts/workspace-boundaries.test.mjs
supersedes: null
---

# System overview

## Stato implementato

`BL-001` introduce un monorepo TypeScript buildabile. In questa fase esistono soltanto entry point minimi e confini verificabili: non esistono ancora database, queue, contratti di dominio, adapter AI, autenticazione o configurazione runtime.

```text
apps/
  web/             Next.js App Router; superficie browser
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

## Comandi disponibili in BL-001

```bash
corepack pnpm@10.34.5 install --frozen-lockfile
corepack pnpm@10.34.5 lint
corepack pnpm@10.34.5 typecheck
corepack pnpm@10.34.5 build
corepack pnpm@10.34.5 test:contract
corepack pnpm@10.34.5 boundaries:check
corepack pnpm@10.34.5 tasks:check
corepack pnpm@10.34.5 verify
```

`verify` copre il perimetro di `BL-001`. Le suite complete di `docs/TASKS.md` §5, CI, test container e browser harness comune restano responsabilità di `BL-002` e `QA-001`.

## Frontend e design

`apps/web` contiene una pagina Server Component minima soltanto per validare il build Next.js. Non è la shell di gioco e non anticipa componenti ad hoc. `BL-079`, dipendente da `BL-001` e `BL-002`, installerà shadcn/ui, AI Elements selettivi, Motion e il sistema visuale descritto in `docs/product/UX_UI_DESIGN.md`.
