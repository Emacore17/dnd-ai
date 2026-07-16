---
status: accepted
owner: engineering
last_reviewed: 2026-07-16
last_verified_commit: 30f611e8e874b9c87d20d50c4c5f45528e1083a5
source_refs:
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#115-event-sourcing-pragmatico
  - docs/MVP_SPEC.md#118-decisione-rest--sse
  - docs/MVP_SPEC.md#196-decisione-eventi-pi%C3%B9-proiezioni-transazionali
  - docs/MVP_SPEC.md#297-bullmq-e-migrazione-a-temporal
  - docs/adr/0002-monorepo-package-boundaries.md
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
  - docs/adr/0006-postgresql-migration-foundation.md
  - docs/adr/0007-observability-context-and-error-reporting.md
  - docs/adr/0008-zod-first-contract-generation.md
related_tasks:
  - DOC-ARCH-001
  - BL-001
  - BL-004
  - BL-028
  - BL-029
  - BL-030
  - BL-036
  - BL-038
code_refs:
  - apps/web
  - apps/api/src/runtime.ts
  - apps/worker/src/runtime.ts
  - packages/config
  - packages/contracts
  - packages/domain
  - packages/rules
  - packages/ai
  - packages/persistence/src/migration-manifest.ts
  - packages/observability
test_refs:
  - tests/contracts/architecture-documentation.test.mjs
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/integration/runtime-startup.test.mjs
supersedes: null
---

# ADR-0009 — Architettura runtime, dati e workflow dell'MVP

## Stato

Accepted il 2026-07-16 durante `DOC-ARCH-001`.

## Contesto

La specifica seleziona un modular monolith TypeScript, ma le decisioni su runtime, trasporti, stato autorevole e workflow devono essere leggibili come un unico sistema. Le fondazioni correnti non implementano ancora il loop di gioco: l'ADR distingue quindi la decisione normativa dal suo stato di adozione, senza descrivere componenti pianificati come già disponibili.

## Decisione

1. Web Next.js, API Fastify e worker sono processi separabili dello stesso modular monolith e condividono contratti e moduli di dominio senza diventare microservizi autonomi.
2. Fastify è il composition root HTTP: le route restano sottili e delegano casi d'uso e regole ai moduli applicativi e di dominio.
3. REST gestisce query e comandi; SSE gestisce progress e delivery unidirezionale server→client. Lo stream definitivo viene emesso soltanto dopo il commit canonico previsto dal contratto del turno.
4. PostgreSQL con JSONB e pgvector è la fonte autorevole. Redis serve soltanto coordinamento effimero, lock, rate limit, cache e BullMQ; il sistema deve restare protetto dai vincoli PostgreSQL e ricostruibile senza stato Redis.
5. Gli eventi append-only e le proiezioni canoniche vengono scritti nella stessa transazione PostgreSQL. I side effect esterni passano da transactional outbox e consumer idempotenti.
6. BullMQ è il workflow engine dell'MVP: usa `jobId=turnId`, retry/backoff limitati, watchdog e stato autorevole in PostgreSQL. La state machine resta nel Turn Orchestrator, non nella queue.

## Stato di adozione

| Decisione | Stato | Evidenza o task proprietario |
|---|---|---|
| Tre processi separabili nello stesso modular monolith | `Implementato` | `BL-001`; workspace `@dnd-ai/web`, `@dnd-ai/api`, `@dnd-ai/worker` |
| Composition root Fastify con config fail-fast | `Implementato` | `BL-001`, `BL-003`; `apps/api/src/runtime.ts` |
| API di dominio REST e stream SSE | `Pianificato` | `BL-028` per il comando di turno; `BL-038` per lo stream |
| Fondazione PostgreSQL + pgvector autorevole | `Implementato` | `BL-004`; le tabelle di dominio arrivano con i task proprietari |
| Redis non autorevole per il lock del turno | `Pianificato` | `BL-029` |
| Eventi e proiezioni nella stessa transazione | `Pianificato` | `BL-036` |
| Outbox→BullMQ→worker con job ID deterministico | `Pianificato` | `BL-030` |

## Alternative considerate

- **Microservizi:** rifiutati nell'MVP perché aumentano deployment, consistenza distribuita e osservabilità senza un bisogno dimostrato.
- **WebSocket come default:** rifiutato perché l'interazione è comando discreto più stream server→client; REST+SSE copre il caso con meno stato di connessione.
- **Event store puro con proiezioni solo asincrone:** rifiutato perché complica query e consistenza immediata della vertical slice.
- **CRUD senza eventi:** rifiutato perché non soddisfa audit, replay, causation e idempotenza del gioco.
- **Temporal immediato:** rinviato perché il workflow MVP è breve e BullMQ mantiene minore costo e overhead operativo.

## Conseguenze

I confini di processo e di package restano espliciti, mentre la prima vertical slice può evolvere in un solo repository e con transazioni PostgreSQL locali. Il costo è che replay, outbox, watchdog, retry e compensation restano responsabilità applicative e devono essere coperti da test di idempotenza, crash recovery e convergenza.

## Condizioni di revisione

La scelta BullMQ viene rivista soltanto quando almeno due trigger misurabili di `MVP_SPEC` §29.7 sono veri: workflow di ore o giorni, catene oltre dieci step con compensation complesse, fan-out/fan-in frequente, recovery manuale oltre l'1%, workflow multi-region, costo operativo significativo di watchdog/reconciliation, nuove pipeline asincrone o necessità di versionare workflow in-flight tra più deploy. Le altre decisioni vengono riaperte soltanto da finding di capacità reali o dai criteri di revisione già definiti nella specifica; ogni modifica richiede aggiornamento coordinato di specifica, ADR, task e contratti.
