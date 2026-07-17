---
status: active
owner: engineering
last_reviewed: 2026-07-17
last_verified_commit: e173fd9424ad77330ae8302f68affd4832d66798
source_refs:
  - docs/MVP_SPEC.md#126-schema-del-turno
  - docs/MVP_SPEC.md#128-schemi-separati
  - docs/MVP_SPEC.md#20-api
  - docs/adr/0008-zod-first-contract-generation.md
  - docs/adr/0010-internal-provider-neutral-identity.md
  - docs/superpowers/specs/2026-07-16-bl-006-session-access-design.md
related_tasks:
  - BL-009
  - BL-005
  - BL-006
  - BL-021
  - BL-022
  - BL-028
code_refs:
  - packages/contracts/src
  - packages/contracts/generated/v1
  - packages/contracts/generated/v2
  - scripts/generate-contracts.mjs
  - scripts/lib/contract-artifact-policy.mjs
  - scripts/lib/contract-compatibility-policy.mjs
  - scripts/lib/owned-path-policy.mjs
test_refs:
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/contracts-runtime.test.mjs
  - tests/contracts/contracts-artifacts.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/contracts/identity-contracts.test.mjs
  - tests/unit/owned-path-policy.test.mjs
supersedes: null
---

# Contratti API, eventi e output AI

## Contratto corrente

`@dnd-ai/contracts` espone schemi Zod strict e tipi inferiti. L'artifact `v1` (`1.0.0`) resta immutabile; BL-005 pubblica l'artifact `v2` (`2.0.0`) per aggiungere le operazioni identity. `schemaVersion: 1` degli envelope evento/SSE non cambia, perché il relativo wire format è invariato.

OpenAPI `v2` descrive soltanto le route effettivamente implementate `/api/auth/sign-up`, `/api/auth/verify-email` e `/api/auth/resend-verification`, inclusi idempotency header, risposte, errori e cookie applicabili. Le route del turno restano assenti finché il task proprietario non implementa handler e comportamento.

`identity-access-v1` approva per BL-006 un nuovo artifact immutabile `v3` / `3.0.0` con sign-in, refresh, sign-out, revoke-all e reset password. `v3` è un target di implementazione: directory generate, export e route non esistono ancora e non devono essere presentati come runtime disponibile.

| Contratto | Tipo | Responsabilità |
|---|---|---|
| `SubmitTurnRequest` | request | modalità di interazione strict e `clientStateVersion` |
| `SubmitTurnAcceptedResponse` | response | accettazione asincrona `202`, turn ID e stream URL |
| `ApiErrorResponse` | response | error envelope stabile e redatto |
| `TurnStreamEvent` | event | lifecycle SSE accepted/progress/completed/failed |
| `GameEvent` | event | envelope append-only con ordering, causation e correlation |
| `DungeonMasterTurnResult` | ai_output | narrazione e sole proposte AI validate |
| `SignUpRequest` | request | email, password e display name strict/normalizzati |
| `VerifyEmailRequest` | request | email e codice numerico a sei cifre |
| `ResendVerificationRequest` | request | richiesta generica anti-enumeration |
| `VerificationRequiredResponse` | response | accettazione `202`, TTL challenge e cooldown resend |
| `VerifiedResponse` | response | attivazione completata; la sessione viaggia soltanto nel cookie |
| `IdentityErrorResponse` | response | codici auth allowlisted e request ID redatto |

La factory `createAIToolCallSchema` accetta uno schema tool-name allowlisted e lo schema degli argomenti. Non esiste un envelope mutante con nome tool arbitrario.

## Artefatti e comandi

Gli output tracciati sono:

```text
packages/contracts/generated/v1/
  manifest.json
  openapi.json
  schemas/*.schema.json
packages/contracts/generated/v2/
  manifest.json
  openapi.json
  schemas/*.schema.json
```

Rigenerare soltanto dalle sorgenti:

```powershell
corepack pnpm@11.13.0 contracts:generate
corepack pnpm@11.13.0 contracts:check
```

`contracts:generate` scrive soltanto i file posseduti dal catalogo per entrambi i major. `contracts:check` non modifica il workspace e fallisce su artifact mancanti, stale o inattesi, root collegati e cambi ai byte del major `v1` già pubblicato. In locale la base è `origin/main`; in CI è `HEAD^1`, già disponibile con checkout depth 2. Il check non esegue fetch. I file sotto `generated/` non vanno editati manualmente.

## Uso runtime

Un consumer importa schema e tipo dallo stesso package e valida al proprio confine:

```ts
import {
  SubmitTurnRequestSchema,
  type SubmitTurnRequest,
} from "@dnd-ai/contracts";

const request: SubmitTurnRequest = SubmitTurnRequestSchema.parse(input);
```

Gli output del modello sono sempre input non affidabili. La validazione di `DungeonMasterTurnResult` non rende canoniche le proposte: authorization, Rules Engine, transazione ed evento restano responsabilità dell'application layer.

## Versionamento

- Patch: correzione che lascia invariati tutti i byte degli artifact pubblicati.
- Wire change: qualsiasi variazione, anche additiva, richiede la directory major successiva (`v2`) e un piano di migrazione; `v1` resta identica in parallelo.
- `schemaVersion` sugli eventi cambia soltanto con una nuova versione wire incompatibile.

Ogni evoluzione deve modificare sorgente Zod, catalogo, generated files e test nello stesso change set. I path OpenAPI vengono aggiunti soltanto dal task che implementa il comportamento descritto.
