---
status: accepted
owner: engineering-and-data
last_reviewed: 2026-07-14
last_verified_commit: c72c78bbae06ebb02c7de7d63844f17065354c06
source_refs:
  - docs/MVP_SPEC.md#195-migrazioni-e-compatibilita
  - docs/MVP_SPEC.md#264-integration-test-database
  - docs/MVP_SPEC.md#295-migrazioni-zero-downtime
  - docs/MVP_SPEC.md#31-backlog-iniziale
  - docs/adr/0002-monorepo-package-boundaries.md
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
related_tasks:
  - BL-004
code_refs:
  - package.json
  - packages/config/src/runtime-config.ts
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - scripts/run-database-migrations.mjs
  - scripts/lib/database-migration-policy.mjs
  - scripts/lib/postgres-test-container.mjs
  - infra/local/postgres.compose.yml
test_refs:
  - tests/unit/database-migration-policy.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/database/database-migration-failure.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/security/database-migration-security.test.mjs
supersedes: null
---

# ADR-0006 — Fondazione PostgreSQL e contratto delle migrazioni

## Stato

Accepted il 2026-07-14 durante `BL-004`.

## Contesto

`BL-004` deve rendere riproducibili la creazione di un database vuoto, l'upgrade da una versione supportata, il replay su un database già aggiornato e il recupero da un errore. La verifica deve usare PostgreSQL reale, non SQLite, e deve preservare i confini stabiliti dagli ADR-0002 e ADR-0004: `@dnd-ai/config` resta un leaf server-only e `@dnd-ai/persistence` non dipende dalla configurazione ambientale.

La specifica impone migrazioni forward-only negli ambienti gestiti e il pattern expand/contract. La baseline non deve anticipare le tabelle di dominio, i vincoli tenant, gli indici vettoriali o le policy RLS posseduti dai task successivi.

## Decisione

### Runtime e dipendenze pin

1. La baseline locale e CI usa PostgreSQL 17 con pgvector 0.8.2 tramite l'immagine immutabile:

   ```text
   pgvector/pgvector:0.8.2-pg17-trixie@sha256:5c97c57367a485a8e99389548db67d441ab1a878f5492c3df04989f34ecf3c75
   ```

   Tag mobili, `latest` e digest non verificati non sono ammessi. Il provider gestito futuro deve dimostrare compatibilità con PostgreSQL 17 e con la versione pgvector prevista dal migration head prima del rollout.

2. Il runner usa `node-pg-migrate@8.0.4` e il driver `pg@8.22.0`. Le versioni restano esatte nel lockfile; un upgrade richiede test da database vuoto, upgrade, replay e failure path.

### Confini e composition root

3. I composition root sono script repository-level posseduti da `BL-004`. Leggono `process.env`, validano `APP_ENV` e `MIGRATION_DATABASE_URL` tramite `@dnd-ai/config`, quindi passano a `@dnd-ai/persistence` soltanto parametri già validati.
4. `@dnd-ai/persistence` espone discovery, pianificazione ed esecuzione delle migrazioni come API a input esplicito. Non importa `@dnd-ai/config`, non legge implicitamente l'ambiente e non stampa la URL di connessione.

### Baseline e contratto di compatibilità

5. La prima migration canonica è `000001_postgresql_foundation`; il migration contract corrente è `database-baseline-v1`.
6. La baseline crea esclusivamente:
   - l'estensione `vector` fornita da pgvector;
   - i namespace `app` e `infra`;
   - il registro `infra.migration_contracts`, che conserva nome ordinato, checksum SHA-256 del contratto canonico, versione, compatibilità dichiarata e timestamp di applicazione. Il checksum canonico include anche lo SHA-256 normalizzato della sorgente migration; i due digest restano distinti.
7. `infra.migration_contracts` è la prova di integrità e compatibilità. Il runner confronta il manifest versionato con i record applicati prima di eseguire DDL; una migration già condivisa con checksum differente, un ordine non valido o un contratto incompatibile falliscono chiusi.
8. `database-baseline-v1` non dichiara un predecessore perché è la prima versione. Ogni contratto successivo deve dichiarare la compatibilità con almeno la versione corrente e la precedente durante un rollout rolling, oppure bloccare esplicitamente il rollout finché tutti i consumer non sono aggiornati.
9. La baseline non crea tabelle di dominio, colonne `vector`, indici vettoriali, ownership applicativa, RLS, utenti applicativi o dati seed. Questi elementi restano nei task che possiedono i rispettivi invarianti.

### Ordinamento, atomicità e concorrenza

10. `checkOrder` è sempre attivo: una migration precedente a un head già applicato non può essere inserita fuori ordine.
11. Il runner tenta un advisory lock PostgreSQL stabile e non bloccante prima di modificare il database. Se il lock non è disponibile, termina con errore senza attendere e senza applicare migration.
12. Le migration pendenti vengono applicate in una singola transazione. Un errore annulla DDL e aggiornamento del registro nello stesso rollback; il lock viene sempre rilasciato nel blocco di chiusura della sessione.
13. Operazioni future incompatibili con una transazione, come `CREATE INDEX CONCURRENTLY`, richiedono un passo separato, idempotente e revisionato. Non possono disabilitare silenziosamente il default transazionale.

### Rollback e zero downtime

14. `staging` e `production` sono forward-only. Un rollback operativo consiste nel ripristinare una versione applicativa compatibile con lo schema espanso e applicare una nuova migration di forward-fix.
15. Una migration `down` è ammessa soltanto con `APP_ENV=local`, su database dichiarato disposable e con conferma esplicita. Il comando rifiuta ambienti gestiti, conferma assente e target non disposable.
16. Ogni evoluzione segue expand/contract: aggiunta compatibile, eventuale dual read/write, backfill idempotente, switch delle letture e rimozione soltanto in una release successiva. Le riscritture di grandi tabelle non entrano nel path di deploy sincrono.

## Alternative considerate

### Schema push o ORM come fonte implicita

Rifiutato: un diff implicito non fornisce un ordine immutabile, una policy forward-only né una prova chiara di checksum e compatibilità.

### Script SQL manuali senza runner

Rifiutato: non coprono in modo uniforme lock, ordine, ledger, replay, redazione e failure transazionale.

### Importare `@dnd-ai/config` da `@dnd-ai/persistence`

Rifiutato: invertirebbe il boundary deciso dall'ADR-0002 e renderebbe il package infrastrutturale dipendente da stato ambientale implicito.

### Creare subito il modello dati completo

Rifiutato: anticiperebbe tabelle e invarianti posseduti da identity, campaign, turn loop, event sourcing, memory e privacy. La baseline abilita le capability del database senza sostituire le migration dei task funzionali.

## Conseguenze e revisione

- locale e CI condividono una piattaforma PostgreSQL/pgvector riproducibile;
- il migration head e il checksum diventano contratti versionati e verificabili;
- un runner concorrente o un drift della storia falliscono prima di modificare lo schema;
- gli ambienti gestiti non dipendono da down migration distruttive;
- Docker è richiesto per il percorso locale/test, ma non è richiesto `psql` sul sistema host;
- `QA-001` potrà consolidare il lifecycle container comune senza cambiare questo contratto.

Rivedere la decisione se il provider gestito non supporta PostgreSQL 17/pgvector 0.8.2, se una migration richiede operazioni non transazionali ricorrenti o se metriche reali dimostrano che il runner scelto non soddisfa lock, recovery o tempi di deploy. Ogni revisione aggiorna specifica, migration contract, runbook e test nello stesso change set.
