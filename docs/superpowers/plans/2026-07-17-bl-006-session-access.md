---
status: active
owner: engineering-security-and-product
last_reviewed: 2026-07-17
last_verified_commit: 6e4bf8c3b8a8b4f9e870a8088b674dd12b77e44a
source_refs:
  - docs/MVP_SPEC.md#20-api
  - docs/MVP_SPEC.md#222-autenticazione
  - docs/MVP_SPEC.md#228-csrf-e-cors
  - docs/MVP_SPEC.md#229-rate-limiting-e-abuso-costi
  - docs/MVP_SPEC.md#2212-audit-log
  - docs/TASKS.md#bl-006--sessioni-reset-revoca
  - docs/product/UX_UI_DESIGN.md
  - docs/adr/0010-internal-provider-neutral-identity.md
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
  - docs/superpowers/specs/2026-07-16-bl-006-session-access-design.md
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
  - apps/web/components/ui
  - apps/web/lib/server
  - packages/config/src
  - packages/contracts/src
  - packages/domain/src/identity
  - packages/persistence/src
test_refs:
  - tests/contracts
  - tests/database
  - tests/integration
  - tests/security
  - tests/unit
supersedes: null
---

# BL-006 — Session Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute this plan task-by-task. Il Product Owner ha già scelto l'esecuzione inline; non creare sub-agent.

**Goal:** consegnare login, refresh, logout, revoca globale e recupero password one-time con sessioni opache server-side e UI shadcn mobile-first.

**Architecture:** BL-006 estende l'identità interna di BL-005 senza introdurre provider o framework auth. Contratti/domain restano puri; una migration forward-only e `PostgresIdentityAccessStore` possiedono atomicità e concorrenza; Fastify orchestra policy/Argon2/cookie; il worker generalizza l'outbox; Next.js espone un BFF same-origin e tre superfici auth essenziali.

**Tech Stack:** TypeScript strict, Zod/JSON Schema/OpenAPI 3.1.1, PostgreSQL 17 + node-pg-migrate, Fastify, Argon2id, Node crypto, Next.js 16, React 19, shadcn/ui `new-york` su Radix, Tailwind CSS 4, Node test runner.

## Global Constraints

- Corsia `HIGH_RISK`; nessuna modifica a provider, account, SMTP reale, Vercel, staging o Production.
- Applicare RED → GREEN → refactor per ogni batch. Nessun codice di produzione prima del relativo test fallente osservato.
- Preservare byte-per-byte gli artifact `v1` e `v2`; generare soltanto `v3` / `3.0.0` per BL-006.
- Migration forward-only `000004_identity_access`; non modificare `000001`–`000003`.
- Password Unicode NFC 15–128 caratteri, blocklist e Argon2id/pepper esistenti.
- Codice reset numerico a sei cifre, TTL 600 s, massimo 5 tentativi, supersession e HMAC dedicato/versionato.
- Sessione idle 86.400.000 ms, absolute 2.592.000.000 ms; refresh ruota token/sessione senza superare l'absolute expiry.
- Login sconosciuto/pending/disabled/password errata usa sempre `401 identity.credentials_invalid`; reset request usa sempre `202` generico; conferma reset usa un solo errore codice stabile.
- Rate limit e validazione economica precedono Argon2. Nessun email/IP/password/codice/cookie/token/digest nei log o audit.
- Browser solo su path relativi `/api/auth/*`; niente credential in URL, localStorage, sessionStorage o cookie non HttpOnly.
- UI con shadcn `Card`, `Label`, `Input`, `Button`, `Alert` e `AlertDialog`; una CTA primaria per step, 48 px, viewport 320/390/1440 e nessuna funzione desktop-only.
- Test locali provider-free. Eseguire test mirati per batch, un solo full `TURBO_FORCE=true corepack pnpm@11.13.0 verify` sul candidato e infine clean checkout.

---

## File map

| Unità | Responsabilità |
|---|---|
| `packages/contracts/src/identity-access.ts` | Schemi e tipi wire BL-006, separati da signup v2 |
| `packages/domain/src/identity/access-ports.ts` | Porte/comandi/risultati puri per credenziali, sessioni e reset |
| `packages/persistence/src/identity-access-store.ts` | Query e transazioni BL-006; `identity-store.ts` resta proprietario di signup |
| `packages/persistence/src/migrations/000004_identity_access.ts` | Evoluzione forward-only di credential, reset, outbox, rate/idempotenza/audit |
| `apps/api/src/identity/identity-access-service.ts` | Application service BL-006, rate gate, password verify/hash e mapping failure |
| `apps/api/src/identity/access-routes.ts` | Sei route Fastify, cookie parsing/rotation/clear e Origin policy |
| `apps/worker/src/identity/*` | Outbox discriminato `verification`/`password_reset` e sender template-aware |
| `apps/web/components/auth/*` | Form login/reset e pannello sicurezza account |
| `apps/web/lib/server/identity-bff.ts` | Boundary BFF per body/cookie/status/schema delle nuove route |

---

## Task 1 — Contract v3, policy, config e primitive crittografiche

**Files**

- Create: `packages/contracts/src/identity-access.ts`
- Modify: `packages/contracts/src/{catalog,index,operations,artifacts,version}.ts`
- Generate: `packages/contracts/generated/v3/**`
- Preserve: `packages/contracts/generated/v1/**`, `packages/contracts/generated/v2/**`
- Create: `packages/domain/src/identity/access-ports.ts`
- Modify: `packages/domain/src/{index.ts,identity/ports.ts}`
- Modify: `packages/config/src/runtime-config.ts`
- Modify: `apps/{api,worker}/.env.example`
- Modify: `apps/api/src/identity/identity-crypto.ts`
- Test: `tests/contracts/{identity-contracts,contracts-generated,contracts-compatibility}.test.mjs`
- Test: `tests/unit/{identity-policy,identity-runtime-config,identity-crypto}.test.mjs`
- Test: `tests/security/environment-file-policy.test.mjs`

**Interfaces**

- Consumes: `IdentityEmailSchema`, `IdentityPasswordSchema`, `IdempotencyKeySchema`, `IdentityMutationResult`, `PasswordHash`, `IdentitySessionMaterial`.
- Produces: `SignInRequestSchema`, `PasswordResetRequestSchema`, `PasswordResetConfirmSchema`, `RevokeAllSessionsRequestSchema`, `AuthenticatedResponseSchema`, `PasswordResetRequestedResponseSchema`, `PasswordResetCompletedResponseSchema`, `IdentityAccessStore`, reset crypto/config.

- [x] Scrivere test contract RED che richiedano body strict, codice stringa con leading zero, `confirmation: "revoke_all"`, nuovi error code e i sei path OpenAPI.

  ```js
  const signIn = requireSchema("SignInRequestSchema");
  const reset = requireSchema("PasswordResetConfirmSchema");
  assert.deepEqual(signIn.parse({ email: " PLAYER@example.test ", password: "a".repeat(15) }), {
    email: "player@example.test",
    password: "a".repeat(15),
  });
  assert.equal(reset.safeParse({ email: "player@example.test", code: "012345", newPassword: "b".repeat(15) }).success, true);
  assert.equal(reset.safeParse({ email: "player@example.test", code: 12345, newPassword: "b".repeat(15) }).success, false);
  ```

- [x] Eseguire il RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/contracts --filter=@dnd-ai/domain --filter=@dnd-ai/config --filter=@dnd-ai/api
  node --test tests/contracts/identity-contracts.test.mjs tests/unit/identity-policy.test.mjs tests/unit/identity-runtime-config.test.mjs tests/unit/identity-crypto.test.mjs
  ```

  Atteso: fallimento per schema/export/config reset e metodi crypto mancanti.

- [x] Implementare i contratti wire in `identity-access.ts`:

  ```ts
  export const SignInRequestSchema = z.strictObject({
    email: IdentityEmailSchema,
    password: IdentityPasswordSchema,
  });
  export const PasswordResetRequestSchema = z.strictObject({
    email: IdentityEmailSchema,
  });
  export const PasswordResetConfirmSchema = z.strictObject({
    email: IdentityEmailSchema,
    code: z.string().regex(/^[0-9]{6}$/u),
    newPassword: IdentityPasswordSchema,
  });
  export const RevokeAllSessionsRequestSchema = z.strictObject({
    confirmation: z.literal("revoke_all"),
  });
  export const AuthenticatedResponseSchema = z.strictObject({
    status: z.literal("authenticated"),
  });
  export const PasswordResetRequestedResponseSchema = z.strictObject({
    status: z.literal("password_reset_requested"),
  });
  export const PasswordResetCompletedResponseSchema = z.strictObject({
    status: z.literal("password_reset"),
  });
  ```

- [x] Estendere catalogo/OpenAPI a `v3` mantenendo le directory precedenti immutabili. I path refresh/sign-out non hanno request body; revoke-all usa `RevokeAllSessionsRequest`; successi 204 non dichiarano content.

- [x] Definire le porte pure BL-006:

  ```ts
  export interface IdentityAccessCredential {
    readonly userId: IdentityId;
    readonly email: IdentityEmail;
    readonly status: "active" | "pending";
    readonly passwordHash: PasswordHash;
    readonly credentialVersion: number;
  }

  export interface IdentityPasswordResetReference {
    readonly challengeId: IdentityChallengeId;
    readonly codeDigest: string;
    readonly keyVersion: number;
    readonly userId: IdentityId;
    readonly credentialVersion: number;
  }

  export interface IdentityAccessStore {
    consumeRateLimit(command: IdentityRateLimitCommand): Promise<IdentityRateLimitDecision>;
    findSignInCredential(email: IdentityEmail): Promise<IdentityAccessCredential | null>;
    signIn(command: IdentitySignInCommand): Promise<IdentityMutationResult<IdentitySessionAccessValue>>;
    refreshSession(command: IdentityRefreshSessionCommand): Promise<IdentityMutationResult<IdentitySessionAccessValue>>;
    signOut(command: IdentitySignOutCommand): Promise<IdentityMutationResult<Readonly<{ status: "signed_out" }>>>;
    revokeAllSessions(command: IdentityRevokeAllSessionsCommand): Promise<IdentityMutationResult<IdentitySessionActionValue>>;
    requestPasswordReset(command: IdentityPasswordResetRequestCommand): Promise<IdentityMutationResult<Readonly<{ accepted: true }>>>;
    findPasswordResetChallenge(email: IdentityEmail): Promise<IdentityPasswordResetReference | null>;
    rejectPasswordReset(command: IdentityPasswordResetRejectCommand): Promise<IdentityMutationResult<Readonly<{ status: "invalid" }>>>;
    confirmPasswordReset(command: IdentityPasswordResetConfirmCommand): Promise<IdentityMutationResult<IdentityPasswordResetValue>>;
  }
  ```

- [x] Aggiungere scope rate `sign_in_ip`, `sign_in_email`, `refresh_session`, `sign_out`, `revoke_all`, `reset_request_ip`, `reset_request_email`, `reset_confirm_ip`, `reset_challenge`.

- [x] Aggiungere secret distinti e obbligatori `API_AUTH_RESET_HMAC_KEY_BASE64`/`API_AUTH_RESET_KEY_VERSION` e `WORKER_AUTH_RESET_HMAC_KEY_BASE64`/`WORKER_AUTH_RESET_KEY_VERSION`; includere reset nel controllo di non riuso chiavi.

- [x] Estendere l'adapter crypto con `createPasswordResetChallenge`, `derivePasswordResetCodeDigest`, `matchesPasswordResetCode`, `sessionTokenDigest`; usare `timingSafeEqual` soltanto dopo validazione di due digest SHA-256 canonici.

- [x] Rigenerare `v3`, osservare GREEN e verificare compatibilità:

  ```powershell
  corepack pnpm@11.13.0 contracts:generate
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/contracts --filter=@dnd-ai/domain --filter=@dnd-ai/config --filter=@dnd-ai/api
  node --test tests/contracts/identity-contracts.test.mjs tests/contracts/contracts-generated.test.mjs tests/contracts/contracts-compatibility.test.mjs tests/unit/identity-policy.test.mjs tests/unit/identity-runtime-config.test.mjs tests/unit/identity-crypto.test.mjs tests/security/environment-file-policy.test.mjs
  ```

- [x] Commit funzionale:

  ```powershell
  git add packages/contracts packages/domain packages/config apps/api/.env.example apps/worker/.env.example apps/api/src/identity/identity-crypto.ts tests/contracts tests/unit tests/security/environment-file-policy.test.mjs
  git commit -m "feat(identity): define session access contracts"
  ```

---

## Task 2 — Migration `000004_identity_access`

**Files**

- Create: `packages/persistence/src/migrations/000004_identity_access.ts`
- Modify: `packages/persistence/src/migration-manifest.ts`
- Modify: `tests/contracts/database-migration-contract.test.mjs`
- Modify: `tests/database/{identity-migration,database-migrations}.test.mjs`
- Modify: `tests/security/database-migration-security.test.mjs`

**Interfaces**

- Consumes: head `000003_identity_signup`, migration ledger e SQL identity esistenti.
- Produces: head `000004_identity_access`, contract `database-identity-access-v1`, schema necessario a store/worker.

- [x] Scrivere test RED per zero→head, `000003`→`000004`, rollback/reapply disposable, constraint e due runner simultanei. Richiedere:

  ```sql
  ALTER TABLE app.user_credentials ADD COLUMN credential_version bigint NOT NULL DEFAULT 1;
  CREATE TABLE app.password_reset_challenges (
    challenge_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app.users (user_id) ON DELETE RESTRICT,
    code_digest text COLLATE "C" NOT NULL,
    key_version integer NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 5,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz NULL,
    superseded_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE app.identity_email_outbox ADD COLUMN password_reset_challenge_id uuid NULL;
  ```

  I test devono provare `credential_version > 0`, una sola reset challenge corrente, XOR fra challenge verifica/reset, template coerente, scope/endpoint/event allowlisted e nessuna riscrittura delle migration precedenti.

- [x] Eseguire il RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
  node --test tests/contracts/database-migration-contract.test.mjs tests/database/identity-migration.test.mjs tests/security/database-migration-security.test.mjs
  ```

  Atteso: head/contract/schema `000004` mancanti.

- [x] Implementare la migration con DDL forward-only:

  ```ts
  export function up(pgm: MigrationBuilder): void {
    pgm.sql(DATABASE_IDENTITY_ACCESS_CREDENTIAL_VERSION_SQL);
    pgm.sql(DATABASE_IDENTITY_ACCESS_RESET_TABLE_SQL);
    pgm.sql(DATABASE_IDENTITY_ACCESS_RESET_INDEXES_SQL);
    pgm.sql(DATABASE_IDENTITY_ACCESS_OUTBOX_SQL);
    pgm.sql(DATABASE_IDENTITY_ACCESS_CONSTRAINTS_SQL);
    pgm.sql(DATABASE_IDENTITY_ACCESS_SUPERSEDE_SIGNUP_CONTRACT_SQL);
    pgm.sql(DATABASE_IDENTITY_ACCESS_CONTRACT_INSERT_SQL);
  }
  ```

  `down` è solo per database locale disposable e ripristina esattamente constraint/outbox/head `000003` prima di eliminare reset/credential version.

- [x] Calcolare `IDENTITY_ACCESS_MIGRATION_SOURCE_SHA256` sul file normalizzato LF, aggiungere il quarto record al manifest e mantenere `minimumCompatibleMigrationId: 1`.

- [x] Eseguire GREEN e regressione migration completa:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
  node --test tests/contracts/database-migration-contract.test.mjs tests/database/identity-migration.test.mjs tests/database/database-migrations.test.mjs tests/security/database-migration-security.test.mjs
  ```

- [x] Commit funzionale:

  ```powershell
  git add packages/persistence/src/migration-manifest.ts packages/persistence/src/migrations/000004_identity_access.ts tests/contracts/database-migration-contract.test.mjs tests/database tests/security/database-migration-security.test.mjs
  git commit -m "feat(identity): add access lifecycle migration"
  ```

---

## Task 3 — `PostgresIdentityAccessStore`

**Files**

- Create: `packages/persistence/src/identity-access-store.ts`
- Modify: `packages/persistence/src/index.ts`
- Create: `tests/database/identity-access-store.test.mjs`
- Modify: `tests/security/identity-persistence-security.test.mjs`

**Interfaces**

- Consumes: `IdentityAccessStore` e schema `000004`.
- Produces: `createPostgresIdentityAccessStore({ databaseUrl })` con `close()` idempotente.

- [x] Scrivere RED per credenziali generiche, rate policy, sign-in/replay, refresh rotation/idle/absolute, logout idempotente, revoke-all, reset request/supersession, invalid attempts e reset atomico.

  ```js
  const [first, second] = await Promise.allSettled([
    store.confirmPasswordReset(command(1)),
    store.confirmPasswordReset(command(2)),
  ]);
  assert.equal([first, second].filter((result) => result.status === "fulfilled" && result.value.value.status === "password_reset").length, 1);
  assert.equal(await activeSessionCount(email), 0);
  assert.equal(await credentialVersion(email), 2);
  ```

- [x] Eseguire il RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/domain --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
  node --test tests/database/identity-access-store.test.mjs
  ```

  Atteso: export/store mancante.

- [x] Implementare validazione fail-closed e policy rate con i valori del design. Creare un pool dedicato con gli stessi timeout bounded di `identity-store.ts`.

- [x] Implementare sign-in atomico: lock utente/credenziale, recheck `active` + `credential_version`, insert session/audit/idempotency. Un mismatch restituisce `credentials_invalid`; il replay deriva dalla session ID originale.

- [x] Implementare refresh atomico: idempotency lookup prima dello stato sessione, lock per token digest, check `revoked_at`, idle e absolute; revoca vecchia riga e inserimento nuova con:

  ```ts
  const idleExpiresAt = new Date(
    Math.min(
      command.context.occurredAt.valueOf() + IDENTITY_POLICY.session.idleTtlMs,
      current.absolute_expires_at.valueOf(),
    ),
  );
  ```

- [x] Implementare logout corrente come successo anche con token assente/scaduto; audit soltanto quando una sessione viene effettivamente revocata. Revoke-all richiede sessione valida e aggiorna tutte le righe attive + un solo audit nella stessa transazione.

- [x] Implementare reset request generico: per utente non active nessuna challenge/outbox ma stesso risultato/idempotenza; per active supersede corrente e inserisce challenge + outbox atomici.

- [x] Implementare reset invalid/confirm. `rejectPasswordReset` incrementa al massimo una volta per idempotency key; `confirmPasswordReset` blocca challenge/credential, ricontrolla digest/versione, aggiorna hash e `credential_version + 1`, consuma challenge, revoca tutte le sessioni e appende audit nella stessa transazione.

- [x] Verificare che tutte le query selezionino colonne esplicite, nessun `SELECT *`, nessuna email/token/password/digest nei messaggi errore.

- [x] Eseguire GREEN e security regression:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/domain --filter=@dnd-ai/persistence --filter=@dnd-ai/testing
  node --test tests/database/identity-access-store.test.mjs tests/database/identity-store.test.mjs tests/security/identity-persistence-security.test.mjs
  ```

- [x] Commit funzionale:

  ```powershell
  git add packages/persistence/src/identity-access-store.ts packages/persistence/src/index.ts tests/database/identity-access-store.test.mjs tests/security/identity-persistence-security.test.mjs
  git commit -m "feat(identity): persist access and reset lifecycle"
  ```

---

## Task 4 — Application service, Fastify route e cookie

**Files**

- Create: `apps/api/src/identity/identity-access-service.ts`
- Create: `apps/api/src/identity/access-routes.ts`
- Modify: `apps/api/src/identity/{session-cookie,http-errors}.ts`
- Modify: `apps/api/src/{index,runtime}.ts`
- Create: `tests/unit/identity-access-service.test.mjs`
- Modify: `tests/unit/identity-cookie.test.mjs`
- Create: `tests/integration/identity-access-api.test.mjs`
- Modify: `tests/security/identity-api-security.test.mjs`

**Interfaces**

- Consumes: contract v3, `IdentityAccessStore`, Argon2/blocklist/crypto e Origin/client-subject esistenti.
- Produces: `IdentityAccessService` e `registerIdentityAccessRoutes`.

- [x] Scrivere service RED che provi: due rate gate prima di Argon2, dummy hash per identity non eleggibile, recheck credential version, session rotation/replay, generic reset, code check prima del nuovo Argon2 e mapping failure senza reflection.

  ```js
  assert.ok(calls.indexOf("rate:sign_in_email") < calls.indexOf("password:verify"));
  assert.deepEqual(await service.signIn(input, metadata()), {
    absoluteExpiresAt: new Date(NOW.valueOf() + 2_592_000_000),
    sessionToken: TOKEN,
    status: "authenticated",
  });
  ```

- [x] Scrivere API/cookie RED per sei route, Origin/Sec-Fetch, `Idempotency-Key`, Cookie header, fixation, Set-Cookie ruotato, clear cookie esatto, 204 senza body, 401 generico, 202 reset request e `Cache-Control: no-store`.

- [x] Eseguire il RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/api
  node --test tests/unit/identity-access-service.test.mjs tests/unit/identity-cookie.test.mjs tests/integration/identity-access-api.test.mjs
  ```

- [x] Implementare il service con API esplicita:

  ```ts
  export interface IdentityAccessService {
    signIn(request: SignInRequest, metadata: IdentityRequestMetadata): Promise<AuthenticatedIdentityResult>;
    refreshSession(sessionToken: string, metadata: IdentityRequestMetadata): Promise<AuthenticatedIdentityResult>;
    signOut(sessionToken: string | null, metadata: IdentityRequestMetadata): Promise<void>;
    revokeAllSessions(sessionToken: string, request: RevokeAllSessionsRequest, metadata: IdentityRequestMetadata): Promise<void>;
    requestPasswordReset(request: PasswordResetRequest, metadata: IdentityRequestMetadata): Promise<PasswordResetRequestedResponse>;
    confirmPasswordReset(request: PasswordResetConfirm, metadata: IdentityRequestMetadata): Promise<PasswordResetCompletedResponse>;
  }
  ```

- [x] Per sign-in usare un PHC dummy Argon2id valido quando il lookup è null/pending; verificare password fuori transazione e lasciare allo store il lock/recheck finale. Tutti i casi non eleggibili mappano a `CREDENTIALS_INVALID`.

- [x] Per reset conferma: rate IP, lookup/dummy challenge, rate challenge, confronto digest constant-time; mismatch chiama `rejectPasswordReset` senza hash. Solo un match normalizza/blocklista/hash la nuova password e chiama `confirmPasswordReset`.

- [x] Estendere cookie helper:

  ```ts
  export function clearIdentitySessionCookie(): string {
    return "__Host-dnd_ai_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
  }

  export function readIdentitySessionToken(cookieHeader: string | undefined): string | null {
    if (cookieHeader === undefined) return null;
    const matches = cookieHeader.split(/;\s*/u).filter((part) => part.startsWith("__Host-dnd_ai_session="));
    if (matches.length !== 1) return null;
    const token = matches[0]?.slice("__Host-dnd_ai_session=".length) ?? "";
    return isCanonicalToken(token) ? token : null;
  }
  ```

- [x] Registrare route separate. Sign-in/refresh impostano il nuovo cookie; sign-out/revoke/reset-confirm impostano sempre il clear cookie; reset-request non accetta né emette cookie. Body absent è consentito soltanto a refresh/sign-out.

- [x] Comporre store/service/route in `createApiIdentityRuntime`; chiusura deve attendere entrambi gli store senza doppio `Pool.end()`.

- [x] Eseguire GREEN e security regression:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/api
  node --test tests/unit/identity-access-service.test.mjs tests/unit/identity-cookie.test.mjs tests/integration/identity-access-api.test.mjs tests/integration/identity-api.test.mjs tests/security/identity-api-security.test.mjs
  ```

- [x] Commit funzionale:

  ```powershell
  git add apps/api packages/config tests/unit/identity-access-service.test.mjs tests/unit/identity-cookie.test.mjs tests/integration/identity-access-api.test.mjs tests/security/identity-api-security.test.mjs
  git commit -m "feat(identity): expose session and reset API"
  ```

---

## Task 5 — Outbox e delivery reset

**Files**

- Modify: `apps/worker/src/identity/{challenge-code,email-sender,outbox-dispatcher,postgres-outbox,smtp-email-sender}.ts`
- Modify: `apps/worker/src/{index,runtime}.ts`
- Modify: `tests/unit/identity-outbox-dispatcher.test.mjs`
- Modify: `tests/integration/identity-email-worker.test.mjs`
- Modify: `tests/security/identity-email-security.test.mjs`

**Interfaces**

- Consumes: outbox XOR verification/reset e due secret HMAC del worker.
- Produces: job discriminato e messaggio template-aware senza code persistence.

- [x] Scrivere RED che richieda claim discriminato:

  ```ts
  export type ClaimedIdentityEmail =
    | Readonly<{ kind: "verification"; outboxId: string; challengeId: string; keyVersion: number; deliveryEmail: string; leaseToken: string }>
    | Readonly<{ kind: "password_reset"; outboxId: string; challengeId: string; keyVersion: number; deliveryEmail: string; leaseToken: string }>;
  ```

  Provare reset code derivato just-in-time, key mismatch → dead, SMTP/fake redatti, retry bounded e template sconosciuto fail-closed.

- [x] Eseguire il RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/worker
  node --test tests/unit/identity-outbox-dispatcher.test.mjs tests/integration/identity-email-worker.test.mjs tests/security/identity-email-security.test.mjs
  ```

- [x] Generalizzare query outbox con `CASE`/join espliciti e verificare che ogni riga claimed abbia esattamente un kind/challenge. Non usare union SQL che possa duplicare una riga.

- [x] Derivare il codice con domain HMAC separato `identity-password-reset-code-v1`; selezionare chiave/versione dal `kind`. Il messaggio sender diventa:

  ```ts
  export type IdentityEmailMessage =
    | Readonly<{
        kind: "verification";
        recipient: string;
        displayName: string;
        code: string;
        expiresInMinutes: 10;
      }>
    | Readonly<{
        kind: "password_reset";
        recipient: string;
        code: string;
        expiresInMinutes: 10;
      }>;
  ```

- [x] Il template reset usa copy breve, nessun link e nessun dato account aggiuntivo. Fake sender conserva messaggi solo in memoria test; SMTP subject/body non includono request/user ID.

- [x] Eseguire GREEN:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/worker
  node --test tests/unit/identity-outbox-dispatcher.test.mjs tests/integration/identity-email-worker.test.mjs tests/security/identity-email-security.test.mjs
  ```

- [x] Commit funzionale:

  ```powershell
  git add apps/worker tests/unit/identity-outbox-dispatcher.test.mjs tests/integration/identity-email-worker.test.mjs tests/security/identity-email-security.test.mjs
  git commit -m "feat(identity): deliver password reset codes"
  ```

---

## Task 6 — BFF e UI shadcn mobile-first

**Files**

- Modify: `apps/web/lib/server/identity-bff.ts`
- Create: `apps/web/app/api/auth/{sign-in,session/refresh,sign-out,sessions/revoke-all,password-reset/request,password-reset/confirm}/route.ts`
- Create: `apps/web/app/{sign-in,reset-password,account/security}/page.tsx`
- Create: `apps/web/components/auth/{sign-in-form,password-reset-form,account-security-panel}.tsx`
- Create via shadcn source: `apps/web/components/ui/alert-dialog.tsx`
- Modify: `apps/web/components/auth/identity-client.ts`
- Modify: `tests/unit/{identity-bff,identity-client}.test.mjs`
- Modify: `tests/contracts/web-identity-ui.test.mjs`
- Modify: `tests/integration/web-identity-pages.test.mjs`

**Interfaces**

- Consumes: contract v3, BFF assertion e foundation BL-079.
- Produces: tre pagine, sei BFF route e conferma distruttiva Radix/shadcn.

- [x] Scrivere RED BFF per cookie forwarding allowlisted: sign-in/reset-request non inoltrano cookie; refresh/sign-out/revoke inoltrano soltanto `__Host-dnd_ai_session`; reset-confirm può eliminare il cookie ma non inoltrarlo. Validare success schema/status e Set-Cookie create/clear per ogni path.

- [x] Scrivere RED UI per copy, relative fetch, password manager, live region, one-time-code, stato email solo React, nessun URL/storage, CTA 48 px e `AlertDialog` sulla revoca globale.

- [x] Eseguire il RED:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/web
  node --test tests/unit/identity-bff.test.mjs tests/unit/identity-client.test.mjs tests/contracts/web-identity-ui.test.mjs tests/integration/web-identity-pages.test.mjs
  ```

- [x] Consultare la primitive con la skill shadcn e aggiungerla senza sovrascrivere componenti esistenti:

  ```powershell
  corepack pnpm dlx shadcn@latest docs alert-dialog
  corepack pnpm dlx shadcn@latest add alert-dialog --cwd apps/web
  ```

  Controllare il diff: import da `radix-ui`, token semantici, nessuna modifica a `globals.css`, `components.json`, font o primitive già possedute.

- [x] Estendere `IdentityBffPath`, request/response parser e cookie policy con mappe esaustive. Un cookie upstream inatteso o uno status/schema non previsto restituisce 502 generico.

- [x] Implementare `/sign-in` con `AuthShell`, email/password, toggle Lucide, CTA “Accedi” e link `/reset-password`. Errore generico credenziali; successo `router.replace("/")`.

- [x] Implementare `/reset-password` con una sola card e stato:

  ```ts
  type ResetStep =
    | Readonly<{ kind: "request" }>
    | Readonly<{ kind: "confirm"; email: string }>;
  ```

  Step 1 invia email e passa a confirm sul 202; step 2 mostra codice/nuova password/conferma locale e torna a `/sign-in` sul successo. Email non entra in URL/storage/cookie.

- [x] Implementare `/account/security` con due azioni. “Esci” POST sign-out. “Disconnetti tutti i dispositivi” apre `AlertDialog`; conferma POST revoke-all con body `{ confirmation: "revoke_all" }`; entrambe tornano a `/sign-in`.

- [x] Usare `aria-live="polite"`, focus summary error, label visibili, `autoComplete="current-password"`/`new-password`/`one-time-code`, paste consentito e target `size="lg"`/`h-12`. Nessun gradient, HUD o device metadata.

- [x] Eseguire GREEN, lint/typecheck/build web:

  ```powershell
  corepack pnpm@11.13.0 turbo run build lint typecheck --filter=@dnd-ai/web
  node --test tests/unit/identity-bff.test.mjs tests/unit/identity-client.test.mjs tests/contracts/web-identity-ui.test.mjs tests/integration/web-identity-pages.test.mjs
  ```

- [x] Applicare la checklist `vercel:react-best-practices` ai TSX modificati; correggere soltanto finding reali su hook, accessibilità, component boundary, performance e tipi.

- [x] Commit funzionale:

  ```powershell
  git add apps/web tests/unit/identity-bff.test.mjs tests/unit/identity-client.test.mjs tests/contracts/web-identity-ui.test.mjs tests/integration/web-identity-pages.test.mjs pnpm-lock.yaml
  git commit -m "feat(identity): add mobile access surfaces"
  ```

---

## Task 7 — Verticale, hardening, documentazione e candidato

**Files**

- Create: `tests/integration/identity-access-flow.test.mjs`
- Modify: `tests/security/{identity-api,identity-email,identity-persistence}.test.mjs`
- Modify: `docs/{MVP_SPEC,TASKS,CONTEXT,TRACEABILITY,CHANGELOG}.md`
- Modify: `docs/{api/README,architecture/SYSTEM_OVERVIEW,data/DATA_MODEL,operations/CONFIGURATION,operations/DATABASE_MIGRATIONS,operations/LOCAL_DEVELOPMENT}.md`
- Modify: `docs/product/UX_UI_DESIGN.md`
- Modify: `docs/superpowers/plans/2026-07-17-bl-006-session-access.md`

**Interfaces**

- Consumes: intero verticale BL-006.
- Produces: evidenza riproducibile e proposta branch-local `DONE/100%/PASSING` soltanto se tutti i gate sono verdi.

- [ ] Scrivere RED verticale PostgreSQL reale per signup/verify precondizione, sign-in, refresh, logout replay, revoke-all, request/reset/nuovo login. Aggiungere due race reali: login contro reset e doppia conferma reset.

- [ ] Eseguire il RED prima di collegare eventuali ultimi composition gap:

  ```powershell
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/api --filter=@dnd-ai/worker --filter=@dnd-ai/web
  node --test tests/integration/identity-access-flow.test.mjs
  ```

- [ ] Chiudere soltanto i gap di composition osservati dal RED, quindi eseguire aggregato identity mirato:

  ```powershell
  node --test tests/unit/identity-*.test.mjs tests/contracts/identity-*.test.mjs tests/database/identity-*.test.mjs tests/integration/identity-*.test.mjs tests/integration/web-identity-pages.test.mjs tests/security/identity-*.test.mjs
  ```

- [ ] Avviare build Next locale e verificare 320×800, 390×844, 1440×900: overflow 0, CTA ≥48 px, target ≥44 px, ordine Tab/focus, form utilizzabile con reduced motion e zero console error. Screenshot temporanei, non versionati.

- [ ] Aggiornare documentazione da “target/design” a “implementato” solo per capability realmente verdi; registrare contract v3, migration head/checksum/source SHA, comandi, exit code e limiti SMTP/Vercel.

- [ ] Eseguire document gate e audit dipendenze:

  ```powershell
  corepack pnpm@11.13.0 verify:docs
  corepack pnpm@11.13.0 audit --audit-level high
  ```

- [ ] Eseguire l'unico full gate finale:

  ```powershell
  $env:TURBO_FORCE='true'
  corepack pnpm@11.13.0 verify
  Remove-Item Env:TURBO_FORCE
  ```

- [ ] Applicare `superpowers:verification-before-completion`, rileggere il diff completo e verificare secret/PII/debug/generated drift. Nessun finding P0/P1 può restare aperto.

- [ ] Congelare il functional head, creare checkout detached temporaneo e verificare almeno install frozen, generated drift, migration zero/previous→head, build API/worker/web, verticale identity, secret scan e docs gate. Eliminare il worktree temporaneo dopo la verifica.

- [ ] Aggiornare card/registro BL-006 nello stesso commit funzionale finale; non creare commit di sola evidenza o post-CI.

- [ ] Commit candidato:

  ```powershell
  git add tests docs apps packages scripts pnpm-lock.yaml
  git commit -m "feat(identity): complete secure session access"
  ```

- [ ] Push della branch, singola PR protetta e attesa `CI / Merge gate`; nessun bypass e nessuna azione Vercel. Dopo merge verificato, rendere eseguibile il primo task P0 le cui dipendenze siano tutte `DONE`.

---

## Self-review del piano

- Copertura spec: contract v3, migration 000004, login generico, idle/absolute, rotation/fixation, logout, revoke-all, reset request/confirm, HMAC dedicato, outbox, privacy, UX e tutti i gate hanno un task proprietario.
- Confini: signup store/service restano separati; nuovi file access evitano di estendere `identity-store.ts` da 945 righe e `identity-service.ts` oltre la responsabilità BL-005.
- Type consistency: `IdentityAccessStore` è prodotto al Task 1, materializzato al Task 3, consumato dal service Task 4; contract v3 è prodotto al Task 1 e consumato da API/BFF/UI.
- Concorrenza: `credential_version`, lock/recheck, idempotency-before-state sul refresh e transazione reset totale sono coperti da test reali.
- Scansione completezza: nessun segnaposto, rinvio generico, implementazione per analogia o failure path non assegnato.
- Scope remoto: nessuna dipendenza da provider, SMTP reale o Vercel; browser e database sono locali.
