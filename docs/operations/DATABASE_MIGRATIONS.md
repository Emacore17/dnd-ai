---
status: active
owner: engineering-and-data
last_reviewed: 2026-07-16
last_verified_commit: 8e6e0d3d46daa057ba80999c58c83ad1c92471b1
source_refs:
  - docs/MVP_SPEC.md#195-migrazioni-e-compatibilità
  - docs/MVP_SPEC.md#264-integration-test-database
  - docs/MVP_SPEC.md#295-migrazioni-zero-downtime
  - docs/adr/0006-postgresql-migration-foundation.md
  - docs/adr/0010-internal-provider-neutral-identity.md
related_tasks:
  - BL-004
  - BL-005
  - BL-010
code_refs:
  - package.json
  - packages/config/src/runtime-config.ts
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - packages/persistence/src/migrations/000003_identity_signup.ts
  - packages/persistence/src/feature-flags.ts
  - packages/persistence/src/identity-store.ts
  - scripts/run-database-migrations.mjs
  - scripts/manage-feature-flag.mjs
  - scripts/lib/database-migration-policy.mjs
  - scripts/lib/postgres-test-container.mjs
  - infra/local/postgres.compose.yml
test_refs:
  - tests/unit/database-migration-policy.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/database/database-migration-failure.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/database/feature-flags.test.mjs
  - tests/database/identity-migration.test.mjs
  - tests/database/identity-store.test.mjs
  - tests/security/database-migration-security.test.mjs
  - tests/security/feature-flags-security.test.mjs
  - docs/testing/BL-004_VERIFICATION.md
supersedes: null
---

# Operazioni database e migrazioni

## Scopo e contratto corrente

Questo runbook copre il lifecycle locale, l'applicazione delle migration, il controllo dello stato, il test riproducibile e il recupero dagli errori. Non autorizza operazioni su production.

| Campo | Valore |
|---|---|
| PostgreSQL | `17` |
| pgvector | `0.8.2` |
| Immagine | `pgvector/pgvector:0.8.2-pg17-trixie@sha256:5c97c57367a485a8e99389548db67d441ab1a878f5492c3df04989f34ecf3c75` |
| Runner/driver | `node-pg-migrate@8.0.4` / `pg@8.22.0` |
| Migration head | `000003_identity_signup` |
| Contract | `database-identity-signup-v1` |
| Source SHA-256 | `22821ad6cf592d99ed63cd444cf2a6b4e3ea936685c0e32b975bf71e06969d05` |
| Contract checksum | `5890760af32ac99501ce9a5119e4e9d2b43c6687d6c4e14c5a4cf27188d35f88` |
| Namespace | `app`, `infra` |
| Registro | `infra.migration_contracts` |

La baseline `000001` abilita `vector` e crea i due namespace e il registro di integrità. `000002_feature_flags` aggiunge catalogo e audit dei kill switch. `000003_identity_signup` aggiunge utenti pending/active, credenziali Argon2id, challenge, sessioni, outbox email, rate limit, idempotenza e audit identity append-only. Non contiene campagne, turni, RLS, colonne/indici vettoriali o dati di gioco.

## Prerequisiti e configurazione

Sono richiesti Node/pnpm alle versioni del repository e Docker con supporto Compose. Il client `psql` sul sistema host non è richiesto: runner e test usano il driver Node e il container PostgreSQL reale.

Creare il file locale ignorato dal template:

```powershell
Copy-Item packages/persistence/.env.example packages/persistence/.env.local
```

Il composition root richiede esclusivamente:

```dotenv
APP_ENV=local
MIGRATION_DATABASE_URL=postgresql://dnd_migration_local:dnd_migration_local@127.0.0.1:55432/dnd_ai_local
```

La URL del template usa esclusivamente credenziali sintetiche note e il database locale creato da `db:local:up`; non è un secret e non è valida fuori dal Compose locale. Non commettere `.env.local`, non sostituirla con credenziali gestite e non passare URL reali come argomento visibile nella command line. In staging/production le stesse chiavi vengono iniettate dal secret manager; non si usano file `.env`.

## Percorso locale standard

### 1. Avvio del database

```powershell
corepack pnpm@11.13.0 db:local:up
```

Il comando usa l'immagine pin a digest, attende con polling bounded il readiness del database e fallisce se il container non raggiunge lo stato healthy. Non deve selezionare un'immagine alternativa o un tag mobile.

### 2. Controllo della configurazione

```powershell
corepack pnpm@11.13.0 config:check:migration
```

L'output ammesso contiene soltanto servizio e ambiente. URL, username, password e dettagli del driver non devono essere stampati.

### 3. Stato prima dell'applicazione

Per il percorso locale, che carica `packages/persistence/.env.local`:

```powershell
corepack pnpm@11.13.0 db:migrate:status:local
```

In CI o in un ambiente gestito, dopo l'iniezione delle variabili nel processo, usare invece `corepack pnpm@11.13.0 db:migrate:status` senza file ambientali.

Su un database vuoto lo stato atteso indica head non applicato e contract non inizializzato. Un errore di ordine, checksum o compatibilità interrompe il comando con exit non-zero.

### 4. Applicazione all'head

Per il percorso locale:

```powershell
corepack pnpm@11.13.0 db:migrate:local
```

In CI o in un ambiente gestito, dopo l'iniezione delle variabili nel processo, usare `corepack pnpm@11.13.0 db:migrate`.

Il composition root e il runner:

1. valida `APP_ENV` e `MIGRATION_DATABASE_URL` prima di connettersi;
2. verifica che i file migration compilati corrispondano esattamente al manifest e non contengano symlink;
3. apre una sessione PostgreSQL e verifica ledger, source SHA, checksum del contratto, ordine e compatibilità correnti;
4. tenta il lock advisory non bloccante prima del DDL;
5. applica tutte le migration pendenti in una singola transazione e aggiorna `infra.migration_contracts`;
6. ripete il controllo di stato e rilascia sempre lock e connessione.

Ripetere lo stesso comando su un database già all'head deve produrre un no-op e lasciare invariati schema, checksum e contract.

### 5. Verifica dello stato finale

```powershell
corepack pnpm@11.13.0 db:migrate:status:local
```

Lo stato valido riporta `000003_identity_signup`, `database-identity-signup-v1` e nessuna migration pendente. Il report può contenere nomi e checksum delle migration, mai la URL di connessione.

### 6. Chiusura del database locale

```powershell
corepack pnpm@11.13.0 db:local:down
```

Il comando rimuove soltanto le risorse Compose del progetto locale identificato. Non deve accettare target remoti o cancellare directory del workspace.

## Rollback locale controllato

Le down migration non sono un meccanismo di rollback per ambienti gestiti. Sono disponibili unicamente per provare il failure path su un database locale e disposable:

```powershell
corepack pnpm@11.13.0 db:rollback:local
```

Lo script dedicato trasmette internamente al composition root la conferma `--confirm-local-rollback`; invocare il comando distinto è quindi una conferma operativa esplicita, non un default del runner generale.

Il comando deve rifiutare l'operazione quando almeno una delle condizioni seguenti non è soddisfatta:

- `APP_ENV=local`;
- destinazione riconosciuta come database disposable locale;
- conferma `--confirm-local-rollback` presente;
- lock advisory acquisito;
- head e checksum coerenti.

Dopo il rollback locale, rieseguire `db:migrate:local` e verificare che checksum e stato convergano nuovamente allo stesso head. Non aggiungere flag di bypass per staging o production.

## Test riproducibile

```powershell
corepack pnpm@11.13.0 db:migrate:test
```

Il comando possiede il lifecycle di un database isolato e deve verificare almeno:

- database vuoto -> `000003_identity_signup`;
- upgrade dalla versione precedente: `000002_feature_flags` -> `000003_identity_signup`;
- replay all'head come no-op;
- presenza dell'estensione `vector`, dei namespace `app`/`infra`, di `infra.migration_contracts`, di `app.feature_flags` e di `app.feature_flag_events`;
- source SHA normalizzato, checksum canonico e compatibilità `database-identity-signup-v1`;
- file migration sconosciuti e symlink rifiutati prima del DDL;
- ordine fail-closed con `checkOrder`;
- errore DDL con rollback completo della singola transazione;
- due runner realmente simultanei e lock già occupato rifiutati senza doppia applicazione;
- rollback locale rifiutato senza conferma e in un ambiente gestito;
- override di routing PostgreSQL nella query string rifiutato per il rollback locale;
- output e report privi di URL o credenziali.

La suite `tests/database/feature-flags.test.mjs` continua a verificare lettura seed, cambio flag senza deploy, audit, CAS, idempotenza e rollback. Le suite `identity-migration`/`identity-store` aggiungono constraint, indici, zero/previous→head, signup/verify/resend atomici, race reali, rate limit, idempotenza e audit append-only.

Il test termina sempre il container isolato, anche dopo un failure. Nessun test usa SQLite, sleep arbitrari o dati reali.

## Failure path e recupero

| Sintomo | Comportamento obbligatorio | Recupero sicuro |
|---|---|---|
| Config mancante o malformata | Exit non-zero prima della connessione; solo nomi delle chiavi invalide | Correggere `.env.local` o secret injection, poi rieseguire il preflight |
| Docker non disponibile o health timeout | Nessuna migration eseguita | Ripristinare Docker, controllare il container e rieseguire `db:local:up` |
| Connessione/auth/TLS fallita | Exit non-zero senza registrare migration | Correggere connettività o credenziale; non stampare la URL nei report |
| Lock advisory occupato | Fallimento immediato, nessuna attesa e nessun DDL | Attendere la conclusione del runner proprietario e riprovare; non forzare unlock |
| Checksum di una migration applicata differente | Fail-closed prima del DDL | Ripristinare il file condiviso; correggere il comportamento con una nuova forward-fix |
| Migration fuori ordine | Fail-closed tramite `checkOrder` | Rinominare solo una migration non condivisa oppure aggiungere una nuova migration ordinata |
| SQL/DDL invalido | Rollback dell'intera transazione e registro invariato | Correggere una migration non condivisa; se condivisa, creare una forward-fix |
| Contract incompatibile | Rollout bloccato prima della mutation | Aggiornare prima i consumer o aggiungere una migration compatibile e documentata |
| Rollback senza conferma o non locale | Operazione rifiutata | Usare rollback applicativo più forward-fix; nessun bypass |
| Teardown locale incompleto | Database non considerato pulito per un nuovo test | Eseguire `db:local:down`, verificare lo scope Compose e ripetere su un database nuovo |

Non modificare manualmente `infra.migration_contracts`, non cancellare il ledger per “sbloccare” un deploy e non riscrivere una migration già condivisa.

## Rollback operativo in staging e production

In staging e production non eseguire `down`:

1. fermare il rollout che introduce il problema;
2. mantenere lo schema espanso;
3. ripristinare una versione applicativa dichiarata compatibile;
4. preparare una nuova migration forward-fix, con nuovo nome e checksum;
5. provare vuoto, upgrade, replay e failure path su PostgreSQL reale;
6. applicare prima in staging e verificare status, health e telemetry redatta;
7. procedere in production soltanto tramite change plan autorizzato.

Un restore da backup non sostituisce la migration policy ed è posseduto dal runbook di hardening. Production non è un ambiente di prova.

## Regole di authoring e expand/contract

- usare prefissi numerici monotoni a sei cifre, ad esempio `000004_add_campaigns`;
- una migration condivisa è immutabile; ogni correzione usa un nuovo file;
- aggiungere prima tabelle/colonne nullable o con default sicuri;
- usare dual read/write solo con un periodo di compatibilità esplicito;
- rendere ogni backfill idempotente, osservabile e fuori dal deploy sincrono se può riscrivere grandi tabelle;
- cambiare le letture solo dopo il completamento verificato del backfill;
- rimuovere il vecchio schema in una release successiva;
- separare e revisionare le operazioni non transazionali, incluso `CREATE INDEX CONCURRENTLY`, senza disattivare il default transazionale globale;
- introdurre tabelle di dominio, RLS, colonne e indici vettoriali soltanto nei task proprietari con migration e test dedicati.

## Evidenze da registrare

Per chiudere una modifica database registrare:

- commit e migration head;
- contract version e checksum;
- immagine PostgreSQL/pgvector completa di digest;
- comandi, exit code e durata;
- esito database vuoto, upgrade, replay, lock e rollback/failure path;
- ambiente `local`, CI o staging, senza credenziali;
- report di test e documenti aggiornati;
- forward-fix o rischio residuo tracciato.
