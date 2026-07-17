---
status: active
owner: engineering-security-and-product
last_reviewed: 2026-07-17
last_verified_commit: e173fd9424ad77330ae8302f68affd4832d66798
source_refs:
  - docs/MVP_SPEC.md#20-api
  - docs/MVP_SPEC.md#222-autenticazione
  - docs/MVP_SPEC.md#228-csrf-e-cors
  - docs/MVP_SPEC.md#229-rate-limiting-e-abuso-costi
  - docs/MVP_SPEC.md#2212-audit-log
  - docs/MVP_SPEC.md#265-test-api
  - docs/MVP_SPEC.md#268-end-to-end
  - docs/MVP_SPEC.md#269-test-di-sicurezza
  - docs/TASKS.md#bl-006--sessioni-reset-revoca
  - docs/product/UX_UI_DESIGN.md
  - docs/adr/0010-internal-provider-neutral-identity.md
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
related_tasks:
  - BL-005
  - BL-006
  - BL-007
  - BL-065
  - BL-067
  - QA-002
code_refs:
  - apps/api/src/identity
  - apps/worker/src/identity
  - apps/web/app
  - apps/web/components/auth
  - apps/web/lib/server
  - packages/config/src
  - packages/contracts/src
  - packages/domain/src/identity
  - packages/persistence/src
test_refs:
  - tests/contracts/identity-contracts.test.mjs
  - tests/contracts/web-identity-ui.test.mjs
  - tests/database/identity-migration.test.mjs
  - tests/database/identity-store.test.mjs
  - tests/integration/identity-api.test.mjs
  - tests/integration/identity-email-worker.test.mjs
  - tests/integration/web-identity-pages.test.mjs
  - tests/security/identity-api-security.test.mjs
  - tests/security/identity-email-security.test.mjs
  - tests/security/identity-persistence-security.test.mjs
supersedes: null
---

# BL-006 — Design di accesso, sessioni e recupero credenziali

## 1. Stato della decisione

Questo documento è il contratto di design `identity-access-v1` approvato dal Product Owner il 2026-07-16. Completa `identity-signup-v1` senza cambiare la decisione provider-neutral di ADR-0010.

La slice è `HIGH_RISK`: modifica autenticazione, sessioni, credenziali, schema PostgreSQL, configurazione server-only, side effect email e superfici web. L'implementazione può iniziare soltanto dopo la review di questo documento e un piano TDD versionato.

## 2. Obiettivo e confini

BL-006 deve consentire a un utente verificato di:

1. accedere con email e password senza rivelare lo stato dell'account;
2. mantenere una sessione opaca con scadenza idle e assoluta applicate dal server;
3. uscire dal dispositivo corrente in modo idempotente;
4. revocare tutte le proprie sessioni con un'unica azione esplicita;
5. recuperare l'accesso tramite un codice email one-time e impostare una nuova password;
6. ricevere una UI mobile-first semplice, accessibile e coerente con la foundation shadcn di BL-079.

Restano fuori scope: social login, MFA utente, elenco o revoca per singolo dispositivo, IP/geolocalizzazione/device fingerprint, “ricordami”, account provider, SMTP reale, campagne e `ActorContext`, deploy Vercel, staging, Production, AI Elements, Motion e Rive.

## 3. Architettura scelta

L'identità resta un modulo interno del monolite. BL-006 aggiunge una porta specializzata `IdentityAccessStore` e l'implementazione `PostgresIdentityAccessStore`; non estende ulteriormente il repository signup monolitico e non introduce un framework auth.

I confini sono:

- `packages/contracts`: DTO e schemi Zod del nuovo artifact immutabile `v3` / SemVer `3.0.0`;
- `packages/domain`: policy pure per durata sessione, password e challenge, più errori tipizzati;
- `packages/persistence`: migration `000004_identity_access` e store transazionale specializzato;
- `apps/api`: application service e route sottili per sign-in, refresh, logout, revoca e reset;
- `apps/worker`: riuso dell'outbox con template di reset, senza cambiare la semantica di retry;
- `apps/web`: BFF same-origin e pagine/componenti auth; nessun secret o config server package nel browser.

Il contract `v2` resta byte-per-byte immutabile. Il nuovo artifact `v3` contiene sia i contratti già pubblicati sia le aggiunte di BL-006.

## 4. Contratti HTTP

Ogni mutazione richiede `Idempotency-Key`, applica l'Origin/Sec-Fetch policy già introdotta da BL-005 e restituisce l'error envelope canonico con `requestId`. I limiti sono configurabili; i valori seguenti costituiscono la baseline P0.

| Endpoint | Input | Successo | Failure sicuri | Limite iniziale |
|---|---|---|---|---:|
| `POST /api/auth/sign-in` | `email`, `password` | `200 authenticated` e nuovo cookie | `401 identity.credentials_invalid` generico; 400/403/409/429 | 10/15 min/IP e 5/15 min/email |
| `POST /api/auth/session/refresh` | nessun body | `200 authenticated` e cookie ruotato | 401 sessione non valida; 403/409 | 12/ora/utente |
| `POST /api/auth/sign-out` | nessun body | `204`, revoca corrente se presente e cookie eliminato | 403/409; assenza/replay restano 204 | 30/ora/soggetto |
| `POST /api/auth/sessions/revoke-all` | `confirmation: "revoke_all"` | `204`, tutte le sessioni revocate e cookie eliminato | 400/401/403/409/429 | 5/ora/utente |
| `POST /api/auth/password-reset/request` | `email` | `202` sempre generico | soltanto schema/origin/idempotenza/rate/servizio | 10/15 min/IP, 5/giorno/email, cooldown 60 s |
| `POST /api/auth/password-reset/confirm` | `email`, `code`, `newPassword` | `200 password_reset`, nessuna sessione, cookie eliminato | `422 identity.password_reset_code_invalid` stabile; 400/403/409/429 | 5 tentativi/challenge e 10/15 min/IP |

Il `401 identity.credentials_invalid` copre nello stesso modo account inesistente, pending, disabled e password errata. La richiesta reset usa sempre lo stesso `202` e la conferma non distingue challenge assente, scaduta, consumata o superseded.

## 5. Session lifecycle

La sessione usa il cookie esistente `__Host-dnd_ai_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` e senza `Domain`. PostgreSQL conserva soltanto il digest del token.

- idle timeout: 24 ore;
- absolute timeout: 30 giorni;
- il server aggiorna `last_seen_at` e `idle_expires_at` durante il refresh esplicito, senza oltrepassare `absolute_expires_at`;
- sign-in e refresh ruotano sempre il token; il token precedente non resta valido;
- sign-in crea una sessione nuova e non adotta un cookie preesistente, eliminando la fixation;
- cambio password revoca tutte le sessioni, inclusa quella del browser corrente;
- logout è idempotente e ordina sempre al browser di eliminare il cookie;
- sessioni scadute o revocate falliscono chiuso e non vengono riattivate.

Il refresh è un `POST` esplicito: nessuna query `GET` o render di pagina muta implicitamente lo stato autorevole.

## 6. Flusso di sign-in

1. L'API valida schema, Origin, idempotency key e bucket di rate limit prima di eseguire Argon2id.
2. Il lookup restituisce materiale sufficiente a eseguire un confronto a costo uniforme anche quando l'utente non è eleggibile.
3. La verifica Argon2id avviene fuori dalla transazione per non tenere lock durante il lavoro CPU-bound.
4. Dopo una verifica positiva, la transazione blocca e rilegge utente e credenziale.
5. Se stato o `credential_version` sono cambiati, il comando fallisce con il medesimo errore generico.
6. La transazione crea una sola nuova sessione e un evento audit redatto, quindi persiste il replay idempotente.
7. Solo dopo il commit la route emette il cookie.

Questa rilettura impedisce che un login concorrente al reset completi con una credenziale divenuta obsoleta.

## 7. Flusso di recupero password

### 7.1 Richiesta

1. La richiesta applica schema, Origin, idempotenza e rate limit prima del lookup.
2. La risposta è sempre `202` con copy neutro, indipendentemente dall'esistenza o dallo stato dell'account.
3. Soltanto un account verificato e attivo genera un codice numerico casuale di sei cifre.
4. Il codice è conservato come digest HMAC con una chiave/versione dedicata al reset, distinta dalla verifica email.
5. TTL 10 minuti, massimo 5 tentativi e una sola challenge corrente per utente; una nuova richiesta supersede la precedente.
6. Challenge e record outbox vengono creati nella stessa transazione. Nessuna email viene inviata inline.

### 7.2 Conferma

1. Email e codice localizzano e bloccano la challenge corrente; il confronto del digest è constant-time.
2. Ogni errore decrementa atomicamente i tentativi quando esiste una challenge eleggibile, senza rivelarne lo stato.
3. La nuova password attraversa la stessa policy e blocklist di signup, poi viene hashata con Argon2id e pepper corrente.
4. Una singola transazione aggiorna la credenziale, consuma la challenge, revoca tutte le sessioni, registra audit e idempotenza.
5. Il successo non crea né ripristina una sessione; la UI torna al login.

Retry e richieste simultanee convergono: una sola conferma può consumare la challenge e nessuna sessione precedente sopravvive al commit.

## 8. Schema PostgreSQL e outbox

La migration forward-only `000004_identity_access` porta il contract database a `database-identity-access-v1` e aggiunge:

- `app.password_reset_challenges`: ID, user ID, digest e key version, tentativi, scadenza, consumo e supersession, con check di coerenza e indice parziale per una sola challenge corrente;
- `app.user_credentials.credential_version`: contatore positivo incrementato a ogni cambio password e confrontato dopo l'hash per chiudere il race login/reset;
- indici di lookup per session digest, user/revocation e challenge corrente necessari ai percorsi reali;
- generalizzazione di `app.identity_email_outbox`: ogni record riferisce esattamente una challenge di verifica oppure una challenge di reset, con template allowlisted coerente al tipo;
- vincoli/indici necessari al replay idempotente delle nuove operation class.

Lo store non persiste un motivo di revoca nella riga sessione: il motivo appartiene all'audit append-only. Nessun codice, token, email raw, password hash o IP raw entra nei payload audit o nei log.

## 9. Atomicità, concorrenza e retry

- Sign-in: dopo Argon2id, lock e recheck precedono sessione, audit e idempotenza atomici.
- Refresh: la sessione corrente viene bloccata, ruotata una sola volta e limitata dall'absolute expiry.
- Logout: revoca corrente e audit sono atomici quando la sessione esiste; retry/assenza restano successo.
- Revoke-all: tutte le sessioni dell'utente, inclusa la corrente, e un solo audit vengono aggiornati atomicamente.
- Reset: consumo challenge, update credenziale, revoca globale, audit e idempotenza sono una sola transazione.
- Outbox: leasing, retry bounded e stato terminale restano quelli di BL-005; il dispatcher seleziona il renderer allowlisted dal template.

Le idempotency key sono scoped per operation e subject pseudonimo. Il replay con stesso payload riproduce lo stesso risultato senza creare nuove sessioni, challenge, email o audit; lo stesso key con payload differente restituisce `409`.

## 10. Sicurezza e privacy

- Rate limit e validazione economica precedono ogni hash costoso.
- Password, codice e token sono `Cache-Control: no-store` e non transitano in URL, query string, storage browser, telemetry o messaggi di log.
- Il reset usa una secret HMAC dedicata e versionata; config mancante o incoerente fallisce all'avvio.
- BFF e API mantengono il subject HMAC pseudonimo di BL-005; gli header provider-controlled non vengono accettati da client diretti.
- Tutte le route mutanti richiedono same-origin e segnali Sec-Fetch compatibili; assenza o mismatch falliscono chiuso secondo il profilo runtime.
- Audit conserva operation, outcome sintetico, actor/subject pseudonimo e request/correlation ID, mai PII o segreti.
- Nessun segnale di tempo, copy o codice errore deve distinguere account assente, pending o disabled.

## 11. UX/UI mobile-first

Le superfici auth non usano la HUD di gioco. Riutilizzano `AuthShell`, primitive shadcn `new-york`, token semantici, Geist e Lucide senza introdurre una seconda libreria visuale.

### 11.1 Login

`/sign-in` mostra email, password, controllo mostra/nascondi, CTA primaria “Accedi” da 48 px e link secondario “Hai dimenticato la password?”. Il submit riuscito porta alla home. Password manager, autofill e paste restano supportati.

### 11.2 Reset progressivo

`/reset-password` usa una sola card a due step:

1. email e CTA “Invia codice”;
2. codice numerico, nuova password, conferma e CTA “Imposta nuova password”.

L'email resta solo nello stato effimero React della pagina: niente URL, local/session storage o cookie. La conferma riuscita porta a `/sign-in`, senza auto-login.

### 11.3 Sicurezza account

`/account/security` presenta soltanto “Esci” e “Disconnetti tutti i dispositivi”. La seconda azione richiede conferma esplicita e comunica che anche il dispositivo corrente verrà disconnesso. Non vengono mostrati IP, browser, città, timestamp o liste di device.

### 11.4 Accessibilità e densità

- una sola azione primaria per step e massimo tre gruppi informativi concorrenti;
- target primario 48 px, altri target almeno 44 px;
- label visibili, focus ring, ordine tastiera naturale, live region per pending/success/error;
- summary errore e focus sul primo campo invalido;
- tastiera numerica e paste preservando gli zero iniziali per il codice;
- nessun requisito dipende dall'animazione; `prefers-reduced-motion` resta rispettato;
- matrici minime 320×800, 390×844 e 1440×900 senza overflow o feature desktop-only.

## 12. Strategia TDD e gate

Il piano di implementazione deve iniziare da test fallenti e procedere per batch autonomi:

1. contratti/policy/config e artifact `v3`;
2. migration zero→head e `000003`→`000004`, constraint e concorrenza;
3. store session/reset con clock fake, replay e race;
4. API sign-in/refresh/logout/revoke/reset, Origin, cookie, rate e redaction;
5. outbox reset, timeout, retry e template non autorizzato;
6. BFF e componenti UI, keyboard/accessibility e failure path;
7. verticale PostgreSQL reale, browser locale, full `pnpm verify`, audit e checkout pulito.

Test obbligatori includono happy path, credenziali generiche, account pending/disabled, Argon2 dopo rate gate, fixation, idle/absolute expiry, rotazione, logout replay, revoke-all, reset scaduto/invalido/consumato/superseded, reset/login concorrenti, idempotency mismatch, outbox retry, log redaction, cookie flags e viewport/accessibilità.

Provider ed email reali sono vietati nei test di default. Nessuna azione Vercel è necessaria o autorizzata per chiudere BL-006.

## 13. Alternative rifiutate

- Link di reset: rifiutato perché trasferisce una capability nell'URL e aggiunge failure path da scanner, forwarding e history.
- Auto-login dopo reset: rifiutato; il cambio credenziale deve revocare le sessioni e richiedere un nuovo login esplicito.
- Lista sessioni/device: differita perché richiede raccolta di metadata non necessaria alla slice e aumenta densità/privacy surface.
- JWT stateless: rifiutato; revoca, idle expiry e audit richiedono comunque stato autorevole.
- Framework/provider auth: non giustificato dopo BL-005; introdurrebbe un secondo modello dati e dipendenza esterna.
- Refresh implicito su `GET`: rifiutato perché nasconde una mutazione in un percorso di lettura.

## 14. Condizioni di revisione e Definition of Done

Il design va riesaminato se MFA/social login diventano P0, se si decide di raccogliere metadata dispositivo, se cambia la cookie policy cross-site o se un provider gestito sostituisce l'identità interna.

BL-006 può diventare `DONE` soltanto quando contract `v3`, migration `000004`, tutti i flussi e failure path, UI mobile/accessibile, documentazione living, full HIGH_RISK, audit dipendenze e clean checkout sono verificati. La delivery remota resta distinta dallo stato branch-local; SMTP reale, staging e Vercel non sono gate della card.
