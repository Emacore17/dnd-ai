---
status: active
owner: engineering-security-and-product
last_reviewed: 2026-07-16
last_verified_commit: 0761b18d5b910c309e763774749b5bf1352b1d6c
source_refs:
  - docs/MVP_SPEC.md#201-convenzioni-rest
  - docs/MVP_SPEC.md#202-endpoints-principali
  - docs/MVP_SPEC.md#222-autenticazione
  - docs/MVP_SPEC.md#228-csrf-e-cors
  - docs/MVP_SPEC.md#229-rate-limiting-e-abuso-costi
  - docs/TASKS.md#bl-005--signup-verify-rate-limit
  - docs/product/UX_UI_DESIGN.md
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
  - docs/adr/0010-internal-provider-neutral-identity.md
related_tasks:
  - BL-005
  - BL-006
  - QA-002
code_refs:
  - apps/api/src
  - apps/worker/src
  - apps/web/app
  - apps/web/components/ui
  - packages/config/src
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

# BL-005 — Signup Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute this plan task-by-task. In questa sessione il Product Owner ha già scelto l'esecuzione inline; non creare sub-agent.

**Goal:** consegnare signup, verifica email e resend provider-neutral con sessione iniziale sicura, outbox email e UI shadcn mobile-first, senza introdurre login/logout, provider esterni o azioni Vercel.

**Architecture:** Fastify resta l'autorità HTTP e applicativa; PostgreSQL conserva identità, rate limit, idempotenza, audit e outbox. `packages/domain` contiene soltanto policy, errori e porte pure. Gli adapter Node crypto/Argon2 vivono nell'API, l'adapter di derivazione challenge e SMTP nel worker, e fixture golden ne impediscono il drift. Next espone un BFF same-origin sottile e due route UI; nessun secret raggiunge il client.

**Tech Stack:** TypeScript strict, Fastify, PostgreSQL/node-pg-migrate, Zod/JSON Schema/OpenAPI, `argon2@0.44.0`, `nodemailer@9.0.3`, Next.js 16, React 19, shadcn/ui `new-york` su Radix, Node test runner.

## Global Constraints

- Corsia `HIGH_RISK`: schema, security, cookie, config, dipendenze native e side effect email cambiano nello stesso candidato.
- Applicare TDD: per ogni task osservare il test mirato RED per il comportamento mancante, implementare il minimo, poi osservare GREEN. Non scrivere codice di produzione prima del relativo RED.
- Usare clock, random bytes e jitter iniettati. Test e build non usano rete, SMTP reale, Vercel o account esterni.
- Non loggare body, email, IP, password, codice, cookie, idempotency key, digest o payload SMTP. I test devono provare l'assenza di questi valori.
- Preservare risposta anti-enumeration per signup/resend e applicare rate limit prima di Argon2.
- Il dominio non importa Fastify, PostgreSQL, SMTP, `node:crypto` o `argon2`; gli adapter crittografici duplicati API/worker condividono fixture golden, non codice infrastrutturale.
- `WEB_API_INTERNAL_ORIGIN` è server-only. Il browser usa soltanto `/api/auth/*` e non persiste password, codice o session ID.
- Non introdurre Motion, AI Elements, Rive, un auth framework, una seconda form library o nuove primitive oltre `Label` e `Alert`.
- A fine task eseguire test mirati; eseguire una sola `TURBO_FORCE=true corepack pnpm@11.13.0 verify` sul candidato finale e poi il clean-checkout gate previsto.

---

## Task 1 — Contratti identity e policy di dominio

**Files**

- Create: `packages/contracts/src/identity.ts`
- Create: `packages/contracts/src/operations.ts`
- Modify: `packages/contracts/src/{catalog,artifacts,index,version}.ts`
- Preserve byte-for-byte: `packages/contracts/generated/v1/**`
- Generate: `packages/contracts/generated/v2/**`
- Modify: `scripts/generate-contracts.mjs`
- Create: `packages/domain/src/identity/{errors,policy,ports,types}.ts`
- Create: `apps/api/assets/common-passwords-top-10000.sha256`
- Create: `apps/api/assets/NOTICE.md`
- Modify: `packages/domain/src/index.ts`
- Create: `tests/unit/identity-policy.test.mjs`
- Create: `tests/contracts/identity-contracts.test.mjs`
- Verify: `tests/contracts/contracts-generated.test.mjs`
- Verify: `tests/security/secret-scanner.test.mjs`

- [x] Scrivere `identity-contracts.test.mjs` per richiedere body strict, codice stringa `^[0-9]{6}$`, email normalizzata, display name bounded, header `Idempotency-Key` 16–128 e i path OpenAPI `/api/auth/sign-up`, `/api/auth/verify-email`, `/api/auth/resend-verification`.
- [x] Scrivere `identity-policy.test.mjs` per NFC, password 15–128 Unicode, assenza di composition rules, blocklist >=10.000 righe, display name, TTL 600 s, max 5 tentativi, cooldown 60 s e session expiry 24 h/30 giorni.
- [x] Eseguire il RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/contracts --filter=@dnd-ai/domain
  node --test tests/contracts/identity-contracts.test.mjs tests/unit/identity-policy.test.mjs
  ```

  Atteso: fallimento per export/schema/policy identity mancanti, non per setup.

- [x] Implementare schema Zod strict e tipi inferiti:

  ```ts
  export const SignUpRequestSchema = z.strictObject({
    email: IdentityEmailSchema,
    password: z.string().min(15).max(128),
    displayName: DisplayNameSchema,
  });

  export const VerifyEmailRequestSchema = z.strictObject({
    email: IdentityEmailSchema,
    code: z.string().regex(/^[0-9]{6}$/u),
  });
  ```

- [x] Aggiungere response `verification_required`/`verified`, error code identity allowlisted e definizioni OpenAPI 202/200/400/403/409/410/422/429/503 con header `Idempotency-Key`, `Retry-After` e `Set-Cookie` dove applicabile.
- [x] Pubblicare `CONTRACT_VERSION` `2.0.0` e namespace `v2`, mantenendo `schemaVersion: 1` negli envelope evento/SSE invariati: ADR-0008 rende il major artifact `v1` immutabile anche per aggiunte, ma BL-005 non cambia il wire format degli eventi. Estendere il generatore affinché conservi/verifichi `v1` byte-per-byte dalla base Git protetta e aggiunga soltanto `v2`; verificare compatibilità backward e failure closed su major mancanti o alterati.
- [x] Definire porte pure con dati minimali:

  ```ts
  export interface PasswordHasher {
    hash(password: string): Promise<PasswordHash>;
    verify(password: string, stored: PasswordHash): Promise<boolean>;
  }

  export interface IdentityClock { now(): Date }
  export interface IdentityRandomSource { bytes(length: number): Uint8Array }
  export interface IdentityStore {
    signUp(command: SignUpCommand): Promise<SignUpResult>;
    verifyEmail(command: VerifyEmailCommand): Promise<VerifyEmailResult>;
    resendVerification(command: ResendVerificationCommand): Promise<ResendResult>;
  }
  ```

- [x] Vendorizzare nell'adapter API server-only i digest SHA-256 della lista password con provenienza, licenza e checksum sorgente/output in `NOTICE.md`; il test rifiuta righe vuote/duplicate e prova almeno 10.000 voci senza inserire la lista nel dominio o nel bundle browser. La policy pura riceve un predicato `PasswordBlocklist` iniettato.
- [x] Portare a GREEN i test nuovi, `contracts-generated`, compatibilità e secret scan.

## Task 2 — Configurazione runtime, adapter crypto e dipendenze pin

**Files**

- Modify: `packages/config/src/{runtime-config,index,cli}.ts`
- Modify: `apps/{api,worker,web}/.env.example`
- Modify: `packages/{domain,config}/package.json`
- Modify: `apps/{api,worker}/package.json`
- Modify: `apps/web/next.config.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/api/src/identity/{identity-crypto,password-blocklist,password-hasher}.ts`
- Create: `apps/worker/src/identity/challenge-code.ts`
- Create: `tests/fixtures/identity/crypto-golden.json`
- Create: `tests/unit/identity-crypto.test.mjs`
- Modify: `tests/unit/runtime-config.test.mjs`
- Modify: `tests/contracts/runtime-config-contract.test.mjs`
- Verify: `tests/contracts/workspace-boundaries.test.mjs`
- Verify: `tests/security/environment-file-policy.test.mjs`

- [x] Scrivere RED per config API/worker/web: secret Base64 decodificati >=32 byte, versioni positive, chiavi logicamente distinte, `fake` solo local, SMTP obbligatorio fuori local, origin HTTP(S) senza credentials/query/hash e `WEB_API_INTERNAL_ORIGIN` server-only.
- [x] Scrivere RED crypto golden per challenge six-digit con leading zero preservato, digest fixed-length/timing-safe, subject/idempotency HMAC domain-separated, session token 32 byte e digest SHA-256.
- [x] Eseguire RED con:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/config --filter=@dnd-ai/domain --filter=@dnd-ai/api --filter=@dnd-ai/worker
  node --test tests/unit/runtime-config.test.mjs tests/contracts/runtime-config-contract.test.mjs tests/unit/identity-crypto.test.mjs
  ```

- [x] Estendere `ConfigurationService` con `web` e restituire oggetti frozen che espongono chiavi già decodificate come `Uint8Array`, mai valori raw nei messaggi d'errore.
- [x] Implementare HMAC domain separation, rejection sampling e constant-time compare negli adapter API; implementare nel worker la sola derivazione challenge verificata contro la stessa fixture golden.
- [x] Implementare `Argon2PasswordHasher` con prehash `HMAC-SHA-256(pepper, "identity-password-v1" || NFC(password))`, Argon2id `memoryCost=19456`, `timeCost=2`, `parallelism=1`, formato PHC e versione pepper esplicita. Hash malformati/pepper sconosciuto falliscono chiuso.
- [x] Installare esattamente `argon2@0.44.0`, `nodemailer@9.0.3` e `@types/nodemailer@8.0.1` se TypeScript lo richiede. Aggiungere soltanto `argon2: true` alla allowlist `pnpm.onlyBuiltDependencies`/policy equivalente; niente wildcard.
- [x] Esporre il parser web server-only senza dichiarare ancora dipendenze inutilizzate nel manifest web; `@dnd-ai/config`/`@dnd-ai/contracts` e il guard client vengono aggiunti insieme al primo Route Handler consumer nel Task 6.
- [x] Correggere la root Next/Turbopack nella worktree con `outputFileTracingRoot`/`turbopack.root` espliciti dopo il RED degli smoke standalone; nessuna variazione del comportamento applicativo.
- [x] Portare a GREEN test config/crypto/boundary e poi eseguire `corepack pnpm@11.13.0 audit --prod` registrando finding reali senza forzare upgrade fuori scope (`No known vulnerabilities found`).

## Task 3 — Migration identity e repository PostgreSQL

**Files**

- Create: `packages/persistence/src/migrations/000003_identity_signup.ts`
- Create: `packages/persistence/src/identity-store.ts`
- Modify: `packages/persistence/src/{migration-manifest,index}.ts`
- Modify: `tests/contracts/database-migration-contract.test.mjs`
- Create: `tests/database/identity-migration.test.mjs`
- Create: `tests/database/identity-store.test.mjs`
- Create: `tests/security/identity-persistence-security.test.mjs`

- [x] Scrivere RED sul migration head `000003_identity_signup`, manifest/checksum e tabelle `users`, `user_credentials`, `email_verification_challenges`, `user_sessions`, `identity_email_outbox`, `identity_rate_limits`, `identity_idempotency`, `identity_audit_events`.
- [x] Provare in RED vincoli: email canonical unique, un challenge corrente per user, code/session digest 64 hex, tentativi bounded, outbox dedupe, idempotency scope unique, TTL/lease coerenti e audit metadata privo di PII.
- [x] Scrivere integration RED con PostgreSQL reale per signup pending, retry exact/payload conflict, resend supersession/cooldown, verify atomico, cinque tentativi, expiry, due verify simultanee e due signup simultanee.
- [x] Eseguire RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/persistence
  node --test tests/contracts/database-migration-contract.test.mjs tests/database/identity-migration.test.mjs tests/database/identity-store.test.mjs
  ```

- [x] Implementare migration forward-only e aggiornare manifest con SHA-256 della sorgente, contract version `database-identity-signup-v1`, migration id 3 e `minimumCompatibleMigrationId: 1`.
- [x] Implementare `PostgresIdentityStore` con transazioni e lock advisory/riga dove necessario; nessun `SELECT *`; ogni query applica indici e restituisce DTO minimali.
- [x] Applicare rate bucket atomici, consumati dall'application service prima di Argon2, usando subject HMAC fornito dall'API: signup 5/15 min/IP e 3/h/email; verify 10/15 min/IP e 5/challenge; resend 10/15 min/IP, 5/24 h/email e cooldown 60 s.
- [x] Rendere atomici: pending user + credential + challenge + outbox + audit; rotazione di credenziale/challenge per signup pending; supersession resend; challenge consume + user active + una sessione + idempotency + audit.
- [x] Portare a GREEN migration da database vuoto, upgrade 000002→000003, down locale di test, audit append-only, concorrenza e security test. Verificare che gli indici servano i lookup reali con `EXPLAIN` nei test database. Evidenza locale: lane database 21/21 PASS; lane unit 119 PASS/1 SKIP.

## Task 4 — Application service e route Fastify

**Files**

- Create: `apps/api/src/identity/{identity-service,origin-policy,http-errors,routes,session-cookie}.ts`
- Modify: `apps/api/src/{app,runtime,index}.ts`
- Modify: `apps/api/package.json`
- Create: `tests/unit/identity-service.test.mjs`
- Create: `tests/unit/identity-cookie.test.mjs`
- Create: `tests/integration/identity-api.test.mjs`
- Create: `tests/security/identity-api-security.test.mjs`

- [x] Scrivere unit RED con fake store/clock/crypto/hasher per ordine rate-limit-before-Argon2, normalizzazione, dummy bounded active-account, replay exact, idempotency conflict, expiry, max attempts e mapping errori.
- [x] Scrivere API RED via `Fastify.inject`: 202 generico signup/resend, 200 verify + cookie, unknown key 400, Origin/Sec-Fetch-Site 403, body/header bounded, 409/410/422/429/503, `Retry-After`, request ID e nessuna enumerazione.
- [x] Scrivere security RED che invia canary email/password/code/cookie/idempotency/IP e verifica assenza da error envelope/response; il ledger audit resta coperto dal test PostgreSQL append-only e dalla metadata allowlist del Task 3.
- [x] Eseguire RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/api
  node --test tests/unit/identity-service.test.mjs tests/unit/identity-cookie.test.mjs tests/integration/identity-api.test.mjs tests/security/identity-api-security.test.mjs
  ```

- [x] Implementare `IdentityService` come orchestratore; gli handler fanno solo parse, policy richiesta, service call, mapping response. `createApiApp` riceve dipendenze identity opzionali/iniettate per test e il runtime reale compone pool/store/adapter.
- [x] Validare `Idempotency-Key` e fingerprint HMAC di `{endpoint, normalizedBody}` senza conservare raw key/password; IP solo dal socket, ignorando `X-Forwarded-For` non trusted.
- [x] Implementare cookie factory/parser fail-closed:

  ```text
  __Host-dnd_ai_session=<base64url-32-byte-token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=<bounded>
  ```

  Nessun `Domain`, expiry non oltre 30 giorni; replay verify ricalcola lo stesso token dal solo session ID/versione interna.
- [x] Registrare shutdown ordinato e idempotente del pool e rollback su composition failure; nessuna route auth viene registrata con config incompleta. Gli hook osservabilità vengono registrati prima delle route identity.
- [x] Portare a GREEN unit/integration/security e runtime-startup mirato. Evidenza locale: unit 130 PASS/1 SKIP; integration 25/25 PASS; test identity mirati 19/19 PASS; lint mirato PASS.

## Task 5 — Dispatcher outbox e delivery email

**Files**

- Create: `apps/worker/src/identity/{email-sender,outbox-dispatcher,postgres-outbox,smtp-email-sender}.ts`
- Create: `apps/worker/src/start.ts`
- Modify: `apps/worker/src/{runtime,index}.ts`
- Modify: `apps/worker/package.json`
- Create: `tests/unit/identity-outbox-dispatcher.test.mjs`
- Create: `tests/integration/identity-email-worker.test.mjs`
- Create: `tests/security/identity-email-security.test.mjs`

- [x] Scrivere RED per tick finito: batch 25, lease 30 s, poll 2 s, max 5 attempt, backoff `min(300s, 5s*2^(attempt-1)) + jitter 0..1s`, ack/fail/release e stop con abort signal.
- [x] Scrivere RED PostgreSQL con due dispatcher concorrenti, lease scaduta, crash prima/dopo send, stato terminale e nessuna seconda challenge/mutazione canonica.
- [x] Scrivere RED fake sender deterministico e SMTP adapter con pool 2/20, TLS verificato, connection/greeting 5 s, socket 10 s e contenuto senza link autenticante/PII extra.
- [x] Eseguire RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/worker
  node --test tests/unit/identity-outbox-dispatcher.test.mjs tests/integration/identity-email-worker.test.mjs tests/security/identity-email-security.test.mjs
  ```

- [x] Implementare `dispatchIdentityEmailBatch(deps): Promise<DispatchSummary>` senza loop nascosto; il loop runtime usa timer cancellabile e chiama un tick alla volta.
- [x] Risolvere user/challenge nella query worker, derivare il codice in memoria con la key/versione corretta, inviare DTO `{ recipient, displayName, code, expiresInMinutes: 10 }` e non esporre record completi alla porta.
- [x] Implementare fake solo local/test e Nodemailer solo quando `deliveryMode === "smtp"`; nessun trasporto o socket viene creato all'import.
- [x] Portare a GREEN test unit/integration/security e startup/shutdown worker. Evidenza locale: build/lint/typecheck worker+persistence PASS; 13/13 test unit/integration/security worker PASS; contratti migration, database identity e runtime-startup 16/16 PASS.

## Task 6 — BFF Next e UI shadcn mobile-first

**Files**

- Create: `apps/web/lib/server/identity-bff.ts`
- Create: `apps/web/lib/server/{identity-runtime-config,identity-client-subject-assertion}.ts`
- Create: `apps/web/app/api/auth/{sign-up,verify-email,resend-verification}/route.ts`
- Create: `apps/web/components/auth/{auth-shell,sign-up-form,verify-email-form}.tsx`
- Create: `apps/web/app/sign-up/page.tsx`
- Create: `apps/web/app/verify-email/page.tsx`
- Create: `apps/web/components/ui/{label,alert}.tsx`
- Modify: `apps/web/app/globals.css`
- Create: `tests/unit/identity-bff.test.mjs`
- Create: `tests/contracts/web-identity-ui.test.mjs`
- Create: `tests/integration/web-identity-pages.test.mjs`

- [x] Scrivere BFF RED per path fisso, body limit, timeout/abort, allowlist header, config invalid, response JSON bounded, passthrough `Retry-After`/request ID e rifiuto di cookie multipli o attributi non esatti.
- [x] Scrivere contract/UI RED per `/sign-up` e `/verify-email`: Card/Label/Input/Button/Alert, un CTA primario, autocomplete password-manager, `inputMode="numeric"`, live error, touch 44/48, safe area, focus visibile, nessun storage browser e nessuna decorazione fantasy.
- [x] Eseguire RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/web
  node --test tests/unit/identity-bff.test.mjs tests/contracts/web-identity-ui.test.mjs tests/integration/web-identity-pages.test.mjs
  ```

- [x] Ispezionare prima le primitive shadcn:

  ```powershell
  corepack pnpm@11.13.0 --filter @dnd-ai/web exec shadcn view label alert
  corepack pnpm@11.13.0 --filter @dnd-ai/web exec shadcn add label alert --dry-run
  ```

  Poi aggiungere solo `label` e `alert`, revisionando il diff CLI.

- [x] Implementare BFF server-only verso `WEB_API_INTERNAL_ORIGIN`: inoltra solo `content-type`, `idempotency-key`, `origin`, `sec-fetch-site`, ID valido e subject client HMAC firmato; non logga body/IP raw; Fastify resta autorità.
- [x] Implementare form client con stato locale effimero, chiave idempotency generata per submit logico, duplicate submit disabilitato, errori italiani stabili e redirect a `/verify-email` senza email/codice/sessione nell'URL o storage.
- [x] La verifica chiede email + codice; resend mantiene CTA secondaria e countdown accessibile. Nessun HUD, feed, Motion, AI Elements o Rive sulle form.
- [x] Portare a GREEN test BFF/UI, lint/typecheck/build web e smoke HTTP standalone. Evidenza locale: build production Next PASS; lint/typecheck web PASS; 13/13 test BFF/UI/standalone PASS.
- [x] Avviare localmente il build production-like e verificare con browser 320×800, 390×844 e 1440×900: overflow, tastiera/focus order, label, live error, target touch, disabled/loading, error/retry e gerarchia a una mano. Trasformare ogni finding P0/P1 in test prima della correzione; non commettere screenshot temporanei. Evidenza locale: nessun overflow/overlay/console error; target 44/48 px e focus order PASS; finding P1 sul paste formattato coperto da test e corretto.

## Task 7 — Vertical slice, documentazione e candidato finale

**Files**

- Create: `tests/integration/identity-signup-flow.test.mjs`
- Review unchanged: `docs/MVP_SPEC.md` (nessun requisito normativo è cambiato)
- Modify: `docs/{TASKS,CONTEXT,TRACEABILITY,CHANGELOG,README}.md`
- Modify: `docs/product/UX_UI_DESIGN.md`
- Modify: `docs/architecture/SYSTEM_OVERVIEW.md`
- Modify: `docs/data/DATA_MODEL.md`
- Modify: `docs/api/README.md`
- Modify: `docs/operations/{CONFIGURATION,DATABASE_MIGRATIONS,LOCAL_DEVELOPMENT}.md`
- Modify: `docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md`
- Modify: `docs/superpowers/plans/2026-07-16-bl-005-signup-verification.md`

- [x] Scrivere/portare GREEN la vertical slice reale: signup crea pending + outbox; fake worker cattura codice; verify attiva una volta e restituisce cookie; replay stessa key restituisce stesso cookie; concorrenza non duplica user/session/outbox canonici.
- [x] Aggiungere failure path E2E per codice errato/scaduto, resend supersession, rate limit, idempotency conflict, Origin rejection e SMTP timeout dopo accettazione outbox.
- [x] Aggiornare living docs con file/versioni reali, migration head, config, endpoint, copy UI, test/evidenze e limiti noti. Non dichiarare SMTP reale, Vercel o provider verificati.
- [x] Aggiornare BL-005 a `IN_REVIEW/90%` dopo aggregato identity `74/74`, quindi a proposta `DONE/100%/PASSING` dopo full gate, clean checkout e self-review terminale; rendere `BL-006` il prossimo P0 READY senza anticiparne lo sviluppo.
- [x] Eseguire checklist React best practices dopo le modifiche TSX e self-review security/architecture del diff completo; corretti i finding P1 riproducibili sul paste del codice e sul rate limit globale dietro BFF mediante subject pseudonimo firmato, senza dipendenze aggiuntive.
- [x] Eseguire il solo full gate candidato:

  ```powershell
  $env:TURBO_FORCE='true'
  corepack pnpm@11.13.0 verify
  ```

- [x] Eseguire clean-checkout: install frozen, generated drift, migration da vuoto/upgrade, identity flow, web build/smoke e secret scan. Nessuna rete salvo registry durante `pnpm install`, nessuna azione Vercel.
- [x] Rileggere il diff, verificare assenza di secret/PII/debug/artifact e creare un unico candidato funzionale.
- [ ] Aprire una sola PR e integrare soltanto con `CI / Merge gate` verde.

## Criteri di stop

- Se `argon2` non installa o non produce hash Argon2id sull'engine CI supportato, fermare il task dipendente e registrare il finding: non sostituire silenziosamente algoritmo o parametri.
- Se non è possibile garantire transazione/lock/idempotenza con lo schema proposto, fermare persistence/API e correggere design o ADR prima di continuare.
- Se un adapter richiede secret nel client, cookie rilassato, `X-Forwarded-For` non trusted o logging del body, fallire chiuso.
- Se la UI richiede state machine turno, HUD, Motion, AI Elements o componenti non auth, spostare il lavoro al task proprietario senza ampliare BL-005.
- Se SMTP reale, provider, deploy o Vercel diventano necessari, lasciare quella sola prova fuori scope; non usare account diversi né modificare ambienti remoti.
