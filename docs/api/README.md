---
status: active
owner: engineering
last_reviewed: 2026-07-15
last_verified_commit: ccecd683c12ebfe29f4cc6be78c950ebb01ca288
source_refs:
  - docs/MVP_SPEC.md#126-schema-del-turno
  - docs/MVP_SPEC.md#128-schemi-separati
  - docs/MVP_SPEC.md#20-api
  - docs/adr/0008-zod-first-contract-generation.md
related_tasks:
  - BL-009
  - BL-021
  - BL-022
  - BL-028
code_refs:
  - packages/contracts/src
  - packages/contracts/generated/v1
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
  - tests/unit/owned-path-policy.test.mjs
supersedes: null
---

# Contratti API, eventi e output AI

## Contratto corrente

`@dnd-ai/contracts` espone gli schemi Zod strict e i tipi inferiti di `api-contract-v1` (`1.0.0`, `schemaVersion: 1`). Il catalogo genera JSON Schema Draft 2020-12 e un documento OpenAPI 3.1.1 a soli componenti.

OpenAPI ha intenzionalmente `paths: {}`: nessuna route del turno è implementata in `BL-009`. Il task proprietario aggiungerà operazione, auth, idempotenza, status ed error mapping nello stesso change set del relativo handler.

| Contratto | Tipo | Responsabilità |
|---|---|---|
| `SubmitTurnRequest` | request | modalità di interazione strict e `clientStateVersion` |
| `SubmitTurnAcceptedResponse` | response | accettazione asincrona `202`, turn ID e stream URL |
| `ApiErrorResponse` | response | error envelope stabile e redatto |
| `TurnStreamEvent` | event | lifecycle SSE accepted/progress/completed/failed |
| `GameEvent` | event | envelope append-only con ordering, causation e correlation |
| `DungeonMasterTurnResult` | ai_output | narrazione e sole proposte AI validate |

La factory `createAIToolCallSchema` accetta uno schema tool-name allowlisted e lo schema degli argomenti. Non esiste un envelope mutante con nome tool arbitrario.

## Artefatti e comandi

Gli output tracciati sono:

```text
packages/contracts/generated/v1/
  manifest.json
  openapi.json
  schemas/*.schema.json
```

Rigenerare soltanto dalle sorgenti:

```powershell
corepack pnpm@11.13.0 contracts:generate
corepack pnpm@11.13.0 contracts:check
```

`contracts:generate` scrive gli otto file posseduti dal catalogo. `contracts:check` non modifica il workspace e fallisce su artifact mancanti, stale o inattesi, root collegati e cambi a un major già pubblicato. In locale la base è `origin/main`; in CI è `HEAD^1`, già disponibile con checkout depth 2. Il check non esegue fetch. I file sotto `generated/` non vanno editati manualmente.

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
