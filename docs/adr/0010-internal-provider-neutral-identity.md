---
status: accepted
owner: engineering-security-and-product
last_reviewed: 2026-07-16
last_verified_commit: a9a2e4ba3f53db1d3b9a1d1011f745f7ba50fdf2
source_refs:
  - docs/MVP_SPEC.md#222-autenticazione
  - docs/MVP_SPEC.md#228-csrf-e-cors
  - docs/MVP_SPEC.md#229-rate-limiting-e-abuso-costi
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
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

## Stato di adozione

| Decisione | Stato | Evidenza o task proprietario |
|---|---|---|
| Boundary e design identity P0 | `Approvato` | design BL-005 `identity-signup-v1` |
| Signup, verifica, resend e prima sessione | `In implementazione` | `BL-005` |
| Login, logout, reset e revoca | `Pianificato` | `BL-006` |
| Social login e MFA utente | `P1` | task dedicato futuro |

## Alternative considerate

- **Magic link:** rifiutato per P0 perché trasferisce la capability nell'URL ed espone più failure path legati a scanner, forwarding e replay.
- **Provider auth gestito:** rinviato perché introduce stato/costi/account esterni prima che esista un requisito di federation; resta una possibile migrazione dietro la porta identity.
- **Sessione stateless firmata:** rifiutata perché revoca, idle expiry e audit richiedono comunque stato autorevole e sono più semplici con sessioni opache persistite come digest.

## Conseguenze

Il prodotto possiede più codice security-critical e deve mantenere hashing, rotazione chiavi, anti-enumeration, session lifecycle e delivery. In cambio conserva portabilità, test deterministici, controllo dei dati e nessun blocco da provider durante M0. `BL-005` è quindi `HIGH_RISK` e richiede PostgreSQL reale, security test, review e full gate.

## Condizioni di revisione

La decisione viene riesaminata se social login/MFA/federation diventano P0, se il carico operativo dell'identità interna supera un servizio gestito o se requisiti normativi impongono un provider certificato. La migrazione deve preservare user ID, audit, revoca, anti-enumeration e contratti, oppure versionare esplicitamente ogni incompatibilità.
