---
status: active
owner: engineering-security
last_reviewed: 2026-07-17
last_verified_commit: dde888e4f835d25fc5d6142129394971efa90320
source_refs:
  - docs/MVP_SPEC.md#223-autorizzazione-e-isolamento-campagne
  - docs/MVP_SPEC.md#22-sicurezza-e-moderazione
  - docs/adr/0010-internal-provider-neutral-identity.md
  - docs/superpowers/specs/2026-07-17-bl-007-actor-context-design.md
related_tasks:
  - BL-005
  - BL-006
  - BL-007
  - BL-038
  - BL-064
  - BL-065
  - BL-066
code_refs:
  - apps/api/src/campaign
  - apps/api/src/access/owned-sse-authorization.ts
  - packages/domain/src/access/actor-context.ts
  - packages/domain/src/campaign
  - packages/persistence/src/campaign-access-store.ts
  - packages/persistence/src/migrations/000005_campaign_ownership.ts
test_refs:
  - tests/security/campaign-access-security.test.mjs
  - tests/integration/campaign-idor-flow.test.mjs
  - tests/integration/campaign-api.test.mjs
  - tests/database/campaign-access-store.test.mjs
  - tests/database/campaign-ownership-migration.test.mjs
supersedes: null
---

# Threat model MVP

## Scopo

Questa baseline descrive i trust boundary identity e campaign ownership implementati da BL-005–BL-007. Non sostituisce i contratti dettagliati di hashing, challenge, cookie, rotazione, revoca e reset di BL-005/BL-006; li assume come controlli già verificati. Moderazione di input/output e categorie safety restano di proprietà di BL-064 tramite `docs/security/MODERATION_POLICY.md`, ancora pianificato.

## Trust boundary implementati

| Boundary | Input non affidabile | Autorità | Controllo |
|---|---|---|---|
| Browser → API identity | cookie, header, body | PostgreSQL session/user | cookie opaco, digest, expiry e status active |
| API → campaign repository | UUID e `ActorContext` | `campaigns.user_id` | firma actor-scoped e filtro nella query |
| Browser → SSE authorization | cookie e resource ID | lookup owner-scoped | nessun header SSE prima del successo |

L'API costruisce `ActorContext` soltanto dopo la risoluzione read-only della sessione. Il contesto non accetta user ID, actor ID o subject da header client. Il repository player-facing applica `campaign_id`, `user_id` e `deleted_at IS NULL` nella stessa query PostgreSQL; non esiste un'opzione per disattivare l'ownership.

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

## Failure e limiti correnti

- Campagna inesistente, altrui e soft-deleted hanno status, body e header pubblici equivalenti; nessun ID tenant-sensitive entra nell'envelope.
- Cookie assente, malformato, sconosciuto, revocato o scaduto termina con `401` prima della query campagna.
- L'adapter SSE è verificato su una route fixture e non è registrato nel composition root; l'endpoint pubblico, i ticket e il reconnect restano BL-038.
- RLS non è implementato. La garanzia corrente è applicata da porte actor-scoped, query SQL e source guard; un'eventuale RLS richiede decisione e test dedicati.
- Rate limit `campaign.read`, admin/operator access, lifecycle privacy e moderazione restano rispettivamente BL-065, BL-066 e task security/privacy proprietari.

## Regola di aggiornamento

Aggiornare questo documento quando cambia un trust boundary, una fonte dell'identità, la semantica pubblica degli errori, una query player-facing, la registrazione SSE o l'accesso operator/admin. Un nuovo percorso non può dichiararsi coperto soltanto perché riusa il cookie: deve provare authorization, failure path e non-enumeration sul proprio resource reader.
