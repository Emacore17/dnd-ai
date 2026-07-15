---
status: accepted
owner: engineering
last_reviewed: 2026-07-15
last_verified_commit: ccecd683c12ebfe29f4cc6be78c950ebb01ca288
source_refs:
  - docs/MVP_SPEC.md#115-event-sourcing-pragmatico
  - docs/MVP_SPEC.md#126-schema-del-turno
  - docs/MVP_SPEC.md#128-schemi-separati
  - docs/MVP_SPEC.md#20-api
  - docs/MVP_SPEC.md#294-cicd
  - docs/superpowers/specs/2026-07-15-bl-009-contract-generation-design.md
  - docs/adr/0002-monorepo-package-boundaries.md
related_tasks:
  - BL-009
  - GOV-002
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
  - .github/workflows/ci.yml
test_refs:
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/contracts-runtime.test.mjs
  - tests/contracts/contracts-artifacts.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/unit/owned-path-policy.test.mjs
  - tests/contracts/ci-workflow.test.mjs
supersedes: null
---

# ADR-0008 — Contratti Zod-first e artefatti generati

## Stato

Accepted il 2026-07-15 durante `BL-009`.

## Contesto

Client, API, worker e provider AI devono condividere DTO validati a runtime senza duplicare tipi TypeScript, JSON Schema e OpenAPI. Il repository non implementa ancora le route del turno: pubblicarle in OpenAPI prima del relativo handler renderebbe la documentazione più avanzata del sistema reale. I file generati devono inoltre essere riproducibili e non modificabili manualmente.

`BL-009` possiede la fondazione comune. Lo schema completo della Campaign Bible resta di `BL-022`, il catalogo tool definitivo dei task del Rules Engine e le operazioni HTTP dei task che implementano le route.

## Decisione

1. Gli schemi strict Zod in `@dnd-ai/contracts` sono la fonte unica dei contratti runtime; i tipi TypeScript pubblici derivano dagli schemi.
2. Il contratto iniziale è `1.0.0`, usa namespace `api-contract-v1` e `schemaVersion: 1`. Gli ID e i metadata canonici hanno schemi condivisi, ma nessun DTO applica mutazioni di dominio.
3. La baseline comprende request/response/error API, lifecycle SSE, `GameEvent`, `DungeonMasterTurnResult` e factory di tool envelope che richiedono al chiamante uno schema di nomi allowlisted. Un `toolName: string` generico non viene esportato.
4. `z.toJSONSchema` genera Draft 2020-12 con errore sui costrutti non rappresentabili. Ogni schema standalone ha `$id`, titolo, tipo di contratto e versione stabili.
5. OpenAPI `3.1.1` usa lo stesso catalogo e pubblica soltanto `components.schemas`; `paths` resta vuoto finché il task proprietario non implementa e testa la relativa operazione.
6. Gli artefatti canonici vivono in `packages/contracts/generated/v1/`: manifest, OpenAPI e JSON Schema. Sono JSON canonico, ordinati dal catalogo e committati; non si modificano a mano.
7. `pnpm contracts:generate` è l'unico writer. `pnpm contracts:check` è read-only, rigenera in memoria e fallisce su file mancanti, stale o inattesi. Il job CI `Quality` e `pnpm verify` eseguono il check.
8. Il generatore possiede soltanto path relativi allowlisted sotto la directory generated, rifiuta symlink/junction nell'intera catena repository→artifact e non esegue cancellazioni ricorsive.
9. Ogni major già presente nella base Git protetta è immutabile byte per byte. Qualsiasi modifica wire, inclusa un'aggiunta, richiede la directory major successiva e artefatti paralleli; una patch è ammessa soltanto se i byte generati restano invariati.
10. La compatibility policy usa `origin/main` in locale e `HEAD^1` nel job Quality con history depth 2. Non esegue fetch; una base assente fallisce chiuso. Il bootstrap `v1` è ammesso soltanto quando la base non contiene ancora artifact.
11. Ajv 2020 viene usato nei test per compilare gli output e verificarne la parità con Zod; non diventa il validator runtime del package.

## Alternative considerate

### OpenAPI o JSON Schema come fonte primaria

Rifiutata per la baseline: richiederebbe code generation inversa per mantenere validazione runtime e tipi, introducendo una seconda pipeline prima di avere route reali.

### Libreria OpenAPI dedicata

Rinviata: i componenti iniziali sono rappresentabili direttamente con Zod e OpenAPI 3.1. Una dipendenza ulteriore avrebbe superficie e lockfile maggiori senza un consumer operativo.

### Documentare subito `POST /turns`

Rifiutata: `BL-028` possiede handler, auth, idempotenza e comportamento HTTP. La specifica dei path deve coincidere con codice e contract test implementati.

## Conseguenze e revisione

La fondazione offre validazione runtime e artefatti interoperabili con un solo punto di modifica. Il trade-off è che metadata e operazioni OpenAPI più ricchi arrivano insieme alle feature proprietarie.

Rivedere la decisione se il catalogo non è più rappresentabile fedelmente da Zod, se un consumer richiede code generation multi-linguaggio o quando `BL-028` aggiunge le prime operazioni. Ogni revisione deve mantenere drift check deterministico, compatibilità esplicita e failure closed sugli schemi non rappresentabili.
