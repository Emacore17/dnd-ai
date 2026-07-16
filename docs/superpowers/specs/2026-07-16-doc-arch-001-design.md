---
status: active
owner: engineering
last_reviewed: 2026-07-16
last_verified_commit: 3e9c6d5b088825066fedab4163c8482d391ab543
source_refs:
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#19-modello-dati
  - docs/MVP_SPEC.md#24-osservabilit%C3%A0
  - docs/MVP_SPEC.md#29-infrastruttura-e-deployment
  - docs/TASKS.md#doc-arch-001--documentazione-architetturale-dati-e-sviluppo-locale
  - docs/adr/0002-monorepo-package-boundaries.md
  - docs/adr/0006-postgresql-migration-foundation.md
related_tasks:
  - DOC-ARCH-001
  - BL-001
  - BL-003
  - BL-004
  - BL-008
  - BL-009
  - BL-010
code_refs:
  - package.json
  - pnpm-workspace.yaml
  - apps/web/app/health/route.ts
  - apps/api/src/runtime.ts
  - apps/worker/src/runtime.ts
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - infra/local/postgres.compose.yml
test_refs:
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/document-integrity.test.mjs
supersedes: null
---

# DOC-ARCH-001 — Design della documentazione architetturale e dello sviluppo locale

## Scopo

`DOC-ARCH-001` deve trasformare la specifica e le fondazioni M0 già integrate in una documentazione living verificabile. Il risultato deve permettere a uno sviluppatore di distinguere rapidamente ciò che il repository esegue oggi dall'architettura normativa assegnata ai task futuri, comprendere i confini del modular monolith e portare un checkout pulito fino agli health check realmente disponibili.

Il task non completa l'architettura target: la descrive senza presentare come operative API di dominio, Redis locale, BullMQ, outbox, SSE, tabelle di gioco, staging o production.

## Vincoli approvati

- La specifica resta la fonte normativa; codice, migration e contratti dimostrano lo stato implementato.
- Ogni vista usa le etichette **Implementato** e **Pianificato**. Una vista mista deve rendere lo stato di ogni nodo o tabella inequivocabile.
- Un solo nuovo ADR sintetizza forma del sistema, trasporti, persistenza e workflow; non duplica le decisioni operative già possedute dagli ADR-0002, ADR-0004, ADR-0006, ADR-0007 e ADR-0008.
- Il setup locale usa soltanto comandi e capacità presenti nel repository. Non introduce un secondo orchestratore, un generatore documentale, nuove dipendenze o nuova infrastruttura.
- Il percorso di verifica non usa rete applicativa esterna, provider AI, account cloud o Vercel.
- Il task è in corsia `STANDARD`: modifica documentazione e aggiunge un contract test anti-drift, senza cambiare runtime, workflow CI o configurazione di deploy.

## Approcci valutati

### Documentazione living stratificata — scelta

Responsabilità separate per overview, dati e sviluppo locale, collegate da indice e ADR. Limita la duplicazione dei runbook esistenti e consente test anti-drift mirati.

### Handbook unico

Riduce il numero iniziale di file, ma mescola onboarding, decisioni e schema dati. Duplicherebbe `CONFIGURATION.md` e `DATABASE_MIGRATIONS.md`, aumentando il costo di manutenzione.

### Documentazione generata

Un generatore potrebbe derivare package e migration dal codice, ma introdurrebbe una pipeline prima che il formato sia stabile. Per M0 è sufficiente un contract test che confronti pochi invarianti autorevoli.

## Struttura dei deliverable

### `docs/architecture/SYSTEM_OVERVIEW.md`

Resta l'entry point architetturale e viene consolidato in quattro viste:

1. inventario implementato dei tre runtime e degli otto package condivisi;
2. direzioni di dipendenza e composition root reali;
3. flusso target REST → Fastify → PostgreSQL/outbox → BullMQ → worker → commit → SSE, interamente marcato come pianificato dove manca il consumer;
4. topologia locale e managed target, con staging esplicitamente non disponibile.

Il documento non replica matrici di configurazione, procedure migration o dettagli CI: collega i documenti proprietari.

### `docs/data/DATA_MODEL.md`

Diventa l'autorità living sul modello dati e mantiene due sezioni separate:

- **schema fisico implementato:** estensione `vector`, namespace `app`/`infra`, `infra.migration_contracts`, `app.feature_flags`, `app.feature_flag_events`, vincoli, indici, ownership e migration head `000002_feature_flags` con contract `database-feature-flags-v1`;
- **modello logico pianificato:** famiglie utenti/campagne, eventi/proiezioni, snapshot, memoria e AI usage provenienti dalla specifica, senza colonne o indici inventati oltre il contratto normativo.

Un diagramma ER descrive soltanto lo schema fisico corrente. Il modello futuro usa un diagramma concettuale distinto e nodi marcati `Pianificato`, evitando che una relazione prevista venga interpretata come migration esistente.

### `docs/operations/LOCAL_DEVELOPMENT.md`

È il percorso di onboarding da checkout pulito. Riusa tramite link i dettagli di configurazione e migration, ma possiede l'ordine operativo completo:

1. verificare Git, Node, Corepack/pnpm e Docker Compose;
2. eseguire installazione frozen;
3. copiare i tre template `.env.example` in file `.env.local` ignorati e sostituire soltanto i sentinel locali;
4. avviare PostgreSQL/pgvector e attendere il health check Compose;
5. validare la configurazione migration, applicare l'head e verificarne lo stato;
6. costruire workspace e app;
7. verificare `/health` del web su loopback, startup Fastify e initializer worker tramite i percorsi disponibili;
8. arrestare i processi e rimuovere il Compose locale in `finally`.

La guida dichiara che API e worker non aprono ancora connessioni DB/Redis applicative, che l'API non espone ancora un endpoint health proprio e che il worker non è ancora un daemon BullMQ avviabile. La readiness corrente è quindi composta da health PostgreSQL, `/health` web, startup API e integration test del worker.

### `docs/adr/0009-mvp-runtime-data-and-workflow-architecture.md`

L'ADR registra una sola decisione composita già normativa:

- modular monolith TypeScript con runtime web/API/worker separabili;
- Fastify per il composition root API;
- REST per query/comandi e SSE unidirezionale per progress/delivery;
- PostgreSQL + JSONB + pgvector come stato autorevole, Redis non autorevole;
- event sourcing pragmatico con evento e proiezione nella stessa transazione;
- BullMQ per l'MVP, stato durabile PostgreSQL, outbox e job ID deterministico.

Motivazioni, alternative, svantaggi e trigger di revisione vengono riportati una sola volta. L'ADR collega quelli specialistici già accepted e specifica quali parti sono implementate e quali restano target. Non rende `accepted` ADR-0005 né modifica il freeze Vercel.

### Documenti di governo

`docs/README.md`, `docs/adr/README.md`, `docs/CONTEXT.md`, `docs/TASKS.md`, `docs/TRACEABILITY.md` e `docs/CHANGELOG.md` vengono aggiornati solo per indice, ownership, stato del task, riferimenti e modifica architetturale significativa. `docs/MVP_SPEC.md` cambia soltanto se l'implementazione rivela una divergenza normativa reale; il design corrente non ne prevede una.

## Flussi e confini

### Stato implementato

Il browser può raggiungere il Route Handler Next `/health`. L'API valida il profilo service-scoped, crea Fastify e inizializza osservabilità prima del bind; non contiene route di dominio e non usa ancora le URL DB/Redis oltre la validazione. Il worker valida configurazione e osservabilità prima dell'initializer iniettato; non possiede un entry point daemon. Il composition root migration collega config e persistence e applica le migration PostgreSQL reali. Il database contiene esclusivamente fondazione, ledger e feature flag auditate.

### Target pianificato

Il web invierà comandi REST idempotenti all'API e riceverà progress/delivery tramite SSE. L'API persisterà intent/outbox in PostgreSQL e pubblicherà job BullMQ con ID deterministico. Il worker ricostruirà il contesto autorevole, applicherà Rules Engine e adapter AI, quindi committerà evento e proiezione prima della narrazione definitiva. Redis coordinerà lock e queue senza diventare fonte della verità.

Le due descrizioni restano separate anche nei diagrammi; nessuna freccia target implica un code path corrente.

## Failure path del setup locale

| Failure | Esito obbligatorio | Recupero |
|---|---|---|
| Versione Node/pnpm incompatibile | preflight non procede | attivare le versioni pin del repository |
| Docker/Compose assente | nessun servizio o migration avviato | ripristinare Docker e ripetere il preflight |
| Porta PostgreSQL occupata o container unhealthy | `db:local:up` fallisce bounded | liberare la porta, rimuovere solo lo stack locale e riprovare |
| File `.env.local` mancante o sentinel invariato | config check fallisce senza stampare valori | copiare il template e fornire URL esclusivamente locali |
| Checksum, ordine o contract migration incoerente | migration fail-closed prima del DDL utile | ripristinare la migration condivisa o creare forward-fix nel task proprietario |
| Build o startup API fallito | health locale non dichiarato verde | correggere il finding; nessun bypass o servizio fittizio |
| `/health` web non risponde con `web-health-v1` | cold start fallito | terminare il processo, esaminare output locale redatto e riprovare |
| Cleanup incompleto | verifica non conclusa | arrestare processi esatti e usare `db:local:down` sul solo progetto locale |

## Contratto anti-drift

`tests/contracts/architecture-documentation.test.mjs` sarà un test piccolo e read-only. Deve fallire quando:

- un workspace tracciato non è rappresentato nell'overview o ne viene dichiarato uno inesistente;
- migration head o contract documentati divergono dalle costanti persistence;
- un comando canonico della guida non esiste nel root `package.json`;
- i documenti affermano che BullMQ, Redis locale, route API di dominio o staging sono implementati;
- manca la distinzione esplicita fra stato implementato e pianificato.

Il test non fotografa interi documenti e non sostituisce `verify:docs`. Front matter, link, anchor, section reference, registro ADR, task graph e rendering Mermaid restano proprietà dei gate documentali esistenti.

## Strategia di verifica

### Durante lo sviluppo

- eseguire il nuovo contract test dopo ogni batch coerente;
- eseguire `pnpm verify:docs` dopo aver completato documenti e registro ADR;
- eseguire `pnpm verify:affected` sul candidato `STANDARD`.

### Cold checkout

Su un worktree detached dal candidato:

1. `corepack pnpm@11.13.0 install --frozen-lockfile`;
2. creare esclusivamente i file locali ignorati dai template;
3. `db:local:up`, config check, migration e status all'head;
4. build dei workspace;
5. avvio web su loopback e readback HTTP del contratto `web-health-v1`;
6. verifica startup API e initializer worker con le suite d'integrazione;
7. teardown di processi e database anche in caso di errore.

L'evidenza registra comandi, exit code, ambiente, head/contract migration e risultato health senza URL sensibili. Non produce un report separato né un commit post-CI.

## Fuori scope

- aggiunta di Redis al Compose locale o avvio di BullMQ;
- route API di dominio, endpoint health API, daemon worker o SSE;
- tabelle utenti/campagne/eventi/memoria e relativi indici/RLS;
- generatori di documentazione o nuove dipendenze;
- modifiche a CI, packaging, contratti pubblici o migration;
- provider AI, account cloud, staging, production o qualsiasi operazione Vercel;
- implementazione della shell UX/UI di `BL-079`.

## Criteri di accettazione mappati

| Criterio card | Evidenza prevista |
|---|---|
| Diagrammi e package boundaries coincidono con il codice | overview separata implementato/target, contract test workspace, Mermaid gate |
| Topologia e decisioni coincidono con codice/spec | ADR-0009, overview, backlink agli ADR specialistici |
| Migration head e modello dati coincidono | `DATA_MODEL.md`, costanti persistence e contract test |
| Comandi local/staging sono veritieri | guida locale; staging marcato non disponibile e posseduto da BL-080 |
| Cold-start pulito porta a health verdi | install frozen, PostgreSQL healthy/head, build, web health, startup API e worker integration |
| Code path citati controllati | front matter verificato e contract test anti-drift |
| Nessuna divergenza silenziosa dalla spec | etichette implementato/pianificato; ADR obbligatorio per differenze reali |

## Delivery

Il task usa una branch `codex/doc-arch-001`, un candidato coerente e una sola PR verso `main`. Lo stato terminale proposto comprende documenti, test, card ed evidenze locali. L'integrazione avviene soltanto dopo `CI / Merge gate` verde, senza bypass, commit di sola evidenza o azioni Vercel.
