---
status: active
owner: engineering
last_reviewed: 2026-07-17
last_verified_commit: e173fd9424ad77330ae8302f68affd4832d66798
source_refs:
  - docs/MVP_SPEC.md#19-modello-dati
  - docs/MVP_SPEC.md#195-migrazioni-e-compatibilit%C3%A0
  - docs/MVP_SPEC.md#196-decisione-eventi-pi%C3%B9-proiezioni-transazionali
  - docs/adr/0006-postgresql-migration-foundation.md
  - docs/adr/0009-mvp-runtime-data-and-workflow-architecture.md
  - docs/adr/0010-internal-provider-neutral-identity.md
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
  - docs/superpowers/specs/2026-07-16-bl-006-session-access-design.md
related_tasks:
  - DOC-ARCH-001
  - BL-004
  - BL-005
  - BL-006
  - BL-010
  - BL-025
  - BL-028
  - BL-036
  - BL-037
  - BL-052
  - BL-054
  - BL-064
code_refs:
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - packages/persistence/src/migrations/000003_identity_signup.ts
  - packages/persistence/src/migrations/000004_identity_access.ts
  - packages/persistence/src/feature-flags.ts
  - packages/persistence/src/identity-store.ts
  - infra/local/postgres.compose.yml
test_refs:
  - tests/contracts/architecture-documentation.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/database/feature-flags.test.mjs
  - tests/database/identity-migration.test.mjs
  - tests/database/identity-store.test.mjs
  - tests/integration/identity-signup-flow.test.mjs
  - tests/security/database-migration-security.test.mjs
  - tests/security/feature-flags-security.test.mjs
supersedes: null
---

# Modello dati

## Legenda

- **Implementato**: schema creato dalle migration condivise e verificabile sul migration head corrente.
- **Pianificato**: modello normativo senza migration fisica corrente; nomi e relazioni non sono ancora un contratto SQL.

## Contratto fisico implementato

| Elemento | Valore corrente | Fonte |
|---|---|---|
| PostgreSQL | `17` | `infra/local/postgres.compose.yml` |
| pgvector | `0.8.2` | immagine Compose pin a digest |
| Migration runner | `node-pg-migrate 8.0.4` | `packages/persistence/package.json` |
| Migration head | `000004_identity_access` | `DATABASE_MIGRATION_HEAD` |
| Contract attivo | `database-identity-access-v1` | `DATABASE_CONTRACT_VERSION` |
| Compatibilità minima | migration `000001_postgresql_foundation` | manifest versionato |

Le migration sono eseguite in ordine, sotto advisory lock, con singola transazione per run. Il runner rifiuta file sconosciuti, ledger non ordinati, contract/checksum inattesi e oggetti di fondazione presenti senza migration applicata.

## Schema e tabelle implementate

### Estensione e namespace

- L'estensione `vector` è installata dalla prima migration. Non esistono ancora colonne embedding o indici vettoriali applicativi.
- Lo schema `infra` contiene il ledger gestito dal runner e il contratto applicativo delle migration.
- Lo schema `app` contiene feature flag/audit e il verticale identity. Non contiene ancora campagne, personaggi, turni o stato di gioco.

### `infra.schema_migrations`

Tabella gestita da `node-pg-migrate`, con `id` serial primary key, `name` `varchar(255) NOT NULL` e `run_on` `timestamp NOT NULL`. L'applicazione legge le righe per ordine di esecuzione e richiede che coincidano con il prefisso noto del manifest; non viene attribuito al database un vincolo unique su `name` che la libreria non crea.

### `infra.migration_contracts`

| Campo | Vincoli effettivi |
|---|---|
| `migration_id` | integer, primary key, maggiore di zero |
| `migration_name` | text non vuoto, unique |
| `contract_version` | text non vuoto |
| `checksum` | text nel formato SHA-256 lowercase |
| `minimum_compatible_migration_id` | positivo e non maggiore di `migration_id` |
| `applied_at` | timestamptz, default current timestamp |
| `superseded_at` | timestamptz nullable, non precedente ad `applied_at` |

L'indice parziale unique `migration_contracts_one_active_idx` ammette un solo contratto con `superseded_at IS NULL`.

### `app.feature_flags`

| Campo | Vincoli effettivi |
|---|---|
| `flag_key` | text, primary key, formato dot-separated lowercase |
| `enabled` | boolean non nullo, default `false` |
| `default_enabled` | boolean non nullo e sempre `false` |
| `version` | bigint non negativo, default `0` |
| `owner` | text nel formato owner allowlisted |
| `updated_by` | actor ID non vuoto e bounded, default `system:migration` |
| `updated_reason_code` | reason code lowercase, default `operator_request` |
| `updated_at` | timestamptz, default current timestamp |

La migration inserisce esclusivamente le chiavi chiuse `campaign.start`, `turn.new` e `model.route.premium`, tutte disabilitate.

### `app.feature_flag_events`

| Campo | Vincoli effettivi |
|---|---|
| `event_id` | bigint identity, primary key |
| `flag_key` | foreign key verso `app.feature_flags(flag_key)`, delete restrict |
| `idempotency_key` | text bounded, unique |
| `command_hash` | SHA-256 lowercase |
| `previous_version` | bigint non negativo |
| `resulting_version` | esattamente `previous_version + 1` |
| `enabled` | boolean non nullo |
| `actor_id`, `reason_code`, `correlation_id` | text non vuoto con formato bounded |
| `created_at` | timestamptz, default current timestamp |

L'indice `feature_flag_events_flag_key_created_at_idx` ordina la lettura audit per `(flag_key, created_at, event_id)`. Gli eventi di flag sono append-only per contratto applicativo; la baseline non attribuisce loro i futuri vincoli del log di gioco.

### Tabelle identity di `000003_identity_signup` + `000004_identity_access`

| Tabella | Responsabilità e vincoli principali |
|---|---|
| `app.users` | Email canonica lowercase univoca, email di consegna e display name bounded; stato esclusivamente `pending`/`active`, coerente con `activated_at`. |
| `app.user_credentials` | Una credenziale per utente; solo PHC Argon2id, `pepper_version` e `credential_version` positivi, senza password o prehash in chiaro. La versione chiude il race login/reset. |
| `app.email_verification_challenges` | Digest SHA-256/HMAC, versione chiave, TTL, massimo cinque tentativi e stati consumed/superseded mutuamente esclusivi; indice parziale garantisce una sola challenge corrente per utente. |
| `app.password_reset_challenges` | Digest HMAC con chiave/versione reset dedicate, TTL, massimo cinque tentativi e stati consumed/superseded mutuamente esclusivi; indice parziale garantisce una sola challenge corrente per utente. |
| `app.user_sessions` | Digest token univoco, versione chiave, idle/absolute expiry e revoca; il token raw non è persistito. |
| `app.identity_email_outbox` | Una consegna per challenge verifica **oppure** reset; XOR e template coerente sono vincoli SQL. Stati `pending/leased/sent/dead`, massimo cinque tentativi e lease composto da `lease_until` + `lease_token`; indice parziale serve il dispatcher. |
| `app.identity_rate_limits` | Bucket atomico per scope e subject HMAC; include scope signup/verify e access/reset allowlisted, hit bounded e finestra temporale coerente. |
| `app.identity_idempotency` | Unique su endpoint + actor hash + key digest, fingerprint della richiesta, risultato minimo e TTL; endpoint/risultati access/reset sono allowlisted e nessuna chiave raw è persistita. |
| `app.identity_audit_events` | Event type signup/access/reset chiuso, request/correlation ID bounded e metadata JSONB allowlisted; trigger vieta `UPDATE` e `DELETE`. |

Signup persiste utente pending, credenziale, challenge, outbox, idempotenza e audit nella stessa transazione. Verify consuma la challenge, attiva l'utente e inserisce una sola sessione atomicamente. Lock advisory su email, idempotenza e bucket rate-limit chiudono i race testati; Redis non partecipa a questi invarianti.

## Relazioni implementate

```mermaid
erDiagram
    SCHEMA_MIGRATIONS {
        int id PK
        string name
        datetime run_on
    }
    MIGRATION_CONTRACTS {
        int migration_id PK
        string migration_name UK
        string contract_version
        string checksum
        int minimum_compatible_migration_id
    }
    FEATURE_FLAGS {
        string flag_key PK
        boolean enabled
        bigint version
        string owner
    }
    FEATURE_FLAGS ||--o{ FEATURE_FLAG_EVENTS : records
    FEATURE_FLAG_EVENTS {
        bigint event_id PK
        string flag_key FK
        string idempotency_key UK
        string command_hash
        bigint previous_version
        bigint resulting_version
    }
    USERS {
        uuid user_id PK
        string canonical_email UK
        string status
    }
    USERS ||--|| USER_CREDENTIALS : owns
    USERS ||--o{ EMAIL_VERIFICATION_CHALLENGES : receives
    USERS ||--o{ PASSWORD_RESET_CHALLENGES : recovers
    USERS ||--o{ USER_SESSIONS : authenticates
    USERS ||--o{ IDENTITY_EMAIL_OUTBOX : dispatches
    USERS ||--o{ IDENTITY_AUDIT_EVENTS : records
    EMAIL_VERIFICATION_CHALLENGES ||--|| IDENTITY_EMAIL_OUTBOX : delivers
    PASSWORD_RESET_CHALLENGES ||--|| IDENTITY_EMAIL_OUTBOX : delivers
```

`SCHEMA_MIGRATIONS` e `MIGRATION_CONTRACTS` descrivono due viste complementari dello stesso avanzamento, ma non hanno una foreign key fisica fra loro.

## Modello logico pianificato

Questo diagramma è concettuale per il dominio di gioco: soltanto `User identity` corrisponde oggi allo schema fisico implementato sopra. Gli altri nodi sono **Pianificati** e non autorizzano query, tabelle o migration con questi nomi.

```mermaid
flowchart LR
    USER["User identity · Implementato"] --> CAMPAIGN["Campaign · Pianificato"]
    CAMPAIGN --> CHARACTER["Character/Entity · Pianificato"]
    CAMPAIGN --> SCENE["Scene/Quest/NPC · Pianificato"]
    CAMPAIGN --> TURN["Turn request · Pianificato"]
    TURN --> EVENT["Game event · Pianificato"]
    EVENT --> SNAPSHOT["Snapshot · Pianificato"]
    EVENT --> MEMORY["Memory · Pianificato"]
    TURN --> AI_REQUEST["AI request/usage · Pianificato"]
```

### Identity signup e schema access implementati

ADR-0010 e `identity-signup-v1` sono materializzati dalla migration `000003_identity_signup` e dal repository PostgreSQL. `000004_identity_access` implementa la parte fisica di `identity-access-v1`: `credential_version`, challenge reset, outbox discriminato e allowlist access/reset. Constraint, upgrade `000003`→head, rollback/re-apply locale e runner simultanei sono verificati su PostgreSQL reale. Lo store session/reset e le route restano in sviluppo; la presenza dello schema non implica disponibilità runtime. Ownership delle risorse resta BL-007.

## Ownership dei task

| Area concettuale | Task proprietario | Regola per la migration futura |
|---|---|---|
| Utente, verifica, sessione e ownership | `BL-005`–`BL-007` | `BL-005` ha introdotto `000003_identity_signup`; BL-006 aggiunge forward-only `000004_identity_access` per login, refresh, revoca e reset senza riscrivere le migration condivise; BL-007 aggiunge ownership. |
| Personaggio e cataloghi | `BL-011`, `BL-015`–`BL-017` | Nessuna tabella è nominata in anticipo; aggregate e autosave definiscono il contratto. |
| Campagna, Bible, scena, location, quest e clock | `BL-018`, `BL-022`–`BL-025` | Persistenza soltanto dopo schema e validazione della Bible. |
| NPC e knowledge state | `BL-025`, `BL-052`, `BL-053` | Knowledge boundary e ownership precedono qualsiasi indice di retrieval. |
| Turn request, idempotenza e queue handoff | `BL-028`–`BL-030` | Unique/partial index e outbox vengono introdotti con test concorrenti e retry. |
| Event log canonico | `BL-036` | Evento, sequence, causation e proiezione sono atomici. |
| Snapshot e replay | `BL-037` | Checksum e convergenza sono obbligatori prima dell'adozione. |
| Memoria episodica e pgvector | `BL-054`–`BL-057` | Filtri di visibilità precedono ranking e indice vettoriale. |
| AI request, tool call e usage/costo | `BL-021`, `BL-034`, `BL-064` | Payload e retention devono restare redatti e versionati. |

## Regole di aggiornamento

Ogni nuova migration deve aggiornare nello stesso change set: migration head e contract version, manifest/checksum, tabelle/vincoli/indici di questa pagina, diagramma fisico, task proprietario, test database e note operative. Un modello pianificato passa a **Implementato** soltanto dopo una migration condivisa e verificata; non si deduce lo schema fisico dalla sola specifica.
