---
status: active
owner: engineering-and-platform
last_reviewed: 2026-07-15
last_verified_commit: 8e6e0d3d46daa057ba80999c58c83ad1c92471b1
source_refs:
  - docs/MVP_SPEC.md#2216-incident-response
  - docs/MVP_SPEC.md#275-change-management-dei-prompt
  - docs/MVP_SPEC.md#298-disaster-recovery-e-operazioni
  - docs/TASKS.md#bl-010--flag-storeconfig-auditato
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
  - docs/adr/0006-postgresql-migration-foundation.md
  - docs/adr/0007-observability-context-and-error-reporting.md
related_tasks:
  - BL-010
code_refs:
  - packages/persistence/src/feature-flags.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - scripts/manage-feature-flag.mjs
test_refs:
  - tests/unit/feature-flags.test.mjs
  - tests/database/feature-flags.test.mjs
  - tests/security/feature-flags-security.test.mjs
supersedes: null
---

# BL-010 - Design feature flag e kill switch server-side

## Decisione approvata

Il Product Owner ha approvato l'opzione PostgreSQL + CLI server-side il 2026-07-15. BL-010 non usa feature flag client e non introduce endpoint admin pubblici: l'operatore cambia i flag tramite comando server-side autenticato dall'ambiente in cui viene eseguito, mentre API/worker leggeranno lo stesso store quando i task proprietari introdurranno i consumer reali.

La stima passa da `S` a `M` e la corsia e `HIGH_RISK`, perche il criterio "senza deploy" richiede uno store condiviso, durabile e auditato. BL-004 diventa dipendenza esplicita insieme a BL-003 e BL-008.

## Catalogo e safe default

La prima slice espone un catalogo chiuso:

- `campaign.start`: ammette o blocca nuove campagne.
- `turn.new`: ammette o blocca nuovi turni.
- `model.route.premium`: ammette o blocca la route interna premium citata dalla specifica.

Ogni flag ha owner, descrizione e `defaultEnabled=false`. Un flag sconosciuto, una route non catalogata, lo store indisponibile, una riga malformata o una lettura fallita producono sempre decisione `disabled` con motivo sicuro. Questo rende il kill switch utile anche durante incidenti, provider outage e budget overrun.

## Store e audit

La migration `000002_feature_flags` aggiunge due tabelle in schema `app`:

- `feature_flags`: stato corrente per chiave, owner, default, versione monotona e ultimo cambio.
- `feature_flag_events`: audit append-only di ogni comando operatore.

Il cambio flag avviene in una sola transazione: lock della riga corrente, CAS opzionale su `expectedVersion`, aggiornamento stato, inserimento audit e commit. Se l'audit fallisce, anche lo stato viene annullato. L'idempotency key e il digest del comando rendono un retry identico un replay stabile; la stessa key con payload diverso fallisce come conflitto.

L'audit non accetta testo libero: usa `actorId`, `reasonCode`, `correlationId`, idempotency key e metadata bounded generati dal comando. Messaggi e errori non riflettono database URL, secret, payload arbitrari o valori sensibili.

## Interfacce

`@dnd-ai/persistence` esporta:

- catalogo e tipi `FeatureFlagKey`, `FeatureFlagReasonCode`, `FeatureFlagState`;
- `createPostgresFeatureFlagStore({ databaseUrl })`;
- `evaluateFeatureGate(store, key)`, che applica il fail-closed boundary;
- errori tipizzati e redatti per unknown flag, version conflict, idempotency conflict e store failure.

`scripts/manage-feature-flag.mjs` usa `parseMigrationRuntimeConfig` e il repository compilato. Supporta `status` e `set <flag> --enable|--disable --actor <id> --reason <code> --idempotency-key <key> [--expected-version <n>] [--correlation-id <id>]`. Non stampa URL, secret o dettagli SQL.

## Fuori scope

Sono fuori scope endpoint admin, UI, auth operatori, rollout percentuali, Redis cache, route API/worker reali e model provider adapter. I task futuri dovranno chiamare `evaluateFeatureGate` ai rispettivi boundary di side effect: start campaign prima della mutazione, new turn prima dell'enqueue e model route prima della chiamata provider.

## Verifica

La slice richiede TDD su catalogo, fail-closed evaluator, migration zero-to-head/previous-to-head, CAS, idempotenza, audit atomico, CLI redatta e security failure path. Il gate finale e `pnpm verify` perche cambia schema database, runtime persistence e superficie operativa.
