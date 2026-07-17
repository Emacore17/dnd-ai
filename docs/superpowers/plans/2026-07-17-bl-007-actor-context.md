---
status: active
owner: engineering-security
last_reviewed: 2026-07-17
last_verified_commit: 3d0912f70d3b0ff395597853181748b0ee473adf
source_refs:
  - docs/MVP_SPEC.md#191-convenzioni-generali
  - docs/MVP_SPEC.md#201-convenzioni-rest
  - docs/MVP_SPEC.md#202-endpoints-principali
  - docs/MVP_SPEC.md#223-autorizzazione-e-isolamento-campagne
  - docs/MVP_SPEC.md#32-criteri-di-accettazione
  - docs/TASKS.md#bl-007--actorcontext-e-query-tenant-safe
  - docs/superpowers/specs/2026-07-17-bl-007-actor-context-design.md
related_tasks:
  - BL-006
  - BL-007
  - BL-028
  - BL-038
  - BL-064
  - BL-065
  - QA-002
code_refs:
  - apps/api/src
  - packages/contracts/src
  - packages/domain/src
  - packages/persistence/src
test_refs:
  - tests/contracts
  - tests/database
  - tests/integration
  - tests/security
  - tests/unit
supersedes: null
---

# BL-007 ActorContext and Tenant-Safe Campaign Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current inline session. Do not delegate batches or create parallel worktrees.

**Goal:** Introdurre una radice campagna PostgreSQL, risolvere sessioni valide in un `ActorContext` immutabile e provare che repository, HTTP e guardia SSE non consentano alcun accesso cross-tenant.

**Architecture:** Il dominio pubblica tipi e porte actor-scoped; un singolo store PostgreSQL implementa la lettura read-only di sessione e campagna applicando ownership nella query. L'API trasforma il cookie opaco in `ActorContext`, espone soltanto `GET /api/campaigns/:campaignId` e offre un pre-handler SSE generico più un adapter campagna non registrato nel runtime.

**Tech Stack:** TypeScript 6 strict, Zod 4, Fastify 5, PostgreSQL 17, node-pg-migrate 8, pg 8, JSON Schema 2020-12, OpenAPI 3.1.1, Node test runner, pnpm 11.13.0.

## Global Constraints

- Corsia `HIGH_RISK`: autenticazione, isolamento tenant, migration, contratto pubblico e confine SSE.
- Esecuzione inline esclusiva nella worktree `C:\Users\emanu\Documents\progetti\dnd-ai\.worktrees\bl-007-actor-context`; non usare subagenti e non toccare la worktree principale.
- Base integrata `464b124d7b5182d2614703a743dffb622cc220fe`; design approvato nel commit `3d0912f70d3b0ff395597853181748b0ee473adf`.
- Nessun endpoint player-facing può esportare o usare `findById(id)` senza `ActorContext`; ownership deve stare nella stessa query SQL.
- Sessione assente, malformata, sconosciuta, revocata, idle-expired o absolute-expired produce sempre `401 identity.session_invalid` e non interroga campagne.
- Campagna inesistente, altrui o soft-deleted produce lo stesso `404 campaign.not_found`, con body/header pubblici identici.
- Le letture non ruotano token, non aggiornano `last_seen_at`, non estendono scadenze e non creano audit/idempotency record.
- `v1`, `v2` e `v3` degli artifact contratto restano immutabili; il nuovo artifact è `v4` / `4.0.0`.
- Migration head `000005_campaign_ownership`, forward-only negli ambienti condivisi; rollback soltanto local/disposable secondo ADR-0006.
- L'endpoint pubblico `/api/turns/:turnId/stream`, ticket SSE, reconnect e retention restano BL-038; la route fixture SSE esiste soltanto nei test.
- Rate limit generale e quota `campaign.read` restano BL-065; BL-007 pubblica la classification, non un limiter parallelo.
- RLS, creazione/lista/modifica campagna, UI/BFF, Redis, provider, deploy e qualsiasi azione Vercel sono esclusi.
- Test mirati per ogni batch; un solo `TURBO_FORCE=true corepack pnpm@11.13.0 verify` sul candidato finale e checkout pulito perché cambiano migration/artifact.

## File map terminale

| File | Responsabilità |
|---|---|
| `packages/domain/src/access/actor-context.ts` | `ActorContext`, validazione e freeze del request context |
| `packages/domain/src/identity/session-reader.ts` | porta read-only per sessione attiva |
| `packages/domain/src/campaign/types.ts` | `CampaignId`, status e projection player-safe |
| `packages/domain/src/campaign/ports.ts` | `CampaignReader` obbligatoriamente actor-scoped |
| `packages/contracts/src/campaign.ts` | Zod schema per ID, detail ed error envelope campagna |
| `packages/contracts/src/{catalog,operations,artifacts,version,index}.ts` | artifact `v4` e GET canonica |
| `packages/contracts/generated/v4/` | JSON Schema/OpenAPI generati, mai editati a mano |
| `packages/persistence/src/migrations/000005_campaign_ownership.ts` | tabella `app.campaigns` e ledger contract |
| `packages/persistence/src/migration-manifest.ts` | SQL canonico, source hash, checksum e head `000005` |
| `packages/persistence/src/campaign-access-store.ts` | session reader e campaign reader sullo stesso pool bounded |
| `apps/api/src/campaign/campaign-access-service.ts` | autenticazione read-only e mapping errori applicativi |
| `apps/api/src/campaign/request-context.ts` | request/correlation ID, cookie e campaign param sicuri |
| `apps/api/src/campaign/http-errors.ts` | envelope uniforme 400/401/404/503 |
| `apps/api/src/campaign/routes.ts` | `GET /api/campaigns/:campaignId` |
| `apps/api/src/access/owned-sse-authorization.ts` | factory generica del pre-handler SSE owner-gated |
| `apps/api/src/campaign/sse-authorization.ts` | adapter campagna esportato ma non registrato |
| `apps/api/src/{app,index,runtime}.ts` | composition root e lifecycle store |
| `tests/contracts/campaign-contracts.test.mjs` | Zod/OpenAPI/version/freeze `v4` |
| `tests/database/campaign-ownership-migration.test.mjs` | zero/previous→head, vincoli e rollback/re-apply |
| `tests/database/campaign-access-store.test.mjs` | sessioni read-only e matrice repository IDOR |
| `tests/unit/campaign-access-service.test.mjs` | auth/service failure mapping senza DB |
| `tests/integration/campaign-api.test.mjs` | contratto HTTP con service fake |
| `tests/integration/campaign-idor-flow.test.mjs` | verticale PostgreSQL HTTP/SSE due utenti |
| `tests/security/campaign-access-security.test.mjs` | enumeration, source guard e route fixture assente |
| `docs/security/THREAT_MODEL.md` | baseline identity/tenant isolation attiva |

---

### Task 1: Congelare tipi di dominio e contract API `v4`

**Files:**
- Create: `packages/domain/src/access/actor-context.ts`
- Create: `packages/domain/src/identity/session-reader.ts`
- Create: `packages/domain/src/campaign/types.ts`
- Create: `packages/domain/src/campaign/ports.ts`
- Create: `packages/contracts/src/campaign.ts`
- Create: `tests/unit/actor-context.test.mjs`
- Create: `tests/contracts/campaign-contracts.test.mjs`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/catalog.ts`
- Modify: `packages/contracts/src/operations.ts`
- Modify: `packages/contracts/src/artifacts.ts`
- Modify: `packages/contracts/src/version.ts`
- Modify: `tests/contracts/contracts-artifacts.test.mjs`
- Modify: `tests/contracts/identity-contracts.test.mjs`
- Generate: `packages/contracts/generated/v4/`

**Interfaces:**
- Produces: `ActorContext`, `createActorContext`, `IdentitySessionReader.resolveActiveSession`, `CampaignId`, `CampaignSafeView`, `CampaignReader.findOwnedCampaign`.
- Produces: `CampaignIdSchema`, `CampaignDetailResponseSchema`, `CampaignErrorResponseSchema` e tipi inferiti.
- Preserves: artifact `v1`–`v3` byte-per-byte e tutte le nove operation identity.

- [ ] **Step 1: Scrivere i test RED per tipi, schemi e OpenAPI**

```js
// tests/unit/actor-context.test.mjs
test("ActorContext is immutable and rejects invalid request metadata", () => {
  const actor = createActorContext({
    correlationId: "correlation-campaign-0001",
    requestId: "40000000-0000-4000-8000-000000000001",
    sessionId: "20000000-0000-4000-8000-000000000001",
    userId: "10000000-0000-4000-8000-000000000001",
  });
  assert.equal(Object.isFrozen(actor), true);
  assert.throws(
    () => createActorContext({ ...actor, correlationId: "bad value" }),
    TypeError,
  );
});

// tests/contracts/campaign-contracts.test.mjs
test("campaign v4 contracts expose one safe owner read", () => {
  const detail = contracts.CampaignDetailResponseSchema.parse({
    id: "70000000-0000-7000-8000-000000000001",
    stateVersion: 1,
    status: "active",
    title: "La città sommersa",
    updatedAt: "2026-07-17T12:00:00.000Z",
  });
  assert.equal(Object.isFrozen(contracts.CONTRACT_CATALOG), true);
  assert.equal(detail.status, "active");
  const openapi = contracts.createContractArtifacts()["v4/openapi.json"];
  const operation = openapi.paths["/api/campaigns/{campaignId}"].get;
  assert.equal(operation.operationId, "getCampaign");
  assert.equal(operation["x-dnd-ai-rate-limit-class"], "campaign.read");
  assert.equal(operation.parameters[0].schema.$ref, "#/components/schemas/CampaignId");
  assert.equal(operation.responses["404"].content["application/json"].schema.$ref,
    "#/components/schemas/CampaignErrorResponse");
});
```

Aggiornare `expectedCatalog` in `contracts-artifacts.test.mjs` con:

```js
["CampaignDetailResponse", "response", "campaign-detail-response.schema.json"],
["CampaignErrorResponse", "response", "campaign-error-response.schema.json"],
["CampaignId", "request", "campaign-id.schema.json"],
```

Aggiornare ogni path corrente del test artifact da `v3` a `v4`, la versione da `3.0.0` a `4.0.0`, l'URN a `urn:dnd-ai:contracts:v4` e aggiungere `/api/campaigns/{campaignId}` alla lista OpenAPI. In `identity-contracts.test.mjs` filtrare il loop con `path.startsWith("/api/auth/")` prima di assumere il metodo `post`.

- [ ] **Step 2: Eseguire RED**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/domain --filter=@dnd-ai/contracts
node --test tests/unit/actor-context.test.mjs tests/contracts/campaign-contracts.test.mjs
```

Expected: build/test `FAIL` perché i nuovi export e `v4/openapi.json` non esistono.

- [ ] **Step 3: Implementare i tipi puri**

```ts
// packages/domain/src/access/actor-context.ts
import type { IdentityId, IdentitySessionId } from "../identity/types.js";

const CONTEXT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

export interface ActorContext {
  readonly correlationId: string;
  readonly requestId: string;
  readonly sessionId: IdentitySessionId;
  readonly userId: IdentityId;
}

export function createActorContext(input: ActorContext): ActorContext {
  if (
    !CONTEXT_ID_PATTERN.test(input.requestId) ||
    !CONTEXT_ID_PATTERN.test(input.correlationId)
  ) {
    throw new TypeError("actor context metadata is invalid");
  }
  return Object.freeze({ ...input });
}

// packages/domain/src/identity/session-reader.ts
import type { IdentityId, IdentitySessionId } from "./types.js";

export interface ActiveIdentitySession {
  readonly sessionId: IdentitySessionId;
  readonly userId: IdentityId;
}

export interface IdentitySessionReader {
  resolveActiveSession(
    tokenDigest: string,
    occurredAt: Date,
  ): Promise<ActiveIdentitySession | null>;
}

// packages/domain/src/campaign/types.ts
declare const campaignIdBrand: unique symbol;
export type CampaignId = string & { readonly [campaignIdBrand]: true };
export type CampaignStatus =
  | "draft" | "ready" | "generating" | "active"
  | "completed" | "abandoned" | "failed";
export interface CampaignSafeView {
  readonly id: CampaignId;
  readonly stateVersion: number;
  readonly status: CampaignStatus;
  readonly title: string;
  readonly updatedAt: Date;
}

// packages/domain/src/campaign/ports.ts
import type { ActorContext } from "../access/actor-context.js";
import type { CampaignId, CampaignSafeView } from "./types.js";
export interface CampaignReader {
  findOwnedCampaign(
    actor: ActorContext,
    campaignId: CampaignId,
  ): Promise<CampaignSafeView | null>;
}
```

Esportare i quattro moduli da `packages/domain/src/index.ts`.

- [ ] **Step 4: Implementare Zod, catalogo e operation**

```ts
// packages/contracts/src/campaign.ts
import { z } from "zod";
import { IsoDateTimeSchema, RequestIdSchema, UuidV7Schema } from "./identifiers.js";

export const CampaignIdSchema = UuidV7Schema;
export const CampaignStatusSchema = z.enum([
  "draft", "ready", "generating", "active",
  "completed", "abandoned", "failed",
]);
export const CampaignDetailResponseSchema = z.strictObject({
  id: CampaignIdSchema,
  stateVersion: z.number().int().min(0).max(2_147_483_647),
  status: CampaignStatusSchema,
  title: z.string().trim().min(1).max(80),
  updatedAt: IsoDateTimeSchema,
});
export const CampaignErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum([
      "campaign.request_invalid",
      "identity.session_invalid",
      "campaign.not_found",
      "campaign.unavailable",
    ]),
    message: z.string().min(1).max(500),
    requestId: RequestIdSchema,
    retryable: z.boolean(),
  }),
});
export type CampaignDetailResponse = z.infer<typeof CampaignDetailResponseSchema>;
export type CampaignErrorResponse = z.infer<typeof CampaignErrorResponseSchema>;
export type CampaignId = z.infer<typeof CampaignIdSchema>;
```

In `version.ts` impostare esattamente `CONTRACT_VERSION = "4.0.0"`, `CONTRACT_MAJOR_VERSION = "v4"` e `CONTRACT_ID_NAMESPACE = "urn:dnd-ai:contracts:v4"`. Aggiungere i tre schema al catalogo, esportare `campaign.ts`, e in `artifacts.ts` usare:

```ts
paths: {
  ...createIdentityOpenApiPaths(),
  ...createCampaignOpenApiPaths(),
},
```

La nuova operation in `operations.ts` è:

```ts
export function createCampaignOpenApiPaths(): JsonRecord {
  const error = (description: string): JsonRecord => ({
    description,
    content: { "application/json": {
      schema: { $ref: "#/components/schemas/CampaignErrorResponse" },
    } },
  });
  return {
    "/api/campaigns/{campaignId}": {
      get: {
        operationId: "getCampaign",
        summary: "Legge il dettaglio player-safe di una campagna posseduta.",
        "x-dnd-ai-rate-limit-class": "campaign.read",
        parameters: [{
          in: "path", name: "campaignId", required: true,
          schema: { $ref: "#/components/schemas/CampaignId" },
        }],
        responses: {
          "200": { description: "Campagna posseduta.", content: {
            "application/json": { schema: {
              $ref: "#/components/schemas/CampaignDetailResponse",
            } },
          } },
          "400": error("Identificatore non valido."),
          "401": error("Sessione non valida."),
          "404": error("Campagna non trovata."),
          "503": error("Servizio temporaneamente non disponibile."),
        },
      },
    },
  };
}
```

Aggiornare inoltre la descrizione OpenAPI in `artifacts.ts` a `Contratti versionati per identity e accesso player-safe alle campagne.`.

- [ ] **Step 5: Generare e verificare GREEN**

Run:

```powershell
corepack pnpm@11.13.0 contracts:generate
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/domain --filter=@dnd-ai/contracts
node --test tests/unit/actor-context.test.mjs tests/contracts/campaign-contracts.test.mjs tests/contracts/contracts-artifacts.test.mjs tests/contracts/identity-contracts.test.mjs
```

Expected: tutti i test `PASS`; `git diff -- packages/contracts/generated/v1 packages/contracts/generated/v2 packages/contracts/generated/v3` vuoto; nuovi file soltanto sotto `generated/v4`.

- [ ] **Step 6: Commit**

```powershell
git add packages/domain packages/contracts tests/unit/actor-context.test.mjs tests/contracts/campaign-contracts.test.mjs tests/contracts/contracts-artifacts.test.mjs tests/contracts/identity-contracts.test.mjs
git commit -m "feat(bl-007): define actor and campaign contracts"
```

---

### Task 2: Aggiungere migration `000005_campaign_ownership`

**Files:**
- Create: `packages/persistence/src/migrations/000005_campaign_ownership.ts`
- Create: `tests/database/campaign-ownership-migration.test.mjs`
- Modify: `packages/persistence/src/migration-manifest.ts`
- Modify: `tests/database/identity-migration.test.mjs`
- Modify: `tests/database/database-migrations.test.mjs`
- Modify: `tests/contracts/database-migration-contract.test.mjs`

**Interfaces:**
- Consumes: `app.users(user_id)` e migration head `000004_identity_access`.
- Produces: `app.campaigns`, `DATABASE_CAMPAIGN_OWNERSHIP_*`, head `000005_campaign_ownership`, contract `database-campaign-ownership-v1`.

- [ ] **Step 1: Scrivere il test RED di schema e upgrade**

```js
test("campaign ownership migration protects the aggregate root", async () => {
  await withPostgresTestContainer(async ({ databaseUrl }) => {
    const migrated = await runDatabaseMigrations({ databaseUrl, direction: "up" });
    assert.equal(migrated.current, "000005_campaign_ownership");
    assert.equal(DATABASE_CONTRACT_VERSION, "database-campaign-ownership-v1");
    const client = await connect(databaseUrl);
    try {
      await seedActiveUser(client, USER_A);
      await client.query(`INSERT INTO app.campaigns
        (campaign_id, user_id, title, status, state_version, created_at, updated_at)
        VALUES ($1, $2, 'Nebbia su Corva', 'active', 1, $3, $3)`,
        [CAMPAIGN_A, USER_A, NOW]);
      await assert.rejects(
        client.query(`INSERT INTO app.campaigns
          (campaign_id, user_id, title) VALUES ($1, $2, 'Estranea')`,
          [CAMPAIGN_B, USER_B]),
        (error) => error.constraint === "campaigns_user_fkey",
      );
    } finally { await client.end(); }
  });
});
```

Aggiungere nello stesso file test per UUID non-v7, titolo blank/>80, status sconosciuto, `state_version=-1`, timestamp incoerenti, soft-delete antecedente alla creazione, indice owner e upgrade `count:4`→head→rollback locale→re-apply.

- [ ] **Step 2: Eseguire RED**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
node --test tests/database/campaign-ownership-migration.test.mjs
```

Expected: `FAIL` perché la migration e gli export non esistono.

- [ ] **Step 3: Scrivere SQL canonico e migration**

Il blocco tabella in `migration-manifest.ts` deve essere esattamente equivalente a:

```sql
CREATE TABLE app.campaigns (
  campaign_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  state_version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz NULL,
  CONSTRAINT campaigns_pkey PRIMARY KEY (campaign_id),
  CONSTRAINT campaigns_user_fkey FOREIGN KEY (user_id)
    REFERENCES app.users (user_id) ON DELETE RESTRICT,
  CONSTRAINT campaigns_id_uuidv7 CHECK (
    campaign_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT campaigns_title_bounded CHECK (
    title = btrim(title) AND char_length(title) BETWEEN 1 AND 80
  ),
  CONSTRAINT campaigns_status_known CHECK (
    status IN ('draft','ready','generating','active','completed','abandoned','failed')
  ),
  CONSTRAINT campaigns_state_version_bounded CHECK (
    state_version BETWEEN 0 AND 2147483647
  ),
  CONSTRAINT campaigns_timestamps_coherent CHECK (
    updated_at >= created_at AND (deleted_at IS NULL OR deleted_at >= created_at)
  )
);
CREATE INDEX campaigns_owner_lookup_idx
ON app.campaigns (user_id, campaign_id)
WHERE deleted_at IS NULL;
```

La migration usa soltanto costanti del manifest:

```ts
export function up(pgm: MigrationBuilder): void {
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_TABLE_SQL);
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_INDEX_SQL);
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_SUPERSEDE_ACCESS_CONTRACT_SQL);
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_CONTRACT_INSERT_SQL);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql("DELETE FROM infra.migration_contracts WHERE migration_id = 5;");
  pgm.sql("DROP TABLE app.campaigns RESTRICT;");
  pgm.sql(DATABASE_CAMPAIGN_OWNERSHIP_RESTORE_ACCESS_CONTRACT_SQL);
}
```

Normalizzare CRLF→LF e calcolare il source SHA con:

```powershell
$source = (Get-Content -Raw packages/persistence/src/migrations/000005_campaign_ownership.ts) -replace "`r`n?", "`n"
$bytes = [Text.Encoding]::UTF8.GetBytes($source)
$algorithm = [Security.Cryptography.SHA256]::Create()
try {
  ([BitConverter]::ToString($algorithm.ComputeHash($bytes)) -replace '-', '').ToLowerInvariant()
} finally {
  $algorithm.Dispose()
}
```

Inserire quel valore esatto in `CAMPAIGN_OWNERSHIP_MIGRATION_SOURCE_SHA256`; costruire checksum canonico con source SHA, SQL tabella/indice/supersede e definizione migration ID 5. Aggiornare `DATABASE_CONTRACT_VERSION`, `DATABASE_MIGRATION_HEAD` e `DATABASE_MIGRATION_MANIFEST` al nuovo contract.

- [ ] **Step 4: Correggere i test di regressione di head e collisione**

In `identity-migration.test.mjs` far applicare `count: 4` al test identity principale e ai passaggi 000003→000004, così resta owner del solo contract identity. In `database-migrations.test.mjs` rinominare il file negativo in `000006_unknown_migration.js`. In `database-migration-contract.test.mjs` leggere `000005`, verificare source SHA normalizzato e i marker `campaigns`/`database-campaign-ownership-v1`.

- [ ] **Step 5: Verificare GREEN**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
node --test --test-concurrency=1 tests/database/campaign-ownership-migration.test.mjs tests/database/identity-migration.test.mjs tests/database/database-migrations.test.mjs tests/contracts/database-migration-contract.test.mjs
```

Expected: zero→`000005`, `000004`→`000005`, replay e rollback/re-apply `PASS`; test unknown migration usa `000006` e continua a fallire chiuso.

- [ ] **Step 6: Commit**

```powershell
git add packages/persistence/src/migration-manifest.ts packages/persistence/src/migrations/000005_campaign_ownership.ts tests/database/campaign-ownership-migration.test.mjs tests/database/identity-migration.test.mjs tests/database/database-migrations.test.mjs tests/contracts/database-migration-contract.test.mjs
git commit -m "feat(bl-007): add campaign ownership migration"
```

---

### Task 3: Implementare lo store actor-scoped

**Files:**
- Create: `packages/persistence/src/campaign-access-store.ts`
- Create: `tests/database/campaign-access-store.test.mjs`
- Modify: `packages/persistence/src/index.ts`

**Interfaces:**
- Consumes: `IdentitySessionReader`, `CampaignReader`, `ActorContext`, `CampaignId`.
- Produces: `createPostgresCampaignAccessStore({ databaseUrl })` con `resolveActiveSession`, `findOwnedCampaign`, `close`.

- [ ] **Step 1: Scrivere la matrice repository RED**

```js
for (const [actor, campaignId, expectedTitle] of [
  [ACTOR_A, CAMPAIGN_A, "Campagna A"],
  [ACTOR_A, CAMPAIGN_B, null],
  [ACTOR_B, CAMPAIGN_A, null],
  [ACTOR_B, CAMPAIGN_B, "Campagna B"],
  [ACTOR_A, MISSING_CAMPAIGN, null],
  [ACTOR_A, DELETED_CAMPAIGN, null],
]) {
  const found = await store.findOwnedCampaign(actor, campaignId);
  assert.equal(found?.title ?? null, expectedTitle);
}
```

Nello stesso test: sessione attiva risolta; token sconosciuto/revocato/idle-expired/absolute-expired e utente pending restituiscono `null`; `last_seen_at`, idle e absolute expiry restano invariati; risultati non-null sono frozen; input digest/data/ID invalidi falliscono con errore tipizzato e messaggio non sensibile.

- [ ] **Step 2: Eseguire RED**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/domain --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
node --test tests/database/campaign-access-store.test.mjs
```

Expected: `FAIL` sull'export `createPostgresCampaignAccessStore` mancante.

- [ ] **Step 3: Implementare le query bounded**

Il factory crea un `Pool` con `application_name: "dnd-ai-campaign-access"`, `max: 5`, connection timeout 10 s, statement timeout 10 s e query timeout 15 s. Le sole query player sono:

```sql
SELECT s.session_id, s.user_id
  FROM app.user_sessions AS s
  JOIN app.users AS u ON u.user_id = s.user_id
 WHERE s.token_digest = $1
   AND u.status = 'active'
   AND s.revoked_at IS NULL
   AND s.idle_expires_at > $2
   AND s.absolute_expires_at > $2
 LIMIT 1
```

```sql
SELECT c.campaign_id, c.title, c.status, c.state_version, c.updated_at
  FROM app.campaigns AS c
 WHERE c.campaign_id = $1
   AND c.user_id = $2
   AND c.deleted_at IS NULL
 LIMIT 1
```

Validare digest SHA-256 lowercase, data valida e UUIDv7 prima della query. Convertire `state_version` in numero safe tra 0 e `2_147_483_647`; restituire `Object.freeze` oppure `null`. Non esportare alcun `findById`, SQL unscoped o opzione per disabilitare il filtro. `close()` memoizza `pool.end()` come gli store identity.

- [ ] **Step 4: Verificare GREEN e regressioni**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
node --test tests/database/campaign-access-store.test.mjs tests/database/identity-access-store.test.mjs
```

Expected: matrice 2×2 e lifecycle sessione `PASS`; nessuna mutation della sessione osservata.

- [ ] **Step 5: Commit**

```powershell
git add packages/persistence/src/campaign-access-store.ts packages/persistence/src/index.ts tests/database/campaign-access-store.test.mjs
git commit -m "feat(bl-007): enforce tenant-safe campaign reads"
```

---

### Task 4: Esporre il GET campagna con `ActorContext`

**Files:**
- Create: `apps/api/src/campaign/campaign-access-service.ts`
- Create: `apps/api/src/campaign/request-context.ts`
- Create: `apps/api/src/campaign/http-errors.ts`
- Create: `apps/api/src/campaign/routes.ts`
- Create: `tests/unit/campaign-access-service.test.mjs`
- Create: `tests/integration/campaign-api.test.mjs`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/runtime.ts`

**Interfaces:**
- Consumes: `IdentityCryptography.sessionTokenDigest`, `IdentitySessionReader`, `CampaignReader`.
- Produces: `CampaignAccessService.authenticate`, `CampaignAccessService.getCampaign`, `registerCampaignRoutes`.

- [ ] **Step 1: Scrivere service/API RED**

```js
test("campaign API maps absent, foreign and owned resources safely", async () => {
  const owned = await app.inject({
    headers: { cookie: COOKIE_A, "x-request-id": REQUEST_ID },
    method: "GET", url: `/api/campaigns/${CAMPAIGN_A}`,
  });
  assert.equal(owned.statusCode, 200);
  assert.deepEqual(owned.json(), SAFE_DETAIL);
  for (const campaignId of [CAMPAIGN_B, MISSING_CAMPAIGN]) {
    const response = await app.inject({
      headers: { cookie: COOKIE_A, "x-request-id": REQUEST_ID },
      method: "GET", url: `/api/campaigns/${campaignId}`,
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "campaign.not_found");
    assert.equal(response.headers["cache-control"], "private, no-store");
  }
});
```

Il test unit service copre token malformato→`SESSION_INVALID`, session reader null→`SESSION_INVALID`, reader throw→`UNAVAILABLE`, campagna null→`NOT_FOUND`, projection valida→successo e prova che `createActorContext` riceva request/correlation ID.

- [ ] **Step 2: Eseguire RED**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/api --filter=@dnd-ai/testing
node --test tests/unit/campaign-access-service.test.mjs tests/integration/campaign-api.test.mjs
```

Expected: `FAIL` perché service, route e dependency `campaign` non esistono.

- [ ] **Step 3: Implementare service ed error mapping**

```ts
export type CampaignAccessErrorCode =
  | "SESSION_INVALID" | "NOT_FOUND" | "UNAVAILABLE";
export class CampaignAccessError extends Error {
  constructor(readonly code: CampaignAccessErrorCode) {
    super("Campaign access failed.");
    this.name = "CampaignAccessError";
  }
}
export interface CampaignAccessService {
  authenticate(
    sessionToken: string | null,
    context: Readonly<{ requestId: string; correlationId: string }>,
  ): Promise<ActorContext>;
  getCampaign(actor: ActorContext, campaignId: CampaignId): Promise<CampaignSafeView>;
}
```

`authenticate` rifiuta `null`; calcola il digest dentro `try/catch`; chiama `resolveActiveSession(digest, clock.now())`; converte null in `SESSION_INVALID`; converte errori store in `UNAVAILABLE`; costruisce `ActorContext`. `getCampaign` converte null in `NOT_FOUND` e errori store in `UNAVAILABLE` senza includere ID nei messaggi.

`http-errors.ts` mappa esattamente:

```ts
const CAMPAIGN_ERROR_MAP = Object.freeze({
  SESSION_INVALID: { statusCode: 401, code: "identity.session_invalid", message: "La sessione non è valida.", retryable: false },
  NOT_FOUND: { statusCode: 404, code: "campaign.not_found", message: "Campagna non trovata.", retryable: false },
  UNAVAILABLE: { statusCode: 503, code: "campaign.unavailable", message: "Servizio temporaneamente non disponibile.", retryable: true },
});
```

La richiesta invalida usa `400 campaign.request_invalid`, messaggio `Richiesta non valida.`, `retryable: false`.

- [ ] **Step 4: Implementare request boundary e route**

`request-context.ts` legge un solo cookie tramite `readIdentitySessionToken`, usa prima l'header `x-request-id` già impostato dall'observability hook e altrimenti `createRequestId`, accetta `x-correlation-id` solo con pattern `^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$`, valida `campaignId` con `CampaignIdSchema` e non legge header user/subject.

```ts
export const CAMPAIGN_READ_RATE_LIMIT_CLASS = "campaign.read" as const;
export function registerCampaignRoutes(
  app: FastifyInstance,
  options: RegisterCampaignRoutesOptions,
): void {
  app.get<{ Params: { campaignId: string } }>(
    "/api/campaigns/:campaignId",
    { config: { rateLimitClass: CAMPAIGN_READ_RATE_LIMIT_CLASS } },
    async (request, reply) => {
      const boundary = readCampaignRequest(request, reply);
      if (!boundary.campaignId) {
        sendCampaignError(reply, campaignRequestError(boundary.requestId));
        return;
      }
      try {
        const actor = await options.service.authenticate(boundary.sessionToken, boundary);
        const campaign = await options.service.getCampaign(actor, boundary.campaignId);
        const body = CampaignDetailResponseSchema.parse({
          ...campaign,
          updatedAt: campaign.updatedAt.toISOString(),
        });
        reply.header("cache-control", "private, no-store");
        await reply.code(200).send(body);
      } catch (error) {
        sendCampaignError(reply, toCampaignHttpError(error, boundary.requestId));
      }
    },
  );
}
```

- [ ] **Step 5: Comporre runtime e lifecycle**

Aggiungere `campaign?: RegisterCampaignRoutesOptions` a `ApiAppDependencies`. Aggiungere `campaignRoutes?` a `ApiIdentityRuntime`; `createApiIdentityRuntime` crea un solo `createPostgresCampaignAccessStore`, un solo `CampaignAccessService` con il medesimo `cryptography` identity e include `campaignAccessStore.close()` nel `Promise.all`. Registrare la route sia in `createApiApp` quando iniettata dai test sia in `createConfiguredApiApp` quando presente nel runtime.

- [ ] **Step 6: Verificare GREEN**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/api --filter=@dnd-ai/testing
node --test tests/unit/campaign-access-service.test.mjs tests/integration/campaign-api.test.mjs tests/integration/runtime-startup.test.mjs
```

Expected: `200/400/401/404/503`, cache header e composition root `PASS`; regressione startup identity `PASS`.

- [ ] **Step 7: Commit**

```powershell
git add apps/api/src tests/unit/campaign-access-service.test.mjs tests/integration/campaign-api.test.mjs
git commit -m "feat(bl-007): expose owner-scoped campaign read"
```

---

### Task 5: Verificare lo stesso confine su SSE e PostgreSQL reale

**Files:**
- Create: `apps/api/src/access/owned-sse-authorization.ts`
- Create: `apps/api/src/campaign/sse-authorization.ts`
- Create: `tests/integration/campaign-idor-flow.test.mjs`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `CampaignAccessService`, `readCampaignRequest`, `sendCampaignError`.
- Produces: `createOwnedSsePreHandler<TIdentifier>`, `createCampaignSseAuthorizationPreHandler`.

- [ ] **Step 1: Scrivere verticale RED due utenti**

Il test avvia PostgreSQL, migra a head, inserisce due utenti active, due sessioni con digest reali e tre campagne (`A`, `B`, `deleted`). Costruisce store/service reali, registra la GET e monta soltanto nel test:

```js
app.get(
  "/__test/campaigns/:campaignId/stream",
  { preHandler: createCampaignSseAuthorizationPreHandler({ service }) },
  async (_request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "cache-control": "private, no-store",
      "content-type": "text/event-stream; charset=utf-8",
    });
    reply.raw.end("event: access.granted\ndata: {}\n\n");
  },
);
```

Per HTTP e SSE provare A→A successo, A→B 404, B→A 404, B→B successo, missing/deleted 404; senza cookie e sessione revocata 401. Confrontare deep-equal body e subset header dei tre 404; verificare che una risposta negata non abbia `content-type: text/event-stream` né `access.granted`.

- [ ] **Step 2: Eseguire RED**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/api
node --test tests/integration/campaign-idor-flow.test.mjs
```

Expected: `FAIL` sull'export del pre-handler mancante.

- [ ] **Step 3: Implementare factory generica e adapter**

```ts
// apps/api/src/access/owned-sse-authorization.ts
export type OwnedSseFailure =
  | "request_invalid" | "session_invalid" | "not_found" | "unavailable";
export type OwnedSseResolution<TIdentifier> =
  | Readonly<{ ok: true; actor: ActorContext; identifier: TIdentifier; requestId: string }>
  | Readonly<{ ok: false; failure: Exclude<OwnedSseFailure, "not_found">; requestId: string }>;

export function createOwnedSsePreHandler<TIdentifier>(options: Readonly<{
  resolve(request: FastifyRequest, reply: FastifyReply): Promise<OwnedSseResolution<TIdentifier>>;
  existsOwned(actor: ActorContext, identifier: TIdentifier): Promise<boolean>;
  fallbackRequestId(request: FastifyRequest, reply: FastifyReply): string;
  sendFailure(reply: FastifyReply, failure: OwnedSseFailure, requestId: string): void;
}>): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    let resolved: OwnedSseResolution<TIdentifier>;
    try { resolved = await options.resolve(request, reply); }
    catch {
      options.sendFailure(
        reply,
        "unavailable",
        options.fallbackRequestId(request, reply),
      );
      return;
    }
    if (!resolved.ok) {
      options.sendFailure(reply, resolved.failure, resolved.requestId);
      return;
    }
    try {
      if (!(await options.existsOwned(resolved.actor, resolved.identifier))) {
        options.sendFailure(reply, "not_found", resolved.requestId);
      }
    } catch {
      options.sendFailure(reply, "unavailable", resolved.requestId);
    }
  };
}
```

L'adapter campagna usa `readCampaignRequest`; implementa `fallbackRequestId` restituendo `.requestId` dallo stesso helper, restituisce `request_invalid` prima dell'auth per ID invalido, `session_invalid` soltanto per `CampaignAccessError("SESSION_INVALID")`, e usa `service.getCampaign` per `existsOwned`. `NOT_FOUND` diventa `false`; `UNAVAILABLE` viene rilanciato al factory. `sendFailure` riusa `CampaignErrorResponse` e `private, no-store`. Non registrare questo adapter in `app.ts` o `runtime.ts`.

- [ ] **Step 4: Verificare GREEN**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/api
node --test tests/integration/campaign-idor-flow.test.mjs tests/integration/campaign-api.test.mjs tests/database/campaign-access-store.test.mjs
```

Expected: matrice repository/API/SSE completa `PASS`; nessuno stream viene aperto prima dell'autorizzazione.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/access apps/api/src/campaign/sse-authorization.ts apps/api/src/index.ts tests/integration/campaign-idor-flow.test.mjs
git commit -m "feat(bl-007): gate SSE access by campaign owner"
```

---

### Task 6: Chiudere source guard, threat model e living docs

**Files:**
- Create: `tests/security/campaign-access-security.test.mjs`
- Create: `docs/security/THREAT_MODEL.md`
- Modify: `tests/contracts/architecture-documentation.test.mjs`
- Modify: `docs/README.md`
- Modify: `docs/TASKS.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/architecture/SYSTEM_OVERVIEW.md`
- Modify: `docs/data/DATA_MODEL.md`
- Modify: `docs/api/README.md`
- Modify: `docs/operations/DATABASE_MIGRATIONS.md`
- Modify: `docs/superpowers/specs/2026-07-17-bl-007-actor-context-design.md`

**Interfaces:**
- Consumes: behavior e test reali dei Task 1–5.
- Produces: controlli sorgente anti-bypass, threat model attivo e tracciabilità AC-23.

- [ ] **Step 1: Scrivere source/security RED**

```js
test("player campaign surfaces cannot bypass ActorContext", async () => {
  const [store, routes, runtime] = await Promise.all([
    read("packages/persistence/src/campaign-access-store.ts"),
    read("apps/api/src/campaign/routes.ts"),
    read("apps/api/src/runtime.ts"),
  ]);
  assert.match(store, /c\.user_id = \$2/u);
  assert.match(store, /c\.deleted_at IS NULL/u);
  assert.doesNotMatch(store, /SELECT\s+\*/iu);
  assert.doesNotMatch(store, /findById|skipOwnership|bypassTenant/iu);
  assert.doesNotMatch(routes, /x-user-id|x-actor-id|x-dnd-ai-client-subject/iu);
  assert.doesNotMatch(runtime, /__test\/campaigns|createCampaignSseAuthorizationPreHandler/u);
});
```

Aggiungere test che i body 404 foreign/missing/deleted siano deep-equal, che canary user/campaign non compaiano in body/header, che DB failure restituisca 503 e mai 404, e che una sessione negata impedisca la chiamata a `findOwnedCampaign`.

- [ ] **Step 2: Eseguire i test security**

Run:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/api --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
node --test tests/security/campaign-access-security.test.mjs
```

Expected: `PASS` se i Task 1–5 rispettano il boundary; ogni finding viene corretto alla causa prima dei documenti.

- [ ] **Step 3: Creare il threat model attivo**

`docs/security/THREAT_MODEL.md` deve avere front matter living e queste righe normative:

```markdown
# Threat model MVP

## Trust boundary implementati

| Boundary | Input non affidabile | Autorità | Controllo |
|---|---|---|---|
| Browser → API identity | cookie, header, body | PostgreSQL session/user | cookie opaco, digest, expiry e status active |
| API → campaign repository | UUID e ActorContext | `campaigns.user_id` | firma actor-scoped e filtro nella query |
| Browser → SSE authorization | cookie e resource ID | lookup owner-scoped | nessun header SSE prima del successo |

## Minacce e controlli

| Minaccia | Failure sicuro | Evidenza |
|---|---|---|
| Subject spoofing via header | gli header user/actor non vengono letti | security source guard |
| IDOR con UUID valido altrui | `404 campaign.not_found` identico a missing | matrice repository/API/SSE |
| Session replay revocata/scaduta | `401 identity.session_invalid` | store e verticale PostgreSQL |
| Soft-delete raggiungibile | filtro `deleted_at IS NULL` | database/store test |
| Stream aperto prima dell'auth | nessun content-type/evento SSE | integration IDOR |
| Errore DB mascherato da 404 | `503 campaign.unavailable` | security failure-path test |
| Enumeration in log/body/header | envelope generico, ID raw assenti | canary/redaction test |
```

Il documento richiama BL-005/BL-006 per hashing/challenge/session lifecycle e assegna moderazione a BL-064. Non duplicare password policy o payload completi.

- [ ] **Step 4: Allineare la documentazione living**

Aggiornare il registro documenti: threat model `Esistente, active (BL-007)` e moderation policy `Planned (BL-064)`, eliminando il riferimento non materializzato `DOC-SEC-001`. Nelle card BL-005/BL-006 sostituire l'owner threat model con la baseline BL-007. Registrare:

- `TRACEABILITY`: AC-23 → migration/store/API/SSE/security test;
- `SYSTEM_OVERVIEW`: Browser→session resolver→ActorContext→CampaignReader→PostgreSQL;
- `DATA_MODEL`: campi e vincoli effettivi di `app.campaigns`, head `000005`;
- `api/README`: artifact `v4`, GET player-safe, SSE pubblico ancora assente;
- `DATABASE_MIGRATIONS`: zero/`000004`→`000005`, rollback local-only;
- `CONTEXT`: contract `v4`, migration head e CTX-R23 mitigato;
- `TASKS`: `IN_REVIEW/90%/PASSING` soltanto dopo tutti i mirati verdi; evidenze mirate reali, full/clean ancora aperti.

- [ ] **Step 5: Verificare documenti e corsie mirate**

Run:

```powershell
corepack pnpm@11.13.0 verify:docs
corepack pnpm@11.13.0 test:contract
corepack pnpm@11.13.0 db:migrate:test
corepack pnpm@11.13.0 test:integration
corepack pnpm@11.13.0 test:security
```

Expected: cinque comandi exit `0`; task graph e secret scan `PASS`.

- [ ] **Step 6: Commit**

```powershell
git add tests/security/campaign-access-security.test.mjs tests/contracts/architecture-documentation.test.mjs docs
git commit -m "docs(bl-007): document campaign isolation boundary"
```

---

### Task 7: Review, full gate, clean checkout e candidato terminale

**Files:**
- Modify after evidence: `docs/TASKS.md`
- Modify after evidence: `docs/CONTEXT.md`

**Interfaces:**
- Consumes: candidato completo dei Task 1–6.
- Produces: branch-local `DONE/100%/PASSING` soltanto con tutti i gate reali verdi; nessuna delivery remota implicita.

- [ ] **Step 1: Rileggere diff e controllare scope**

Run:

```powershell
git status --short --branch
git diff 464b124d7b5182d2614703a743dffb622cc220fe --stat
git diff 464b124d7b5182d2614703a743dffb622cc220fe --check
rg -n "TODO|FIXME|console\.(log|error|warn|info)|x-user-id|x-actor-id|skipOwnership|bypassTenant" apps/api/src packages/domain/src packages/persistence/src tests
git diff -- packages/contracts/generated/v1 packages/contracts/generated/v2 packages/contracts/generated/v3
```

Expected: diff check pulito; nessun marker/debug/bypass; artifact congelati senza diff. Fare una review P0/P1 inline su auth, query scoping, error mapping, pool close, migration down e mancata registrazione SSE; correggere solo finding concreti e rilanciare i mirati toccati.

- [ ] **Step 2: Eseguire un solo full gate locale**

Run:

```powershell
$env:TURBO_FORCE="true"
corepack pnpm@11.13.0 verify
Remove-Item Env:TURBO_FORCE
```

Expected: exit `0` per format, lint, typecheck, build, generated drift, unit/integration/database/contract/security, report, boundaries, document/task/CI/deployment policy, secret scan e artifact.

- [ ] **Step 3: Registrare evidenze reali senza inventare valori**

In `TASKS.md` impostare `DONE/100%/PASSING` e riportare test/count/durate realmente emessi dal full, migration head/checksum/source SHA, spec SHA `96905284cea5cc79df452cfd29a527336969b213479b0ce3da45825283ca4381`, e `eval/trace ID: N/A — slice deterministica senza AI o trace persistita`. In `CONTEXT.md` indicare candidato branch-local e prossimo task `QA-002`; delivery resta `PENDING` finché non è integrata da PR protetta.

- [ ] **Step 4: Validare e incorporare lo stato nel commit funzionale precedente**

Run:

```powershell
corepack pnpm@11.13.0 verify:docs
git add docs/TASKS.md docs/CONTEXT.md
git commit --amend --no-edit
```

Expected: gate docs exit `0`; nessun commit separato di sola evidenza.

- [ ] **Step 5: Verificare il candidato da checkout pulito**

Creare una worktree detached temporanea dal nuovo `HEAD`, eseguire install frozen, build graph, contract drift, migration/database campaign, verticale IDOR, secret scan e `verify:docs`; usare soltanto comandi non distruttivi e rimuovere la worktree dopo aver verificato che il path sia quello temporaneo.

```powershell
corepack pnpm@11.13.0 install --frozen-lockfile
corepack pnpm@11.13.0 contracts:check
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/api --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
node --test tests/database/campaign-ownership-migration.test.mjs tests/database/campaign-access-store.test.mjs tests/integration/campaign-idor-flow.test.mjs tests/security/campaign-access-security.test.mjs
corepack pnpm@11.13.0 scan:secrets
corepack pnpm@11.13.0 verify:docs
```

Expected: tutti exit `0`; nessuna rete provider, account o azione Vercel.

- [ ] **Step 6: Preparare una sola delivery protetta**

Verificare `git status --short` vuoto. Usare la skill `superpowers:requesting-code-review` nei limiti della modalità inline, quindi `superpowers:verification-before-completion` prima di dichiarare concluso. Una sola PR verso `main`; attendere `CI / Merge gate`, integrare senza bypass e verificare la run post-merge. Non creare commit post-CI per copiare SHA/run nei documenti.
