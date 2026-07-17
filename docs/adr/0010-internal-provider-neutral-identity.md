---
status: accepted
owner: engineering-security-and-product
last_reviewed: 2026-07-17
last_verified_commit: e173fd9424ad77330ae8302f68affd4832d66798
source_refs:
  - docs/MVP_SPEC.md#222-autenticazione
  - docs/MVP_SPEC.md#228-csrf-e-cors
  - docs/MVP_SPEC.md#229-rate-limiting-e-abuso-costi
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
  - docs/superpowers/specs/2026-07-16-bl-006-session-access-design.md
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
  - docs/adr/0006-postgresql-migration-foundation.md
  - docs/adr/0007-observability-context-and-error-reporting.md
  - docs/adr/0008-zod-first-contract-generation.md
related_tasks:
  - BL-005
  - BL-006
code_refs:
  - apps/api/src/runtime.ts
  - apps/web/app
  - packages/config
  - packages/contracts
  - packages/domain
  - packages/persistence
test_refs:
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/contracts/web-design-system.test.mjs
supersedes: null
---

# ADR-0010 — Identità interna provider-neutral

## Stato

Accepted il 2026-07-16 durante il design di `BL-005`.

## Contesto

L'MVP richiede email verificata, password sicura, sessioni revocabili, rate limit e audit. La decisione build-vs-managed era aperta; il progetto non dispone di un provider auth approvato e la slice deve essere verificabile localmente senza account, rete o stato esterno.

## Decisione

1. L'identità P0 è implementata internamente dietro porte provider-neutral; PostgreSQL è la fonte autorevole per utenti, credenziali, challenge, sessioni, idempotenza, rate limit e audit.
2. Le password usano Argon2id con pepper versionato e secret server-only; policy e parametri sono versionati.
3. La verifica email usa un codice numerico one-time conservato come digest HMAC, mai un token auth in URL.
4. La delivery usa transactional outbox e una porta SMTP configurabile; fake deterministico in local/test, nessun account o provider remoto richiesto.
5. La sessione nasce soltanto dopo la verifica, usa un identificatore casuale in cookie `__Host-` e conserva nel DB solo un digest.
6. Route, contratti e UI sono posseduti dal prodotto; un provider futuro deve adattarsi alla boundary o introdurre una versione esplicita.
7. Login e refresh emettono una sessione nuova/ruotata; idle 24 ore e absolute 30 giorni sono applicati server-side. Logout corrente e revoca globale sono persistenti e auditati.
8. Il recupero password usa un codice numerico one-time di sei cifre, mai una capability in URL; TTL 10 minuti, tentativi limitati, HMAC dedicato e revoca totale delle sessioni. Il reset non esegue auto-login.

## Stato di adozione

| Decisione | Stato | Evidenza o task proprietario |
|---|---|---|
| Boundary e design identity P0 | `Approvato` | design BL-005 `identity-signup-v1` |
| Signup, verifica, resend e prima sessione | `Implementato` | `BL-005`; PR #28, merge `e173fd9`, CI PR/post-merge verdi |
| Login, logout, reset e revoca | `Design approvato` | `BL-006`; contratto `identity-access-v1` |
| Social login e MFA utente | `P1` | task dedicato futuro |

## Alternative considerate

- **Magic link:** rifiutato per P0 perché trasferisce la capability nell'URL ed espone più failure path legati a scanner, forwarding e replay.
- **Provider auth gestito:** rinviato perché introduce stato/costi/account esterni prima che esista un requisito di federation; resta una possibile migrazione dietro la porta identity.
- **Sessione stateless firmata:** rifiutata perché revoca, idle expiry e audit richiedono comunque stato autorevole e sono più semplici con sessioni opache persistite come digest.
- **Link di reset e auto-login post-reset:** rifiutati perché il link trasferisce la capability nell'URL e l'auto-login indebolisce la separazione fra cambio credenziale, revoca e nuova autenticazione esplicita.
- **Lista device/IP per sessione:** differita perché non necessaria alla revoca globale P0 e aumenterebbe densità, raccolta dati e superficie privacy.

## Conseguenze

Il prodotto possiede più codice security-critical e deve mantenere hashing, rotazione chiavi, anti-enumeration, session lifecycle e delivery. In cambio conserva portabilità, test deterministici, controllo dei dati e nessun blocco da provider durante M0. `BL-005` e `BL-006` sono quindi `HIGH_RISK` e richiedono PostgreSQL reale, security test, review e full gate.

## Condizioni di revisione

La decisione viene riesaminata se social login/MFA/federation diventano P0, se il carico operativo dell'identità interna supera un servizio gestito o se requisiti normativi impongono un provider certificato. La migrazione deve preservare user ID, audit, revoca, anti-enumeration e contratti, oppure versionare esplicitamente ogni incompatibilità.
