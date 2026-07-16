---
status: active
owner: engineering-security-and-product
last_reviewed: 2026-07-16
last_verified_commit: a9a2e4ba3f53db1d3b9a1d1011f745f7ba50fdf2
source_refs:
  - docs/MVP_SPEC.md#201-convenzioni-rest
  - docs/MVP_SPEC.md#202-endpoints-principali
  - docs/MVP_SPEC.md#222-autenticazione
  - docs/MVP_SPEC.md#228-csrf-e-cors
  - docs/MVP_SPEC.md#229-rate-limiting-e-abuso-costi
  - docs/TASKS.md#bl-005--signup-verify-rate-limit
  - docs/product/UX_UI_DESIGN.md
  - docs/adr/0001-mobile-first-conversational-ui.md
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
  - docs/adr/0006-postgresql-migration-foundation.md
  - docs/adr/0007-observability-context-and-error-reporting.md
  - docs/adr/0008-zod-first-contract-generation.md
related_tasks:
  - BL-005
  - BL-006
code_refs:
  - apps/api/src/runtime.ts
  - apps/worker/src/runtime.ts
  - apps/web/app
  - apps/web/components/ui
  - packages/config/src/runtime-config.ts
  - packages/contracts/src
  - packages/domain
  - packages/persistence/src/migration-manifest.ts
test_refs:
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/contracts/web-design-system.test.mjs
supersedes: null
---

# BL-005 — Signup e verifica email sicuri

## Stato e decisione

Il Product Owner ha approvato il design il 2026-07-16. `BL-005` adotta identità interna provider-neutral con email/password, PostgreSQL autorevole, verifica email one-time e delivery tramite porta SMTP configurabile. Il primo accesso autenticato nasce soltanto dopo la verifica; login, logout, reset e gestione completa delle sessioni restano proprietari di `BL-006`.

La slice usa i componenti shadcn/ui già posseduti dal prodotto per un percorso mobile-first semplice, contemporaneo e accessibile. Non introduce provider auth gestiti, social login, magic link, account esterni, configurazione Vercel o invii SMTP reali nei test.

Il contratto implementativo prende il nome `identity-signup-v1`.

## Obiettivi e confini

La slice deve:

1. creare un utente inattivo con credenziale Argon2id e challenge di verifica;
2. consegnare un codice numerico tramite transactional outbox e adapter email;
3. verificare il codice una sola volta, attivare l'utente e creare una sessione sicura nella stessa transazione canonica;
4. rendere signup, resend e verify idempotenti e protetti da rate limit persistente;
5. non rivelare se un indirizzo è già registrato attraverso copy, log o tempi evitabilmente distinguibili;
6. fornire le schermate `/sign-up` e `/verify-email` ottimizzate per 320–430 px e tastiera mobile;
7. provare concorrenza, scadenza, replay, timeout SMTP, CSRF/Origin e assenza di PII nei log.

Restano fuori scope: login/logout/reset, revoca di tutte le sessioni e settings account (`BL-006`); social login e MFA utente (P1); provider email gestito e provisioning remoto; autorizzazione di campagne; deploy e modifiche Vercel.

## Approcci valutati

### Identità interna provider-neutral — scelta

Il dominio definisce porte per password hashing, challenge, sessioni, clock e delivery email. PostgreSQL conserva stato e limiti; API e worker compongono adapter concreti. Questa scelta mantiene la fonte della verità nel prodotto, non richiede account esterni e consente di sostituire SMTP o migrare a un provider auth tramite un ADR futuro senza contaminare dominio e contratti pubblici.

### Magic link — rifiutato per P0

Riduce l'attrito della password, ma trasferisce una capability di autenticazione nell'URL, è più esposto a link scanner e forward accidentali e contrasta con il requisito di non trasportare token auth in URL. Il codice inserito manualmente mantiene la capability fuori da URL, history e referrer.

### Provider auth gestito — rinviato

Clerk/Auth0/Descope ridurrebbero il codice di identity lifecycle, ma introdurrebbero stato e costi esterni non necessari per questa slice, richiederebbero un account e sposterebbero una decisione di portabilità dentro il primo percorso P0. La boundary interna consente una futura adozione senza cambiare la semantica API.

## Architettura e ownership

- `packages/contracts` possiede schema Zod strict, catalogo errori e artefatti JSON Schema/OpenAPI per signup, verify e resend.
- `packages/domain` possiede policy e tipi identity, errori di dominio e porte; non importa Fastify, PostgreSQL, SMTP o librerie crypto.
- `packages/persistence` possiede repository tenant-safe, migration `000003_identity_signup` e transazioni.
- `apps/api` possiede composition root, route sottili, verifica Origin/Sec-Fetch-Site, cookie, mapping errori e casi d'uso in `apps/api/src/identity`; non vive logica identity negli handler.
- `apps/worker` possiede un poller PostgreSQL bounded per la outbox email e l'adapter SMTP; non usa BullMQ e non importa logica di dominio negli entrypoint.
- l'application service identity coordina policy, repository, clock, hasher, challenge e outbox; non vive negli handler.
- `apps/web` possiede le due route, wrapper di dominio composti da primitive shadcn e un BFF same-origin minimale per `/api/auth/*`; non conserva password, codice o session ID nello storage browser.

Il worker esistente esegue il dispatcher con lease PostgreSQL, batch e intervallo bounded; ogni tick è testabile come funzione finita con clock iniettato. Il percorso di test usa un fake deterministico; il composition root reale seleziona SMTP senza cambiare il caso d'uso. API e worker rimangono processi dello stesso modular monolith, non microservizi autonomi.

## Modello dati

La migration aggiunge tabelle in `app` con UUID generati dall'applicazione, timestamp `timestamptz`, check constraint e indici espliciti:

| Tabella | Scopo e invarianti principali |
|---|---|
| `users` | `email_normalized` univoca, `display_name`, stato `pending_verification|active|disabled`, `email_verified_at` nullo finché pending, ruolo `player`, soft-delete separato. |
| `user_credentials` | una credenziale password attiva per utente, hash Argon2id PHC, `pepper_version`, `password_changed_at`; nessuna password o pepper nel DB. |
| `email_verification_challenges` | challenge HMAC one-time con `key_version`, `expires_at`, `attempt_count`, `max_attempts`, `consumed_at`, `superseded_at`; una sola challenge corrente per utente. |
| `user_sessions` | session record ID casuale, digest del token, `key_version`, `created_at`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`, `revoked_at`; il token raw non è persistito. |
| `identity_email_outbox` | evento `identity.verification_requested.v1` con soli user/challenge/template ID, stato delivery, lease, attempt bounded e prossima esecuzione; niente codice o email raw nel payload e unique key contro duplicati. |
| `identity_rate_limits` | bucket persistenti per classe endpoint e soggetto pseudonimizzato; nessun IP/email raw. |
| `identity_idempotency` | actor scope anonimo pseudonimizzato, endpoint, key digest, request fingerprint HMAC, response sicura, result reference interno e scadenza 24 ore; replay diverso restituisce conflitto. |
| `identity_audit_events` | ledger append-only con evento allowlisted, subject ID opzionale, correlation/request ID e metadata pseudonimi; niente email, IP, codice, hash credenziale o cookie. |

L'attivazione utente, il consumo della challenge, la creazione della sessione e l'audit `identity.email_verified.v1` sono atomici. Un indice parziale impedisce più challenge correnti e un vincolo unique sul digest sessione impedisce collisioni applicative. Le migration restano forward-only negli ambienti gestiti secondo ADR-0006.

## Normalizzazione e password

L'email viene validata come indirizzo singolo, priva di control character, lunga al massimo 254 byte, con trim sugli spazi esterni e normalizzata in lowercase per lookup. L'indirizzo di delivery originale validato può essere conservato separatamente; non si applicano trasformazioni provider-specifiche come rimozione dei punti o del `+tag`. `displayName` usa NFC, trim, 2–40 caratteri, rifiuta control character e non è un identificatore univoco.

La password:

- è normalizzata Unicode NFC prima di misurazione e hashing;
- accetta da 15 a 128 caratteri Unicode e spazi;
- non impone maiuscole, numeri o simboli artificiali;
- viene confrontata con una blocklist server-side versionata di almeno 10.000 password comuni/compromesse tramite digest esatto, vendorizzata con provenienza/licenza e checksum, senza inviarla a servizi esterni;
- non viene troncata silenziosamente e non viene scritta in log, telemetry, audit o error detail.

L'implementazione usa `argon2` dietro la porta `PasswordHasher`, con Argon2id minimo `memoryCost=19456 KiB`, `timeCost=2`, `parallelism=1`, salt casuale della libreria e formato PHC. Un pepper di almeno 32 byte, versionato e iniettato come secret API, viene applicato come HMAC-SHA-256 pre-hash con domain separation; il DB conserva soltanto `pepper_version`. Il limite Node del repository resta invariato: non si usa l'API Argon2 built-in perché non è disponibile sull'intero engine range corrente.

Questi valori seguono le baseline correnti di [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) e [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html). I parametri sono catalogati come `password-policy-v1` e possono aumentare; la verifica accetta hash precedenti e segnala rehash futuro senza anticipare il login di `BL-006`.

## Challenge email

Il codice è numerico a sei cifre e valido dieci minuti. Viene derivato uniformemente tramite HMAC-SHA-256 con domain separation da una challenge ID casuale e dalla chiave identity, usando rejection sampling per evitare bias; il worker può quindi ricostruirlo per l'invio senza conservarlo nel database. La tabella challenge conserva un secondo digest `HMAC-SHA-256(challengeKey, "identity-email-verification-digest-v1" || challengeId || code)`. Il confronto usa byte di lunghezza fissa e `timingSafeEqual`.

Ogni challenge accetta al massimo cinque tentativi. Un successo, il superamento dei tentativi, la scadenza o un resend rendono la challenge precedente inutilizzabile. Il resend ha cooldown di 60 secondi e massimo cinque invii per indirizzo nelle 24 ore; crea una nuova challenge e supersede la precedente nella stessa transazione.

## Sessione minima

Dopo la sola verifica riuscita il server crea un session record ID casuale e deriva un token pseudocasuale di 256 bit con `HMAC-SHA-256(sessionKey, "identity-session-token-v1" || sessionId)`. Restituisce il token esclusivamente nel cookie `__Host-dnd_ai_session` e conserva nel DB soltanto `SHA-256(token)`. L'idempotency record collega internamente la response al session ID: un replay autorizzato può ricalcolare lo stesso cookie senza token raw persistito e senza creare una seconda sessione. Il cookie usa `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`, nessun `Domain` e una durata non superiore alla scadenza assoluta.

La sessione P0 ha idle expiry 24 ore e absolute expiry 30 giorni. La rotazione al login, logout, reset, revoca multipla e rinnovo idle sono implementati in `BL-006`; `BL-005` crea soltanto la prima sessione e rende esplicita la porta necessaria.

Session ID, challenge, password e idempotency key non appaiono in URL, local/session storage, HTML server-rendered, log o response body.

## Contratti HTTP

Tutti i body sono Zod strict e tutte le mutazioni richiedono `Idempotency-Key` di 16–128 caratteri nell'allowlist `[A-Za-z0-9._:-]`, `Origin` same-origin e `Sec-Fetch-Site` coerente quando presente. La key e il payload vengono fingerprintati con HMAC domain-separated usando la subject hash key; non vengono conservati key o password raw. L'IP deriva dal socket remoto o da proxy esplicitamente trusted, mai da `X-Forwarded-For` arbitrario.

Il browser chiama sempre path relativi `/api/auth/*` sul dominio web. I Route Handler Next.js inoltrano verso lo stesso path Fastify usando `WEB_API_INTERNAL_ORIGIN`, variabile server-only: passano soltanto method/body bounded e header allowlisted (`content-type`, `idempotency-key`, `origin`, `sec-fetch-site`, correlation/request ID valido), non loggano il body e propagano status, envelope sicuro, `Retry-After` e request ID. Un `Set-Cookie` viene accettato soltanto se è l'unico cookie, ha nome/attributi obbligatori `__Host-dnd_ai_session; Path=/; HttpOnly; Secure; SameSite=Lax`, durata bounded non superiore alla sessione e nessun `Domain`; ogni deviazione fallisce chiusa. Il browser non conosce l'origin interno dell'API e il cookie viene quindi applicato al dominio web. Fastify resta l'autorità di validazione, rate limit e mutazione; il BFF non duplica logica identity.

### `POST /api/auth/sign-up`

Request: `email`, `password`, `displayName`. Una richiesta accettata restituisce sempre `202` con `{ status: "verification_required", challengeExpiresInSeconds: 600, resendAfterSeconds: 60 }`. Non restituisce user ID, codice o prova che l'email fosse nuova. Una key riusata con payload diverso restituisce `409 identity.idempotency_conflict`.

Il server applica il rate limit prima di Argon2: massimo cinque richieste ogni 15 minuti per IP pseudonimo e tre ogni ora per email pseudonima. Per un account pending esistente, una richiesta autorizzata ruota credenziale/challenge in modo idempotente senza creare un secondo utente; per un account active restituisce la stessa forma generica senza invio aggiuntivo oltre le policy. Gli idempotency record scadono dopo 24 ore.

### `POST /api/auth/verify-email`

Request: `email`, `code`, dove `code` è una stringa strict `^[0-9]{6}$` per preservare gli zeri iniziali. Un successo restituisce `200` con `{ status: "verified" }` e il cookie sessione. Errori: `422 identity.verification_invalid`, `410 identity.verification_expired`, `429 identity.verification_rate_limited`. Un replay della stessa richiesta con la stessa idempotency key ricalcola lo stesso token dal session result reference e restituisce la response/cookie originali senza creare una seconda sessione; un nuovo tentativo con una key diversa sulla challenge consumata fallisce chiuso. Il limite è cinque tentativi per challenge e dieci richieste ogni 15 minuti per IP pseudonimo.

### `POST /api/auth/resend-verification`

Request: `email`. Restituisce `202` con forma generica e gli stessi limiti anti-enumeration. Rispetta cooldown 60 secondi, massimo cinque invii per email nelle 24 ore, dieci richieste ogni 15 minuti per IP pseudonimo, supersession atomica e idempotenza.

Errori condivisi: `400 identity.request_invalid`, `403 identity.origin_rejected`, `409 identity.idempotency_conflict`, `429 identity.rate_limited` con `Retry-After`, `503 identity.delivery_unavailable` retryable soltanto quando l'accettazione della outbox non può essere garantita. Un timeout SMTP dopo l'accettazione in outbox non modifica la response signup e viene ritentato dal dispatcher bounded.

## Delivery email e failure path

La porta `VerificationEmailSender` riceve un DTO minimale e non vede password, sessione o record completi. Il dispatcher risolve user/challenge, deriva il codice in memoria appena prima dell'invio e azzera i buffer intermedi quando possibile. L'adapter reale usa `nodemailer` con TLS verificato, connection/greeting timeout 5 secondi, socket timeout 10 secondi, pool massimo 2 connessioni/20 messaggi e nessun fallback provider. Il poller usa intervallo 2 secondi, batch 25 e lease 30 secondi; l'outbox limita a cinque attempt con backoff `min(300 s, 5 s × 2^(attempt-1))` più jitter iniettato 0–1 secondo e stato terminale osservabile.

Un crash dopo commit e prima dell'invio lascia la riga pending; un crash dopo invio ma prima dell'ack può produrre un secondo messaggio, ma non una seconda challenge valida né una mutazione canonica duplicata. Il contenuto email espone soltanto codice, scadenza e indicazione di ignorare il messaggio; niente link autenticante.

I test usano sender fake in-memory e clock/RNG deterministici. Nessun test apre rete o richiede credenziali SMTP.

## Dipendenze ammesse

La feasibility sul registry del 2026-07-16 seleziona `argon2@0.44.0` (Node ≥16.17, MIT) e `nodemailer@9.0.3` (MIT-0), con `@types/nodemailer@8.0.1` solo se necessario al build TypeScript. Le versioni vengono pin esattamente con lockfile e audit; l'eventuale script native di `argon2` entra nella allowlist pnpm in modo nominativo. HMAC, randomness e constant-time compare usano `node:crypto`. Non vengono aggiunti framework auth, librerie rate-limit, template engine email o un secondo form framework.

## Configurazione

Le variabili sono server-only, service-scoped e validate prima di listener o connessioni:

- `WEB_API_INTERNAL_ORIGIN`, origin HTTP(S) assoluta usata soltanto dai Route Handler Next.js e mai esposta come `NEXT_PUBLIC_*`;
- `API_PUBLIC_ORIGIN`;
- `API_AUTH_PASSWORD_PEPPER_BASE64` e `API_AUTH_PASSWORD_PEPPER_VERSION`;
- `API_AUTH_CHALLENGE_HMAC_KEY_BASE64` e `API_AUTH_CHALLENGE_KEY_VERSION`;
- `API_AUTH_SESSION_HMAC_KEY_BASE64` e `API_AUTH_SESSION_KEY_VERSION`;
- `API_AUTH_SUBJECT_HASH_KEY_BASE64` per rate limit/audit pseudonimi;
- `WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64` e `WORKER_AUTH_CHALLENGE_KEY_VERSION`, stesso secret/versione logici della challenge API ma iniettati nel solo profilo worker;
- `WORKER_EMAIL_DELIVERY_MODE=fake|smtp`;
- `WORKER_SMTP_HOST`, `WORKER_SMTP_PORT`, `WORKER_SMTP_SECURE`, `WORKER_SMTP_USERNAME`, `WORKER_SMTP_PASSWORD`, `WORKER_SMTP_FROM` quando la modalità è `smtp`.

Password pepper, session key, subject hash key e challenge key sono secret logicamente distinti e decodificano ad almeno 32 byte; la challenge key è l'unica condivisa fra API e worker per permettere la derivazione del codice. Una rotazione challenge invalida/supersede in modo auditato le challenge pending prima di eliminare la chiave precedente; una rotazione session key revoca intenzionalmente le sessioni della versione precedente. `fake` è ammesso soltanto in local/test; staging/production falliscono all'avvio se non è configurato SMTP. I secret non hanno default, non attraversano il browser e non vengono aggiunti a Vercel in questa slice.

## UX/UI mobile-first

`/sign-up` usa una singola `Card` centrata, `Label`, `Input`, `Button`, `Alert` e testo essenziale: email, nome visibile, password, mostra/nascondi password e CTA primaria da 48 px. `autocomplete` usa `email`, `name` e `new-password`; il campo password supporta password manager e incolla senza impedirli. La pagina non mostra HUD di gioco, immagini fantasy, gradienti invasivi o informazioni secondarie.

`/verify-email` mostra il codice come unico compito, tastiera numerica tramite `inputMode="numeric"`, scadenza/cooldown leggibili, CTA verifica e azione resend secondaria. Il focus entra nel primo campo invalido o nel titolo di esito; errori inline e summary sono collegati con `aria-describedby`, lo stato asincrono usa live region e nessuna informazione dipende dall'animazione.

Entrambe le pagine rispettano 320/390/1440 px, safe area, zoom browser, touch target almeno 44 px, contrasto e `prefers-reduced-motion`. Le transizioni sono limitate a feedback shadcn/CSS già disponibile; Motion e AI Elements non sono necessari per il form e restano fuori dalla slice.

## Osservabilità e privacy

Gli eventi allowlisted includono `identity.signup.accepted`, `identity.verification.failed`, `identity.email_verified`, `identity.email.delivery_failed` e `identity.rate_limited`. Espongono request/correlation ID, error code, durata e identificatori pseudonimi; non espongono email, IP, user agent raw, codice, cookie, hash/digest, password, payload SMTP o body HTTP.

Gli errori inattesi conservano causa/stack internamente dopo sanitizzazione; la response usa l'envelope API stabile. I tempi non vengono dichiarati matematicamente indistinguibili: la mitigazione è risposta generica, rate limit pre-hash, operazioni dummy bounded sui rami sensibili e nessun dettaglio osservabile sullo stato account.

## Strategia TDD e verifica

### Unit e property

- normalizzazione email/password, limiti Unicode, blocklist e policy exhaustive;
- Argon2id/pepper round-trip, parametri, hash malformato e rotazione versione;
- challenge HMAC/derivazione uniforme, scadenza, cinque tentativi, compare costante e supersession;
- cookie/digest/session expiry, rate bucket e idempotency request hash.

### PostgreSQL integration

- migration zero→`000003`, previous→head, replay e rollback local/disposable;
- unique/check/partial index, transazioni e audit append-only;
- due signup simultanei sulla stessa email, verify simultanei e resend concorrente;
- lease/crash/retry outbox, dispatcher concorrenti, idempotency replay/conflict e rate limit persistente.

### API, security e UX

- happy/negative path via `app.inject()`, mapping 202/200/4xx/503 e `Retry-After`;
- BFF same-origin: header allowlist, body bounded, passthrough cookie/errori e rifiuto di origin/config non valide;
- Origin/Sec-Fetch-Site, cookie exact, payload unknown, body limit e anti-enumeration;
- fixture PII/secret assente da log, errori, audit e report;
- sender fake: timeout, retry, terminal failure e zero rete;
- component test tastiera/accessibilità e smoke browser locale 320/390/1440.

I test applicativi vengono osservati RED prima del codice corrispondente. Poiché cambiano security, schema, config, dipendenze e cookie, l'implementazione usa corsia `HIGH_RISK`, test mirati durante lo sviluppo, un solo `verify` sul candidato, clean checkout e `CI / Merge gate` protetto.

## Criteri di successo

`BL-005` può essere proposto `DONE/100%/PASSING` soltanto quando:

1. un utente resta pending prima della verifica e diventa active con una sola sessione dopo il codice valido;
2. replay, concorrenza, scadenza, tentativi e supersession non duplicano utenti, sessioni o side effect canonici;
3. rate limit, idempotenza, Origin e cookie rispettano il contratto;
4. la migration reale e i failure path email sono verdi senza provider o rete;
5. le schermate shadcn sono usabili e accessibili sui viewport target;
6. log, audit, errori e artifact non contengono PII o secret della fixture;
7. contratti generati, documentazione, tracciabilità e stato rappresentano il codice;
8. il candidato supera full gate, clean checkout e una sola PR protetta, senza azioni Vercel.

## Condizioni di revisione

La scelta viene riaperta solo se il costo operativo o il rischio dell'identità interna supera un provider gestito, se servono federation/social login/MFA P1 oppure se obblighi normativi richiedono un identity provider certificato. Una migrazione deve preservare user ID, audit, anti-enumeration, session revocation e contratti API oppure versionarli esplicitamente.
