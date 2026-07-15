---
status: active
owner: engineering-and-api
last_reviewed: 2026-07-15
last_verified_commit: ccecd683c12ebfe29f4cc6be78c950ebb01ca288
source_refs:
  - docs/MVP_SPEC.md#115-event-sourcing-pragmatico
  - docs/MVP_SPEC.md#126-schema-del-turno
  - docs/MVP_SPEC.md#128-schemi-separati
  - docs/MVP_SPEC.md#20-api
  - docs/MVP_SPEC.md#294-cicd
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
  - docs/TASKS.md#bl-009--zod-json-schema-openapi-generation
  - docs/adr/0002-monorepo-package-boundaries.md
related_tasks:
  - BL-009
  - BL-021
  - BL-022
  - BL-028
  - BL-035
  - BL-042
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
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/unit/owned-path-policy.test.mjs
supersedes: null
---

# BL-009 — Design dei contratti Zod, JSON Schema e OpenAPI

## Stato e decisione

Il Product Owner ha autorizzato la prosecuzione del primo task ordinato eleggibile sulla baseline `main` integrata il 2026-07-15. La specifica approvata impone Zod come fonte primaria e JSON Schema/OpenAPI come output generati; questo documento rende eseguibile tale decisione senza ampliare lo scope dei task applicativi successivi.

Il contratto prende il nome `api-contract-v1`. `@dnd-ai/contracts` contiene gli schemi Zod strict e i tipi inferiti, genera JSON Schema Draft 2020-12 e assembla un documento OpenAPI 3.1.1 deterministico. Gli artifact tracciati vengono controllati in locale e CI con una modalità read-only che fallisce su file mancanti, inattesi o non aggiornati.

## Approcci valutati

### Zod-first con generazione nativa e assemblatore OpenAPI minimo — scelto

Zod 4 fornisce la validazione runtime e la conversione nativa con `z.toJSONSchema`. Un catalogo interno associa nome, kind, versione e schema; un assemblatore piccolo produce componenti OpenAPI, mantenendo `paths: {}` finché non esiste una route implementata dal task proprietario.

Vantaggi: una fonte della verità, nessuna seconda libreria di codegen, tipi e runtime allineati, output riproducibile e package boundary invariato. Svantaggio: metadata e operation OpenAPI vanno composti esplicitamente.

### Zod-first con libreria OpenAPI dedicata — non scelta

Una libreria dedicata ridurrebbe parte della composizione dei path, ma aggiungerebbe superficie di dipendenza e una seconda semantica di metadata prima che esista una API applicativa sostanziale. La baseline non ne giustifica il costo.

### OpenAPI/JSON Schema-first con Zod generato — non scelta

Favorirebbe i validator Fastify, ma contraddirebbe Zod come fonte primaria e introdurrebbe una pipeline bidirezionale più difficile da diagnosticare. Viene esclusa per la vertical slice P0.

## Perimetro della vertical slice

La prima versione pubblica sette famiglie di contratti:

1. `SubmitTurnRequest`: union discriminata dei mode `free_action|dialogue|relationship`, `closed_choice` e `combat`; oggetti strict, limiti bounded e nessun campo client per danni, roll, quest, relazione o tool arbitrari.
2. `SubmitTurnAcceptedResponse`: risposta `202` con `turnId`, stato, URL SSE e `requestId` server-owned.
3. `ApiErrorResponse`: error envelope versionato con details bounded e `currentStateVersion` opzionale.
4. `TurnStreamEvent`: union discriminata degli eventi lifecycle essenziali `turn.accepted`, `turn.progress`, `turn.completed` e `turn.failed`, ciascuno con `schemaVersion: 1` e payload strict.
5. `GameEvent`: envelope append-only v1 con UUIDv7 canonici, sequence, causation/correlation, actor, versioni letterali coerenti e payload JSON; gli eventi di dominio concreti restringeranno `eventType` e payload nei task proprietari.
6. `DungeonMasterTurnResult`: output AI finale strict della §12.6, con proposte non canoniche, cardinalità bounded e tipi inferiti.
7. factory `createAIToolCallSchema`/`createAIToolResultSchema`: richiedono esplicitamente schema del nome allowlisted e schema args/data; non esiste un tool name generico autorizzante.

OpenAPI 3.1.1 pubblica questi contratti in `components.schemas` ma mantiene `paths: {}`. I contratti REST previsti sono quindi disponibili al codebase senza dichiarare implementata una route inesistente; BL-028 aggiungerà l’operation quando handler, auth, idempotenza e failure path saranno reali.

Sono fuori scope:

- handler Fastify, auth, ownership, idempotenza e persistence del turno (`BL-028` e successivi);
- catalogo SSE completo e delivery/reconnect (`BL-035`/`BL-041`);
- Campaign Bible, cataloghi personaggio, memoria, summary ed epilogo completi (`BL-011`, `BL-022` e task proprietari);
- tool registry e tool concreti: BL-009 fornisce soltanto envelope parametrizzati che non autorizzano alcun nome;
- type provider Fastify, client codegen, UI, provider AI, database, deploy o modifiche Vercel.

## Architettura e file ownership

`packages/contracts/src` resta un package leaf e browser-compatible:

- `version.ts`: versioni numerica/SemVer, dialect e namespace degli schema ID;
- `identifiers.ts`: primitive JSON-safe condivise per UUID, request ID, state version e testo bounded;
- `api.ts`: request/response/error schema e tipi inferiti;
- `events.ts`: eventi SSE lifecycle e tipi inferiti;
- `game-event.ts`: envelope append-only JSON-safe con version gate v1;
- `ai-turn.ts`: risultato turno AI e value object strict;
- `tool-envelope.ts`: factory allowlisted per call/result;
- `catalog.ts`: registro immutabile di nome, kind, filename e schema;
- `artifacts.ts`: conversione pura Zod → JSON Schema e composizione OpenAPI/manifest;
- `index.ts`: unica superficie pubblica runtime, senza filesystem o dipendenze Node.

`scripts/lib/contract-artifact-policy.mjs` possiede canonicalizzazione e confronto drift; `scripts/lib/contract-compatibility-policy.mjs` legge in sola lettura la base Git protetta e congela i major già pubblicati; `scripts/lib/owned-path-policy.mjs` rifiuta symlink/junction nella catena posseduta. `scripts/generate-contracts.mjs` è il solo writer degli artifact e accetta esclusivamente `--write` o `--check`. Gli output vivono in `packages/contracts/generated/v1/`; non vengono modificati a mano.

## Versionamento e compatibilità

- `CONTRACT_VERSION` usa SemVer e parte da `1.0.0`; gli envelope persistibili espongono `schemaVersion: 1`.
- `$id` include il namespace stabile `urn:dnd-ai:contracts:v1:<name>`; filename e component name sono stabili.
- dopo la pubblicazione, ogni directory major è immutabile byte per byte rispetto alla base protetta;
- qualsiasi variazione wire, anche additiva, richiede la directory major successiva e una consumer migration esplicita; una patch è ammessa soltanto se gli artifact non cambiano;
- la CI confronta sia output canonicalizzato sia tree Git della base e rifiuta artifact stale, mancanti, inattesi o modifiche a major pubblicati;
- i file generated non sono una seconda fonte: derivano sempre dal catalogo Zod versionato.

## Flusso di generazione

1. il package compila gli schemi TypeScript;
2. `createContractArtifacts()` converte ogni entry con target Draft 2020-12 e fallisce su costrutti non rappresentabili; i soli cicli ammessi sono quelli del valore JSON ricorsivo e vengono resi come `$ref`;
3. l’assemblatore riusa gli stessi schema nei componenti OpenAPI 3.1.1;
4. la policy ordina ricorsivamente le chiavi e serializza con newline finale;
5. prima di leggere o scrivere, il generator verifica la catena reale repository→generated e rifiuta symlink/junction; `--write` sincronizza soltanto la directory posseduta;
6. la compatibility policy usa `origin/main` in locale e `HEAD^1` in CI, senza fetch, ammette il bootstrap solo se la base non contiene artifact e poi congela `v1`;
7. `--check` non scrive e restituisce exit non-zero su drift o incompatibilità; il job Quality lo esegue con history depth 2 prima del merge gate.

## Validazione, errori e sicurezza

Gli schemi di rete usano oggetti strict: campi sconosciuti non vengono eliminati silenziosamente ma rifiutati. I limiti di stringa, array e record prevengono payload non bounded; i parser non normalizzano né applicano trasformazioni non rappresentabili in JSON Schema. L’autorizzazione e la validazione semantica delle entità restano responsabilità del server e non vengono simulate nel package.

Il generator fallisce chiuso se la build manca, una conversione Zod non è rappresentabile, la base Git non è disponibile, un major pubblicato cambia, un path esce dalla directory posseduta, la catena contiene symlink/junction o il contenuto tracciato diverge. Non esegue fetch e i messaggi indicano esclusivamente filename e categoria, mai payload utente.

## Strategia di test

- contract compile: build/typecheck puliti e tipi inferiti verificati dal compilatore;
- runtime: parse/serialize di request, response, `GameEvent`, risultato AI ed eventi SSE; UUIDv7 canonici; reject di unknown fields, versioni incoerenti, mode errati, valori fuori limite, tool non allowlisted e campi client proibiti;
- roundtrip: gli stessi fixture sono accettati/rifiutati dagli schemi Zod e dagli artifact JSON Schema tramite Ajv 2020;
- versioning: SemVer, schema version, `$id`, manifest, component refs e confronto offline con un commit Git precedente;
- generation: missing/stale/unexpected, root symlink/junction e `pnpm contracts:check` read-only;
- CI: contract diff+compatibility obbligatorio nel job Quality con `HEAD^1` e policy test che impedisce di rimuovere history o baseline.

## Criteri di revisione

Valutare una libreria OpenAPI dedicata soltanto quando il numero di operation rende l’assemblatore più complesso del mapping dichiarativo o quando serve codegen multi-lingua. Valutare subpath separati soltanto se il bundle client dimostra un costo misurabile; la baseline privilegia una superficie semplice e tree-shakeable.
