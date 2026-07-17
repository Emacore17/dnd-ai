---
status: active
owner: engineering
last_reviewed: 2026-07-17
last_verified_commit: dde888e4f835d25fc5d6142129394971efa90320
source_refs:
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#19-modello-dati
  - docs/MVP_SPEC.md#29-infrastruttura-e-deployment
  - AGENTS.md#9-confini-architetturali-e-struttura-target
  - docs/adr/0002-monorepo-package-boundaries.md
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
  - docs/adr/0006-postgresql-migration-foundation.md
  - docs/adr/0007-observability-context-and-error-reporting.md
  - docs/adr/0008-zod-first-contract-generation.md
  - docs/adr/0009-mvp-runtime-data-and-workflow-architecture.md
  - docs/adr/0010-internal-provider-neutral-identity.md
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
  - docs/superpowers/specs/2026-07-16-bl-006-session-access-design.md
  - docs/superpowers/specs/2026-07-17-bl-007-actor-context-design.md
  - docs/data/DATA_MODEL.md
  - docs/operations/LOCAL_DEVELOPMENT.md
related_tasks:
  - BL-001
  - BL-002
  - BL-003
  - BL-004
  - BL-005
  - BL-006
  - BL-007
  - BL-008
  - BL-009
  - BL-010
  - BL-028
  - BL-029
  - BL-030
  - BL-036
  - BL-038
  - BL-079
  - BL-080
  - DOC-ARCH-001
  - QA-001
  - QA-002
code_refs:
  - apps/web
  - apps/api
  - apps/worker
  - packages/ai
  - packages/config
  - packages/contracts
  - packages/domain
  - packages/observability
  - packages/persistence
  - packages/rules
  - packages/testing
  - scripts/lib/workspace-boundaries.mjs
  - .github/workflows/ci.yml
test_refs:
  - tests/integration/identity-access-flow.test.mjs
  - tests/contracts/architecture-documentation.test.mjs
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/observability-contract.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/integration/testing-containers.test.mjs
  - tests/integration/identity-signup-flow.test.mjs
  - tests/contracts/identity-contracts.test.mjs
  - tests/contracts/web-identity-ui.test.mjs
  - tests/security/identity-api-security.test.mjs
  - tests/integration/campaign-idor-flow.test.mjs
  - tests/security/campaign-access-security.test.mjs
supersedes: null
---

# System overview

## Legenda di stato

- **Implementato**: verificabile nel repository e nei test citati.
- **Pianificato**: requisito normativo posseduto da un task non concluso.

La legenda vale per ogni sezione: la presenza di un workspace o di un contratto di fondazione non implica che la relativa feature di gioco sia già disponibile.

## Inventario implementato

| Path | Package name | Responsabilità corrente |
|---|---|---|
| `apps/web` | `@dnd-ai/web` | Next.js App Router, health, foundation UI, BFF auth same-origin, form identity e shell di gioco interattiva fixture. |
| `apps/api` | `@dnd-ai/api` | Composition root Fastify, osservabilità, route identity e GET campagna owner-scoped; la guardia SSE è esportata ma non registrata. |
| `apps/worker` | `@dnd-ai/worker` | Composition root worker e dispatcher PostgreSQL dell'outbox email identity; non è ancora un consumer BullMQ. |
| `packages/ai` | `@dnd-ai/ai` | Confine package per porte e adapter AI; oggi contiene soltanto la fondazione tipizzata. |
| `packages/config` | `@dnd-ai/config` | Parser Zod server-only e profili runtime per API, worker, web e migration, incluse chiavi/versioni identity e SMTP. |
| `packages/contracts` | `@dnd-ai/contracts` | Schemi Zod strict e artefatti JSON Schema/OpenAPI `v1`–`v4`; `v4` aggiunge la lettura campagna player-safe. |
| `packages/domain` | `@dnd-ai/domain` | Policy e porte identity pure, `ActorContext`, `CampaignId` e `CampaignReader` actor-scoped. |
| `packages/observability` | `@dnd-ai/observability` | Correlation context, tracing OTel, logging redatto e Sentry error-only. |
| `packages/persistence` | `@dnd-ai/persistence` | Runner migration, manifest, feature flag/identity store e letture sessione/campagna owner-scoped PostgreSQL. |
| `packages/rules` | `@dnd-ai/rules` | Confine puro del Rules Engine; le regole di gioco arrivano nei task proprietari. |
| `packages/testing` | `@dnd-ai/testing` | Primitive deterministiche e lifecycle Node per PostgreSQL/Redis di test. |

## Dipendenze implementate

Il grafo mostra soltanto dipendenze **workspace→workspace** dichiarate nei manifest correnti. I nodi senza archi sono leaf o fondazioni non ancora collegate; non rappresentano dipendenze future.

```mermaid
flowchart LR
    WEB["apps/web"] --> OBS["@dnd-ai/observability"]
    WEB --> CFG["@dnd-ai/config"]
    WEB --> CONTRACTS["@dnd-ai/contracts"]
    API["apps/api"] --> CFG["@dnd-ai/config"]
    API --> CONTRACTS
    API --> DOMAIN["@dnd-ai/domain"]
    API --> OBS
    API --> PERSISTENCE["@dnd-ai/persistence"]
    WORKER["apps/worker"] --> CFG
    WORKER --> OBS
    PERSISTENCE --> DOMAIN
    RULES["@dnd-ai/rules"]
    AI["@dnd-ai/ai"]
    TESTING["@dnd-ai/testing"]
```

App→app, package→app, import relativi fuori package e cicli workspace sono vietati. Il contratto è applicato da `scripts/lib/workspace-boundaries.mjs` e dal test `workspace-boundaries`.

## Flusso target pianificato

Il flusso seguente è la topologia normativa della vertical slice, non lo stato del runtime corrente. L'outbox evita di trattare database e queue come una singola transazione distribuita; Redis migliora il coordinamento ma non sostituisce i vincoli PostgreSQL.

```mermaid
flowchart LR
    WEB["Next.js web"] -->|"REST"| API["Fastify API"]
    API -->|"SSE delivery"| WEB
    API -->|"transaction + outbox"| PG[("PostgreSQL + pgvector")]
    PG -->|"outbox pending"| DISPATCHER["Outbox dispatcher"]
    DISPATCHER -->|"jobId=turnId"| Q["BullMQ"]
    Q --> WORKER["Worker"]
    WORKER -->|"eventi + proiezioni"| PG
    API -.->|"lock/cache/rate limit"| REDIS[("Redis non autorevole")]
    WORKER -.-> REDIS
```

Il contratto completo e le condizioni di revisione sono in [`ADR-0009`](../adr/0009-mvp-runtime-data-and-workflow-architecture.md).

## Flusso identity implementato da BL-005 e BL-006

Il verticale auth è separato dalla futura pipeline dei turni. Il browser parla soltanto con il BFF same-origin; il BFF converte l'IP trusted del provider in un subject HMAC firmato e bounded senza inoltrare l'IP raw; Fastify verifica l'asserzione e applica Origin, rate limit e idempotenza. PostgreSQL committa utente/challenge/outbox o attivazione/sessione in una singola transazione. Il worker deriva il codice in memoria e può duplicare la sola consegna dopo un crash, mai lo stato canonico.

```mermaid
flowchart LR
    FORM["Form auth mobile"] -->|"POST same-origin"| BFF["Next BFF"]
    BFF -->|"REST bounded + subject firmato"| API_ID["Fastify IdentityService"]
    API_ID -->|"transaction"| PG_ID[("PostgreSQL identity")]
    PG_ID -->|"claim + lease token"| EMAIL_WORKER["Email outbox dispatcher"]
    EMAIL_WORKER -->|"fake locale o SMTP configurato"| MAIL["Email delivery port"]
    FORM -->|"codice 6 cifre"| BFF
```

## Confine campaign ownership implementato da BL-007

La GET campagna usa lo stesso cookie opaco del verticale identity. Il resolver verifica sessione e utente senza mutare `last_seen_at` o scadenze, quindi crea un `ActorContext` immutabile. `CampaignReader` riceve obbligatoriamente il contesto e filtra `campaign_id`, `user_id` e soft-delete nella stessa query PostgreSQL. Foreign, missing e deleted convergono allo stesso `404`; gli errori storage restano `503`.

```mermaid
flowchart LR
    BROWSER["Browser"] -->|"cookie + campaign UUIDv7"| API_CAMPAIGN["Fastify GET campaign"]
    API_CAMPAIGN --> SESSION["Session resolver read-only"]
    SESSION --> ACTOR["ActorContext"]
    ACTOR --> READER["CampaignReader actor-scoped"]
    READER --> PG_CAMPAIGN[("PostgreSQL app.campaigns")]
    SSE_GUARD["SSE authorization guard · non registrata"] -.-> SESSION
    SSE_GUARD -.-> READER
```

L'adapter SSE è verificato con una route fixture e PostgreSQL reali, ma non esiste un endpoint SSE pubblico: registrazione, ticket, retention e reconnect restano BL-038.

## Capability non ancora disponibili

- **BullMQ:** Pianificato
- **Redis locale:** Pianificato
- **API di dominio completa:** Pianificata
- **Staging:** non disponibile

I task proprietari sono rispettivamente `BL-030`, `BL-029`, `BL-028`/`BL-038` e `BL-080`. Signup, verifica e sessione iniziale sono implementati e integrati da BL-005; BL-006 ha integrato contratti, schema, persistence, service, API, worker outbox, BFF e UI di login, refresh, logout, revoca completa e reset. Lo stato bloccato di `BL-080` non autorizza deploy, release, Production o modifiche all'account Vercel.

## Fondazioni implementate

| Area | Stato verificabile | Documento proprietario |
|---|---|---|
| Configurazione | `runtime-config-v1`, profili service-scoped, errori redatti e startup fail-fast | [`CONFIGURATION.md`](../operations/CONFIGURATION.md), [`ADR-0004`](../adr/0004-runtime-configuration-and-secret-injection.md) |
| Migrazioni | PostgreSQL 17 + pgvector, ledger applicativo, head candidato `000005_campaign_ownership` con radice campagna owner-scoped | [`DATABASE_MIGRATIONS.md`](../operations/DATABASE_MIGRATIONS.md), [`ADR-0006`](../adr/0006-postgresql-migration-foundation.md) |
| Feature flag | Catalogo kill switch server-side, default safe e audit append-only | [`BL-010 design`](../superpowers/specs/2026-07-15-bl-010-feature-flags-design.md) |
| Contratti | Zod-first `v1`–`v3` immutabili + candidato `v4` con nove operazioni identity e una GET campagna, JSON Schema/OpenAPI e drift check | [`docs/api/README.md`](../api/README.md), [`ADR-0008`](../adr/0008-zod-first-contract-generation.md) |
| Campaign access | `ActorContext`, session resolver read-only, lookup ownership/soft-delete atomico, GET player-safe e guardia SSE non registrata | [`campaign-ownership-v1`](../superpowers/specs/2026-07-17-bl-007-actor-context-design.md), [`THREAT_MODEL.md`](../security/THREAT_MODEL.md) |
| Identity | Signup/verify/resend, lifecycle access/reset, schema, store, API, worker, BFF e UI integrati da BL-005/BL-006 | [`identity-signup-v1`](../superpowers/specs/2026-07-16-bl-005-signup-verification-design.md), [`identity-access-v1`](../superpowers/specs/2026-07-16-bl-006-session-access-design.md), [`ADR-0010`](../adr/0010-internal-provider-neutral-identity.md) |
| Osservabilità | Correlation context, tracing in-memory, Pino redatto e Sentry error-only | [`BL-008 design`](../superpowers/specs/2026-07-15-bl-008-observability-baseline-design.md), [`ADR-0007`](../adr/0007-observability-context-and-error-reporting.md) |
| Testing | Runner Node, fixture deterministiche, lifecycle PostgreSQL/Redis e artifact verificati | [`TEST_STRATEGY.md`](../testing/TEST_STRATEGY.md) |
| CI e supply chain | Quality, test, security, build/artifact e `CI / Merge gate` fail-closed | [`CI_CD.md`](../operations/CI_CD.md), [`ADR-0003`](../adr/0003-ci-trust-boundary-and-artifacts.md) |
| Frontend | Foundation, shell conversazionale interattiva fixture, `/health` e form auth shadcn mobile-first integrati; il trasporto turno/SSE reale resta pianificato | [`UX_UI_DESIGN.md`](../product/UX_UI_DESIGN.md), [`ADR-0001`](../adr/0001-mobile-first-conversational-ui.md) |

## Confini operativi correnti

- Il web espone `GET /health`, due pagine auth e tre Route Handler BFF; il secret di asserzione resta server-only e il browser non riceve secret identity né l'origin API interno.
- API e worker offrono il verticale identity; l'API aggiunge la sola lettura campagna owner-scoped, ma non esiste ancora un percorso di gioco end-to-end né SSE pubblico.
- Le migration e i test database usano PostgreSQL locale/effimero; Redis è disponibile soltanto nel test harness di `QA-001`, non come servizio locale dell'applicazione.
- Lo staging non esiste. Le procedure Vercel rimangono fail-closed nel runbook [`PREVIEW_STAGING.md`](../operations/PREVIEW_STAGING.md); `BL-080` resta bloccato e fuori dallo scope di `DOC-ARCH-001`.
