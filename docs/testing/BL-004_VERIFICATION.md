---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-14
last_verified_commit: aaa17b2ada8a7bab73e3877f263b2c46c5865c13
source_refs:
  - docs/MVP_SPEC.md#195-migrazioni-e-compatibilita
  - docs/MVP_SPEC.md#264-integration-test-database
  - docs/MVP_SPEC.md#295-migrazioni-zero-downtime
  - docs/adr/0006-postgresql-migration-foundation.md
  - docs/operations/DATABASE_MIGRATIONS.md
related_tasks:
  - BL-004
code_refs:
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - scripts/run-database-migrations.mjs
  - scripts/lib/database-migration-policy.mjs
  - scripts/lib/postgres-test-container.mjs
  - infra/local/postgres.compose.yml
  - .github/workflows/ci.yml
test_refs:
  - tests/unit/database-migration-policy.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/database/database-migration-failure.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/security/database-migration-security.test.mjs
supersedes: null
---

# Verifica BL-004 — Fondazione PostgreSQL e migrazioni

## Verdetto corrente

`DONE/100%/PASSING`. Implementazione, suite specifica, full gate e clean verify sono verdi; la [PR #18](https://github.com/Emacore17/dnd-ai/pull/18) ha completato la CI PR [`29351291907`](https://github.com/Emacore17/dnd-ai/actions/runs/29351291907) con 5/5 job `SUCCESS`, incluso `CI / Merge gate`.

## Baseline verificata

| Campo | Valore |
|---|---|
| Data | `2026-07-14` |
| Branch | `codex/bl-004-persistence-baseline` |
| Base | `c72c78bbae06ebb02c7de7d63844f17065354c06` |
| Spec SHA-256 | `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c` |
| Node / pnpm | `24.11.0` / `10.34.5` |
| Docker | `29.2.1` |
| PostgreSQL / pgvector | `17` / `0.8.2` |
| Immagine | `pgvector/pgvector:0.8.2-pg17-trixie@sha256:5c97c57367a485a8e99389548db67d441ab1a878f5492c3df04989f34ecf3c75` |
| Runner / driver | `node-pg-migrate@8.0.4` / `pg@8.22.0` |
| Migration head | `000001_postgresql_foundation` |
| Contract | `database-baseline-v1` |
| Source SHA-256 normalizzato | `e8543d84b9b842adf352260536dcea284c93dfb859c9ec03368f10deb9455fc7` |
| Contract checksum | `46a2bb9ce2ca6957a3b87e423e0ea67b36688e71ebacc84c469bdb7f7a8dc449` |

Il source SHA protegge il file TypeScript normalizzato LF. Il contract checksum include quel digest, il DDL canonico e i metadati di compatibilità: sono due valori distinti e non intercambiabili.

## Matrice di accettazione

| Requisito | Prova | Esito |
|---|---|---|
| Database vuoto → head | applicazione di `000001_postgresql_foundation` su PostgreSQL reale | `PASS` |
| Replay | seconda esecuzione `up` senza mutazioni o righe duplicate | `PASS` |
| Capability baseline | pgvector `0.8.2`, schema `app`/`infra`, ledger e contract table | `PASS` |
| Vincoli e indice | constraint nominati e unico contract attivo tramite partial unique index | `PASS` |
| Integrità sorgente/manifest | source SHA, checksum DB, ordine e insieme esatto dei file `.js`; symlink rifiutati | `PASS` |
| Head sconosciuto | migration compilata aggiuntiva rifiutata prima di ogni DDL | `PASS` |
| DDL fallito | schema/tabella annullati, ledger presente ma con zero righe, lock rilasciato | `PASS` |
| Rollback prodotto fallito | oggetto dipendente blocca `down`; contract, ledger, schema e lock restano coerenti | `PASS` |
| Concorrenza reale | due `runDatabaseMigrations` sovrapposti; il secondo fallisce sul lock | `PASS` |
| Lock già occupato | `pg_advisory_lock` esterno; nessuna mutation e errore redatto | `PASS` |
| Rollback locale | `down` esplicito su database loopback disposable, poi re-apply convergente | `PASS` |
| Rollback gestito | staging/production e override URL `?host`/`?port` rifiutati prima della connessione | `PASS` |
| CLI | `status` vuoto, `up`, status con contract e `down` locale senza URL/secret in output | `PASS` |
| CI | job Tests esegue `pnpm db:migrate:test` senza secret o service statico | `PASS`; run PR `29351291907` 5/5 `SUCCESS` |

`previous→head` è `N/A` per la baseline iniziale: non esiste una versione applicata precedente distinta dal database vuoto. La prima migration successiva, `000002`, deve introdurre un test esplicito `000001→000002` oltre a zero→head e replay.

## Comandi ed evidenze

| Comando | Ambiente | Esito corrente |
|---|---|---|
| `corepack pnpm@10.34.5 db:migrate:test` | Windows, Docker locale, database sintetici effimeri | exit `0`, 13/13 |
| lint/typecheck/build `@dnd-ai/persistence` | Windows | `PASS` |
| unit + contract + security migration mirati | Windows | exit `0`, 13/13 |
| `corepack pnpm@10.34.5 audit --audit-level=high` | workspace | exit `0`, `No known vulnerabilities found` |
| `TURBO_FORCE=true corepack pnpm@10.34.5 verify` | working tree | exit `0` in 73,4 s; lint/build 11/11, typecheck 12/12, unit 47 pass/1 skip host, integration 9/9, database 13/13, contract 22/22, security 23 pass/3 skip host, artifact 3.238 |
| install frozen + `verify` | commit pulito `b1030501fd82d0396add5ff4f9df10fbaa405d0b` | install exit `0` in 0,6 s; verify exit `0` in 66,2 s senza cache, stessi conteggi del working tree |
| `CI / Merge gate` | GitHub Actions Ubuntu, [PR #18](https://github.com/Emacore17/dnd-ai/pull/18) | [run `29351291907`](https://github.com/Emacore17/dnd-ai/actions/runs/29351291907), 5/5 job `SUCCESS` |

Il lifecycle Docker usa porta effimera bindata a `127.0.0.1`, volume `tmpfs`, health polling bounded e rimozione per container ID completo. Un errore di teardown diverso da “container già assente” fallisce la suite. Nessun container della suite deve restare attivo al termine.

## Failure path osservati durante lo sviluppo

1. La prima discovery includeva file TypeScript emessi come `.d.ts.map`; il test reale è diventato rosso prima del fix. La discovery eseguibile ora accetta soltanto l'insieme `.js` esatto del manifest e rifiuta symlink.
2. La review ha riprodotto un URL loopback con `?host=production.internal`: `pg` applicava l'override, mentre la policy precedente lo considerava locale. La policy `down` ora rifiuta qualunque query/hash e il regression test confronta i parametri effettivi del driver.
3. Il test DDL invalido ha mostrato che node-pg-migrate crea il ledger infrastrutturale prima della transazione delle migration. Il criterio corretto è ledger invariato con zero righe e nessun oggetto applicativo parziale; il test lo verifica esplicitamente.
4. Una prima sincronizzazione concorrente basata su `pg_sleep` era corretta ma lenta. È stata sostituita da una barriera advisory separata e bounded, senza sleep arbitrari.

## Sicurezza e dati

- solo credenziali sintetiche locali, mai riutilizzabili fuori dal container;
- URL e password non compaiono in output CLI, errori utente o report;
- `@dnd-ai/persistence` non legge `process.env` e non importa `@dnd-ai/config`;
- `down` richiede `APP_ENV=local`, flag esatto, host loopback, database `dnd_ai_local|dnd_ai_test` e nessun parametro di routing;
- staging e production restano forward-only;
- nessuna risorsa Vercel, cloud database o configurazione Production è stata creata o modificata.

## Rischi residui

- Docker è un prerequisito del gate database; un host senza Docker deve fallire, non saltare la suite.
- La compatibilità con un provider PostgreSQL gestito non è provata in `BL-004` e appartiene al provisioning operativo futuro.
- Il primo upgrade non-vuoto e la policy rolling current/previous diventano verificabili con `000002`.
- Tabelle di dominio, RLS, utenti service-scoped gestiti, backup/restore e backfill restano nei task proprietari.

## Gate di chiusura

- [x] suite PostgreSQL reale e failure path mirati;
- [x] ADR, runbook, CI e tracciabilità aggiornati;
- [x] full gate e dependency audit sul change set;
- [x] commit verificato da worktree pulito;
- [x] PR e CI remota verdi;
- [x] task `DONE/100%/PASSING` e `BL-008` reso `READY`.
