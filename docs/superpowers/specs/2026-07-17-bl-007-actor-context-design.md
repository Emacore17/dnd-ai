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
  - docs/adr/0009-mvp-runtime-data-and-workflow-architecture.md
  - docs/adr/0010-internal-provider-neutral-identity.md
  - docs/superpowers/specs/2026-07-16-bl-006-session-access-design.md
related_tasks:
  - BL-006
  - BL-007
  - BL-015
  - BL-028
  - BL-038
  - BL-065
  - BL-066
  - QA-002
code_refs:
  - apps/api/src/identity
  - packages/contracts/src
  - packages/domain/src/identity
  - packages/persistence/src
  - packages/persistence/src/migrations
test_refs:
  - tests/contracts
  - tests/database
  - tests/integration
  - tests/security
  - tests/unit
supersedes: null
---

# BL-007 — Design di ActorContext e isolamento campagne

## 1. Stato della decisione

Questo documento è il contratto di design `campaign-ownership-v1`, approvato dal Product Owner il 2026-07-17. Introduce il primo confine di autorizzazione delle risorse di gioco senza anticipare creazione campagna, orchestrazione turno o streaming pubblico.

La slice è `HIGH_RISK`: modifica autenticazione read-only, schema PostgreSQL, contratto HTTP pubblico e autorizzazione di API/SSE. L'implementazione può iniziare soltanto dopo la review di questo documento e un piano TDD versionato.

## 2. Obiettivo e confini

BL-007 deve garantire che:

1. una sessione valida venga trasformata una sola volta in un `ActorContext` immutabile;
2. ogni repository player-facing richieda tale contesto nella propria firma;
3. una campagna sia leggibile soltanto dal valore `campaigns.user_id` corrispondente all'attore;
4. risorsa assente e risorsa appartenente a un altro utente producano la stessa risposta `404`;
5. lo stesso confine possa proteggere sia handler HTTP sia il futuro stream SSE;
6. una matrice automatizzata con due utenti e risorse incrociate provi zero accessi cross-tenant.

La slice comprende migration `000005_campaign_ownership`, contratto API `v4`, risoluzione della sessione, repository actor-scoped, endpoint reale `GET /api/campaigns/:campaignId` e pre-handler SSE riusabile verificato con Fastify e PostgreSQL reali.

Restano fuori scope: creazione/lista/modifica/abbandono campagne, personaggi, Campaign Bible, turni, endpoint pubblico `/api/turns/:turnId/stream`, ticket SSE firmati, payload narrativi, RLS, rate limit generale, Redis, UI, BFF di gioco, provider, deploy e qualsiasi azione Vercel.

## 3. Approcci considerati

### A. Ownership spine, HTTP reale e guardia SSE riusabile — scelto

Creare la minima radice `campaigns`, rendere obbligatorio `ActorContext` nelle porte di lettura, esporre il solo endpoint HTTP canonico già supportabile e costruire un pre-handler SSE componibile. Il pre-handler viene montato in una route di integrazione non registrata dal runtime; BL-038 lo collegherà all'endpoint pubblico dopo l'introduzione dei turni.

Vantaggi: verifica oggi il trust boundary reale senza inventare dati o API, conserva ownership nel database e lascia una composizione diretta ai task futuri. Costo: la route SSE pubblica resta intenzionalmente non disponibile fino a BL-038.

### B. Anticipare `/api/turns/:turnId/stream`

Richiederebbe tabelle turno, lifecycle, retention, reconnect e semantica eventi appartenenti a BL-028/BL-038. Una risposta placeholder renderebbe pubblico un contratto formalmente presente ma funzionalmente falso.

### C. Aggiungere uno stream temporaneo per campagna

Offrirebbe una superficie pubblica immediata, ma introdurrebbe un endpoint non canonico e debito di compatibilità da rimuovere. È escluso.

## 4. Modello di ownership

`app.campaigns` è l'aggregate root e l'unica fonte di ownership. La migration forward-only `000005_campaign_ownership` aggiunge i soli campi stabili necessari alla slice:

- `campaign_id` UUIDv7 generato server-side, esposto come `id` nel contratto HTTP;
- `user_id` obbligatorio con foreign key verso `app.users(user_id)` e cancellazione `RESTRICT`;
- `title` player-safe e bounded;
- `status` allowlisted, inizialmente `draft`, `ready`, `generating`, `active`, `completed`, `abandoned`, `failed`;
- `state_version` intero non negativo;
- `created_at`, `updated_at` e `deleted_at` nullable per il recovery previsto dalla specifica.

L'indice player-facing è `(user_id, id)` con predicato `deleted_at IS NULL`; un indice aggiuntivo su `(user_id, status, updated_at DESC)` viene introdotto soltanto se la query di lista entra nella stessa slice, cosa esclusa dal design corrente. Le colonne per scena, atto, Bible, snapshot e progressione appartengono alle migration dei task proprietari e non vengono simulate con JSONB.

Il contract database diventa `database-campaign-ownership-v1`. La suite copre database vuoto→head, `000004`→`000005`, replay, rollback locale/re-apply, constraint UUIDv7/status/version/timestamp, foreign key, indici e isolamento a due tenant.

## 5. ActorContext e autenticazione read-only

Il dominio introduce tipi branded distinti per `CampaignId` e un `ActorContext` minimo:

```ts
interface ActorContext {
  readonly userId: IdentityId;
  readonly sessionId: IdentitySessionId;
  readonly requestId: string;
  readonly correlationId: string;
}
```

Il context non contiene ruolo admin, IP, email, token o autorizzazioni precalcolate. È creato nell'API dopo aver validato il cookie opaco e non può essere costruito da header controllati dal client.

Una nuova porta read-only specializzata risolve il digest del token in `userId` e `sessionId` soltanto quando utente e sessione sono attivi, non revocati e dentro idle/absolute expiry. Questa lettura:

- non ruota il token;
- non estende `last_seen_at` o scadenze;
- non crea audit o idempotency record;
- usa il clock iniettato;
- restituisce un unico esito non autenticato per token assente, sconosciuto, revocato o scaduto.

In questo modo nessuna `GET` o apertura SSE nasconde una mutazione. La porta resta separata dai comandi di `IdentityAccessStore` e può essere riusata da tutti i moduli player-facing.

## 6. Porte e repository tenant-safe

La porta di campagna non espone `findById(campaignId)` nel percorso player. L'operazione pubblica è semanticamente actor-scoped:

```ts
interface CampaignReader {
  findOwnedCampaign(
    actor: ActorContext,
    campaignId: CampaignId,
  ): Promise<CampaignSafeView | null>;
}
```

L'implementazione PostgreSQL esegue il filtro di ownership nella stessa query:

```sql
WHERE c.campaign_id = $campaignId
  AND c.user_id = $actorUserId
  AND c.deleted_at IS NULL
```

È vietato caricare prima per ID e autorizzare dopo in memoria. La projection seleziona colonne esplicite e player-safe; non usa `SELECT *` e non espone campi futuri nascosti. Metodi operator/admin, se introdotti da BL-066, useranno porte nominalmente separate e non un parametro opzionale che disabilita il filtro.

## 7. Contratto HTTP

BL-007 pubblica soltanto `GET /api/campaigns/:campaignId`:

- autenticazione tramite cookie sessione già canonico;
- parametro UUIDv7 validato prima del repository;
- `200` con `CampaignDetailResponse` minimale: `id`, `title`, `status`, `stateVersion`, `updatedAt`;
- `401 identity.session_invalid` per sessione assente o non valida;
- `404 campaign.not_found` identico per ID inesistente, campagna altrui e campagna soft-deleted;
- error envelope canonico con `requestId`, `Cache-Control: private, no-store` e nessun dettaglio diagnostico tenant-sensitive.

Il nuovo artifact immutabile `v4` / SemVer `4.0.0` contiene i contratti precedenti e la nuova operazione; `v1`, `v2` e `v3` restano byte-per-byte invariati. Zod è la fonte e JSON Schema/OpenAPI vengono rigenerati, mai modificati a mano.

Il rate limit `120/min` resta di proprietà di BL-065: BL-007 non introduce un secondo limiter parziale. La route conserva una classification stabile e testabile affinché BL-065 possa applicarla senza cambiare il contratto.

## 8. Confine SSE senza endpoint prematuro

BL-007 introduce un pre-handler Fastify di autorizzazione SSE, non un trasporto parallelo. Il boundary:

1. risolve `ActorContext` dalla stessa sessione dell'HTTP;
2. valida l'identificatore della risorsa;
3. invoca esclusivamente un lookup actor-scoped iniettato;
4. prosegue soltanto quando la risorsa appartiene all'attore;
5. mappa assente, altrui e soft-deleted allo stesso `404` prima di aprire lo stream.

Il test d'integrazione monta il vero pre-handler su una route Fastify fixture, emette un singolo evento SSE deterministico dopo l'autorizzazione e chiude la connessione. La route fixture non viene registrata nel composition root di produzione e non entra in OpenAPI. Questo prova cookie, actor resolution, query PostgreSQL, headers SSE e mancata apertura cross-tenant senza dichiarare implementato `/api/turns/:turnId/stream`.

BL-038 comporrà lo stesso boundary con un `TurnReader` actor-scoped e aggiungerà ticket, `Last-Event-ID`, retention, reconnect e limiti connessione. Nessuna decisione di questo design sostituisce quei requisiti.

## 9. Errori e resistenza all'enumeration

La policy pubblica distingue soltanto autenticazione da presenza della risorsa:

| Caso | Esito pubblico | Lookup campagna |
|---|---|---|
| Cookie assente/malformato | `401 identity.session_invalid` | non eseguito |
| Sessione sconosciuta/revocata/scaduta | `401 identity.session_invalid` | non eseguito |
| `campaignId` sintatticamente invalido | `400 campaign.request_invalid` | non eseguito |
| Campagna inesistente | `404 campaign.not_found` | actor-scoped |
| Campagna di altro utente | `404 campaign.not_found` | actor-scoped |
| Campagna soft-deleted | `404 campaign.not_found` | actor-scoped |
| Campagna propria | `200` o apertura SSE fixture | actor-scoped |

Body, status, error code, retryability, header pubblici e struttura restano identici nei tre casi `404`. I test non imporranno uguaglianza temporale assoluta, ma impediranno query aggiuntive, messaggi, metric labels o log che distinguano il tenant proprietario. I log interni possono registrare una reason class allowlisted senza campaign/user ID raw e senza modificare la risposta.

## 10. Concorrenza, retry e failure path

La slice è read-only: non usa idempotency key e non muta stato canonico. Letture concorrenti della stessa campagna producono la stessa projection; revoca o scadenza già committute prima della query falliscono chiuso.

Errori PostgreSQL e timeout non vengono convertiti in `404`: producono l'envelope server-safe previsto dal runtime, preservano cause soltanto nei log redatti e non aprono lo stream. Una disconnessione SSE dopo il singolo evento fixture non genera retry applicativo né side effect.

## 11. Sicurezza e threat model

BL-007 crea la baseline attiva `docs/security/THREAT_MODEL.md`, oggi registrata come planned, e documenta almeno:

- spoofing del subject tramite header o cookie costruito;
- IDOR su ID UUIDv7 validi ma appartenenti ad altri utenti;
- enumeration tramite status/body/header/log;
- sessioni revocate o scadute riutilizzate su HTTP/SSE;
- bypass tramite repository unscoped o filtro applicato dopo il fetch;
- soft-delete ancora raggiungibile;
- apertura dello stream prima dell'autorizzazione;
- errori DB trasformati erroneamente in “not found”.

Il documento riassume anche i controlli identity già implementati da BL-005/BL-006 senza duplicarne il design. BL-064 estenderà la policy di moderazione; i task privacy e operativi proprietari estenderanno lifecycle e superfici non ancora implementate. Nessuno di questi task è una dipendenza bloccante di BL-007.

RLS non è parte della slice: la garanzia obbligatoria resta nelle firme delle porte e nelle query. Una policy RLS richiederebbe gestione per-request della connessione/transazione, pool reset e test cross-connection; sarà introdotta soltanto con ADR/task dedicato. Questa esclusione non autorizza query unscoped.

## 12. Strategia TDD e gate

L'implementazione procede in batch con test fallenti osservati prima del codice:

1. tipi `ActorContext`/`CampaignId`, contract `v4` e freeze di `v1`–`v3`;
2. migration `000005`, manifest/checksum e matrice constraint/upgrade;
3. session resolver read-only con clock fake e PostgreSQL reale;
4. repository campagna actor-scoped e matrice due utenti/due campagne;
5. route HTTP e mapping uniforme `401/400/404/5xx`;
6. pre-handler SSE montato soltanto nell'integration harness;
7. security regression per IDOR, enumeration, redaction e repository surface;
8. living docs, test mirati, un solo full `pnpm verify`, review P0/P1 e checkout pulito.

La matrice minima verifica per ciascun utente: propria campagna accessibile; campagna incrociata, inesistente e soft-deleted non accessibili. Gli stessi casi attraversano repository, HTTP e SSE. Test strutturali impediscono l'esportazione di un metodo player `findById`, il trust di header subject e la registrazione della route SSE fixture nel runtime.

Provider, rete esterna e account reali sono vietati nei test. Nessun deploy o azione Vercel è necessario o autorizzato.

## 13. Documentazione e tracciabilità

Lo stesso change set funzionale aggiorna:

- `docs/CONTEXT.md` con task, migration/contract head e rischio IDOR;
- `docs/TRACEABILITY.md` per AC-23 e suite repository/API/SSE;
- `docs/architecture/SYSTEM_OVERVIEW.md` con il nuovo boundary ActorContext;
- `docs/data/DATA_MODEL.md` con la parte implementata di `campaigns`;
- `docs/api/README.md` e gli artifact generati `v4`;
- `docs/security/THREAT_MODEL.md`;
- `docs/operations/DATABASE_MIGRATIONS.md`;
- `docs/TASKS.md` con stato, dipendenze, comandi ed evidenze reali.

La decisione applica requisiti già normativi e non richiede un nuovo ADR. Un ADR diventa necessario se si introduce RLS, si cambia la semantica 404, si accetta un subject client-controlled o si espone una nuova route SSE.

## 14. Condizioni di revisione e Definition of Done

Il design va riesaminato se l'ownership diventa multi-user, compaiono ruoli campaign-scoped, si adotta RLS, cambia il formato della sessione o BL-038 necessita un modello di autorizzazione non componibile con lookup actor-scoped.

BL-007 può diventare `DONE` soltanto quando migration `000005`, contract `v4`, session resolver, repository, HTTP, guardia SSE, matrice IDOR e threat model superano test mirati, full HIGH_RISK, review e checkout pulito. L'endpoint pubblico dei turni resta non implementato e nessuna evidenza di questa slice può dichiararlo disponibile.
