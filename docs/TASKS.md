---
status: active
owner: engineering
last_reviewed: 2026-07-15
last_verified_commit: 15382d547638333e33992be96479a6f0cbff1a29
source_refs:
  - docs/MVP_SPEC.md
related_tasks:
  - GOV-001
  - GOV-002
  - GOV-003
  - BL-001
  - BL-002
  - BL-003
  - BL-004
  - BL-008
  - BL-009
  - BL-010
  - BL-079
  - BL-080
code_refs:
  - .vercelignore
  - apps
  - packages
  - packages/config
  - packages/observability/src/node.ts
  - packages/observability/src/tracing.ts
  - packages/observability/src/logger.ts
  - packages/observability/src/redaction.ts
  - packages/contracts/src
  - packages/contracts/generated/v1
  - scripts/generate-contracts.mjs
  - scripts/lib/contract-artifact-policy.mjs
  - scripts/lib/contract-compatibility-policy.mjs
  - scripts/lib/owned-path-policy.mjs
  - apps/api/src/observability.ts
  - apps/worker/src/observability.ts
  - apps/web/instrumentation.ts
  - apps/web/instrumentation-client.ts
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/feature-flags.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - infra/local/postgres.compose.yml
  - scripts/run-database-migrations.mjs
  - scripts/manage-feature-flag.mjs
  - scripts/lib/database-migration-policy.mjs
  - scripts/lib/postgres-test-container.mjs
  - apps/api/src/runtime.ts
  - apps/worker/src/runtime.ts
  - .github/workflows/ci.yml
  - .github/workflows/deployment-smoke.yml
  - apps/web/app/health/route.ts
  - apps/web/package.json
  - apps/web/vercel.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - infra/deployment/vercel-staging.json
  - scripts/check-deployment-foundation.mjs
  - scripts/assert-vercel-preview-bootstrap-enabled.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - scripts/lib/build-artifact.mjs
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/lib/secret-scanner.mjs
  - scripts/lib/deployment-smoke.mjs
  - scripts/lib/deployment-workflow-policy.mjs
  - scripts/lib/workspace-boundaries.mjs
  - scripts/lib/task-graph.mjs
  - turbo.json
  - package.json
  - scripts/check-docs.mjs
  - scripts/lib/document-policy.mjs
  - scripts/verify-affected.mjs
  - scripts/lib/affected-verification.mjs
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/unit/build-artifact.test.mjs
  - tests/security/secret-scanner.test.mjs
  - tests/unit/runtime-config.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/security/environment-file-policy.test.mjs
  - tests/unit/deployment-smoke.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
  - tests/unit/vercel-preview-bootstrap-policy.test.mjs
  - tests/security/vercel-preview-bootstrap-gate.test.mjs
  - tests/unit/database-migration-policy.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/database/database-migration-failure.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/security/database-migration-security.test.mjs
  - tests/unit/feature-flags.test.mjs
  - tests/database/feature-flags.test.mjs
  - tests/security/feature-flags-security.test.mjs
  - docs/testing/BL-004_VERIFICATION.md
  - tests/contracts/agent-workflow-contract.test.mjs
  - tests/contracts/document-policy.test.mjs
  - tests/unit/affected-verification.test.mjs
  - tests/unit/observability-core.test.mjs
  - tests/unit/observability-node.test.mjs
  - tests/integration/observability-flow.test.mjs
  - tests/contracts/observability-contract.test.mjs
  - tests/security/observability-security.test.mjs
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/contracts-runtime.test.mjs
  - tests/contracts/contracts-artifacts.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/unit/owned-path-policy.test.mjs
supersedes: null
---

# TASKS.md — Piano operativo e registro di avanzamento dell’MVP

> **Scopo:** fonte operativa per gli agenti di coding AI incaricati di trasformare la specifica in un MVP verificato.
> **Punto di ingresso agente:** [`AGENTS.md`](../AGENTS.md)
> **Specifica canonica:** [`docs/MVP_SPEC.md`](MVP_SPEC.md)
> **Studio UX/UI:** [`docs/product/UX_UI_DESIGN.md`](product/UX_UI_DESIGN.md)
> **Baseline specifica:** SHA-256 `d07620bb477a50bf8309c6c24729baaaa45a4a29499e624741a5fcdaa514a329`
> **Data baseline:** `2026-07-15`
> **Versione schema task:** `1.1.0`
> **Stato del programma:** `IN_PROGRESS`
> **Milestone corrente:** `M0 — Fondamenta`
> **Task attivo:** `GOV-002 — Validazione automatica della documentazione e tracciabilità`
> **Prossimo task READY:** `—`; `GOV-002` è `IN_PROGRESS`, mentre `BL-079` resta `BACKLOG` finché lo staging non è disponibile
> **Regola assoluta:** nessun task può essere marcato `DONE` senza test `PASSING`, contesto verificato ed evidenze di chiusura.

Questo file è sia backlog sia registro di esecuzione. Deve essere modificato nello stesso commit del lavoro a cui si riferisce. Le descrizioni di prodotto e architettura provengono da `docs/MVP_SPEC.md`; questo documento le scompone in unità eseguibili, con dipendenze, riferimenti e quality gate.

---

## 1. Gerarchia delle fonti e gestione dei conflitti

L’agente deve usare la seguente gerarchia:

1. **Decisioni approvate e vigenti:** ADR con stato `accepted`, purché la modifica sia riflessa nello stesso commit anche in `docs/MVP_SPEC.md` quando cambia un requisito o una decisione architetturale.
2. **Specifica MVP:** `docs/MVP_SPEC.md`, fonte canonica per scope, requisiti, invarianti, API previste e criteri globali.
3. **Contratti generati/versionati:** JSON Schema, OpenAPI, event schema e migration head; rappresentano il comportamento implementato, ma non possono contraddire silenziosamente la specifica.
4. **Documentazione living di feature e operazioni:** file registrati al §6.
5. **Codice e test:** prova dell’implementazione corrente.
6. **`TASKS.md`:** stato, ordine, dipendenze ed evidenze del lavoro.

In caso di conflitto:

- non scegliere arbitrariamente una versione;
- marcare il task `BLOCKED`;
- registrare il conflitto nelle note del task e in `docs/CONTEXT.md`;
- creare o aggiornare un ADR;
- aggiornare tutte le fonti coinvolte nello stesso change set;
- rieseguire `docs:check`, contract test e test della feature.

La memoria della conversazione, un prompt precedente o un commento non versionato **non sono fonti della verità**.

## 2. Stati, progresso e campi obbligatori

### 2.1 Stati consentiti

| Stato | Significato | Regola |
|---|---|---|
| `BACKLOG` | Definito ma non ancora eseguibile. | Almeno una dipendenza non è `DONE` o non è il prossimo task ordinato. |
| `READY` | Dipendenze soddisfatte e contesto verificabile. | Può essere selezionato dall’agente. |
| `IN_PROGRESS` | Implementazione o test in corso. | Un agente deve avere normalmente un solo task in questo stato. |
| `BLOCKED` | Impossibile proseguire per un impedimento concreto. | Deve contenere causa, impatto e condizione di sblocco; non usare per semplici difficoltà. |
| `IN_REVIEW` | Implementazione conclusa, quality gate in esecuzione/revisione. | Test specifici già passati; restano gate globali o review. |
| `DONE` | Deliverable verificato e documentato. | Richiede tutte le condizioni del §4. |
| `DEFERRED` | Fuori dall’attuale perimetro/release. | P1/P2/Post-MVP non si avviano finché i gate P0 non lo autorizzano. |
| `CANCELLED` | Non più necessario. | Richiede motivazione e riferimento ad ADR/spec aggiornata. |

### 2.2 Progresso

Usare solo `0%`, `25%`, `50%`, `75%`, `90%`, `100%`.

- `0%`: non iniziato.
- `25%`: contesto letto, test/approccio definiti.
- `50%`: percorso principale implementato, test ancora incompleti.
- `75%`: happy e negative path implementati; test specifici quasi completi.
- `90%`: in review, documentazione/evidenze/gate globali in chiusura.
- `100%`: soltanto con stato `DONE`.

### 2.3 Esito test

| Esito | Significato |
|---|---|
| `NOT_RUN` | Nessun test pertinente eseguito sul change corrente. |
| `FAILING` | Almeno un test richiesto fallisce. Il task non può uscire da `IN_PROGRESS`. |
| `PARTIAL` | Suite specifica incompleta o gate globale non ancora eseguito. |
| `PASSING` | Tutti i test del task e i gate applicabili passano sul commit indicato. |
| `N/A` | Ammesso solo con motivazione tecnica esplicita; mai per evitare un test richiesto. |

Lo stato di programma è canonico esclusivamente sulla default branch. Il record terminale presente in una branch è una proposta completa dei gate locali, mentre la delivery è derivata da GitHub: `PENDING` finché il commit non è raggiungibile da `main`, `VERIFIED` quando è stato integrato da una PR con `CI / Merge gate` verde. La delivery non viene duplicata nelle card e una CI rossa non richiede un commit documentale di rollback, perché non modifica lo stato canonico su `main`.

## 3. Procedura obbligatoria per ogni sessione dell’agente

Una continuazione sullo stesso task non ripete la cold start. Su task/branch nuovo o contesto compattato:

1. Leggere `AGENTS.md` §§1–7 e la sola area tecnica applicabile; altrimenti eseguire prima `GOV-001`.
2. Verificare la baseline:
   ```bash
   sha256sum docs/MVP_SPEC.md
   git rev-parse HEAD
   ```
   Il primo valore deve coincidere con la baseline dichiarata o deve essere registrata una revisione del diff.
3. Leggere soltanto snapshot/risks pertinenti in `CONTEXT`, §§1–7 + card/registro in questo file, sezioni spec e ADR collegati.
4. Controllare codice, migration head, contratti generati e test realmente toccati.
5. Selezionare il primo task `READY` P0 o il task prioritario indicato direttamente dal Product Owner.
6. Registrare nel change set funzionale `IN_PROGRESS/25%`, corsia `FAST|STANDARD|HIGH_RISK`, scope, test e fuori scope; nessun commit di solo stato.
7. Per provider/capacità esterne non provate, eseguire feasibility/readback entro 15 minuti prima del codice; se non confermate, un solo contenimento e `BLOCKED`.
8. Implementare il minimo change set completo e usare test mirati per batch significativi.
9. Eseguire il gate della corsia, una review indipendente e soltanto il follow-up dei P0/P1.
10. Consolidare codice, test, stato e soli documenti semanticamente interessati in un unico candidato finale.
11. Marcare il candidato proposto `DONE/100%/PASSING`, aprire una sola PR e integrare soltanto dopo `CI / Merge gate`; stato di programma e delivery seguono la semantica derivata del §2.3.
12. Non creare commit/PR per copiare SHA o run CI; GitHub è evidenza esterna. Rendere `READY` il successivo task realmente sbloccato.

Quando un requisito non è chiaro ma la specifica contiene un’assunzione esplicita, applicare l’assunzione. Una decisione che cambia scope, costi, sicurezza, legalità o architettura deve produrre ADR e aggiornamento documentale, non una scelta nascosta nel codice.

## 4. Definition of Done vincolante

Un task è `DONE` solo se tutte le seguenti condizioni sono vere:

- [ ] obiettivo e criterio di accettazione sono soddisfatti;
- [ ] test obbligatori del task sono tutti selezionati e passano;
- [ ] lint, typecheck e build pertinenti passano;
- [ ] unit/integration/contract/E2E/security/eval applicabili passano;
- [ ] happy path, negative path e failure/retry path applicabili sono coperti;
- [ ] authorization, idempotenza, concorrenza e rollback sono testati quando pertinenti;
- [ ] migration/backfill è provata da database vuoto e su upgrade quando presente;
- [ ] nessuna modifica AI committa output invalido; timeout/retry/fallback/costo/trace sono coperti;
- [ ] nessun test è stato eliminato, saltato o indebolito senza ADR;
- [ ] documentazione e riferimenti sono aggiornati nello stesso commit;
- [ ] `docs/CONTEXT.md` riflette l’architettura e le versioni correnti;
- [ ] `docs/TRACEABILITY.md` collega requisito, task, test ed evidenza;
- [ ] evidenze riportano commit, comandi, exit code, environment e report;
- [ ] non restano TODO critici non tracciati;
- [ ] è stato eseguito il gate della corsia; clean checkout è obbligatorio solo per installazione, packaging, symlink, workflow o comportamento cross-platform;
- [ ] per UI: keyboard flow e accessibility scan senza blocker;
- [ ] per security/privacy: threat/data review aggiornata;
- [ ] per AI: eval pertinente e impatto token/costo registrati;
- [ ] staging smoke test eseguito quando il task modifica un percorso già disponibile nell'ambiente target; per i prerequisiti del primo deploy, l'evidenza local/contract indica `N/A` motivato e collega il task che possiede il primo smoke reale.

Un’implementazione “funzionante a mano” ma senza test/evidenze resta `IN_PROGRESS` o `BLOCKED`, mai `DONE`.

## 5. Contratto dei comandi di qualità

I seguenti comandi costituiscono il target del repository. Usare il minimo insieme che copre il rischio; `pnpm verify` non è il comando predefinito per ogni modifica.

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:unit
pnpm test:integration
pnpm test:contract
pnpm test:e2e
pnpm test:security
pnpm test:eval
pnpm test:bot
pnpm test:load
pnpm docs:check
pnpm db:migrate:test
pnpm verify:docs
pnpm verify:affected
pnpm verify
```

Corsie: `FAST` usa `verify:docs`; `STANDARD` usa test mirati + `verify:affected` per workspace interessati e guardrail root, quindi delega il gate completo alla CI PR; `HIGH_RISK` usa test mirati + una sola `verify` finale. Le suite costose non applicabili non si eseguono per consuetudine.

## 6. Contesto e documentazione living

### 6.1 Registro documenti

| Documento | Stato iniziale | Autorità | Aggiornamento obbligatorio |
|---|---|---|---|
| `docs/MVP_SPEC.md` | Esistente, canonico | Scope/architettura/requisiti | Quando una decisione approvata cambia la specifica. |
| `docs/TASKS.md` | Esistente, operativo | Stato/dipendenze/evidenze | Una volta nel candidato finale di ogni task, salvo blocker reale. |
| [`AGENTS.md`](../AGENTS.md) | Esistente, `active` | Entry point agente | Quando cambia workflow, source hierarchy, boundary globali o policy browser/sicurezza. |
| [`docs/CONTEXT.md`](CONTEXT.md) | Esistente, `active` | Snapshot corrente | Solo cambio reale di task, architettura, comando, versione o rischio. |
| [`docs/README.md`](README.md) | Esistente, `active` | Indice documentazione | A ogni nuovo documento/supersede. |
| [`docs/TRACEABILITY.md`](TRACEABILITY.md) | Esistente, `active`; automatizzazione pianificata in `GOV-002` | Requisito→task→test→evidenza | Solo se cambia il mapping funzionale. |
| [`docs/CHANGELOG.md`](CHANGELOG.md) | Esistente, `active`; consolidamento pianificato in `GOV-002` | Modifiche documentali/contrattuali | Decisione, contratto pubblico o release; non semplice avanzamento. |
| [`docs/product/UX_UI_DESIGN.md`](product/UX_UI_DESIGN.md) | Esistente, `active` | Contratto UX/UI mobile-first e motion | Ogni cambio a gerarchia, component stack, token, responsive o motion. |
| [`docs/adr/0001-mobile-first-conversational-ui.md`](adr/0001-mobile-first-conversational-ui.md) | Esistente, `accepted` | Decisione UI mobile-first e stack visuale | Ogni revisione della decisione o dei guardrail. |
| [`docs/adr/0003-ci-trust-boundary-and-artifacts.md`](adr/0003-ci-trust-boundary-and-artifacts.md) | Esistente, `accepted` | Trust boundary, gate e artifact CI | Ogni modifica a trigger, permessi, cache, scan o artifact. |
| [`docs/operations/CI_CD.md`](operations/CI_CD.md) | Esistente, `active` | Contratto operativo della pipeline | Ogni modifica a job, Ruleset, gate o ownership differita. |
| [`docs/testing/BL-002_VERIFICATION.md`](testing/BL-002_VERIFICATION.md) | Esistente, `active` | Evidenze riproducibili BL-002 | A ogni run o cambio del commit verificato. |
| `docs/adr/` | Registro parziale; automazione pianificata in `GOV-002` | Decisioni architetturali | Prima o insieme a decisioni non reversibili. |
| [`docs/architecture/SYSTEM_OVERVIEW.md`](architecture/SYSTEM_OVERVIEW.md) | Esistente, baseline `BL-001`; consolidamento `DOC-ARCH-001` | Architettura implementata | Ogni cambio di confine/topologia. |
| `docs/data/DATA_MODEL.md` | Planned (`DOC-ARCH-001`) | Entità, indici, migration head | Ogni migration/schema change. |
| `docs/features/CHARACTER_CREATION.md` | Planned (`DOC-CHAR-001`) | Character Builder | Ogni catalog/rule/API/UI change. |
| `docs/features/CAMPAIGN_GENERATION.md` | Planned (`DOC-CAMP-001`) | Bible/prologo/generation | Ogni schema/prompt/provider flow change. |
| `docs/features/TURN_LOOP.md` | Planned (`DOC-TURN-001`) | Orchestrator/idempotenza/recovery | Ogni state machine/commit/retry change. |
| `docs/features/RULES_ENGINE.md` | Planned (`DOC-RULES-001`) | Regole/tool | Ogni formula, evento o tool change. |
| `docs/features/MEMORY_NPC.md` | Planned (`DOC-MEM-001`) | Knowledge/memory/context | Ogni visibility/retrieval/budget change. |
| `docs/features/PROGRESSION_ENDINGS.md` | Planned (`DOC-END-001`) | Pacing/finali/epilogo | Ogni predicate/gate change. |
| [`docs/api/README.md`](api/README.md) | Esistente, `active` | Contratti runtime/generated e version policy | Ogni endpoint/schema version. |
| `docs/events/EVENT_CATALOG.md` | Planned | Eventi e payload | Ogni nuovo evento/versione. |
| `docs/security/THREAT_MODEL.md` | Planned (`DOC-SEC-001`) | Threat/controls | Ogni trust boundary/dato/endpoint. |
| `docs/security/MODERATION_POLICY.md` | Planned (`DOC-SEC-001`) | Policy safety | Ogni policy/provider/category change. |
| `docs/operations/RUNBOOK.md` | Planned (`DOC-OPS-001`) | Operazioni/incidenti | Ogni deploy, alert, recovery o kill switch. |
| `docs/testing/TEST_STRATEGY.md` | Planned (`QA-001`/`DOC-TEST-001`) | Suite e fixture | Ogni nuovo livello/gate di test. |
| `docs/testing/AI_EVALS.md` | Planned (`DOC-TEST-001`) | Evals/rubriche/versioni | Ogni prompt/model/schema/eval change. |
| `docs/testing/RELEASE_EVIDENCE.md` | Planned (`DOC-TEST-001`) | Evidenze go/no-go | Ogni release candidate. |

### 6.2 Front matter minimo

Ogni documento living deve iniziare con metadata equivalenti a:

```yaml
---
status: draft | active | accepted (ADR only) | superseded
owner: <team-or-role>
last_reviewed: YYYY-MM-DD
last_verified_commit: <git-sha>
source_refs:
  - docs/MVP_SPEC.md#<section>
related_tasks:
  - BL-000
code_refs:
  - path/to/module
test_refs:
  - path/to/test
supersedes: null
---
```

### 6.3 Controllo di freschezza

Prima di iniziare e chiudere un task:

- confrontare SHA della specifica e commit del repository;
- verificare che i path citati esistano o siano marcati `planned`;
- controllare che schema/API/eventi generati non abbiano diff;
- aggiornare `last_verified_commit` solo nei documenti semanticamente toccati, usando una baseline già esistente e mai un commit autoreferenziale;
- registrare in `docs/CONTEXT.md`: milestone, task attivo, migration head, contract version, prompt/eval version, feature flag/kill switch e rischi;
- eseguire `pnpm verify:docs`, che include `pnpm docs:check`, task graph e secret scan.

PR/head/run CI restano evidenze esterne: non generano un commit documentale dedicato. Report separati sono richiesti soltanto per gate, incidenti o task `HIGH_RISK` con una matrice che non entra nella card.

Se la specifica cambia, tutti i task non conclusi collegati alle sezioni modificate tornano con contesto `NO` finché non revisionati.

## 7. Regole di pianificazione e modifica del backlog

- La sequenza P0 segue M0→M7. Un gate di milestone deve essere `DONE` prima della milestone successiva, salvo lavoro puramente preparatorio che non modifica il prodotto.
- P1, P2 e Post-MVP restano `DEFERRED` fino a decisione esplicita.
- Un nuovo task usa un ID stabile: `BL-xxx` se entra nel backlog prodotto, `GOV-xxx`, `QA-xxx`, `DOC-xxx`, `GATE-xxx` o `BUG-xxx`.
- Ogni nuovo task deve contenere stato, progresso, test, riferimenti, dipendenze, criterio, docs ed evidenze.
- Non accorpare task già tracciati per “semplificare” se si perde la possibilità di testarli separatamente.
- Non dividere un task in micro-task amministrativi privi di deliverable verificabile.
- Un bug scoperto durante un task:
  - se è necessario per il criterio corrente, resta nello scope e ottiene un regression test;
  - se è indipendente, creare `BUG-xxx`, indicare severità/dipendenza e non nasconderlo in note.
- Una decisione di prodotto/architettura non risolta genera `DEC-xxx` o ADR e blocca soltanto i task realmente dipendenti.

## 8. Dashboard programma

| Milestone | Stato | Progresso | Task inclusi | Gate | Condizione di uscita |
|---|---:|---:|---:|---|---|
| M0 — Fondamenta | `IN_PROGRESS` | 54% | 18 | `GATE-M0` | Pipeline, auth, dati, osservabilità, ambiente preview/staging, fondazione UX/UI e contesto agenti operativi. |
| M1 — Character Builder | `NOT_STARTED` | 0% | 9 | `GATE-M1` | Personaggio e fino a due compagni validi e documentati. |
| M2 — Campaign Generator | `NOT_STARTED` | 0% | 12 | `GATE-M2` | Bible/prologo validi, canonici, moderati e idempotenti. |
| M3 — Core Turn Loop | `NOT_STARTED` | 0% | 16 | `GATE-M3` | Input→AI/tool→commit→SSE riproducibile e fault-safe. |
| M4 — Rules Engine | `NOT_STARTED` | 0% | 12 | `GATE-M4` | Regole deterministiche complete per la vertical slice. |
| M5 — NPC e memoria | `NOT_STARTED` | 0% | 9 | `GATE-M5` | Continuità, knowledge boundary e context budget verificati. |
| M6 — Progressione e finale | `NOT_STARTED` | 0% | 6 | `GATE-M6` | Campagne convergono a finali backend-gated ed epilogo. |
| M7 — Hardening e rilascio | `NOT_STARTED` | 0% | 12 | `GATE-M7` | Safety, security, SLO, costi, ops ed eval pronti. |
| MVP | `NOT_STARTED` | 0% | AC-01..25 | `GATE-MVP` | Tutte le evidenze go/no-go valide sul release commit. |

---

## 9. M0 — Fondamenta

Stabilire repository, governance del contesto, contratti, dati, identity, osservabilità e quality gates.

### GOV-001 — Bootstrap del contesto persistente per gli agenti di coding

- **Stato:** `DONE`
- **Progresso:** `100%`
- **Esito test:** `PASSING`
- **Contesto verificato:** `YES` — commit/SHA: repository `unversioned`; spec SHA `b639a75c26ca0dc17e54d9f1c8816de7514a5e2d54ea4cfa733f275e18fbcd84`; data: `2026-07-13`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** —
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §1, §5, §8, §21, §30, §35; `docs/TASKS.md` §§1–7; `docs/product/UX_UI_DESIGN.md`
- **Obiettivo:** Creare un punto di ingresso obbligatorio e aggiornabile che permetta a ogni agente di ricostruire rapidamente stato, decisioni, versioni e prossimo lavoro senza affidarsi alla memoria della chat.
- **Deliverable:** `AGENTS.md`; `docs/README.md`; `docs/CONTEXT.md` con baseline, milestone, task READY, architettura corrente, comandi, versioni schema/prompt/eval, decisioni e rischi aperti; `docs/TRACEABILITY.md` e `docs/CHANGELOG.md` iniziali; convenzione front matter; studio UX/UI e ADR della direzione mobile-first richiesta prima dello sviluppo.
- **Criterio di accettazione:** Un agente nuovo, leggendo soltanto AGENTS → CONTEXT → TASKS → riferimenti indicati, identifica correttamente source of truth, prossimo task, dipendenze, comandi di verifica e decisioni aperte.
- **Test obbligatori prima di `DONE`:**
  - [x] Validare tutti i link e i path citati nei documenti attualmente creati; nessun riferimento inesistente non marcato come `planned`.
  - [x] Simulare una cold-start review con checklist: baseline hash, milestone, READY task e open decisions sono determinabili.
  - [x] Verificare che `docs/CONTEXT.md` riporti SHA/commit e data di ultima verifica, non descrizioni temporali vaghe.
- **Documentazione e contesto:** `AGENTS.md`, `docs/README.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, `docs/CHANGELOG.md`, `docs/product/UX_UI_DESIGN.md`, ADR-0001, aggiornamento registro documenti in `docs/TASKS.md`
- **Evidenze di chiusura:** commit/PR `N/A — repository unversioned`; comandi e exit code `structural audit: 0; final cold-start audit: 0`; report/CI `AGENTS_VALIDATION.txt (PASS)`; migration/eval/trace ID `N/A`; docs aggiornati e file SHA manifest nel report.
- **Note, rischi o bloccanti:** Nessun blocco residuo per il bootstrap documentale. L’automazione `pnpm docs:check` resta correttamente pianificata in `GOV-002`; `BL-001` è il prossimo task `READY`.

### BL-001 — Configurare workspace, app e package boundaries

- **Stato:** `DONE`
- **Progresso:** `100%`
- **Esito test:** `PASSING`
- **Contesto verificato:** `YES` — commit `6cda07a60022665f321b48dd82fbeb1d9bef586f`; spec SHA `5bdf152a6c535470d239ad72772603d17d53cc82cc3c02f09bf44cbe1ef47e90`; data: `2026-07-13`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** —
- **Dipendenze operative aggiuntive:** GOV-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §11.2 Forma del sistema; `docs/MVP_SPEC.md` §11.3 Moduli applicativi; `docs/MVP_SPEC.md` §29.1 Topologia MVP; `docs/MVP_SPEC.md` §30 Milestone 0; `docs/MVP_SPEC.md` §31 `BL-001`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sviluppatore voglio un monorepo coerente per condividere contratti.
- **Deliverable:** Configurare workspace, app e package boundaries.
- **Criterio di accettazione:** Build/lint/typecheck di tutte le app; import boundaries testate.
- **Test obbligatori prima di `DONE`:**
  - [x] Test di accettazione automatizzato: Build/lint/typecheck di tutte le app; import boundaries testate.
  - [x] Build, lint e typecheck da checkout pulito su tutte le app/package.
  - [x] Test automatico delle dependency/import boundaries con almeno un caso vietato che deve fallire.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/`
- **Evidenze di chiusura:** commit `6cda07a60022665f321b48dd82fbeb1d9bef586f`; `install --frozen-lockfile: 0`; `TURBO_FORCE=true pnpm verify: 0`; report `docs/testing/BL-001_VERIFICATION.md`; migration/eval/trace ID `N/A`; overview, ADR-0002, contesto e tracciabilità aggiornati.
- **Note, rischi o bloccanti:** Nessun blocco residuo nel perimetro. CI e harness completi restano tracciati in `BL-002`/`QA-001`; shadcn/ui e shell visuale in `BL-079`.

### BL-002 — Pipeline test, scan, build e artifact

- **Stato:** `DONE`
- **Progresso:** `100%`
- **Esito test:** `PASSING`
- **Contesto verificato:** `YES` — base commit iniziale `74af8947932443de5b4df2f42f4c6aebfff7a109`; branch base dopo collegamento remote `6b9f5d281fb0185f5f6c98813e2ffcee6424e658`; spec SHA `ed2c7882f94fa751e30dc6f1c73e279388891d7e0fcd686db30aad3b565096f6`; data: `2026-07-13`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001
- **Dipendenze operative aggiuntive:** BL-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §26.12 CI quality gates; `docs/MVP_SPEC.md` §29.4 CI/CD; `docs/MVP_SPEC.md` §31 `BL-002`; `docs/MVP_SPEC.md` §35.1 Definition of Done per user story
- **Obiettivo:** Come team voglio una CI che blocchi regressioni.
- **Deliverable:** Pipeline test, scan, build e artifact.
- **Criterio di accettazione:** PR non mergeabile su gate fallito; cache non espone secret.
- **Test obbligatori prima di `DONE`:**
  - [x] Test di accettazione automatizzato: PR non mergeabile su gate fallito; cache non espone secret.
  - [x] Pipeline su PR con job lint, typecheck, unit, integration/contract e build; un fixture fallito raggiunge e fallisce il merge gate.
  - [x] Verifica che cache, log e artifact CI non contengano secret.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/0003-ci-trust-boundary-and-artifacts.md`; `docs/operations/CI_CD.md`; `docs/testing/BL-002_VERIFICATION.md`
- **Evidenze di chiusura:** verified implementation head `7c6c7071d027c55aeffbc7279b8ca3765ea26c37`; PR #1/run positiva `29257544214` PASS; merge commit `ae88583dc2cc8ae9d8e869f5ca324c5b3585095e` e post-merge run `29257721274` PASS; [Ruleset `main-required-ci` `18877721`](https://github.com/Emacore17/dnd-ai/rules/18877721) active/strict/no bypass; PR negativa #3/run `29256736728` con `CI / Merge gate=FAILURE` e `mergeStateStatus=BLOCKED`; report `docs/testing/BL-002_VERIFICATION.md`; migration/eval/trace ID `N/A`; docs aggiornati.
- **Note, rischi o bloccanti:** Nessun blocco residuo. La Ruleset richiede una PR e il check `CI / Merge gate` prodotto da GitHub Actions (`integration_id=15368`); la PR negativa è stata chiusa senza merge e la branch rimossa.

### BL-003 — Typed config, secret injection contract, local template

- **Stato:** `DONE`
- **Progresso:** `100%`
- **Esito test:** `PASSING`
- **Contesto verificato:** `YES` — delivery baseline commit: `d530f3a0bab8cc20b8eee9f63ef222e6c4bb19f8`; verified implementation head: `f57141341efe5df0707c77ff8ccef4f6fa15f675`; spec SHA-256: `0b7ce963316cb601c7178340876de1b8932bc63b7c672adb1b37554d3b139f0c`; data: `2026-07-13`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** BL-001
- **Dipendenze operative aggiuntive:** BL-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §5 Assunzioni; `docs/MVP_SPEC.md` §22.10 Segreti e cifratura; `docs/MVP_SPEC.md` §29.3 Ambienti; `docs/MVP_SPEC.md` §31 `BL-003`; `docs/MVP_SPEC.md` §35.1; `docs/adr/0004-runtime-configuration-and-secret-injection.md`
- **Obiettivo:** Come operatore voglio config separata per ambiente.
- **Deliverable:** Typed config ai composition root; contratto provider-agnostic di iniezione dei secret; template locale senza valori sensibili.
- **Criterio di accettazione:** Ogni composition root con chiavi obbligatorie fallisce prima di bind/esecuzione su configurazione mancante o malformata; i profili `local`/`staging`/`production` sono distinti; nessun secret è committato, loggato o incluso negli artifact. Il web statico corrente ha zero chiavi richieste e non riceve `NEXT_PUBLIC_*` o il package server-only.
- **Test obbligatori prima di `DONE`:**
  - [x] Test di accettazione automatizzato: Startup fallisce su config mancante; nessun secret committato.
  - [x] Unit test della typed config per valori validi, mancanti e malformati.
  - [x] Process smoke locale dei runtime/composition root con fixture valida; startup fail-fast ed exit non-zero senza variabili obbligatorie.
  - [x] Contract test del profilo `staging`: chiavi richieste, assenza di fallback `local`/`production`, errori redatti e nessun valore secret nei report. Il primo deploy/smoke reale appartiene a `BL-080`.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/0002-monorepo-package-boundaries.md`; `docs/adr/0004-runtime-configuration-and-secret-injection.md`; `docs/operations/CONFIGURATION.md`; `docs/testing/BL-003_VERIFICATION.md`
- **Evidenze di chiusura:** verified head `f57141341efe5df0707c77ff8ccef4f6fa15f675`; full verify locale exit `0` in `60,4 s`; clean worktree con install frozen forzata exit `0` e `TURBO_FORCE=true pnpm verify` exit `0` in `61,0 s`; unit `17 pass/1 skip host`, integration `8/8`, contract `13/13`, security Windows `9 pass/3 skip host`, security Ubuntu `12/12`; artifact clean `3.554` file e artifact CI Ubuntu `3.233` file; audit `PASS`; [PR #6](https://github.com/Emacore17/dnd-ai/pull/6), [CI `29285998646`](https://github.com/Emacore17/dnd-ai/actions/runs/29285998646) 5/5 job `SUCCESS`; failure path [run `29285442650`](https://github.com/Emacore17/dnd-ai/actions/runs/29285442650) corretto; migration/eval/trace ID `N/A`; docs aggiornati.
- **Note, rischi o bloccanti:** `BL-003` non provisiona un ambiente cloud e non gestisce valori reali. `BL-080` possiede secret manager concreto, primo deploy e smoke preview/staging; `BL-070` possiede hardening, load/chaos, backup restore e go/no-go.

### BL-004 — Tool migration e schema baseline

- **Stato:** `DONE`
- **Progresso:** `100%`
- **Esito test:** `PASSING`
- **Contesto verificato:** `YES` — delivery baseline `c72c78bbae06ebb02c7de7d63844f17065354c06`; verified implementation head `b1030501fd82d0396add5ff4f9df10fbaa405d0b`; verified evidence head `aaa17b2ada8a7bab73e3877f263b2c46c5865c13`; spec SHA-256 `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c`; data: `2026-07-14`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001, BL-003
- **Dipendenze operative aggiuntive:** BL-001, BL-003
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §19.5 Migrazioni e compatibilità; `docs/MVP_SPEC.md` §29.5 Migrazioni zero-downtime; `docs/MVP_SPEC.md` §26.4 Integration test database; `docs/MVP_SPEC.md` §31 `BL-004`; `docs/MVP_SPEC.md` §35.1; `docs/adr/0004-runtime-configuration-and-secret-injection.md`; `docs/adr/0006-postgresql-migration-foundation.md`; `docs/operations/CONFIGURATION.md`; `docs/operations/DATABASE_MIGRATIONS.md`
- **Obiettivo:** Come backend voglio migrations riproducibili.
- **Deliverable:** Tool migration e schema baseline.
- **Criterio di accettazione:** Migrazione da DB vuoto e rollback operativo documentato.
- **Test obbligatori prima di `DONE`:**
  - [x] Test di accettazione automatizzato: Migrazione da DB vuoto e rollback operativo documentato.
  - [x] Migration test da database vuoto all’head e replay su database già aggiornato.
  - [x] Test rollback/forward-fix documentato e verifica vincoli/indici con PostgreSQL reale.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/0006-postgresql-migration-foundation.md`; `docs/operations/CONFIGURATION.md`; `docs/operations/DATABASE_MIGRATIONS.md`; `docs/testing/BL-004_VERIFICATION.md`; `docs/data/DATA_MODEL.md` resta `planned` con owner `DOC-ARCH-001`
- **Evidenze di chiusura:** test mirati: `db:migrate:test` 13/13 e unit/contract/security migration 13/13 `PASS`. Full working-tree `verify` exit `0` in 73,4 s e audit high pulito. Commit `b1030501fd82d0396add5ff4f9df10fbaa405d0b` verificato da worktree pulito: install frozen exit `0` in 0,6 s; full gate senza cache exit `0` in 66,2 s, con lint/build 11/11, typecheck 12/12, unit 47 pass/1 skip host, integration 9/9, database 13/13, contract 22/22, security 23 pass/3 skip host, policy/scan e artifact 3.238 file `PASS`. [PR #18](https://github.com/Emacore17/dnd-ai/pull/18), [CI PR `29351291907`](https://github.com/Emacore17/dnd-ai/actions/runs/29351291907) 5/5 job `SUCCESS`, incluso il job Tests con suite PostgreSQL reale e `CI / Merge gate`; report `docs/testing/BL-004_VERIFICATION.md`; head `000001_postgresql_foundation`; contract `database-baseline-v1`; source SHA `e8543d84b9b842adf352260536dcea284c93dfb859c9ec03368f10deb9455fc7`; checksum `46a2bb9ce2ca6957a3b87e423e0ea67b36688e71ebacc84c469bdb7f7a8dc449`.
- **Note, rischi o bloccanti:** La baseline è deliberatamente infrastrutturale: ledger/versione di compatibilità, namespace applicativo ed estensione PostgreSQL richiesta, senza anticipare tabelle di dominio. `packages/persistence` riceve config validata e non importa `packages/config`; il composition root resta esterno. La suite reale copre file migration sconosciuti/symlink fail-closed, source SHA e checksum contract, database vuoto→head, replay, DDL invalido con rollback e ledger vuoto, due runner simultanei, lock occupato, vincoli/indice, rollback locale e re-apply. `previous→head` è `N/A` per la prima migration: non esiste ancora una versione applicata precedente diversa dal database vuoto; diventa obbligatorio da `000002`. `down` è limitato a URL loopback disposable senza parametri di routing e vietato in staging/production. Fuori scope: tabelle utenti/campagne/eventi/memorie, RLS, repository, backfill, provisioning gestito e harness generale `QA-001`.

### BL-005 — Signup, verify, rate limit

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-003, BL-004, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §20 API; `docs/MVP_SPEC.md` §22.2 Autenticazione; `docs/MVP_SPEC.md` §32 AC-01; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-005`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come utente voglio registrarmi e verificare l’email.
- **Deliverable:** Signup, verify, rate limit.
- **Criterio di accettazione:** Account inattivo fino a verifica; replay token non valido.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Account inattivo fino a verifica; replay token non valido.
  - [ ] Unit e integration test di token/session lifecycle, scadenza, revoca e replay.
  - [ ] API/E2E happy path e negative path; rate-limit e cookie/security headers.
  - [ ] Component/mobile accessibility smoke delle schermate signup e verifica sulla fondazione `BL-079`.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/`; `docs/security/THREAT_MODEL.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-006 — Sessioni, reset, revoca

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-005, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §20 API; `docs/MVP_SPEC.md` §22.2 Autenticazione; `docs/MVP_SPEC.md` §32 AC-01; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-006`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come utente voglio login/logout/reset sicuri.
- **Deliverable:** Sessioni, reset, revoca.
- **Criterio di accettazione:** Cookie sicuri; logout revoca; reset one-time e rate-limited.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Cookie sicuri; logout revoca; reset one-time e rate-limited.
  - [ ] Unit e integration test di token/session lifecycle, scadenza, revoca e replay.
  - [ ] API/E2E happy path e negative path; rate-limit e cookie/security headers.
  - [ ] Component/mobile accessibility smoke di login, logout e reset sulla fondazione `BL-079`.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/`; `docs/security/THREAT_MODEL.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-007 — ActorContext e query tenant-safe

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-004, BL-006
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §20.1 Convenzioni REST; `docs/MVP_SPEC.md` §22.3 Autorizzazione e isolamento campagne; `docs/MVP_SPEC.md` §32 AC-23; `docs/MVP_SPEC.md` §31 `BL-007`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio ownership scoped nei repository.
- **Deliverable:** ActorContext e query tenant-safe.
- **Criterio di accettazione:** IDOR matrix restituisce zero accessi; risorsa altrui 404.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: IDOR matrix restituisce zero accessi; risorsa altrui 404.
  - [ ] Matrice IDOR automatizzata su repository/API/SSE con due utenti e risorse incrociate.
  - [ ] Test che gli errori non rivelino l’esistenza della risorsa altrui.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/`; `docs/security/THREAT_MODEL.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-008 — OTel/log/Sentry baseline

- **Stato:** `DONE`
- **Progresso:** `100%`
- **Esito test:** `PASSING`
- **Contesto verificato:** `YES` — candidate head precedente `b9b707f3ee6bb812114b206cda03530c33e48edb`; spec SHA `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c`; data: `2026-07-15`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001, BL-003
- **Dipendenze operative aggiuntive:** BL-001, BL-003
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §24 Osservabilità; `docs/MVP_SPEC.md` §29.1 Topologia MVP; `docs/MVP_SPEC.md` §31 `BL-008`; `docs/MVP_SPEC.md` §35.1 Definition of Done; `docs/adr/0002-monorepo-package-boundaries.md`; `docs/adr/0004-runtime-configuration-and-secret-injection.md`; `docs/adr/0007-observability-context-and-error-reporting.md`; [`design observability-baseline-v1`](superpowers/specs/2026-07-15-bl-008-observability-baseline-design.md); [`piano TDD`](superpowers/plans/2026-07-15-bl-008-observability-baseline.md)
- **Obiettivo:** Come operatore voglio request e trace ID end-to-end.
- **Deliverable:** OTel/log/Sentry baseline.
- **Criterio di accettazione:** Trace web→API→worker fake; log redaction test pass.
- **Test obbligatori prima di `DONE`:**
  - [x] Test di accettazione automatizzato: Trace web→API→worker fake; log redaction test pass.
  - [x] Integration test web→API→worker fake con propagazione correlation/trace ID.
  - [x] Test di redazione PII/secret nei log e cattura errori Sentry senza payload sensibili.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/0007-observability-context-and-error-reporting.md`; `docs/operations/CONFIGURATION.md`; `docs/operations/CI_CD.md`
- **Evidenze di chiusura:** candidate `b9b707f3ee6bb812114b206cda03530c33e48edb`; review indipendente osservabilità senza P0/P1; suite mirate, full gate e checkout pulito verdi. [PR #20](https://github.com/Emacore17/dnd-ai/pull/20), prima run [`29413088682`](https://github.com/Emacore17/dnd-ai/actions/runs/29413088682) rossa sul solo endpoint audit legacy pnpm 10; correzione TDD con pin pnpm `11.13.0`, policy progetto e comando audit esatto. Full finale exit `0` in `85,1 s`; PR integrata nel merge `ccecd683c12ebfe29f4cc6be78c950ebb01ca288` e run post-merge [`29415397361`](https://github.com/Emacore17/dnd-ai/actions/runs/29415397361) con Quality, Tests, Security, Build artifact e `CI / Merge gate` 5/5 `SUCCESS`. Trace fake `web.request → api.request → queue.enqueue → worker.process`, due flussi concorrenti disgiunti; migration head `000001_postgresql_foundation`; eval `N/A`; trace ID `N/A — fixture runtime non persistita`.
- **Note, rischi o bloccanti:** proposta branch-local terminale in corsia `HIGH_RISK`, senza downgrade del gate o modifica del dependency graph; il lockfile è invariato. Il clean checkout riapre il task se fallisce. Sentry resta off-by-default senza provisioning; nessuna azione Vercel.

### BL-009 — Zod, JSON Schema, OpenAPI generation

- **Stato:** `DONE`
- **Progresso:** `100%`
- **Esito test:** `PASSING`
- **Contesto verificato:** `YES` — baseline `ccecd683c12ebfe29f4cc6be78c950ebb01ca288`; spec SHA `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c`; data: `2026-07-15`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001
- **Dipendenze operative aggiuntive:** BL-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §11.5 Event sourcing pragmatico; `docs/MVP_SPEC.md` §12.6 Schema del turno; `docs/MVP_SPEC.md` §12.8 Schemi separati; `docs/MVP_SPEC.md` §20.1 Convenzioni REST e §20.4 Payload di turno; `docs/MVP_SPEC.md` §29.4 CI/CD; `docs/MVP_SPEC.md` §31 `BL-009`; `docs/MVP_SPEC.md` §35.1; `docs/MVP_SPEC.md` Prime 10 attività di implementazione; `docs/adr/0002-monorepo-package-boundaries.md`; [`design api-contract-v1`](superpowers/specs/2026-07-15-bl-009-contract-generation-design.md); [`piano TDD`](superpowers/plans/2026-07-15-bl-009-contract-generation.md)
- **Obiettivo:** Come client voglio DTO runtime-validati.
- **Deliverable:** Zod, JSON Schema, OpenAPI generation.
- **Criterio di accettazione:** Contract compile e response validation; schema versionato.
- **Test obbligatori prima di `DONE`:**
  - [x] Test di accettazione automatizzato: Contract compile e response validation; schema versionato.
  - [x] Contract test di parse/serialize e validazione runtime per request/response/event schema.
  - [x] Test di compatibilità/versionamento e verifica OpenAPI/JSON Schema generati senza diff non committato.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/0008-zod-first-contract-generation.md`; `docs/api/README.md`; `packages/contracts/generated/v1/`, senza modifica manuale dei file generated
- **Evidenze di chiusura:** preflight su merge `ccecd683` e CI `main` run `29415397361` 5/5 `SUCCESS`; TDD mirato `test:contract` 55/55 e artifact/compatibility/owned-path unit 7/7. La review ha trovato quattro P1 reali, chiusi con UUIDv7, literal v1, baseline Git offline e guard symlink/junction; il re-check indipendente non ha trovato P0/P1 residui. Full `TURBO_FORCE=true corepack pnpm@11.13.0 verify` exit `0` in 86,8 s: lint/build 11/11, typecheck 13/13, unit 84 pass/1 skip host, integration 13/13, database 13/13, contract 56/56, security 26 pass/3 skip host, document policy 31 documenti/11 modificati e artifact 3.942 file `PASS`. Migration/eval/trace ID `N/A — task di contratto senza DB, AI o runtime trace`.
- **Note, rischi o bloccanti:** proposta branch-local terminale in corsia `HIGH_RISK` per dependency graph, contratto pubblico generato e workflow CI. Il primo full ha rilevato che Prettier tentava di ri-formattare artifact canonici; il secondo che lo script annidato risolveva pnpm globale `10.21` invece del pin `11.13.0`. Due regressioni contrattuali ora assegnano al generator l'ownership del formato e invocano direttamente il checker dopo la build; il terzo full passa. Scope: runtime DTO strict con UUIDv7/version gate per API, SSE lifecycle, GameEvent, risultato turno AI e tool envelope allowlisted; JSON Schema Draft 2020-12, OpenAPI 3.1.1 components-only, drift check, freeze offline dei major pubblicati e root guard symlink/junction. Clean checkout e CI protetta riaprono il task se falliscono; fuori scope route Fastify, auth/idempotenza applicativa, catalogo SSE/tool completo, Campaign Bible e cataloghi completi, UI, database, provider e Vercel.

### BL-010 — Flag store/config auditato

- **Stato:** `DONE`
- **Progresso:** `100%`
- **Esito test:** `PASSING`
- **Contesto verificato:** `YES` — baseline `8e6e0d3d46daa057ba80999c58c83ad1c92471b1`; branch `codex/bl-010-feature-flags`; spec SHA-256 `d07620bb477a50bf8309c6c24729baaaa45a4a29499e624741a5fcdaa514a329`; data: `2026-07-15`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-003, BL-004, BL-008
- **Dipendenze operative aggiuntive:** BL-003, BL-004, BL-008
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §22.16 Incident response; `docs/MVP_SPEC.md` §23.2 Backpressure e degradazione; `docs/MVP_SPEC.md` §27.5 Versionamento prompt/schema/model route; `docs/MVP_SPEC.md` §28.6 Budget enforcement; `docs/MVP_SPEC.md` §29.6 Scaling; `docs/MVP_SPEC.md` §29.8 Operatività; `docs/MVP_SPEC.md` §31 `BL-010`; `docs/MVP_SPEC.md` §35.1; `docs/adr/0004-runtime-configuration-and-secret-injection.md`; `docs/adr/0006-postgresql-migration-foundation.md`; `docs/adr/0007-observability-context-and-error-reporting.md`; `docs/operations/CONFIGURATION.md`
- **Obiettivo:** Come operatore voglio feature flag e kill switch server-side.
- **Deliverable:** Flag store/config auditato.
- **Criterio di accettazione:** Disabilita start/turn/model route senza deploy; audit event.
- **Test obbligatori prima di `DONE`:**
  - [x] Test di accettazione automatizzato: Disabilita start/turn/model route senza deploy; audit event.
  - [x] Integration test di ogni kill switch senza deploy e con audit event.
  - [x] Test fail-safe: flag store indisponibile usa il default sicuro documentato.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/operations/CONFIGURATION.md`; `docs/operations/DATABASE_MIGRATIONS.md`; `docs/superpowers/specs/2026-07-15-bl-010-feature-flags-design.md`; `docs/superpowers/plans/2026-07-15-bl-010-feature-flags.md`
- **Evidenze di chiusura:** mirati branch-local: `corepack pnpm@11.13.0 tasks:check` exit `0`; `corepack pnpm@11.13.0 test:unit` exit `0` con 88 pass/1 host skip dopo regressione malformed state; `node --test tests/database/feature-flags.test.mjs` exit `0` con 2/2 dopo regressione replay idempotente post-toggle; `corepack pnpm@11.13.0 db:migrate:test` exit `0` con 15/15; `node --test tests/security/feature-flags-security.test.mjs` exit `0` con 4/4; `corepack pnpm@11.13.0 verify:docs` exit `0` con 33 documenti/10 modificati, task graph e secret scan `PASS`. Full `TURBO_FORCE=true corepack pnpm@11.13.0 verify` exit `0` sul candidato BL-010; commit/PR/CI `pending` per delivery derivata; migration head `000002_feature_flags`; eval/trace ID `N/A`.
- **Note, rischi o bloccanti:** Corsia `HIGH_RISK`: persistence/migration, config operativa e kill switch di sicurezza. Scope approvato dal Product Owner il 2026-07-15: PostgreSQL shared/durable store, CLI server-side, catalogo chiuso, default fail-closed, audit atomico, CAS e idempotenza; nessun endpoint admin pubblico, nessun deploy e nessuna azione Vercel. Tre tentativi di review subagent sono stati interrotti per timeout senza output utile; il pass manuale P0/P1 ha individuato e corretto la semantica di replay idempotente, ora coperta da test PostgreSQL reale.

### BL-079 — Fondazione design system e shell conversazionale mobile-first

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001, BL-002, BL-080
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §§8, 11.4, 21, 23.1, 26.8, 32.2; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-079`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore casual voglio un’interfaccia semplice, premium e comoda sul telefono, così posso leggere, decidere e agire senza una HUD densa.
- **Deliverable:** shadcn/ui `new-york` su Radix; `components.json`; token semantici; font/icon/touch-target contract; primitive AI Elements selettive; wrapper `GameConversation`, `NarrativeTurn`, `FreeActionComposer` e `GameDrawer`; Motion lazy/reduced; shell fixture mobile e desktop adattiva; decisione performance-gated su Rive.
- **Criterio di accettazione:** Il core shell funziona a 320 px ed è ottimizzato a 360–430 px; desktop amplia senza funzioni esclusive; composer, safe area, tastiera virtuale, due suggested actions, drawer HUD e stati idle/loading/error/reconnect sono verificati; keyboard/WCAG 2.2 AA, target touch, reduced-motion, visual regression e performance smoke passano.
- **Test obbligatori prima di `DONE`:**
  - [ ] Component test di token e wrapper per idle, loading, long content, error, reconnect e completed.
  - [ ] E2E a 320, 360, 390, 768, 1024 e 1440 px; portrait/landscape, tastiera virtuale e safe area senza CTA coperte o overflow orizzontale.
  - [ ] Keyboard-only, screen reader smoke, accessibility scan WCAG 2.2 AA e target frequenti ≥44×44 CSS px / primari ≥48 px.
  - [ ] Reduced-motion mantiene contenuto, focus order e azioni; motion layer usa transform/opacity nei percorsi frequenti.
  - [ ] Bundle/performance trace documenta Motion lazy; Rive è assente dal bundle iniziale e viene adottato solo se supera il gate, altrimenti rimosso.
  - [ ] Visual regression delle shell P0 e review “five-second comprehension” con finding tracciati.
  - [ ] Smoke della shell su preview/staging fornita da `BL-080` senza dipendenza inversa.
- **Documentazione e contesto:** `docs/product/UX_UI_DESIGN.md`, `docs/adr/0001-mobile-first-conversational-ui.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, `docs/testing/TEST_STRATEGY.md` quando creato
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report visual/a11y/performance `—`; component inventory/versioni `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** Non installare tutte le registry AI Elements; non introdurre `useChat` o un trasporto parallelo; Rive è opzionale e non può bloccare la shell. `BL-079` possiede il setup browser/component minimo necessario ai propri test e consuma lo staging dopo `BL-080`; `QA-001` consolida il harness comune senza diventare una dipendenza circolare.

### BL-080 — Fondazione preview/staging M0

- **Stato:** `BLOCKED`
- **Progresso:** `50%`
- **Esito test:** `PARTIAL`
- **Contesto verificato:** `YES` — [PR #16](https://github.com/Emacore17/dnd-ai/pull/16) ha integrato il freeze manuale nel merge `aa9342daa63a93c6b8ff4d00963ed2ac6a6a9c9d`; CI PR `29343319207` e post-merge `29343526054` sono 5/5 verdi e non hanno creato deployment Vercel. Il readback project-scoped di `dnd-ai-web` resta a zero deployment/alias. L'audit del tag Vercel CLI `55.0.0`, risolto al commit immutabile `11f0cebacce81dfb713b3cb2d4622e49da0fb475`, mostra che il parser conserva `preview`, ma `@vercel/client 17.6.4` lo imposta a `undefined` prima della POST; la regola Vercel documentata sul primo deployment e l'issue aperta `vercel/vercel#17069` costituiscono l'ipotesi più forte per i record Production, senza ancora offrire conferma/fix/workaround supportato dal maintainer. Spec SHA `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c`; data: `2026-07-14`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-002, BL-003
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §§29.3–29.4, §30 Milestone 0, §31 `BL-080`, §35.1; `docs/adr/0003-ci-trust-boundary-and-artifacts.md`; `docs/adr/0004-runtime-configuration-and-secret-injection.md`; `docs/adr/0005-vercel-web-preview-and-staging.md`; `docs/operations/CI_CD.md`; `docs/operations/CONFIGURATION.md`; `docs/operations/PREVIEW_STAGING.md`; `docs/architecture/SYSTEM_OVERVIEW.md`
- **Obiettivo:** Come team voglio una preview/staging M0 isolata e riproducibile, così ogni slice deployabile può essere validata prima di diventare `DONE`.
- **Deliverable:** scelta provider e regione registrata; provisioning ripetibile; ambiente GitHub protetto; config e secret separati; deploy automatico dei runtime M0 disponibili; URL e owner redatti; smoke, rollback e runbook minimo. Preview di PR e staging possono essere risorse distinte, ma non condividono dati o credenziali production.
- **Criterio di accettazione:** Un commit autorizzato produce un deploy identificabile e ripetibile; la baseline web e gli health check dei runtime disponibili superano smoke automatizzato; un deploy fallito non viene promosso; rollback o redeploy dell'ultima versione valida è documentato e provato; nessun secret o dato production entra in log, artifact o fixture.
- **Test obbligatori prima di `DONE`:**
  - [x] Contract test del workflow/desired state: environment, least privilege, concurrency, failure propagation e identità commit/deployment immutabile.
  - [ ] Deploy smoke su preview/staging con URL, commit, regione, environment e request/run ID redatti.
  - [x] Negative test locale per metadata/config/OIDC mancante, origin/identity non validi, timeout e body non limitato. Il secret applicativo indisponibile è `N/A` per il web corrente, che ha zero secret per contratto.
  - [x] Guard build fail-closed verificato per local, Preview, Production, metadata mancanti/incoerenti e output redatto; il build Vercel usa l'entrypoint dedicato per contratto. La prova provider resta separata e aperta.
  - [x] Payload CLI verificato prima dell'upload: `.vercelignore` root-only, dry-run JSON bounded, input obbligatori, mode/hash, path e budget fail-closed; la prova provider reale resta separata e aperta.
  - [ ] Deploy remoto fallito senza action `ready`, smoke o promozione Production.
  - [ ] Rollback o redeploy provato; baseline web corrente e health check dei runtime disponibili verificati. Lo smoke della shell mobile resta un gate di `BL-079` dopo la disponibilità dell'ambiente.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/operations/CI_CD.md`; `docs/operations/CONFIGURATION.md`; `docs/operations/PREVIEW_STAGING.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/0004-runtime-configuration-and-secret-injection.md`; `docs/adr/0005-vercel-web-preview-and-staging.md`; `docs/testing/BL-080_VERIFICATION.md`
- **Evidenze di chiusura:** foundation `50efcbe620ad7c1fc6eb3cf1b79cdb27b0c383af`/PR #7; hardening `1766406b9bd701a9880705b371fdc0b05a73abe1`/PR #10; attivazione `7335053c59838cf3b581d7f09645450372aa0429`/PR #12; contenimento PR #13; guard PR #14; payload policy `13032743552654f9f68d87050eb11cabbdd92325`/PR #15; freeze `1cb655abee8a55b6974d90ae20b4244b12ba1192`, evidence sync `e5dff7bf371bd91321587fecadbd8f51264cc263`, [PR #16](https://github.com/Emacore17/dnd-ai/pull/16), CI `29343319207`/`29343526054` 5/5 `SUCCESS`, merge `aa9342daa63a93c6b8ff4d00963ed2ac6a6a9c9d`. Nessun deployment Vercel è stato creato da PR #16 o dal merge; progetto ancora a zero deployment/alias. Audit sorgente e riferimenti provider in `docs/testing/BL-080_VERIFICATION.md`.
- **Note, rischi o bloccanti:** fatti osservati: Vercel CLI `55.0.0` passa `preview` internamente, `@vercel/client 17.6.4` omette il campo prima della POST e il provider ha restituito record Production. L'applicazione server della regola first-deployment documentata è l'ipotesi più forte, coerente con `vercel/vercel#17069`, ma non è confermata dal maintainer. Blocco concreto: sul progetto con zero deployment non esiste oggi un percorso first-deployment Preview-only supportato e verificato compatibile con il divieto Product Owner di Production; smoke, failure e redeploy restano impossibili. Condizione di sblocco: fix o workaround ufficiale/provider-confirmed, senza upgrade/cambio account/Production, seguito da PR separata, containment testato e Preview reale. Il contenimento mantiene `source.autoDeploy=false`, `git.deploymentEnabled=false`, binding `null`, guard Preview-only, payload policy, dry-run bounded e `source.manualDeployment.enabled=false`. Sono consentiti soltanto dry-run, readback e contenimento per ID/URL esatto; nessun deploy, retry, redeploy, riattivazione Git, promozione o Production è autorizzato. L'installazione condivisa resta invariata per decisione PO. `BL-079` resta `BACKLOG`.

### GOV-002 — Validazione automatica della documentazione e tracciabilità

- **Stato:** `IN_PROGRESS`
- **Progresso:** `25%`
- **Esito test:** `PARTIAL`
- **Contesto verificato:** `YES` — base `15382d547638333e33992be96479a6f0cbff1a29`; spec SHA-256 `d07620bb477a50bf8309c6c24729baaaa45a4a29499e624741a5fcdaa514a329`; data: `2026-07-15`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** GOV-001, BL-001, BL-002, BL-009
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §26.12, §32.3, §35.1; `docs/TASKS.md` §6
- **Obiettivo:** Impedire che riferimenti, contratti e contesto diventino obsoleti o non verificabili.
- **Deliverable:** Consolidamento di `docs/TRACEABILITY.md` e `docs/CHANGELOG.md`; `docs/adr/README.md`; comando `pnpm docs:check` per front matter, link, task ID, section refs, Mermaid e generated-doc drift.
- **Criterio di accettazione:** La CI blocca link rotti, task ID duplicati, documento senza metadata obbligatori, riferimento a test inesistente e diff non rigenerato di OpenAPI/JSON Schema.
- **Test obbligatori prima di `DONE`:**
  - [ ] Fixture con link rotto, duplicate task ID e front matter mancante deve far fallire `docs:check`.
  - [ ] Fixture valida deve passare in locale e CI con output deterministico.
  - [ ] Verificare almeno un mapping requisito→task→test→evidenza in `docs/TRACEABILITY.md`.
- **Documentazione e contesto:** `docs/TRACEABILITY.md`, `docs/CHANGELOG.md`, `docs/adr/README.md`, `docs/README.md`, CI docs
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** Corsia `HIGH_RISK` per dependency graph/lockfile e workflow CI. Design approvato: policy modulare per anchor e riferimenti `§`, registro ADR completo, Mermaid `11.16.0` parse-only in worker bounded e composizione dei checker contratti/task esistenti in `docs:check`. `GOV-003` continua a possedere front matter, freshness, path/ref/link base, whitespace e task graph; `BL-009` continua a possedere il generator/drift dei contratti. Fuori scope Vercel, deploy, provider, rendering SVG e modifica dei contratti applicativi.

### GOV-003 — Ottimizzazione del ciclo di sviluppo degli agenti

- **Stato:** `DONE`
- **Progresso:** `100%`
- **Esito test:** `PASSING`
- **Contesto verificato:** `YES` — base `6e87034824abeafa76c1da19cba5db81111195f2`; spec SHA-256 `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c`; data: `2026-07-14`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GOV-001, BL-002
- **Riferimenti obbligatori:** `AGENTS.md` §§2, 5, 6, 12, 16, 18; `docs/TASKS.md` §§3–6; `docs/CONTEXT.md`; metriche Git/PR/Actions dei task BL-003, BL-080 e BL-004
- **Obiettivo:** Ridurre drasticamente il tempo ciclo dell’agente eliminando letture, documentazione, review e gate duplicati senza indebolire sicurezza o qualità.
- **Deliverable:** cold-start proporzionata; corsie `FAST`/`STANDARD`/`HIGH_RISK`; timebox per feasibility esterna; una sola review e un solo candidato/PR; divieto di evidence-only commit; `docs:check`/`verify:docs` reali e selezione comportamentale `verify:affected`; baseline e target misurabili.
- **Criterio di accettazione:** Un task standard arriva al merge gate con documentazione già consolidata e senza commit di chiusura post-CI; un task docs-only non richiede il full gate locale; un task high-risk conserva failure path e full gate finale; una continuazione non ripete la cold start. Sul campione dei cinque task successivi: mediana `≤1` PR/task, `0` commit di sola evidenza, commit docs-only `≤10%`, al massimo una run correttiva per P0/P1 e target candidato dei task `S` pari a `15/60/120` minuti per `FAST/STANDARD/HIGH_RISK`, escluse attese esterne dichiarate.
- **Test obbligatori prima di `DONE`:**
  - [x] Contract test di corsie, budget e comandi rapidi.
  - [x] `verify:docs` e `verify:affected` eseguiti con exit `0` sul change set.
  - [x] Full `verify` unico sul candidato finale perché il task modifica il workflow globale.
  - [x] Audit indipendente senza P0/P1 e task graph coerente.
- **Documentazione e contesto:** `AGENTS.md`; `docs/TASKS.md`; `docs/CONTEXT.md`; `docs/CHANGELOG.md`
- **Evidenze di chiusura:** audit baseline: BL-003/BL-080/BL-004 hanno 17 commit documentali su 28 (60,7%); BL-080 ha usato 11 PR, 23 CI e 115 job in 8h07m51s, con sole 28m46s di PR aperte. Candidate in 43 minuti; `verify:docs` exit `0` in 2,65 s; `verify:affected` finale exit `0` in 6,96 s; unico `TURBO_FORCE=true corepack pnpm@10.34.5 verify` exit `0` in 72,70 s: lint/build 11/11, typecheck 12/12, unit 55 pass/1 skip host, integration 9/9, database 13/13, contract 26/26, security 23 pass/3 skip host, policy/scan/docs e artifact 3.238 file `PASS`. Re-review finale: nessun P0/P1.
- **Note, rischi o bloccanti:** Nessun blocco residuo. CI completa e Ruleset restano invariate; `HIGH_RISK` resta fail-closed. I target saranno ricalcolati da Git/PR/Actions dopo i prossimi cinque task; un mancato target genera un task `GOV`/`BUG`, non un bypass. Nessuna operazione Vercel è stata eseguita.

### QA-001 — Fondazione comune per test, fixture e comandi di qualità

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001, BL-002, BL-003, BL-004, BL-009
- **Dipendenze operative aggiuntive:** GOV-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §26 Strategia di testing; `docs/MVP_SPEC.md` §35 Definition of Done
- **Obiettivo:** Rendere eseguibili in modo uniforme unit, integration, contract, E2E, security ed eval fin dalle prime feature.
- **Deliverable:** Test runner e command contract; Testcontainers/PostgreSQL/Redis; factory deterministic; fake clock/RNG; fixture builder; browser/device matrix, accessibility e visual regression harness per UI; report JUnit/coverage; convenzione test ID collegata ai task.
- **Criterio di accettazione:** Da checkout pulito i comandi standard partono, isolano dati e producono report; una fixture failing blocca la CI e una retry non rende flaky il risultato.
- **Test obbligatori prima di `DONE`:**
  - [ ] Self-test red/green del runner e isolamento tra due test process.
  - [ ] Integration smoke su PostgreSQL e Redis reali/containers.
  - [ ] Verifica seed/fake clock/RNG riproducibili e report associabile a un task ID.
  - [ ] Smoke del browser harness su viewport 320/390/1440, reduced-motion e accessibility scan con artifact deterministico.
- **Documentazione e contesto:** `docs/testing/TEST_STRATEGY.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** Consolida e rende comune il setup browser/component minimo creato da `BL-079`; non ne blocca l’esecuzione e non duplica fixture di feature già verificate.

### DOC-ARCH-001 — Documentazione architetturale, dati e sviluppo locale

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** GOV-002, BL-001, BL-003, BL-004, BL-008, BL-009, BL-010
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §11, §19, §24, §29; `docs/MVP_SPEC.md` decisioni architetturali
- **Obiettivo:** Tradurre la specifica in documenti living che descrivano il sistema realmente implementato.
- **Deliverable:** `docs/architecture/SYSTEM_OVERVIEW.md`, `docs/data/DATA_MODEL.md`, guida local setup, diagrammi, ADR per modular monolith/Fastify/REST+SSE/PostgreSQL+pgvector/BullMQ/event sourcing.
- **Criterio di accettazione:** Diagrammi, package boundaries, topologia, migration head, comandi local/staging e decisioni coincidono con codice/IaC; ogni divergenza dalla spec ha ADR e aggiornamento della spec.
- **Test obbligatori prima di `DONE`:**
  - [ ] `pnpm docs:check` passa e i diagrammi Mermaid sono renderizzabili.
  - [ ] Cold-start setup seguito da ambiente pulito porta a health check verdi.
  - [ ] Controllo automatico o review registrata dei code path citati.
- **Documentazione e contesto:** Tutti i deliverable del task; aggiornare `docs/CONTEXT.md` e registro ADR
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### GATE-M0 — Exit gate Milestone 0 — Fondamenta

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GOV-001, GOV-002, QA-001, DOC-ARCH-001, BL-001..BL-010, BL-079, BL-080
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §30 Milestone 0; `docs/MVP_SPEC.md` §35.3
- **Obiettivo:** Validare in modo integrato tutti i deliverable di M0 prima di autorizzare il lavoro della milestone successiva.
- **Deliverable:** Report di exit gate M0, demo riproducibile, evidenze e aggiornamento della dashboard.
- **Criterio di accettazione:** Utente test signup/login; API protetta; migration da zero; staging deploy automatico; trace web→API→worker fake; nessun secret nel repository; shell mobile-first e fondazione UX/UI superano gate accessibility/performance.
- **Test obbligatori prima di `DONE`:**
  - [ ] Eseguire la suite M0 da checkout pulito e in staging.
  - [ ] Verificare security/config/secret scan e smoke end-to-end.
  - [ ] Aggiornare CONTEXT, TRACEABILITY, ADR e release evidence M0.
- **Documentazione e contesto:** `docs/TASKS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, documenti della milestone, release evidence progressiva
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

## 10. M1 — Character Builder

Costruire il party valido e rendere la creazione riproducibile, accessibile e documentata.

### BL-011 — Ascendenze, classi, background, ability, item base

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-009
- **Dipendenze operative aggiuntive:** GATE-M0
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §6.1 Creazione; `docs/MVP_SPEC.md` §14.2–14.15 Rules Engine; `docs/MVP_SPEC.md` §19 Modello dati; `docs/MVP_SPEC.md` §31 `BL-011`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come designer voglio cataloghi originali versionati.
- **Deliverable:** Ascendenze, classi, background, ability, item base.
- **Criterio di accettazione:** Nessun contenuto proprietario; schema/catalog validation pass.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Nessun contenuto proprietario; schema/catalog validation pass.
  - [ ] Schema validation e golden test dei cataloghi; ID univoci e riferimenti risolti.
  - [ ] Review/licensing checklist automatizzabile: nessun contenuto o marchio proprietario non autorizzato.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CHARACTER_CREATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-012 — Step builder con preview

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-011, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §8 Esperienza utente; `docs/MVP_SPEC.md` §21.2 Schermate; `docs/MVP_SPEC.md` §14.2–14.3 Attributi e abilità; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-012`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio scegliere identità e classe.
- **Deliverable:** Step builder con preview.
- **Criterio di accettazione:** Solo opzioni catalogo; keyboard/accessibility smoke.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Solo opzioni catalogo; keyboard/accessibility smoke.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] E2E mobile 320/360/390 px con touch target, tastiera virtuale, autosave e nessuna CTA coperta.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CHARACTER_CREATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-013 — Point allocation/array standard

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-011, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §14.2 Attributi e modificatori; `docs/MVP_SPEC.md` §21.2 Schermate; `docs/MVP_SPEC.md` §32 AC-02; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-013`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio allocare attributi validi.
- **Deliverable:** Point allocation/array standard.
- **Criterio di accettazione:** Budget invariabile; score 8–16; server ricalcola.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Budget invariabile; score 8–16; server ricalcola.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CHARACTER_CREATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-014 — Requisiti e kit iniziali

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-011, BL-013, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §14.3 Abilità; `docs/MVP_SPEC.md` §14.13 Inventario ed equipaggiamento; `docs/MVP_SPEC.md` §21.2 Schermate; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-014`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio scegliere abilità ed equip.
- **Deliverable:** Requisiti e kit iniziali.
- **Criterio di accettazione:** Nessuna scelta oltre slot; equip compatibile e atomico.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Nessuna scelta oltre slot; equip compatibile e atomico.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CHARACTER_CREATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-015 — Character aggregate e stats derived

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-004, BL-011
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §18.2 Compagni; `docs/MVP_SPEC.md` §19.2 Entità relazionali; `docs/MVP_SPEC.md` §32 AC-02; `docs/MVP_SPEC.md` §31 `BL-015`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio persistere un protagonista valido.
- **Deliverable:** Character aggregate e stats derived.
- **Criterio di accettazione:** Un solo player/campaign; checksum rules version.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Un solo player/campaign; checksum rules version.
  - [ ] Domain unit test delle invarianti aggregate e stats derivate.
  - [ ] Integration test PostgreSQL di vincoli, ownership, transazione e reload.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CHARACTER_CREATION.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-016 — Template, tactical role, adult flag

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-015, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §6.1 Creazione; `docs/MVP_SPEC.md` §18.2 Compagni; `docs/MVP_SPEC.md` §32 AC-03; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-016`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio creare fino a due compagni.
- **Deliverable:** Template, tactical role, adult flag.
- **Criterio di accettazione:** 0–2; terzo rifiutato; build semplificata valida.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: 0–2; terzo rifiutato; build semplificata valida.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CHARACTER_CREATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-017 — Autosave step e conflict handling

- **Stato:** `DEFERRED`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P1` / `M`
- **Dipendenze:** BL-012–BL-016, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §8.3 Stati UX del turno; `docs/MVP_SPEC.md` §21.2 Schermate; `docs/MVP_SPEC.md` §23 Requisiti non funzionali; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-017`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio riprendere il draft.
- **Deliverable:** Autosave step e conflict handling.
- **Criterio di accettazione:** Refresh conserva; stale update non sovrascrive.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Refresh conserva; stale update non sovrascrive.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CHARACTER_CREATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### DOC-CHAR-001 — Guida completa alla creazione di personaggio e compagni

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-011, BL-012, BL-013, BL-014, BL-015, BL-016
- **Dipendenze operative aggiuntive:** GOV-002
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §6.1, §14.2–14.3, §18.2, §21.2; `docs/MVP_SPEC.md` AC-02/AC-03
- **Obiettivo:** Fornire all’agente, al team e al QA un riferimento unico per cataloghi, formule, validazioni, API e UX del Character Builder.
- **Deliverable:** `docs/features/CHARACTER_CREATION.md` con flow, modelli, formule, invarianti, catalog versioning, esempi JSON, errori, accessibilità, test matrix e migration compatibility.
- **Criterio di accettazione:** Ogni scelta UI/API è riconducibile a una regola; esempi validi passano gli schema e quelli invalidi sono rifiutati; nessuna logica canonica è duplicata solo nel client.
- **Test obbligatori prima di `DONE`:**
  - [ ] Validare automaticamente tutti gli esempi JSON/TypeScript compilabili.
  - [ ] `docs:check` e link/code-reference check passano.
  - [ ] Review incrociata contro catalog schema, API e test AC-02/AC-03.
- **Documentazione e contesto:** `docs/features/CHARACTER_CREATION.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### GATE-M1 — Exit gate Milestone 1 — Character Builder

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GATE-M0, BL-011..BL-016, DOC-CHAR-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §30 Milestone 1; `docs/MVP_SPEC.md` AC-02/AC-03
- **Obiettivo:** Validare in modo integrato tutti i deliverable di M1 prima di autorizzare il lavoro della milestone successiva.
- **Deliverable:** Report di exit gate M1, demo riproducibile, evidenze e aggiornamento della dashboard.
- **Criterio di accettazione:** Build invalide rifiutate client/server; un protagonista; massimo due compagni; stats derivate riproducibili; reload conserva il draft dove incluso; E2E keyboard pass.
- **Test obbligatori prima di `DONE`:**
  - [ ] E2E completo character+companions in staging.
  - [ ] Domain/property/DB constraint suite e accessibility scan.
  - [ ] Verificare docs/esempi e traceability AC-02/03.
- **Documentazione e contesto:** `docs/TASKS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, documenti della milestone, release evidence progressiva
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

## 11. M2 — Campaign Generator

Generare una campagna canonica partendo dal setup, con moderation, validation, seed transaction e prologo.

### BL-018 — Aggregate campaign/settings status draft

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** BL-015
- **Dipendenze operative aggiuntive:** GATE-M1
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §16 Campaign Bible; `docs/MVP_SPEC.md` §19.2 Entità relazionali; `docs/MVP_SPEC.md` §20.3 Payload di creazione campagna; `docs/MVP_SPEC.md` §31 `BL-018`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio creare un draft campagna.
- **Deliverable:** Aggregate campaign/settings status draft.
- **Criterio di accettazione:** Draft owner-only, stateVersion 1, validazione readiness.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Draft owner-only, stateVersion 1, validazione readiness.
  - [ ] Domain unit test delle invarianti aggregate e stats derivate.
  - [ ] Integration test PostgreSQL di vincoli, ownership, transazione e reload.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-019 — Form brief/tone/difficulty/duration/romance

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-018, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §5 Assunzioni A-05/A-06/A-19; `docs/MVP_SPEC.md` §20.3 Payload di creazione campagna; `docs/MVP_SPEC.md` §21.2 Schermate; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-019`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio descrivere il mondo e il tono.
- **Deliverable:** Form brief/tone/difficulty/duration/romance.
- **Criterio di accettazione:** Limiti 1.500 caratteri; enum e content preferences persistiti.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Limiti 1.500 caratteri; enum e content preferences persistiti.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] E2E mobile 320/360/390 px con tastiera virtuale, content preference comprensibili e form a singola colonna.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-020 — Input moderation e policy result

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-019
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §22.13 Moderazione pipeline; `docs/MVP_SPEC.md` §22.14 Matrice contenuti; `docs/MVP_SPEC.md` §32 AC-22; `docs/MVP_SPEC.md` §31 `BL-020`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio moderare il world brief.
- **Deliverable:** Input moderation e policy result.
- **Criterio di accettazione:** Block/allow/transform persistiti; contenuto bloccato non entra nel prompt.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Block/allow/transform persistiti; contenuto bloccato non entra nel prompt.
  - [ ] Safety integration test allow/block/transform e persistence di policy/version/result.
  - [ ] Prompt boundary test: il contenuto bloccato non raggiunge il provider.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`; `docs/security/MODERATION_POLICY.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-021 — Interface, adapter error/usage normalization, fake

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-009
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.2 Provider adapter; `docs/MVP_SPEC.md` §12.4 Routing dei modelli; `docs/MVP_SPEC.md` §35.2 Definition of Done per componente AI; `docs/MVP_SPEC.md` §31 `BL-021`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come backend voglio un AIProvider sostituibile.
- **Deliverable:** Interface, adapter error/usage normalization, fake.
- **Criterio di accettazione:** Domain non importa SDK; contract test su due adapter fake.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Domain non importa SDK; contract test su due adapter fake.
  - [ ] Contract test condiviso su FakeAIProvider e almeno un adapter; il dominio non importa SDK.
  - [ ] Fixture success, timeout, retryable error, terminal error, invalid schema e usage mancante.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-022 — Zod/JSON Schema e predicate DSL

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-009, BL-011
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.8 Campaign Bible generation; `docs/MVP_SPEC.md` §16.1 Schema; `docs/MVP_SPEC.md` §17.5 Gate del finale; `docs/MVP_SPEC.md` §31 `BL-022`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio uno schema Bible completo.
- **Deliverable:** Zod/JSON Schema e predicate DSL.
- **Criterio di accettazione:** Tutti i riferimenti tipizzati; cardinality/turn budget checks.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Tutti i riferimenti tipizzati; cardinality/turn budget checks.
  - [ ] Schema/DSL unit test con casi validi e invalidi, cardinalità, riferimenti e turn budget.
  - [ ] Property/fuzz test del parser dei predicate senza esecuzione arbitraria.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`; schema/OpenAPI/eventi generati, senza modifica manuale dei file generated
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-023 — Structured Bible generation

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-020–BL-022
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.2 Provider adapter; `docs/MVP_SPEC.md` §16.2 Generazione iniziale; `docs/MVP_SPEC.md` §28 Costi AI; `docs/MVP_SPEC.md` §31 `BL-023`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio una campagna generata dal setup.
- **Deliverable:** Structured Bible generation.
- **Criterio di accettazione:** Output conforme o repair; usage/costo registrati.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Output conforme o repair; usage/costo registrati.
  - [ ] Recorded/fake provider integration test per success, repair e fallback.
  - [ ] Eval su varietà/coerenza e verifica usage/costo/tracing per ogni chiamata.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-024 — Semantic graph validator

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-022, BL-023
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §16.3 Validazione semantica; `docs/MVP_SPEC.md` §17 Progressione narrativa e finali; `docs/MVP_SPEC.md` §27 AI Evaluation Suite; `docs/MVP_SPEC.md` §31 `BL-024`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio validare raggiungibilità e sicurezza.
- **Deliverable:** Semantic graph validator.
- **Criterio di accettazione:** Ending/revelation/act path; orphan reference zero.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Ending/revelation/act path; orphan reference zero.
  - [ ] Graph validator test per path valido e fixture con orphan, ciclo irraggiungibile, ending impossibile e reveal non collegata.
  - [ ] Property test che ogni ending seed abbia almeno un percorso soddisfacibile.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-025 — Persist Bible, NPC, location, quest, clocks, scene

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-024
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §11.5 Event sourcing pragmatico; `docs/MVP_SPEC.md` §16.2 Generazione iniziale; `docs/MVP_SPEC.md` §19 Modello dati; `docs/MVP_SPEC.md` §31 `BL-025`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio seed canonici atomici.
- **Deliverable:** Persist Bible, NPC, location, quest, clocks, scene.
- **Criterio di accettazione:** Retry non duplica; transaction all-or-nothing.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Retry non duplica; transaction all-or-nothing.
  - [ ] Integration test transazionale all-or-nothing con fault injection a ogni fase.
  - [ ] Retry/concurrency test: stessi seed/correlation non creano duplicati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-026 — Generate from validated IDs/state

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-025
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §9 Game loop; `docs/MVP_SPEC.md` §16 Campaign Bible; `docs/MVP_SPEC.md` §21 Interfaccia utente; `docs/MVP_SPEC.md` §32 AC-06; `docs/MVP_SPEC.md` §31 `BL-026`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio un prologo coerente.
- **Deliverable:** Generate from validated IDs/state.
- **Criterio di accettazione:** Nessun ID inventato; prima decisione disponibile; moderated.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Nessun ID inventato; prima decisione disponibile; moderated.
  - [ ] Contract/eval con prologo vincolato a ID canonici, location iniziale e prima decisione.
  - [ ] Moderation output test: output bloccato non diventa scena canonica.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-027 — Generation state, SSE/poll, error UI

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-023–BL-026, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §8.3 Stati UX del turno; `docs/MVP_SPEC.md` §20.5 Status e retry; `docs/MVP_SPEC.md` §20.6 Eventi SSE; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-027`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio progress e retry sicuro.
- **Deliverable:** Generation state, SSE/poll, error UI.
- **Criterio di accettazione:** Step reali; failed precommit retry; no duplicate campaign start.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Step reali; failed precommit retry; no duplicate campaign start.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] E2E mobile con progress reale, reconnect, reduced-motion e nessun salto di layout o CTA coperta.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/CAMPAIGN_GENERATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### DOC-CAMP-001 — Guida alla configurazione, Campaign Bible e prologo

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-018, BL-019, BL-020, BL-021, BL-022, BL-023, BL-024, BL-025, BL-026, BL-027
- **Dipendenze operative aggiuntive:** GOV-002
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12, §16, §20.3, §22.13; `docs/MVP_SPEC.md` AC-04–AC-06
- **Obiettivo:** Documentare end-to-end generazione, validazione, seed canonici, visibilità, retry e cost accounting.
- **Deliverable:** `docs/features/CAMPAIGN_GENERATION.md` con state machine, schema/versioni, validator graph, provider behavior, moderation, transaction boundaries, error matrix ed esempi.
- **Criterio di accettazione:** Il documento permette di riprodurre generation success/repair/fallback e spiega quali dati sono player-visible/hidden e quando diventano canonici.
- **Test obbligatori prima di `DONE`:**
  - [ ] Schema-validare esempi Bible/prologo/errori.
  - [ ] Verificare diagrammi e riferimenti a job/API/eventi con `docs:check`.
  - [ ] Review contro fixture AC-04–AC-06 e test idempotenza seed.
- **Documentazione e contesto:** `docs/features/CAMPAIGN_GENERATION.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### GATE-M2 — Exit gate Milestone 2 — Campaign Generator

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GATE-M1, BL-018..BL-027, DOC-CAMP-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §30 Milestone 2; `docs/MVP_SPEC.md` AC-04–AC-06
- **Obiettivo:** Validare in modo integrato tutti i deliverable di M2 prima di autorizzare il lavoro della milestone successiva.
- **Deliverable:** Report di exit gate M2, demo riproducibile, evidenze e aggiornamento della dashboard.
- **Criterio di accettazione:** 50 fixture generation con schema pass ≥98% dopo repair; riferimenti risolti; almeno 4 ending seed; nessun hidden field nell’API player; retry non duplica seed.
- **Test obbligatori prima di `DONE`:**
  - [ ] Eseguire 50 generation fixture con report versionato.
  - [ ] Fault/idempotency/moderation/cost test.
  - [ ] E2E config→Bible→prologo in staging.
- **Documentazione e contesto:** `docs/TASKS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, documenti della milestone, release evidence progressiva
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

## 12. M3 — Core Turn Loop

Implementare il loop di turno completo con idempotenza, workspace, eventi, snapshot, SSE e recovery.

### BL-028 — POST turns, request hash, 202

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-007, BL-009
- **Dipendenze operative aggiuntive:** GATE-M2
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §13.5 Idempotenza e doppi turni; `docs/MVP_SPEC.md` §20.4 Payload di turno; `docs/MVP_SPEC.md` §32 AC-17; `docs/MVP_SPEC.md` §31 `BL-028`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come client voglio inviare un turno idempotente.
- **Deliverable:** POST turns, request hash, 202.
- **Criterio di accettazione:** Same key/body same turn; body diverso 409.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Same key/body same turn; body diverso 409.
  - [ ] API contract test per 202/status/error envelope.
  - [ ] Idempotency test same key+same body e conflict test same key+different hash.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`; schema/OpenAPI/eventi generati, senza modifica manuale dei file generated
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-029 — Redis lock + partial unique index

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-028
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §11.6 Consistenza e concorrenza; `docs/MVP_SPEC.md` §13.5 Idempotenza e doppi turni; `docs/MVP_SPEC.md` §26.7 Idempotenza, concorrenza e rollback; `docs/MVP_SPEC.md` §31 `BL-029`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio un solo turno attivo per campagna.
- **Deliverable:** Redis lock + partial unique index.
- **Criterio di accettazione:** Concurrency test: uno accepted, altri 409.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Concurrency test: uno accepted, altri 409.
  - [ ] 20 richieste simultanee: una accettata, le altre conflitto/no-op secondo contratto.
  - [ ] Failure test senza Redis: il vincolo database impedisce comunque due turni attivi.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-030 — BullMQ/outbox/job ID deterministico

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-028, BL-029
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §13.2 State machine del turno; `docs/MVP_SPEC.md` §29.7 BullMQ e migrazione a Temporal; `docs/MVP_SPEC.md` §23.2 Backpressure e degradazione; `docs/MVP_SPEC.md` §31 `BL-030`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio elaborare turni su worker.
- **Deliverable:** BullMQ/outbox/job ID deterministico.
- **Criterio di accettazione:** Job duplicato no-op; stuck watchdog recupera.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Job duplicato no-op; stuck watchdog recupera.
  - [ ] Integration test outbox→BullMQ→worker con job ID deterministico e duplicate delivery.
  - [ ] Fault test per worker crash, stuck watchdog, retry limit e dead-letter/terminal state.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-031 — Load state/scene/entities e TurnContext base

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-025, BL-030
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.5 Strati del prompt; `docs/MVP_SPEC.md` §13.3 Sequenza completa di un turno; `docs/MVP_SPEC.md` §15.7 Context Builder; `docs/MVP_SPEC.md` §31 `BL-031`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come DM AI voglio uno stato canonico ridotto.
- **Deliverable:** Load state/scene/entities e TurnContext base.
- **Criterio di accettazione:** Context include invarianti, no hidden data non necessaria.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Context include invarianti, no hidden data non necessaria.
  - [ ] Unit/golden test del Context Builder base con dati obbligatori e hidden-data exclusion.
  - [ ] Token estimate test e snapshot leggibile/versionato del TurnContext.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-032 — Schemi, policy, normalized result

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-021, BL-031
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.8 Tool call envelope; `docs/MVP_SPEC.md` §13.9 Tool call non autorizzata; `docs/MVP_SPEC.md` §14.16 Tool contract; `docs/MVP_SPEC.md` §31 `BL-032`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come orchestrator voglio un registry di tool allowlisted.
- **Deliverable:** Schemi, policy, normalized result.
- **Criterio di accettazione:** Unknown/unauthorized tool rifiutato; no generic executor.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Unknown/unauthorized tool rifiutato; no generic executor.
  - [ ] Contract test per ogni tool registrato e rifiuto di unknown/generic/unauthorized tool.
  - [ ] Authorization matrix per interaction mode, campaign state, actor e rate limits.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-033 — Pending workspace e call ID

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-030, BL-032
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §13.4 Pending turn workspace; `docs/MVP_SPEC.md` §13.7 Retry e fallback; `docs/MVP_SPEC.md` §26.7 Idempotenza, concorrenza e rollback; `docs/MVP_SPEC.md` §31 `BL-033`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio tool results stabili prima del commit.
- **Deliverable:** Pending workspace e call ID.
- **Criterio di accettazione:** Crash/retry riusa roll/result; TTL cleanup.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Crash/retry riusa roll/result; TTL cleanup.
  - [ ] Crash/retry test dopo ogni tool call: risultato e dado vengono riutilizzati.
  - [ ] TTL/cleanup test che non elimina workspace attivi e non conserva dati oltre retention.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-034 — Generate turn/tool loop/final schema

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-021, BL-031–BL-033
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.6 Schema del turno; `docs/MVP_SPEC.md` §13 Turn Orchestrator; `docs/MVP_SPEC.md` §35.2 Definition of Done per componente AI; `docs/MVP_SPEC.md` §31 `BL-034`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio una risposta DM strutturata.
- **Deliverable:** Generate turn/tool loop/final schema.
- **Criterio di accettazione:** Max round/call; turnId e entity IDs validi.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Max round/call; turnId e entity IDs validi.
  - [ ] Orchestrator integration test per zero, una e più tool roundtrip entro limiti.
  - [ ] Fixture AI success/invalid/timeout/fallback; nessun commit prima del risultato finale valido.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`; schema/OpenAPI/eventi generati, senza modifica manuale dei file generated
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-035 — Schema, semantic, knowledge, contradiction validators

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-034
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.9 Validazione dell’output; `docs/MVP_SPEC.md` §13.8 JSON non valido; `docs/MVP_SPEC.md` §24.7 Contradiction detection; `docs/MVP_SPEC.md` §31 `BL-035`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio bloccare output incoerenti.
- **Deliverable:** Schema, semantic, knowledge, contradiction validators.
- **Criterio di accettazione:** Invalid output no commit; repair/fallback bounded.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Invalid output no commit; repair/fallback bounded.
  - [ ] Schema, semantic, knowledge e contradiction tests con fixture mirate.
  - [ ] Fault injection: ogni failure path lascia proiezioni/eventi invariati e produce errore auditabile.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-036 — Event writer, sequence, causation

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-004, BL-033–BL-035
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §11.5 Event sourcing pragmatico; `docs/MVP_SPEC.md` §19.6 Eventi più proiezioni transazionali; `docs/MVP_SPEC.md` §32 AC-16; `docs/MVP_SPEC.md` §31 `BL-036`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio eventi append-only e proiezioni atomiche.
- **Deliverable:** Event writer, sequence, causation.
- **Criterio di accettazione:** Event+projection transaction; append-only permission.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Event+projection transaction; append-only permission.
  - [ ] PostgreSQL integration test di append-only, sequence, causation/correlation e atomicità event+projection.
  - [ ] Replay/reducer test e permission test che impedisce UPDATE/DELETE del log applicativo.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-037 — Snapshot triggers, checksum, reducer replay

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-036
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §11.5 Event sourcing pragmatico; `docs/MVP_SPEC.md` §19 Modello dati; `docs/MVP_SPEC.md` §26.4 Integration test database; `docs/MVP_SPEC.md` §32 AC-15; `docs/MVP_SPEC.md` §31 `BL-037`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio ripristino rapido.
- **Deliverable:** Snapshot triggers, checksum, reducer replay.
- **Criterio di accettazione:** Restore = current checksum; corrupt snapshot skipped.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Restore = current checksum; corrupt snapshot skipped.
  - [ ] Snapshot+event replay produce lo stesso checksum della proiezione corrente.
  - [ ] Corrupt/stale snapshot viene ignorato e il rebuild dagli eventi resta corretto.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-038 — Stream endpoint, events, heartbeats

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-034–BL-036
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §13.11 Risposta parziale e SSE; `docs/MVP_SPEC.md` §13.12 Commit prima dello streaming definitivo; `docs/MVP_SPEC.md` §20.6 Eventi SSE; `docs/MVP_SPEC.md` §31 `BL-038`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio progress e narrazione SSE.
- **Deliverable:** Stream endpoint, events, heartbeats.
- **Criterio di accettazione:** Progress before commit; definitive chunks after commit.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Progress before commit; definitive chunks after commit.
  - [ ] SSE contract test per ordering, heartbeat, reconnect e terminal event.
  - [ ] Test che chunk definitivi/state diff non siano emessi prima del commit.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`; schema/OpenAPI/eventi generati, senza modifica manuale dei file generated
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-039 — GET status, Last-Event-ID, retry banner

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-028, BL-038, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §20.5 Status e retry; `docs/MVP_SPEC.md` §20.6 Eventi SSE; `docs/MVP_SPEC.md` §21.5 Retry sicuro; `docs/MVP_SPEC.md` §32 AC-15; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-039`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio riconnettermi senza doppio turno.
- **Deliverable:** GET status, Last-Event-ID, retry banner.
- **Criterio di accettazione:** Disconnect after commit renders same response; no resubmit.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Disconnect after commit renders same response; no resubmit.
  - [ ] E2E disconnessione prima/durante/dopo commit con Last-Event-ID.
  - [ ] Refresh/retry non reinvia né duplica il turno; stessa risposta finale e stateVersion.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-040 — Narrative cards, composer, party/objective/drawers

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-038, BL-039, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §8 Esperienza utente; `docs/MVP_SPEC.md` §10 Tipologie di turno; `docs/MVP_SPEC.md` §21 Interfaccia utente; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-040`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio una schermata centrale completa.
- **Deliverable:** Narrative cards, composer, party/objective/drawers.
- **Criterio di accettazione:** Tutte le modalità base renderizzate nella shell conversazionale; core loop completo a 320 px, ottimizzato 360–430 px, desktop adattivo, reduced-motion e WCAG 2.2 AA.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Tutte le modalità base renderizzate; responsive/AA.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] E2E 320/360/390/768/1024/1440 px con tastiera virtuale, safe area, touch target, drawer HUD e due suggested actions primarie.
  - [ ] Reduced-motion, visual regression e performance trace del feed/composer/dice tray senza jank attribuibile al motion layer.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-041 — Backend state diff/player view

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-036, BL-040
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.1 Confine di responsabilità; `docs/MVP_SPEC.md` §20 API; `docs/MVP_SPEC.md` §21.3 Schermata principale di gioco; `docs/MVP_SPEC.md` §31 `BL-041`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come client voglio aggiornamenti canonici espliciti.
- **Deliverable:** Backend state diff/player view.
- **Criterio di accettazione:** UI non estrae HP/item dalla prosa; version check.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: UI non estrae HP/item dalla prosa; version check.
  - [ ] Contract test del player-safe state diff e monotonic stateVersion.
  - [ ] UI test che HP/item/quest non vengano derivati o regexati dalla narrazione.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/TURN_LOOP.md`; `docs/api/`; `docs/events/EVENT_CATALOG.md`; schema/OpenAPI/eventi generati, senza modifica manuale dei file generated
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### DOC-TURN-001 — Guida operativa del Turn Orchestrator, API, SSE ed eventi

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-028, BL-029, BL-030, BL-031, BL-032, BL-033, BL-034, BL-035, BL-036, BL-037, BL-038, BL-039, BL-040, BL-041
- **Dipendenze operative aggiuntive:** GOV-002
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §10–§13, §19–§21; `docs/MVP_SPEC.md` AC-07/08/14–18
- **Obiettivo:** Mantenere una descrizione eseguibile del core turn loop e dei suoi failure/recovery path.
- **Deliverable:** `docs/features/TURN_LOOP.md`, `docs/api/README.md`, OpenAPI generated, `docs/events/EVENT_CATALOG.md`; state machine, sequence diagram, envelopes, idempotency, workspace, commit, SSE/reconnect, runbook errori.
- **Criterio di accettazione:** Un agente può implementare o diagnosticare un turno senza ricostruire implicitamente ordering, transazioni o semantica dello stream; API/schema/event examples coincidono con artefatti generati.
- **Test obbligatori prima di `DONE`:**
  - [ ] Conformance test documentazione↔OpenAPI/JSON Schema/event registry.
  - [ ] Render e validate dei diagrammi; link/code refs passano.
  - [ ] Walkthrough registrato di success, invalid JSON, unauthorized tool, timeout, crash after tool, disconnect after commit.
- **Documentazione e contesto:** Tutti i deliverable del task; aggiornare `docs/CONTEXT.md` e traceability AC-07/08/14–18
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### GATE-M3 — Exit gate Milestone 3 — Core Turn Loop

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GATE-M2, BL-028..BL-041, DOC-TURN-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §30 Milestone 3; `docs/MVP_SPEC.md` AC-07/08/14–18
- **Obiettivo:** Validare in modo integrato tutti i deliverable di M3 prima di autorizzare il lavoro della milestone successiva.
- **Deliverable:** Report di exit gate M3, demo riproducibile, evidenze e aggiornamento della dashboard.
- **Criterio di accettazione:** 20 replay concorrenti producono un effetto; crash dopo tool riusa result; invalid JSON non committa; turn completo visibile dopo reconnect; ogni trace contiene usage o reason missing.
- **Test obbligatori prima di `DONE`:**
  - [ ] Concurrency/fault-injection suite completa.
  - [ ] E2E turn+SSE+reconnect con fake provider.
  - [ ] Event/projection/snapshot integrity report.
- **Documentazione e contesto:** `docs/TASKS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, documenti della milestone, release evidence progressiva
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

## 13. M4 — Rules Engine

Sostituire gli stub con un Rules Engine puro, deterministico e coperto da proprietà/golden tests.

### BL-042 — Crypto RNG prod/seed test

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-009
- **Dipendenze operative aggiuntive:** GATE-M3
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §14.1 Obiettivo e confine; `docs/MVP_SPEC.md` §14.4 Prove; `docs/MVP_SPEC.md` §26.6 Test del Rules Engine; `docs/MVP_SPEC.md` §31 `BL-042`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio RNG iniettato e roll registrati.
- **Deliverable:** Crypto RNG prod/seed test.
- **Criterio di accettazione:** Ogni roll ha source/call; replay usa valore evento.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Ogni roll ha source/call; replay usa valore evento.
  - [ ] Unit/property test con RNG iniettato e distribuzione/soglie di dominio.
  - [ ] Replay test: il valore registrato prevale su una nuova estrazione RNG.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-043 — DC bands, modifiers, advantage, degree

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-011, BL-042
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §10 Tipologie di turno; `docs/MVP_SPEC.md` §14.3–14.5 Abilità/prove/salvezza; `docs/MVP_SPEC.md` §32 AC-09; `docs/MVP_SPEC.md` §31 `BL-043`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio prove e salvezza verificabili.
- **Deliverable:** DC bands, modifiers, advantage, degree.
- **Criterio di accettazione:** Formula esatta; impossible action no roll.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Formula esatta; impossible action no roll.
  - [ ] Table/golden tests per DC, modificatori, vantaggio/svantaggio e degree of success.
  - [ ] Negative test: azione impossibile non consuma un tiro e produce outcome tipizzato.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-044 — Move/consume/equip/unequip commands

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-011, BL-036
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §14.13 Inventario ed equipaggiamento; `docs/MVP_SPEC.md` §20.2 Endpoints principali; `docs/MVP_SPEC.md` §32 AC-11; `docs/MVP_SPEC.md` §31 `BL-044`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio usare/equipaggiare oggetti.
- **Deliverable:** Move/consume/equip/unequip commands.
- **Criterio di accettazione:** Quantità non negativa; retry no duplicate; slot validi.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Quantità non negativa; retry no duplicate; slot validi.
  - [ ] Property/integration test per quantità non negative, slot, ownership e transazioni.
  - [ ] Idempotency/concurrency test su move/consume/equip/unequip e ricompense.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-045 — Encounter, initiative, actions, range, attack

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-042–BL-044
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §10 modalità combat; `docs/MVP_SPEC.md` §14.6–14.9 Combat; `docs/MVP_SPEC.md` §21.4 UX dei dadi; `docs/MVP_SPEC.md` §32 AC-10; `docs/MVP_SPEC.md` §31 `BL-045`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio combattimento a turni e zone.
- **Deliverable:** Encounter, initiative, actions, range, attack.
- **Criterio di accettazione:** Turn order/action budget; 4 range band; combat terminal.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Turn order/action budget; 4 range band; combat terminal.
  - [ ] Golden combat fixtures riproducibili per iniziativa, action economy, zone e range.
  - [ ] Property tests delle invarianti encounter e E2E di un combattimento completo.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-046 — HP, downed, death checks, 10 conditions, rest

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-045
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §14.9–14.12 Danni, condizioni, morte e riposi; `docs/MVP_SPEC.md` §32 AC-10; `docs/MVP_SPEC.md` §31 `BL-046`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio danni, cura e condizioni.
- **Deliverable:** HP, downed, death checks, 10 conditions, rest.
- **Criterio di accettazione:** HP bounds; duration/stacking; setting death rispettato.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: HP bounds; duration/stacking; setting death rispettato.
  - [ ] Boundary/property tests per HP, heal, resistance, duration, stacking, downed/death e rest.
  - [ ] Regression test per ogni combinazione di condizione supportata e setting morte.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-047 — State machine, predicates, rewards

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-022, BL-036, BL-044
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §14.14 Quest e progressione; `docs/MVP_SPEC.md` §17.1 Stato di progressione canonico; `docs/MVP_SPEC.md` §32 AC-16; `docs/MVP_SPEC.md` §31 `BL-047`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio quest deterministiche.
- **Deliverable:** State machine, predicates, rewards.
- **Criterio di accettazione:** Invalid transition rifiutata; reward una volta.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Invalid transition rifiutata; reward una volta.
  - [ ] State-machine tests per transizioni valide/invalide e predicate.
  - [ ] Idempotency test reward/step completion e replay eventi.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-048 — Six axes, clamp, milestones, consent

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-036
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §18.4–18.9 Relazioni e romance; `docs/MVP_SPEC.md` §22.14 Matrice contenuti; `docs/MVP_SPEC.md` §32 AC-12; `docs/MVP_SPEC.md` §31 `BL-048`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio relazioni progressive.
- **Deliverable:** Six axes, clamp, milestones, consent.
- **Criterio di accettazione:** Delta limits; source evidence; romance off/adult rules.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Delta limits; source evidence; romance off/adult rules.
  - [ ] Property tests clamp/delta/evidence/milestone one-shot sui sei assi.
  - [ ] Safety tests per romance off, adult-only, consenso, incompatibilità e fade-to-black.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-049 — Tick rules/thresholds/idempotency

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-022, BL-036
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §16.1 Campaign Bible; `docs/MVP_SPEC.md` §17.3 Story clocks; `docs/MVP_SPEC.md` §32 AC-20; `docs/MVP_SPEC.md` §31 `BL-049`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio minacce che avanzano.
- **Deliverable:** Tick rules/thresholds/idempotency.
- **Criterio di accettazione:** Max tick; duplicate evidence no-op; threshold once.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Max tick; duplicate evidence no-op; threshold once.
  - [ ] Unit/property test di tick bounds, soglie one-shot e causation dedup.
  - [ ] Integration test evento→clock→progression senza doppio avanzamento.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-050 — Level-up reducer/catalog effects

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-011, BL-047
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §6.1 Livelli 1–5; `docs/MVP_SPEC.md` §14.14 Quest e progressione; `docs/MVP_SPEC.md` §18.2 Compagni; `docs/MVP_SPEC.md` §31 `BL-050`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio livelli 1–5 a milestone.
- **Deliverable:** Level-up reducer/catalog effects.
- **Criterio di accettazione:** One level per eligible milestone; stats ricalcolate.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: One level per eligible milestone; stats ricalcolate.
  - [ ] Golden tests level 1–5, milestone eligibility e ricalcolo stats.
  - [ ] Negative/replay test: un solo livello per milestone e nessun doppio beneficio.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-051 — Implementare 23 tool su Rules/Application layer

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-032, BL-043–BL-050
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §14.16 Tool contract; `docs/MVP_SPEC.md` §12.8 Tool call envelope; `docs/MVP_SPEC.md` §26.6 Test del Rules Engine; `docs/MVP_SPEC.md` §31 `BL-051`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come DM AI voglio tutti i tool di dominio richiesti.
- **Deliverable:** Implementare 23 tool su Rules/Application layer.
- **Criterio di accettazione:** Contract test per input/output/auth/side effect/idempotency.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Contract test per input/output/auth/side effect/idempotency.
  - [ ] Contract suite parametrica per input/output/auth/limit/event/idempotency di ogni tool.
  - [ ] Coverage report che dimostri la presenza di tutti i tool P0 elencati nella specifica.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/RULES_ENGINE.md`; schema/OpenAPI/eventi generati, senza modifica manuale dei file generated
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### DOC-RULES-001 — Manuale tecnico del Rules Engine e dei tool di dominio

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-042, BL-043, BL-044, BL-045, BL-046, BL-047, BL-048, BL-049, BL-050, BL-051
- **Dipendenze operative aggiuntive:** GOV-002
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §14, §18.4–18.9; `docs/MVP_SPEC.md` AC-09–AC-11
- **Obiettivo:** Rendere formule, semplificazioni, invarianti e tool contract trasparenti, versionati e testabili senza AI.
- **Deliverable:** `docs/features/RULES_ENGINE.md` con regole v1, catalog/rules version, RNG/replay, checks, combat zones, HP/conditions, inventory, quests, relationships, clocks, level-up e tool matrix.
- **Criterio di accettazione:** Ogni formula/evento/tool ha input, output, errori, idempotenza e test associati; non esistono formule canoniche affidate al prompt.
- **Test obbligatori prima di `DONE`:**
  - [ ] Compilare/validare snippet e tabelle machine-readable.
  - [ ] Golden examples del manuale devono produrre gli stessi eventi dei test Rules Engine.
  - [ ] `docs:check` e traceability AC-09–AC-11 passano.
- **Documentazione e contesto:** `docs/features/RULES_ENGINE.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### GATE-M4 — Exit gate Milestone 4 — Rules Engine

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GATE-M3, BL-042..BL-051, DOC-RULES-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §30 Milestone 4; `docs/MVP_SPEC.md` AC-09–AC-11
- **Obiettivo:** Validare in modo integrato tutti i deliverable di M4 prima di autorizzare il lavoro della milestone successiva.
- **Deliverable:** Report di exit gate M4, demo riproducibile, evidenze e aggiornamento della dashboard.
- **Criterio di accettazione:** Invarianti property-based; combat fixture riproducibile; reward/consume idempotenti; nessuna formula nel prompt; branch coverage core ≥80%.
- **Test obbligatori prima di `DONE`:**
  - [ ] Unit/property/golden/contract suite del Rules Engine.
  - [ ] E2E skill check, inventory e combat.
  - [ ] Coverage e formula-location audit.
- **Documentazione e contesto:** `docs/TASKS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, documenti della milestone, release evidence progressiva
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

## 14. M5 — NPC e memoria

Aggiungere NPC persistenti, knowledge boundary, memorie, summary, retrieval e token budget.

### BL-052 — NPC registry, creation, status/location/faction

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-025, BL-051
- **Dipendenze operative aggiuntive:** GATE-M4
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §16.1 NPC seed; `docs/MVP_SPEC.md` §18.1 NPC persistenti; `docs/MVP_SPEC.md` §19.2 Entità relazionali; `docs/MVP_SPEC.md` §31 `BL-052`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio NPC persistenti entro limite.
- **Deliverable:** NPC registry, creation, status/location/faction.
- **Criterio di accettazione:** Max 30; one persistent creation/turn; dead/absent policy.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Max 30; one persistent creation/turn; dead/absent policy.
  - [ ] DB/domain tests per limiti, stato, location/faction e lifecycle NPC.
  - [ ] Concurrency test su create_npc: massimo uno persistente per turno e massimo 30.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/MEMORY_NPC.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-053 — Facts/beliefs/secrets e speaker view

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-052
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §15.6 Memoria e conoscenza NPC; `docs/MVP_SPEC.md` §18.3 Knowledge boundary; `docs/MVP_SPEC.md` §27 AI Evaluation Suite; `docs/MVP_SPEC.md` §32 AC-13; `docs/MVP_SPEC.md` §31 `BL-053`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio NPC senza metagaming.
- **Deliverable:** Facts/beliefs/secrets e speaker view.
- **Criterio di accettazione:** EVAL secret/false belief/dead speaker pass.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: EVAL secret/false belief/dead speaker pass.
  - [ ] AI eval canary-secret, false-belief, private-memory, absent/dead speaker con leak=0.
  - [ ] Unit test della speaker view/knowledge filter prima del rendering prompt.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/MEMORY_NPC.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-054 — Candidate validation/dedup/persist

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-036, BL-053
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §15.3 Memoria episodica; `docs/MVP_SPEC.md` §19.2 Entità relazionali; `docs/MVP_SPEC.md` §32 AC-12; `docs/MVP_SPEC.md` §31 `BL-054`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio memorie episodiche con source.
- **Deliverable:** Candidate validation/dedup/persist.
- **Criterio di accettazione:** Source events required; visibility/owner enforced.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Source events required; visibility/owner enforced.
  - [ ] Validation/dedup test con sourceEvent obbligatorio, visibility e owner.
  - [ ] Integration test di retry/replay e candidate invalidi senza memoria persistita.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/MEMORY_NPC.md`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-055 — Pgvector index, filters, ranking/MMR

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-054
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §15.7 Context Builder; `docs/MVP_SPEC.md` §15.9 Memoria gerarchica in PostgreSQL; `docs/MVP_SPEC.md` §23 Requisiti non funzionali; `docs/MVP_SPEC.md` §31 `BL-055`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come DM AI voglio memorie rilevanti.
- **Deliverable:** pgvector index, filters, ranking/MMR.
- **Criterio di accettazione:** Private leak zero; p95 retrieval target; top-k trace.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Private leak zero; p95 retrieval target; top-k trace.
  - [ ] Retrieval tests con filtri visibility/entity/time applicati prima del ranking.
  - [ ] Performance test p95 e eval precision/recall su fixture; private leak=0.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/MEMORY_NPC.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-056 — Event delta, merge/deprecation, retry

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-021, BL-036
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §15.5 Riassunto strutturato; `docs/MVP_SPEC.md` §12.8 Riassunto; `docs/MVP_SPEC.md` §13.7 Retry e fallback; `docs/MVP_SPEC.md` §31 `BL-056`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio riassunti incrementali verificabili.
- **Deliverable:** Event delta, merge/deprecation, retry.
- **Criterio di accettazione:** Unsupported fact rejected; prior summary retained on fail.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Unsupported fact rejected; prior summary retained on fail.
  - [ ] Summary merge test con source support, deprecation e retry idempotente.
  - [ ] Failure test: output non supportato o provider down conserva il summary precedente.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/MEMORY_NPC.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-057 — Token estimator, section budgets, truncation/cache

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-031, BL-055, BL-056
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §15.7 Context Builder; `docs/MVP_SPEC.md` §15.8 Prompt caching; `docs/MVP_SPEC.md` §23 Requisiti non funzionali; `docs/MVP_SPEC.md` §28 Costi AI; `docs/MVP_SPEC.md` §31 `BL-057`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio contesti entro cap.
- **Deliverable:** Token estimator, section budgets, truncation/cache.
- **Criterio di accettazione:** Balanced ≤24k; invarianti mai troncate.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Balanced ≤24k; invarianti mai troncate.
  - [ ] Token budget tests per profilo e truncation order; invarianti mai rimosse.
  - [ ] Cache-key/version test e metriche su hit/miss/costo senza cross-campaign leakage.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/MEMORY_NPC.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-058 — Knowledge/relationship + tactical policy

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-016, BL-045, BL-053
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §18.2 Compagni; `docs/MVP_SPEC.md` §18.3 Knowledge boundary; `docs/MVP_SPEC.md` §14 Combat; `docs/MVP_SPEC.md` §31 `BL-058`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio compagni coerenti e utili.
- **Deliverable:** Knowledge/relationship + tactical policy.
- **Criterio di accettazione:** Azione combat legale; rare item/irreversible choice protected.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Azione combat legale; rare item/irreversible choice protected.
  - [ ] Combat policy tests: solo azioni legali, target/range validi e tactical role.
  - [ ] Eval narrative/knowledge e approval gate per oggetti rari o scelte irreversibili.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/MEMORY_NPC.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### DOC-MEM-001 — Guida a NPC, conoscenza, memoria e Context Builder

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-052, BL-053, BL-054, BL-055, BL-056, BL-057, BL-058
- **Dipendenze operative aggiuntive:** GOV-002
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §15, §18; `docs/MVP_SPEC.md` AC-12/AC-13
- **Obiettivo:** Documentare confini di conoscenza, retrieval, visibilità, token budget e comportamento dei compagni in modo verificabile.
- **Deliverable:** `docs/features/MEMORY_NPC.md` con data flow, visibility matrix, ranking, source provenance, summary merge, token/truncation/cache, prompt view e eval canary.
- **Criterio di accettazione:** Ogni dato incluso nel contesto ha fonte e policy di visibilità; un NPC non può ricevere dati privati per errore di retrieval o summary.
- **Test obbligatori prima di `DONE`:**
  - [ ] Validare esempi/query/visibility matrix contro fixture di test.
  - [ ] Canary-secret walkthrough e link a eval con leak=0.
  - [ ] `docs:check`, code refs e token-budget examples passano.
- **Documentazione e contesto:** `docs/features/MEMORY_NPC.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### GATE-M5 — Exit gate Milestone 5 — NPC e memoria

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GATE-M4, BL-052..BL-058, DOC-MEM-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §30 Milestone 5; `docs/MVP_SPEC.md` AC-12/AC-13
- **Obiettivo:** Validare in modo integrato tutti i deliverable di M5 prima di autorizzare il lavoro della milestone successiva.
- **Deliverable:** Report di exit gate M5, demo riproducibile, evidenze e aggiornamento della dashboard.
- **Criterio di accettazione:** Eval promise/secret/private memory pass; context entro cap; limite 30 NPC; summary senza source rifiutato; bot 40 turni senza perdita obiettivi principali.
- **Test obbligatori prima di `DONE`:**
  - [ ] AI eval critical memory/knowledge con leak=0.
  - [ ] Retrieval performance/privacy test.
  - [ ] 40-turn bot campaign e context budget report.
- **Documentazione e contesto:** `docs/TASKS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, documenti della milestone, release evidence progressiva
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

## 15. M6 — Progressione e finale

Rendere atti, pacing, finali ed epilogo verificabili dal backend.

### BL-059 — Milestone/act reducer e event

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-024, BL-047, BL-049
- **Dipendenze operative aggiuntive:** GATE-M5
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §16 Campaign Bible; `docs/MVP_SPEC.md` §17.2 Avanzamento atti; `docs/MVP_SPEC.md` §17.5 Gate del finale; `docs/MVP_SPEC.md` §31 `BL-059`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio avanzare atti da predicate.
- **Deliverable:** Milestone/act reducer e event.
- **Criterio di accettazione:** Nessun act advance senza condition; no active combat.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Nessun act advance senza condition; no active combat.
  - [ ] Reducer/predicate tests: act advance solo con condizioni vere e fuori da combat incompatibile.
  - [ ] Event/replay test per milestone e act completion one-shot.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/PROGRESSION_ENDINGS.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-060 — Progress/stall/turn ratio controller

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-057, BL-059
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §9.4 Ritmo e budget; `docs/MVP_SPEC.md` §17.4 Pacing controller; `docs/MVP_SPEC.md` §27.4 Campagne simulate tramite bot; `docs/MVP_SPEC.md` §31 `BL-060`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio evitare stalli e campagne infinite.
- **Deliverable:** Progress/stall/turn ratio controller.
- **Criterio di accettazione:** Stall≥2 produce decision point; turn≥90 converges.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Stall≥2 produce decision point; turn≥90 converges.
  - [ ] Scenario tests per stall/progress ratio e decision point generation.
  - [ ] Bot test: da turno 90 il sistema converge senza invalidare la libertà o il gate finale.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/PROGRESSION_ENDINGS.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-061 — Ending gate/tool/hard cap

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-024, BL-059, BL-060
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §17.5 Gate del finale; `docs/MVP_SPEC.md` §17.6 Selezione dell’esito; `docs/MVP_SPEC.md` §32 AC-20; `docs/MVP_SPEC.md` §31 `BL-061`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio autorizzare finali verificabili.
- **Deliverable:** Ending gate/tool/hard cap.
- **Criterio di accettazione:** Early ending rejected; eligible seed only; terminal ≤100.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Early ending rejected; eligible seed only; terminal ≤100.
  - [ ] Ending gate unit/integration test per early reject, eligible seed e hard-cap policy.
  - [ ] Bot completion suite: terminal state entro 100 turni ≥ soglia specificata.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/PROGRESSION_ENDINGS.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-062 — Final snapshot/context/generation/fallback

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-061
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.8 Epilogo; `docs/MVP_SPEC.md` §17.7 Epilogo; `docs/MVP_SPEC.md` §32 AC-21; `docs/MVP_SPEC.md` §31 `BL-062`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio un epilogo coerente.
- **Deliverable:** Final snapshot/context/generation/fallback.
- **Criterio di accettazione:** No post-final mutations; facts reference final events.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: No post-final mutations; facts reference final events.
  - [ ] E2E final snapshot→epilogo→read-only campaign e fallback deterministico.
  - [ ] Factuality eval: ogni fatto dell’epilogo è supportato da snapshot/eventi finali.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/features/PROGRESSION_ENDINGS.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### DOC-END-001 — Guida alla progressione narrativa, pacing, finali ed epilogo

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-059, BL-060, BL-061, BL-062
- **Dipendenze operative aggiuntive:** GOV-002
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §9.4, §16, §17; `docs/MVP_SPEC.md` AC-20/AC-21
- **Obiettivo:** Rendere espliciti predicate, reducer, hard-cap behavior, ending gate e factuality dell’epilogo.
- **Deliverable:** `docs/features/PROGRESSION_ENDINGS.md` con state machine, predicate examples, stall policy, ending eligibility, final snapshot, fallback ed esempi di finali.
- **Criterio di accettazione:** Il finale non dipende da una decisione libera del modello e ogni epilogo è tracciabile a fatti del final snapshot/event log.
- **Test obbligatori prima di `DONE`:**
  - [ ] Validare predicate/examples contro reducer e ending gate.
  - [ ] Walkthrough early reject, ordinary ending, failure ending e hard-cap.
  - [ ] `docs:check` e traceability AC-20/AC-21 passano.
- **Documentazione e contesto:** `docs/features/PROGRESSION_ENDINGS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### GATE-M6 — Exit gate Milestone 6 — Progressione e finale

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GATE-M5, BL-059..BL-062, DOC-END-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §30 Milestone 6; `docs/MVP_SPEC.md` AC-20/AC-21
- **Obiettivo:** Validare in modo integrato tutti i deliverable di M6 prima di autorizzare il lavoro della milestone successiva.
- **Deliverable:** Report di exit gate M6, demo riproducibile, evidenze e aggiornamento della dashboard.
- **Criterio di accettazione:** Finale rifiutato al turno 12; ≥95% bot campaigns terminali entro 100 turni; epilogo cita solo fatti; nessun evento mutante dopo completion.
- **Test obbligatori prima di `DONE`:**
  - [ ] Ending gate unit/integration.
  - [ ] Bot completion report ≥ soglia.
  - [ ] E2E epilogo/final snapshot/read-only e factuality eval.
- **Documentazione e contesto:** `docs/TASKS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, documenti della milestone, release evidence progressiva
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

## 16. M7 — Hardening e rilascio

Completare safety, cost control, admin, privacy, eval, bot, load/chaos/restore e release operations.

### BL-063 — Policy engine, provider adapter, safe rewrite/block

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-020, BL-034, BL-035
- **Dipendenze operative aggiuntive:** GATE-M6
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §22 Sicurezza e moderazione; `docs/MVP_SPEC.md` §27 AI Evaluation Suite; `docs/MVP_SPEC.md` §32 AC-22; `docs/MVP_SPEC.md` §31 `BL-063`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come sistema voglio moderazione input/output completa.
- **Deliverable:** Policy engine, provider adapter, safe rewrite/block.
- **Criterio di accettazione:** Critical categories fail closed; result/audit persisted.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Critical categories fail closed; result/audit persisted.
  - [ ] Safety eval input/output per tutte le categorie critical e bypass/prompt injection.
  - [ ] Integration test fail-closed, safe rewrite/block, persistence e no unsafe streaming.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/security/`; `docs/operations/`; `docs/testing/`; `docs/security/MODERATION_POLICY.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-064 — Ai_usage, price snapshot, budgets, alerts

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-021, BL-034
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §24 Osservabilità; `docs/MVP_SPEC.md` §28 Costi AI; `docs/MVP_SPEC.md` §32 AC-19; `docs/MVP_SPEC.md` §31 `BL-064`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come operatore voglio uso e costo per richiesta/campagna.
- **Deliverable:** ai_usage, price snapshot, budgets, alerts.
- **Criterio di accettazione:** 100% call con usage/estimated reason; hard policy test.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: 100% call con usage/estimated reason; hard policy test.
  - [ ] Usage completeness test, formula costi con price snapshot e aggregazione campaign.
  - [ ] Budget alert/soft/hard limit tests e model routing senza costanti nel dominio.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/security/`; `docs/operations/`; `docs/testing/`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-065 — Edge/app/user/campaign quotas e semaphore

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-006, BL-028, BL-064
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §22.9 Rate limiting e abuso costi; `docs/MVP_SPEC.md` §23.2 Backpressure; `docs/MVP_SPEC.md` §28.6 Budget enforcement; `docs/MVP_SPEC.md` §31 `BL-065`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come servizio voglio proteggermi da abuso e runaway.
- **Deliverable:** Edge/app/user/campaign quotas e semaphore.
- **Criterio di accettazione:** Limiti/Retry-After; replay idempotente non riconsuma AI.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Limiti/Retry-After; replay idempotente non riconsuma AI.
  - [ ] Rate-limit tests per IP/user/campaign/provider semaphore e Retry-After.
  - [ ] Idempotency test: replay non consuma una nuova quota/chiamata AI.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/security/`; `docs/operations/`; `docs/testing/`; `docs/security/THREAT_MODEL.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-066 — Read-only campaign/event/AI/moderation view

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-007, BL-008, BL-036, BL-064
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §4.2 Utente interno; `docs/MVP_SPEC.md` §21.7 Admin minimo; `docs/MVP_SPEC.md` §22.12 Audit log; `docs/MVP_SPEC.md` §31 `BL-066`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come operatore voglio ispezionare turni ed errori.
- **Deliverable:** Read-only campaign/event/AI/moderation view.
- **Criterio di accettazione:** RBAC/MFA; redaction; ogni accesso auditato.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: RBAC/MFA; redaction; ogni accesso auditato.
  - [ ] RBAC/MFA/IDOR test dell’admin e audit di ogni accesso.
  - [ ] Redaction test; UI/API non espongono prompt, PII o hidden facts oltre ruolo.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/security/`; `docs/operations/`; `docs/testing/`; `docs/security/THREAT_MODEL.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-067 — Export job, signed URL, deletion/anonymization

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-006, BL-036
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §22.11 Backup, recovery ed eliminazione; `docs/MVP_SPEC.md` §20 API; `docs/MVP_SPEC.md` §32 Criteri supplementari; `docs/MVP_SPEC.md` §31 `BL-067`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come utente voglio esportare ed eliminare i dati.
- **Deliverable:** Export job, signed URL, deletion/anonymization.
- **Criterio di accettazione:** Re-auth; job status; retention e audit.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Re-auth; job status; retention e audit.
  - [ ] E2E re-auth→export/delete con stato job, signed URL, retention e audit.
  - [ ] Data inventory test: cancellazione/anonymization copre DB, cache, object storage e analytics secondo policy.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/security/`; `docs/operations/`; `docs/testing/`; `docs/data/DATA_MODEL.md` e migration notes; `docs/security/THREAT_MODEL.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-068 — Fixtures, assertions, grader, report

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-021, BL-035, BL-051
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §26 Strategia di testing; `docs/MVP_SPEC.md` §27 AI Evaluation Suite; `docs/MVP_SPEC.md` §32 AC-24; `docs/MVP_SPEC.md` §31 `BL-068`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come team voglio un harness di evaluation versionato.
- **Deliverable:** Fixtures, assertions, grader, report.
- **Criterio di accettazione:** 48 casi eseguibili; deterministic fail precedence.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: 48 casi eseguibili; deterministic fail precedence.
  - [ ] Harness self-test per fixture, assertion, grader, determinism e report versionato.
  - [ ] Esecuzione di almeno 48 casi con threshold e failure precedence riproducibili.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/security/`; `docs/operations/`; `docs/testing/`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-069 — Goal/explorer/adversarial bots

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-040, BL-051, BL-061, BL-068
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §27.4 Campagne simulate tramite bot; `docs/MVP_SPEC.md` §23 Requisiti non funzionali; `docs/MVP_SPEC.md` §32 AC-07/20; `docs/MVP_SPEC.md` §31 `BL-069`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come team voglio campagne automatiche complete.
- **Deliverable:** Goal/explorer/adversarial bots.
- **Criterio di accettazione:** ≥40 campaigns run; artifact riproducibile; cost report.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: ≥40 campaigns run; artifact riproducibile; cost report.
  - [ ] Run riproducibile di bot goal/explorer/adversarial con seed e artifact.
  - [ ] Almeno 40 campagne; report su completion, corruption, cost, safety e context cap.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/security/`; `docs/operations/`; `docs/testing/`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-070 — Staging tests, backup restore, incident docs

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `XL`
- **Dipendenze:** BL-063–BL-069
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §23 Requisiti non funzionali; `docs/MVP_SPEC.md` §26.10 Performance e chaos; `docs/MVP_SPEC.md` §29.8 Disaster recovery; `docs/MVP_SPEC.md` §32.4 Go/no-go; `docs/MVP_SPEC.md` §31 `BL-070`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come operatore voglio load/chaos/restore e runbook.
- **Deliverable:** Staging tests, container build riproducibile con SBOM e image scan, backup restore, deploy/rollback hardening e incident docs.
- **Criterio di accettazione:** SLO pass; restore checksum; no Sev1; go/no-go signed.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: SLO pass; restore checksum; no Sev1; go/no-go signed.
  - [ ] Load, soak, chaos, provider outage, deploy rollback e backup restore drill in staging.
  - [ ] Container build, SBOM e image scan fail-closed con artifact riferito al commit candidato.
  - [ ] Go/no-go report: SLO/costi/security/Sev1 e checksum restore conformi.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/security/`; `docs/operations/`; `docs/testing/`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### DOC-SEC-001 — Threat model e policy di moderazione operative

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-063, BL-065, BL-066, BL-067
- **Dipendenze operative aggiuntive:** GOV-002
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §22; `docs/MVP_SPEC.md` AC-22/AC-23
- **Obiettivo:** Documentare asset, trust boundary, abuse cases, policy, response e controlli verificabili.
- **Deliverable:** `docs/security/THREAT_MODEL.md`, `docs/security/MODERATION_POLICY.md`, security test matrix, incident escalation e data handling.
- **Criterio di accettazione:** Ogni minaccia P0 ha controllo, test, owner e residual risk; input/output critical falliscono in modo sicuro e l’accesso cross-tenant resta impossibile.
- **Test obbligatori prima di `DONE`:**
  - [ ] Threat-model review con STRIDE/abuse cases e mapping a test.
  - [ ] Policy fixtures validate e safety eval critical pass.
  - [ ] `docs:check`; nessun secret/PII nei sample o log allegati.
- **Documentazione e contesto:** Tutti i deliverable del task; aggiornare `docs/CONTEXT.md` e traceability
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### DOC-OPS-001 — Runbook di esercizio, deploy, backup, recovery e cost control

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `L`
- **Dipendenze:** BL-064, BL-065, BL-066, BL-067, BL-070
- **Dipendenze operative aggiuntive:** DOC-SEC-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §23, §24, §28, §29; `docs/MVP_SPEC.md` §32.4 Go/no-go
- **Obiettivo:** Permettere a un operatore di diagnosticare, degradare, ripristinare e fermare il sistema con procedure provate.
- **Deliverable:** `docs/operations/RUNBOOK.md`, deploy/rollback, queue/provider outage, budget breach, backup restore, data requests, incident severity, dashboards/alerts e kill switches.
- **Criterio di accettazione:** Ogni procedura critica è stata eseguita in staging e include precondizioni, comandi, verifica, rollback e owner.
- **Test obbligatori prima di `DONE`:**
  - [ ] Game-day walkthrough di provider outage, queue stuck, budget exceeded e rollback.
  - [ ] Restore drill con checksum e prova di accesso post-recovery.
  - [ ] `docs:check` e verifica che comandi/runbook coincidano con IaC/scripts correnti.
- **Documentazione e contesto:** `docs/operations/RUNBOOK.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### DOC-TEST-001 — Documentazione finale di testing, AI eval e release evidence

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-068, BL-069, BL-070, DOC-SEC-001, DOC-OPS-001
- **Dipendenze operative aggiuntive:** QA-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §26, §27, §32, §35
- **Obiettivo:** Rendere riproducibile la validazione del prodotto e collegare ogni criterio P0 a evidenze concrete.
- **Deliverable:** `docs/testing/TEST_STRATEGY.md`, `docs/testing/AI_EVALS.md`, `docs/testing/RELEASE_EVIDENCE.md`, traceability completa AC-01..25.
- **Criterio di accettazione:** Un checkout e gli accessi staging necessari consentono di rieseguire la suite e verificare ogni AC; report, seed, versioni modello/prompt/schema e limiti sono registrati.
- **Test obbligatori prima di `DONE`:**
  - [ ] Eseguire docs checker e traceability completeness: AC-01..25 senza buchi.
  - [ ] Re-run campione di unit/integration/E2E/security/eval/bot/load da istruzioni.
  - [ ] Verificare che ogni report riporti commit, environment, seed/config e timestamp assoluto.
- **Documentazione e contesto:** Tutti i deliverable del task; freeze del registro documenti per release candidate
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### GATE-M7 — Exit gate Milestone 7 — Hardening

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GATE-M6, BL-063..BL-070, DOC-SEC-001, DOC-OPS-001, DOC-TEST-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §30 Milestone 7; `docs/MVP_SPEC.md` §32; `docs/MVP_SPEC.md` §35.4
- **Obiettivo:** Validare in modo integrato tutti i deliverable di M7 prima di autorizzare il lavoro della milestone successiva.
- **Deliverable:** Report di exit gate M7, demo riproducibile, evidenze e aggiornamento della dashboard.
- **Criterio di accettazione:** Tutti i criteri globali passano; nessun Sev1 aperto; SLO/load/restore/costo validati; eval critical 100%; staging e production separati.
- **Test obbligatori prima di `DONE`:**
  - [ ] Security/safety/eval/load/chaos/restore suite completa.
  - [ ] Runbook game day e rollback/kill switch.
  - [ ] Release evidence e traceability complete.
- **Documentazione e contesto:** `docs/TASKS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, documenti della milestone, release evidence progressiva
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

## 17. Backlog differito

I task seguenti restano `DEFERRED`. Non devono essere avviati automaticamente: richiedono completamento dei P0, decisione del Product Owner e revisione di scope/costi/architettura quando indicato.


## Backlog P1

### BL-071 — Player-safe event chronology

- **Stato:** `DEFERRED`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P1` / `M`
- **Dipendenze:** BL-036, BL-056, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §21 Interfaccia utente; `docs/MVP_SPEC.md` §25 Analytics; `docs/MVP_SPEC.md` §6.2 Incluso P1; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-071`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio una timeline degli eventi principali.
- **Deliverable:** Player-safe event chronology.
- **Criterio di accettazione:** No hidden event; filter/accessible.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: No hidden event; filter/accessible.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; documento di design dedicato prima dell’avvio
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-072 — Rating/tag events e dashboard

- **Stato:** `DEFERRED`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P1` / `M`
- **Dipendenze:** BL-025, BL-040, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §25 Analytics; `docs/MVP_SPEC.md` §6.2 Incluso P1; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-072`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come Product voglio feedback su coerenza e narrativa.
- **Deliverable:** Rating/tag events e dashboard.
- **Criterio di accettazione:** Opt-out; no free text required; funnel visible.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Opt-out; no free text required; funnel visible.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; documento di design dedicato prima dell’avvio
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-073 — OIDC providers allowlisted

- **Stato:** `DEFERRED`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P1` / `M`
- **Dipendenze:** BL-006, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §22.2 Autenticazione; `docs/MVP_SPEC.md` §6.2 Incluso P1; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-073`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come utente voglio social login.
- **Deliverable:** OIDC providers allowlisted.
- **Criterio di accettazione:** Account linking sicuro; no duplicate identity.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Account linking sicuro; no duplicate identity.
  - [ ] OIDC integration test per linking, collision, revoca e provider error.
  - [ ] Security test state/nonce/PKCE e nessuna identità duplicata.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; documento di design dedicato prima dell’avvio
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-074 — Narrative compilation P1

- **Stato:** `DEFERRED`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P1` / `M`
- **Dipendenze:** BL-062, BL-067, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §22.11 Esportazione/eliminazione; `docs/MVP_SPEC.md` §17.7 Epilogo; `docs/MVP_SPEC.md` §6.2 Incluso P1; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-074`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio esportare la cronaca in Markdown.
- **Deliverable:** Narrative compilation P1.
- **Criterio di accettazione:** Sanitized, no hidden facts, signed URL.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Sanitized, no hidden facts, signed URL.
  - [ ] Component test UI per happy, validation, loading, error e retry state.
  - [ ] E2E keyboard-only e accessibility scan WCAG 2.2 AA sulle schermate modificate.
  - [ ] API/domain negative tests: il server ricalcola e rifiuta payload manipolati.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; documento di design dedicato prima dell’avvio
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`


## Backlog P2

### BL-075 — Catalog expansion dopo bilanciamento

- **Stato:** `DEFERRED`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P2` / `L`
- **Dipendenze:** GATE-MVP, BL-011, BL-064, BL-069
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §14 Rules Engine; `docs/MVP_SPEC.md` §3.3 Obiettivi P2/Post-MVP; `docs/MVP_SPEC.md` §31 `BL-075`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come designer voglio un quarto archetipo o più abilità.
- **Deliverable:** Catalog expansion dopo bilanciamento.
- **Criterio di accettazione:** Nuovi contenuti passano rules/eval; no breaking campaigns.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Nuovi contenuti passano rules/eval; no breaking campaigns.
  - [ ] Prima dell’avvio: nuova specifica/ADR, threat/cost model e acceptance suite approvati.
  - [ ] Nessuna implementazione può riusare assunzioni MVP incompatibili senza test di migrazione.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; documento di design dedicato prima dell’avvio
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** Attivabile solo dopo dati di costo, eval e bilanciamento verificati sul release gate; la condizione non sostituisce una dipendenza con testo libero.


## Post-MVP

### BL-076 — Localization, prompt/eval/moderation

- **Stato:** `DEFERRED`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `Post-MVP` / `XL`
- **Dipendenze:** GATE-MVP, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §5 Assunzione A-07; `docs/MVP_SPEC.md` §3.3 Obiettivi P2/Post-MVP; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-076`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come prodotto voglio supportare una seconda lingua.
- **Deliverable:** Localization, prompt/eval/moderation.
- **Criterio di accettazione:** Suite completa per lingua e UI localizzata.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Suite completa per lingua e UI localizzata.
  - [ ] Prima dell’avvio: nuova specifica/ADR, threat/cost model e acceptance suite approvati.
  - [ ] Nessuna implementazione può riusare assunzioni MVP incompatibili senza test di migrazione.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; documento di design dedicato prima dell’avvio
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** Prima dell’attivazione servono specifica di localizzazione e baseline UX per lingua; `GATE-MVP` rende la dipendenza verificabile.

### BL-077 — Multi-owner, websocket, concurrency redesign

- **Stato:** `DEFERRED`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `Post-MVP` / `XL`
- **Dipendenze:** GATE-MVP
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §7 Non-obiettivi; `docs/MVP_SPEC.md` §11.6 Consistenza e concorrenza; `docs/MVP_SPEC.md` §3.3 Obiettivi P2/Post-MVP; `docs/MVP_SPEC.md` §31 `BL-077`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio una modalità cooperativa.
- **Deliverable:** Multi-owner, websocket, concurrency redesign.
- **Criterio di accettazione:** Nuovo spec; non riusa lock single-player senza redesign.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Nuovo spec; non riusa lock single-player senza redesign.
  - [ ] Prima dell’avvio: nuova specifica/ADR, threat/cost model e acceptance suite approvati.
  - [ ] Nessuna implementazione può riusare assunzioni MVP incompatibili senza test di migrazione.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; documento di design dedicato prima dell’avvio
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** Prima dell’attivazione è obbligatorio un ADR accepted su multi-owner, websocket, lock, consistenza e autorizzazione; non rappresentarlo come dipendenza testuale.

### BL-078 — STT/TTS, streaming audio, safety

- **Stato:** `DEFERRED`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `Post-MVP` / `XL`
- **Dipendenze:** GATE-MVP, BL-063, BL-064, BL-079
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §7 Non-obiettivi; `docs/MVP_SPEC.md` §22 Sicurezza e moderazione; `docs/MVP_SPEC.md` §28 Costi AI; `docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-078`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come giocatore voglio parlare e ascoltare il DM.
- **Deliverable:** STT/TTS, streaming audio, safety.
- **Criterio di accettazione:** Nuovo threat/cost model e accessibility fallback.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Nuovo threat/cost model e accessibility fallback.
  - [ ] Prima dell’avvio: nuova specifica/ADR, threat/cost model e acceptance suite approvati.
  - [ ] Nessuna implementazione può riusare assunzioni MVP incompatibili senza test di migrazione.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; documento di design dedicato prima dell’avvio
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** Prima dell’attivazione sono obbligatori ADR e review di costi, privacy, sicurezza audio e fallback accessibile; le review non sono dipendenze testuali.

## 18. Gate finale MVP

### GATE-MVP — Release gate MVP — GO/NO-GO

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** GATE-M0..GATE-M7
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §32.1 AC-01..AC-25; `docs/MVP_SPEC.md` §32.4 Go/no-go; `docs/MVP_SPEC.md` §35.4
- **Obiettivo:** Autorizzare il rilascio solo sulla base di evidenze riproducibili, non di una valutazione narrativa o manuale informale.
- **Deliverable:** Release candidate immutabile, matrice AC firmata, report SLO/costi/security/eval/bot/restore, legal/policy approvals, rollback e kill-switch evidence.
- **Criterio di accettazione:** AC-01..AC-25 PASS; nessun SEV0/SEV1; backup restore, rollback e kill switch provati; price/model snapshot e policy approvati; staging/production isolati.
- **Test obbligatori prima di `DONE`:**
  - [ ] Rieseguire o verificare freshness di tutte le evidenze AC-01..AC-25 sul commit candidato.
  - [ ] Smoke completo account→personaggio→campagna→40+ turni→finale→epilogo.
  - [ ] Verificare che nessun task P0 o gate sia non-DONE e che ogni evidenza contenga commit/environment/versioni.
- **Documentazione e contesto:** `docs/testing/RELEASE_EVIDENCE.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, changelog/release notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

## 19. Tracciabilità dei criteri globali

Questa matrice è un indice iniziale. `GOV-002` deve trasformarla in `docs/TRACEABILITY.md` con path reali dei test e delle evidenze.

| AC | Capacità | Task principali | Evidenza minima |
|---|---|---|---|
| AC-01 | Account | BL-005, BL-006 | identity unit/integration/E2E + audit |
| AC-02 | Personaggio valido | BL-011..BL-015, DOC-CHAR-001 | domain/property/API/E2E |
| AC-03 | Massimo due compagni | BL-016, DOC-CHAR-001 | API/DB constraint/E2E |
| AC-04 | Configurazione campagna | BL-018, BL-019, BL-020 | E2E config + moderation |
| AC-05 | Campaign Bible valida | BL-021..BL-025 | schema/semantic/50 fixtures |
| AC-06 | Prologo | BL-026, BL-027 | contract/eval/E2E |
| AC-07 | Almeno 40 turni | BL-028..BL-041, BL-057, BL-069 | bot campaign + integrity/context report |
| AC-08 | Input libero e scelte | BL-028, BL-034, BL-040, BL-041 | E2E interaction modes |
| AC-09 | Prove backend | BL-042, BL-043, BL-051 | unit/golden/integration/UI dice |
| AC-10 | Combattimento deterministico | BL-042, BL-045, BL-046, BL-051 | golden/property/E2E |
| AC-11 | Retry inventario | BL-036, BL-044, BL-047 | idempotency/concurrency |
| AC-12 | NPC/relazioni coerenti | BL-048, BL-052..BL-058 | eval + 40-turn bot |
| AC-13 | Knowledge boundary | BL-053, BL-055, BL-057 | canary-secret eval leak=0 |
| AC-14 | Persistenza | BL-036, BL-037 | restart/chaos/integrity |
| AC-15 | Interruzione/ripresa | BL-037..BL-039 | E2E reconnect/replay/checksum |
| AC-16 | Eventi auditabili | BL-036, BL-041, BL-047..BL-050 | event integrity report |
| AC-17 | Retry senza effetti doppi | BL-028..BL-036, BL-044, BL-047 | 20-way concurrency/fault injection |
| AC-18 | Recovery output AI invalido | BL-034, BL-035 | invalid JSON/repair/fallback/no commit |
| AC-19 | Costi AI | BL-021, BL-064 | usage completeness/budget alerts |
| AC-20 | Conclusione | BL-049, BL-059..BL-061, BL-069 | ending gate + bot completion |
| AC-21 | Epilogo | BL-062 | E2E + factuality eval |
| AC-22 | Moderazione | BL-020, BL-063 | safety integration/eval |
| AC-23 | Isolamento utenti | BL-007, BL-066, BL-067 | IDOR/security matrix |
| AC-24 | Evaluation suite | BL-068, BL-069 | 48+ eval + report |
| AC-25 | Staging/production separati | BL-003, BL-080, BL-070, DOC-OPS-001 | IaC/environment/restore review |


## 20. Registro dell’ultima esecuzione

Compilare questa sezione durante il lavoro; mantenerne una sola istanza per il task attivo. Alla chiusura, trasferire le informazioni sintetiche nella card del task e conservare qui l’ultima esecuzione finché non viene selezionato il task successivo.

```yaml
active_task: GOV-002
last_completed_task: BL-010
next_ready_task: null
status: IN_PROGRESS
progress: 25
started_at: 2026-07-15T18:15:00+02:00
candidate_at: null
cycle_target_minutes: 120
cycle_actual_minutes: null
updated_at: 2026-07-15
agent: Codex development agent
git_branch: codex/gov-002-document-integrity
base_commit: 15382d547638333e33992be96479a6f0cbff1a29
candidate_head: null
spec_sha256: d07620bb477a50bf8309c6c24729baaaa45a4a29499e624741a5fcdaa514a329
context_verified: true
test_status: PARTIAL
```

## Contesto letto

- [x] `docs/MVP_SPEC.md` sezioni indicate nel task
- [x] `docs/TASKS.md`
- [x] `AGENTS.md`
- [x] `docs/CONTEXT.md`
- [x] riferimenti GOV-002 — `docs/MVP_SPEC.md` §§26.12, 32.3 e 35.1; card GOV-002; design approvato
- [x] documentazione corrente — `docs/README.md`, `docs/TRACEABILITY.md`, `docs/CHANGELOG.md` e registro ADR
- [x] codice/test interessati — document policy, contract generator, task graph, workflow Quality e relative suite contract

## Piano e scope

- **Corsia:** `HIGH_RISK` perché cambiano dependency graph/lockfile e workflow CI; un full gate sul candidato e clean-checkout verification obbligatoria.
- **Obiettivo verificabile:** `docs:check` blocca metadata, link/anchor, riferimenti `§`, Mermaid, registro ADR, task graph e generated drift con output deterministico.
- **File/moduli previsti:** document/integrity/Mermaid policy, worker bounded, package scripts, workflow Quality, registro ADR, test e soli documenti semanticamente interessati.
- **Azioni esterne:** sola documentazione tecnica ufficiale e registry npm read-only; nessun provider, account, deploy o modifica Vercel.
- **Test previsti:** TDD su anchor/section refs/ADR/Mermaid, composizione contract drift/task graph, CI policy, audit dependency, full gate, clean checkout e review indipendente.
- **Rischi/failure path:** path escape, anchor ambiguo, section range inesistente, parser Mermaid bloccato o oversized, ADR non registrato, generated drift e rimozione del gate CI.
- **Fuori scope:** rendering SVG/PNG, lint editoriale, link HTTP esterni, modifica dei contratti applicativi, UI, provider e Vercel.

## Diario sintetico

| Data/ora assoluta | Progresso | Decisione/finding | Test/evidenza | Prossimo passo |
|---|---:|---|---|---|
| 2026-07-15 18:15 +02:00 | 25% | Selezionato GOV-002 perché tutte le dipendenze sono `DONE`; approvata policy modulare con Mermaid parse-only bounded e riuso dei checker esistenti. | Base `15382d5`; spec SHA `d07620b`; `verify:docs` baseline exit `0` con 33 documenti, task graph e secret scan `PASS`; registry npm conferma `mermaid@11.16.0` MIT. | Versionare design, ottenere review utente e creare il piano TDD prima del codice. |
| 2026-07-15 15:40 +02:00 | 100% | Re-check indipendente senza P0/P1 residui. I primi due full hanno esposto ownership di formattazione generated e risoluzione del pnpm globale nello script annidato; aggiunte regressioni fail-closed e mantenuto un unico checker diretto dopo la build. Candidato branch-local terminale in 61 minuti. | Full finale `TURBO_FORCE=true corepack pnpm@11.13.0 verify` exit `0` in 86,8 s: lint/build 11, typecheck 13, unit 84/1 skip host, integration 13, DB 13, contract 56, security 26/3 skip host, docs 31/11 e artifact 3.942. | Committare il candidato, verificarlo da checkout pulito e pubblicare una sola PR protetta; nessuna azione Vercel. |
| 2026-07-15 15:34 +02:00 | 90% | Living docs e riferimenti ora descrivono `api-contract-v1`, policy immutable-major e delivery BL-008 reale; restano solo gate HIGH_RISK e re-review mirata. | `verify:docs` exit `0`: 31 documenti/11 modificati, task graph e secret scan PASS. | Audit dipendenze, full verify e re-check dei quattro P1. |
| 2026-07-15 15:30 +02:00 | 75% | La review indipendente ha trovato quattro P1 reali: UUID canonici trattati come slug, version gate `GameEvent` aperto, nessuna baseline compatibility esterna e root generated collegabile. TDD rosso→verde: UUIDv7 sui record, literal v1, freeze dei major contro tree Git protetto e guard symlink/junction prima delle mutazioni. | Runtime RED 3/7 e due moduli policy mancanti; GREEN `test:contract` 55/55, unit artifact/compatibility/owned path 7/7, `contracts:check`, Prettier ed ESLint mirati exit `0`; fixture Git/junction soltanto in temp. | Allineare living docs, eseguire audit e gate HIGH_RISK, poi re-review dei quattro P1. |
| 2026-07-15 14:39 +02:00 | 25% | Selezionato BL-009 dal merge BL-008 verificato; approvata slice Zod-first components-only, senza anticipare route, Bible completa o tool concreti. | Base `ccecd683`; post-merge main `29415397361` 5/5; preflight/grafo/docs verdi; design e piano versionati nello stesso change set. | Implementare batch TDD runtime, artifact e CI. |
| 2026-07-15 14:21 +02:00 | 100% | Re-check del P1 senza finding residui e candidato corretto branch-local terminale; audit resta high/fail-closed, lockfile e dependency graph invariati. | Full `TURBO_FORCE=true corepack pnpm@11.13.0 verify` exit `0` in 85,1 s: lint/build 11, typecheck 13, unit 77/1 skip, integration 13, DB 13, contract 36, security 26/3 skip, artifact 3.906. | Committare, verificare install frozen + full gate da clean worktree, push e attendere una sola nuova CI PR. |
| 2026-07-15 14:18 +02:00 | 90% | La review del solo P1 ha provato che una ricerca per sottostringa accettava `--ignore-registry-errors`. Il validator ora richiede un unico step con comando audit esatto, senza flag o shell suffix aggiuntivi. | Regressione inizialmente rossa, poi `tests/contracts/ci-workflow.test.mjs` 5/5 e `ci-workflow-policy` PASS. | Re-check del solo finding, full gate finale, commit e clean checkout. |
| 2026-07-15 14:05 +02:00 | 90% | La prima CI della PR #20 ha isolato un'incompatibilità dell'audit, non una vulnerabilità: pnpm 10 usa endpoint legacy ora `410`. Pin aggiornato a pnpm 11 bulk-capable senza ignore; policy progetto migrate in YAML, script `@sentry/cli` negato e install impliciti pre-script sostituiti da errore fail-closed. Lockfile invariato. | Run `29413088682`: Quality/Tests verdi, solo Security rosso; TDD rosso→verde su pin e workspace config, 11/11 contract PASS; audit high pulito; `verify:docs` PASS; `verify:affected` 33/33 PASS. | Eseguire full/clean gate con pnpm 11, re-review del solo P1, push e attendere la nuova CI. |
| 2026-07-15 13:44 +02:00 | 100% | Review indipendente senza P0/P1 e candidato branch-local terminale. Il primo full ha esposto soltanto Docker Desktop spento; nessun file è cambiato, la suite DB isolata è tornata verde e il rerun completo ha chiuso il gate. | Primo full exit `1` in 67,8 s su start container; DB isolato 13/13 exit `0`; full `TURBO_FORCE=true pnpm verify` exit `0` in 86,2 s: lint 11, typecheck 13, build 11, unit 77/1 skip, integration 13, DB 13, contract 32, security 26/3 skip, artifact 3.906. | Congelare il commit, eseguire install frozen + full verify da worktree pulito, poi una sola PR protetta. |
| 2026-07-15 13:25 +02:00 | 90% | Implementata la baseline completa e chiusi i failure path di privacy, concorrenza, startup e bundle. Il target HIGH_RISK di 120 minuti è stato superato perché la stessa slice ha richiesto hardening condiviso del sanitizer/DSN e wiring verificato su tre runtime; nessuna espansione a provider o deploy. | Head `3d278655`; unit 77/1 skip, integration 13, contract 32, security 26/3 skip e `verify:affected` 33/33, tutti exit `0`; `verify:docs` 27 documenti/11 modificati; artifact client senza marker Node/Sentry server. | Eseguire una review indipendente, l'unico full gate e il checkout pulito. |
| 2026-07-15 10:10 +02:00 | 25% | Selezionato `BL-008` da `main` pulita; approvato kernel condiviso con OTel unica autorità trace, Pino redatto e Sentry error-only off-by-default. | Base `99a4f3f5441fd5a64657d2ad54fd7342e3fefef2`; spec SHA invariato; `verify:docs` PASS su 25 documenti/5 modificati; test implementativi `NOT_RUN`. | Review del design versionato, poi piano TDD dettagliato prima del codice. |
| 2026-07-14 19:55 +02:00 | 100% | Chiuso il candidato in 43 minuti con delivery derivata, una sola review più re-check dei P1 e nessun commit di sola evidenza. | Unico full `verify` exit `0` in 72,70 s; 11 lint/build, 12 typecheck, 55/1 unit, 9 integration, 13 database, 26 contract, 23/3 security; `verify:affected` finale 6,96 s; nessun P0/P1. | Pubblicare una sola PR protetta; dopo il merge selezionare `BL-008`. |
| 2026-07-14 19:46 +02:00 | 90% | Auditato il ciclo agente e implementati corsie/budget, stato delivery derivato, docs gate tracked+untracked e selezione workspace fail-closed. La prima review ha rilevato tre P1 reali, corretti senza indebolire CI/Ruleset. | Baseline: 17/28 commit docs; BL-080 11 PR/23 pipeline/115 job. Targeted 11/11 `PASS`; `verify:docs` exit `0` in 2,65 s; `verify:affected` exit `0` in 7,22 s. | Chiudere la re-review dei P1 ed eseguire l’unico full `verify` finale. |
| 2026-07-14 | 90% | Implementata la baseline PostgreSQL 17/pgvector 0.8.2 pin a digest con runner `node-pg-migrate`, contract/checksum, composition root config, rollback local-only, harness Docker e CI. Le review hanno chiuso override di routing URL, file migration sconosciuti/symlink, cleanup e concorrenza reale. | Mirati 13/13 + 13/13 `PASS`; full `verify` working tree exit `0` in 73,4 s senza cache: unit 47/1 skip, integration 9, DB 13, contract 22, security 23/3 skip, artifact 3.238; audit high pulito. | Congelare e verificare il commit pulito, poi pubblicare la PR protetta. |
| 2026-07-14 | 90% | Congelato e verificato il commit di implementazione da worktree pulito con lockfile frozen e cache Turbo forzatamente ignorata. | Commit `b1030501fd82d0396add5ff4f9df10fbaa405d0b`; install frozen exit `0` in 0,6 s; full `verify` exit `0` in 66,2 s, stessi conteggi del gate working tree e artifact 3.238 file. | Pubblicare PR, attendere CI remota e chiudere task/evidenze senza bypass. |
| 2026-07-14 | 100% | Pubblicata la PR protetta e acquisito il merge gate remoto senza bypass; `BL-004` chiuso e `BL-008` reso unico task `READY`. | [PR #18](https://github.com/Emacore17/dnd-ai/pull/18), head `aaa17b2ada8a7bab73e3877f263b2c46c5865c13`, [run `29351291907`](https://github.com/Emacore17/dnd-ai/actions/runs/29351291907) 5/5 job `SUCCESS`, inclusi suite PostgreSQL reale e `CI / Merge gate`. | Integrare la PR tramite Ruleset, verificare CI post-merge e selezionare `BL-008` da `main`. |
| 2026-07-13 | 25% | Creato `AGENTS.md` con protocollo cold-start, invarianti, standard di codice/test/documentazione e policy browser. | Link esistenti verificati; SHA-256 `1c53683f00393fd1a992287d7efdd8d1b8bb9b107b6804869ead80761148756c`; suite GOV completa ancora `PARTIAL`. | Creare i quattro documenti living mancanti e simulare la cold start. |
| 2026-07-13 | 100% | Completati contesto, indice, tracciabilità, changelog; allineata la direzione UX/UI mobile-first con studio, ADR e `BL-079`. | Structural audit e cold-start finale `PASS`; spec SHA `b639a75c26ca0dc17e54d9f1c8816de7514a5e2d54ea4cfa733f275e18fbcd84`. | Selezionare `BL-001` in una nuova sessione di sviluppo. |
| 2026-07-13 | 25% | Auditati 101 task e 79 righe BL: grafo senza cicli/ID orfani; formalizzati i consumer UI di `BL-079`, le dipendenze differite e l’ownership del browser harness. Selezionato `BL-001`. | Nuova spec SHA `6c40a5c2b42d496c4977df157c19984175e643684cf5b2f1ec8e7ea47fc74578`; test implementativi ancora `NOT_RUN`. | Creare scaffold, checker e test negativi. |
| 2026-07-13 | 90% | Scaffold e policy implementati; corretto il failure path del pnpm globale; documentati overview, ADR-0002 e supply-chain allowlist. | `pnpm verify` `PASS`: 10/10 workspace lint/typecheck/build, 6/6 contract test, boundary/task graph `PASS`; manca la replica da worktree pulito. | Inizializzare Git, verificare il commit da worktree pulito e chiudere il task. |
| 2026-07-13 | 100% | Inizializzato Git e verificato il commit di implementazione da worktree detached pulito con cache forzatamente disabilitata. | Commit `6cda07a60022665f321b48dd82fbeb1d9bef586f`; frozen install `0`; `TURBO_FORCE=true pnpm verify` `0`; 10/10 workspace e 6/6 contract test. | Chiudere `BL-001` e rendere `BL-002` READY. |
| 2026-07-13 | 25% | Selezionato `BL-002`; auditati card, spec, ADR, comandi e trust boundary CI. Nessun remote Git configurato. | Preflight pulito su `74af894`; spec SHA `ed2c7882…`; task graph e 6/6 contract test risultano verdi dalla baseline. | Implementare workflow, test negativi, scansioni e artifact allowlisted. |
| 2026-07-13 | 75% | Implementati workflow fail-closed, action pin, cache pnpm-only, SAST/audit/secret scan, fan-in stabile e artifact allowlisted con manifest SHA. Il remote è stato collegato e il branch di lavoro creato. | Unit 5 pass/1 skip host; integration 3/3; contract 8/8; security 3/3; build 10/10; artifact 3.184 file verificati; audit `No known vulnerabilities found`. | Completare documentazione, `pnpm verify`, PR verde, Ruleset e PR negativa. |
| 2026-07-13 | 90% | Verificato il vincolo del piano GitHub: Ruleset e branch protection sul repository privato restituiscono `403`; Code Scanning non è disponibile e viene sostituito con SAST locale riproducibile senza attivare servizi a pagamento. | `pnpm scan:sast` exit `0`; fixture SAST negativa rilevata; API GitHub letta come admin. | Completare clean checkout e CI remota; mantenere BL-002 aperto finché l'enforcement non è disponibile. |
| 2026-07-13 | 90% | Documentazione, ADR, runbook, tracciabilità e gate locali completati; hardening parent junction, mirror traced e scanner supply-chain incluso. | `pnpm verify` exit `0` in 74,4 s; 10/10 lint/typecheck/build, 9+1 unit, 3 integration, 8 contract, 7 security, SAST/policy/scan/artifact PASS. | Committare, verificare da checkout pulito e aprire PR; Ruleset resta bloccata dal piano GitHub. |
| 2026-07-13 | 90% | Congelato e verificato il commit di implementazione da worktree detached pulito, con lockfile frozen e cache Turbo forzatamente ignorata. | Commit `f9330fed11e623e84fa7e32032dca95c4e7ee308`; install exit `0`; `TURBO_FORCE=true pnpm verify` exit `0` in 73,7 s. | Aprire PR, verificare CI/log/artifact e creare la PR negativa. |
| 2026-07-13 | 90% | La prima run Ubuntu ha rilevato un link Next interno al mirror standalone non presente su Windows; corretto il packager mantenendo il confinement fail-closed. | PR #1 run `29253365500`: quality/security/tests verdi, build e merge gate rossi come previsto; fix locale `pnpm verify` exit `0`. | Committare il fix, rieseguire clean verify e attendere la nuova run remota. |
| 2026-07-13 | 90% | Il fix Linux è stato congelato e verificato da worktree detached pulito senza cache riutilizzata. | Head `049748443aa6fa83496bfc5b996560312b6fd48d`; frozen install `0`; `TURBO_FORCE=true pnpm verify` `0` in 63,4 s. | Push e nuova run della PR #1. |
| 2026-07-13 | 90% | La seconda run Ubuntu ha eseguito il test symlink saltato su Windows e ristretto correttamente l'eccezione ai soli output Next con mirror configurato. | Run `29254060444`: quality/security verdi, tests/gate rossi, build skipped; working tree `TURBO_FORCE=true pnpm verify` `0` in 60,9 s. | Committare, clean verify e rieseguire la PR. |
| 2026-07-13 | 90% | Congelata e verificata da checkout pulito la policy symlink finale, inclusa l'eccezione Next e il rifiuto non-Next. | Head `7c6c7071d027c55aeffbc7279b8ca3765ea26c37`; frozen install `0`; `TURBO_FORCE=true pnpm verify` `0` in 66,0 s. | Push e terza run PR #1. |
| 2026-07-13 | 90% | CI positiva, log/artifact e PR negativa completati; BL-002 passa a `BLOCKED` sul solo enforcement GitHub non disponibile nel piano corrente. | Run `29254494868` 5/5 job PASS; log scan 5 job PASS; artifact 3.205 file PASS; run negativa `29254866626` gate FAIL ma PR #2 `MERGEABLE/UNSTABLE`. | Decisione Product Owner: piano compatibile oppure repository pubblico. |
| 2026-07-13 | 100% | Il repository è stato reso pubblico dal Product Owner; attivata la Ruleset `main-required-ci` senza bypass e chiusa la nuova prova negativa. | Ruleset `18877721` active/strict; run negativa `29256736728` con tests/gate rossi, artifact skipped e PR #3 `mergeStateStatus=BLOCKED`; `TURBO_FORCE=true pnpm verify` sul working tree di chiusura exit `0` in 53,9 s; branch di prova rimossa. | Chiudere BL-002 e rendere `BL-079` READY. |
| 2026-07-13 | 25% | Selezionato `BL-003`, definito un config contract service-scoped senza valori reali e stabilito che la delivery finale parta direttamente da `origin/main` per non includere `BL-079`. | Baseline di delivery `d530f3a0bab8cc20b8eee9f63ef222e6c4bb19f8`; test del change `NOT_RUN`. | Scrivere unit/contract/process smoke e implementare package/configuration boundary. |
| 2026-07-13 | 75% | Implementati package config, profili service-scoped, TLS/auth managed, startup API, boundary worker, template e scanner `.env`; allineati ADR, spec e dipendenza BL-004. | Unit config `7/7`; integration startup `5/5`; contract config `5/5`; security scanner mirato `PASS`; boundary/task graph e SAST `PASS`. | Completare review e isolare la delivery da `origin/main`. |
| 2026-07-13 | 90% | Chiusa la review codice/documenti senza finding P0/P1, rifiutati symlink e file non regolari prima della lettura, validati gli host negli URL e rimossa la dipendenza semantica circolare BL-079/BL-080. | Verify preliminare sulla baseline di sviluppo `PASS`; cherry-pick isolato su `d530f3a` in verifica. | Completare il gate da checkout pulito e attendere CI. |
| 2026-07-13 | 90% | Isolata la delivery; il full gate ha scoperto un private-hoist pnpm non tracciato nell'output Next. Il packager ora omette solo link immediati scoped/unscoped senza mirror dopo il containment check e mantiene gli altri failure path fail-closed. | Head `1090a2a`; `TURBO_FORCE=true pnpm verify` exit `0` in `54,9 s`; unit `17+1 skip`, integration `8`, contract `13`, security `9+3 skip`; artifact `3.191` file; review finale senza P0/P1. | Verificare da checkout pulito e attendere CI. |
| 2026-07-13 | 90% | Verificato il commit documentale da worktree detached pulito con lockfile frozen e cache Turbo forzatamente ignorata. | Head `0d3af18`; install exit `0`; full verify exit `0` in `59,6 s`; artifact `3.212` file; audit documentale finale senza P0/P1. | Pubblicare la PR isolata e attendere CI. |
| 2026-07-13 | 90% | La prima run Ubuntu ha dimostrato che il solo indice Git non enumerava un FIFO untracked; lo scanner ora scopre anche file non ignorati senza seguire symlink/junction e continua a rifiutare file non regolari prima della lettura. | Run `29285442650`: Quality/Tests verdi, Security `11/12`, artifact skipped e merge gate rosso; fix head `f571413`, full verify locale exit `0` in `60,4 s`, artifact `3.191` file. | Ripetere clean verify e CI Ubuntu. |
| 2026-07-13 | 100% | Verificati fix, checkout pulito e CI; BL-003 chiuso senza introdurre staging o secret reali. | Worktree pulito head `f571413`: install frozen forzata exit `0`, full verify exit `0` in `61,0 s`, artifact `3.554` file; run `29285998646` 5/5 job `SUCCESS`, security `12/12`, artifact Ubuntu `3.233` file; PR #6 `MERGEABLE/CLEAN`. | Eseguire `BL-080`; mantenere `BL-079` in backlog fino allo staging. |
| 2026-07-14 | 25% | Integrata PR #6 e selezionato `BL-080` da `main`; limitato il primo ambiente al web deployabile e alle sole risorse non-production, senza anticipare container API/worker o secret applicativi. | Base `0065c012`; spec SHA invariato; run CI post-merge `29315052002` completato con 5/5 job `SUCCESS`; test BL-080 `NOT_RUN`. | Verificare provider/account, formalizzare ADR e testare il contratto prima del provisioning. |
| 2026-07-14 | 50% | Proposta Vercel/`fra1` senza token persistenti; implementati desired state, `/health`, workflow dispatch trusted e smoke redatto. La review ha corretto action Preview `ready`/state `success`, identità Git/runtime/App, origin esatta, OIDC Trusted Sources, permission/step drift, body bounded e sequenza connect; auto-deploy resta disabilitato e la futura attivazione usa `{"**": false, "main": true, "release/production": false}`. Creato GitHub environment `staging` limitato a `main`, senza bypass, secret o variabili. | Full `TURBO_FORCE=true pnpm verify` finale PASS in 58,0 s: unit 29+1 skip host; integration 9/9; contract 16/16; security 11+3 skip host; artifact 3.205 file. Targeted deployment 17/17 PASS; `deploy:check:linked` fallisce atteso sui binding provider `null`. | Pubblicare e integrare la foundation disabilitata; dopo autorizzazione collegare il project, riservare Production Branch, configurare protezione/OIDC, abilitare Preview e provare deploy, failure e redeploy. |
| 2026-07-14 | 50% | Congelata la foundation disabilitata nel commit di implementazione; audit finale senza finding P0/P1/P2. | Commit `50efcbe620ad7c1fc6eb3cf1b79cdb27b0c383af`; verifica completa e failure path già registrati nel report BL-080. | Pubblicare e integrare la foundation; mantenere chiuso il collegamento provider fino all'autorizzazione esplicita. |
| 2026-07-14 | 50% | Foundation disabilitata integrata su `main`; nessuna risorsa Vercel o Preview creata. | PR #7; run PR `29321410036` e post-merge `29321531038` entrambe 5/5 job `SUCCESS`; artifact post-merge 3.247 file. | Ottenere autorizzazione esplicita prima di piano/termini e GitHub App Vercel. |
| 2026-07-14 | 50% | Autorizzato e verificato in forma redatta il solo account Vercel Hobby; creato `dnd-ai-web`, collegato a `Emacore17/dnd-ai` e configurato con root `apps/web`, Next.js, `fra1`, fork protection, system env/OIDC e Standard Protection predefinita. Nessun account alternativo, upgrade, env applicativa o deploy. La rilettura ha trovato Production Branch=`main`, Trusted Sources assente e grant/installation ID non ancora verificabile; l'automazione UI locale è fallita prima di salvare modifiche. | CLI Vercel `55.0.0`; account/plan check `AUTHORIZED`/`HOBBY`; project ID `prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`; repository ID `1299266814`; environment list vuota; deployment list vuota; provider API riletta; working tree iniziale pulito. | Mantenere `deploymentEnabled=false`; correggere la policy minimatch a globstar, completare Production Branch/Trusted Source/grant con dashboard autorizzata, poi registrare origin/installation ID e attivare tramite PR senza deploy su PR. |
| 2026-07-14 | 50% | Configurata e riletta via API la Trusted Source GitHub Actions con audience, repository/repository ID, ref, environment e target `preview` esatti. Acquisita l'installation ID `41079282`; il readback ufficiale ha però trovato `isAccessRestricted=false` e 8 repository accessibili. Il token locale effimero creato dal link è stato rimosso senza leggerlo. | Trusted Source exact-match `PASS`; namespace/installazione e repository grant riletti via API Vercel; Production Branch=`main`; zero deploy/env; hardening policy `**` coperto da contract test; nessuna modifica a permessi di repository estranei. | Far restringere l'installazione Vercel al solo `Emacore17/dnd-ai` senza interrompere altri progetti e impostare Production Branch=`release/production`; poi rileggere e continuare l'attivazione atomica. |
| 2026-07-14 | 50% | Chiuso l'audit di coerenza task/documenti e corretto il checker: la policy futura usa la globstar `**`, `apps/web/vercel.json` deve restare disabilitato finché `autoDeploy=false` e project ID/scope/origin/installation ID sono all-or-none. | `TURBO_FORCE=true pnpm verify` exit `0` in 75,4 s; unit 29+1 skip host; integration 9/9; contract 18/18; security 11+3 skip host; artifact 3.205 file; build web post-rimozione `.env.local`, task graph e secret scan `PASS`; `deploy:check:linked` expected exit `1` sui quattro binding null. | Pubblicare il change set di hardening senza attivare deploy; attendere i due interventi dashboard autorizzati prima della PR di attivazione. |
| 2026-07-14 | 50% | Pubblicato l'hardening branch-closed senza attivare Vercel; il Ruleset ha applicato il merge gate senza bypass. | Commit `1766406b9bd701a9880705b371fdc0b05a73abe1`; PR #10; run `29326093430` con Quality, Tests, Security, Build artifact e `CI / Merge gate` tutti `SUCCESS`; readback provider post-PR con zero deployment. | Integrare la PR, verificare la CI post-merge e mantenere i blocker dashboard prima dell'attivazione. |
| 2026-07-14 | 50% | Integrato l'hardening su `main`; su decisione esplicita del Product Owner il grant condiviso `41079282` resta invariato perché restringerlo toglierebbe accesso ad altri progetti. Creato `release/production` da `ef803add249d16ded6f94936c59531047c8a92fa` e applicata la Ruleset dedicata `release-production-required-ci` (`18926413`) con `CI / Merge gate` strict e `current_user_can_bypass=never`; la Ruleset main `18877721` è invariata e l'environment `staging` non è stato modificato. Corretta inoltre la dipendenza circolare dell'origin: l'alias documentato viene versionato prima del merge e confermato dal primo deploy. | Readback GitHub branch/Ruleset `PASS`; Vercel ancora a zero deploy. `TURBO_FORCE=true pnpm verify` exit `0` in 70,8 s: unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host, task/deploy policy, secret scan e artifact 3.205 file `PASS`. Automazione Vercel non conclusa: browser runtime `Cannot redefine property: process`; fallback Windows `GetCursorPos failed: Accesso negato. (0x80070005)`; nessuna modifica provider parziale. | Impostare e rileggere Production Branch Vercel=`release/production`; poi registrare i binding atomici e completare attivazione, deploy, smoke, failure e redeploy. |
| 2026-07-14 | 50% | Riletta Vercel Production Branch=`release/production`; avviato il change set di attivazione branch-closed da `main` pulita sul branch `codex/bl-080-enable-preview`. | CLI Vercel `55.0.0`: Production branch esatta e zero deployment; base `70f726d5a7fd9feed1a338d4c24bbedecc0bbe0b`; spec SHA `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c`; audit GitHub senza drift su Ruleset e environment. | Registrare binding atomici, abilitare soltanto `main` e verificare che la PR non produca deploy. |
| 2026-07-14 | 50% | Completato localmente il change set linked: binding atomici, deny-all con solo `main`, release esplicitamente negata e Quality gate linked; definita la prova negativa su branch effimera non mergiata. | `TURBO_FORCE=true corepack pnpm@10.34.5 verify` exit `0` in 65,3 s: lint/build 11/11, typecheck 12/12, unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host, policy/scan/artifact 3.205 file PASS. | Chiudere review indipendente, committare e aprire PR; confermare zero deployment prima del merge. |
| 2026-07-14 | 50% | Pubblicata e integrata l'attivazione branch-closed senza bypass; PR e CI non hanno prodotto deployment. | Commit `7335053`; PR #12; run `29331343752` 5/5 `SUCCESS`; merge `c64d095`; readback pre-merge Production Branch=`release/production` e zero deployment. | Osservare il primo deploy di `main` e fermarsi su qualunque target Production. |
| 2026-07-14 | 50% | Il primo deploy post-merge è risultato `target=production`: stop immediato, rimozione del deployment e hotfix fail-closed. | Deployment `dpl_Cag…`; activity `production` con alias assegnati; smoke run `29331534774` `skipped`; deployment e alias del progetto poi vuoti. Hotfix full verify PASS in 61,0 s; causa provider ancora sconosciuta. | Integrare il hotfix con zero nuovi deploy; investigare il target prima di ogni riattivazione. |
| 2026-07-14 | 50% | Integrato il contenimento e implementato il guard build Preview-only: il percorso Vercel richiede metadata `preview` concordanti, mentre Git auto-deploy resta spento. Il guard limita il completamento di un target errato, non la creazione iniziale del relativo record provider. Le review indipendenti finali non rilevano P0/P1/P2 residui. | Commit `519052649c88d84c45da92c3b35131819291a73a`; clean `TURBO_FORCE=true corepack pnpm@10.34.5 verify` exit `0` in 57,1 s, senza cache: unit 33 pass/1 skip host, integration 9/9, contract 18/18, security 14 pass/3 skip host, policy/scan/artifact verdi. Unit guard 4/4, security subprocess 3/3 e contract deployment 5/5; la regressione `--allow-local` + Production è coperta. PR #13/merge `61e5cbd` restano l'evidenza del contenimento remoto con zero deployment project-scoped per `dnd-ai-web`. | **SUPERSEDED dal freeze:** il bootstrap diagnostico previsto in questo checkpoint è già stato eseguito una sola volta e non va ripetuto. |
| 2026-07-14 | 50% | Il guard è stato integrato tramite PR #14 e merge `ee5f129`; CI PR/post-merge 5/5 verde e zero deployment project-scoped per `dnd-ai-web`. Il primo bootstrap CLI Preview è terminato sul limite file prima di creare una delivery: la root conteneva 773,1 MiB e una cache `.turbo` oltre il limite Hobby di 100 MB. La slice fail-closed `codex/bl-080-cli-payload` versiona denylist root-only e dry-run JSON obbligatorio. | PR #14; run PR `29335696502` e post-merge `29335856323`; readback `autoExposeSystemEnvs=true`, Production Branch=`release/production`, lista deployment `dnd-ai-web` vuota. CLI `55.0.0` exit `1` su `File size limit exceeded (100 MB)`; zero deployment project-scoped. TDD rosso, poi 14/14 mirati PASS; dry-run reale PASS con 158 entry/1.093.594 byte e nessun upload. Full `TURBO_FORCE=true corepack pnpm@10.34.5 verify` exit `0` in 69,1 s sul diff e 56,2 s sul commit pulito `13032743552654f9f68d87050eb11cabbdd92325`, senza cache: unit 39/1 skip host, integration 9/9, contract 18/18, security 17/3 skip host. | **SUPERSEDED dal freeze:** il retry previsto in questo checkpoint è già avvenuto e ha prodotto il secondo target mismatch; non ripeterlo. |
| 2026-07-14 | 50% | PR #15 ha integrato payload policy e dry-run bounded. Il solo bootstrap CLI autorizzato con selector Preview ha comunque creato un record Production; fermato il percorso, rimosso l'ID esatto e introdotto un interlock manuale fail-closed. Il controllo è procedurale/versionato: il possibile bypass diretto owner via CLI/dashboard resta vietato ma tecnicamente possibile. | PR #15 merge `1060228`; CI `29339984834` e `29340214947` 5/5; deployment `dpl_4yG…` osservato Production/`ERROR` e rimosso; `dnd-ai-web` project-scoped a zero deployment/alias, origin `404`, nessun nuovo smoke. Test mirati interlock 10/10 PASS; `deploy:bootstrap:check` exit atteso `1` con output statico `disabled`. Full `TURBO_FORCE=true corepack pnpm@10.34.5 verify` exit `0` in 61,9 s sul working tree e 57,2 s sul commit pulito `e5dff7bf371bd91321587fecadbd8f51264cc263`, sempre senza cache: lint/build 11/11, typecheck 12/12, unit 42/1 skip host, integration 9/9, contract 18/18, security 19/3 skip host, policy/scan/artifact 3.205 file PASS. | Aprire la PR del freeze senza deploy; consentire soltanto dry-run/readback/contenimento e mantenere BL-080 aperto finché il mismatch non ha una risoluzione verificabile. |
| 2026-07-14 | 50% | PR #16 ha integrato il freeze senza deploy. L'audit del tag CLI `55.0.0`, risolto al commit immutabile `11f0ceb`, ha circoscritto i fatti: parser/create args conservano Preview, ma `@vercel/client 17.6.4` azzera il target prima della POST; il comportamento first-deployment Production documentato da Vercel e la riproduzione CLI nell'issue aperta `#17069` formano l'ipotesi più forte, senza conferma/fix/workaround maintainer. `BL-080` passa a `BLOCKED/50%/PARTIAL`; `BL-004` diventa `READY`. | PR #16 merge `aa9342d`; CI `29343319207`/`29343526054` 5/5; Vercel project-scoped a zero deployment/alias. Record GitHub vuoto `5442987675`, creato accidentalmente dal readback `gh api -f`, eliminato per ID esatto; GET `404` e lista SHA `[]`. | Conservare il freeze, monitorare soltanto fonti ufficiali/provider issue e selezionare `BL-004`; nessun nuovo deploy reale. |
| 2026-07-14 | 50% | Allineati task, contesto, ADR, runbook e tracciabilità distinguendo omissione client provata, ipotesi server e blocco operativo; review indipendenti senza P0 residui. | Commit pulito `b84f4eb79000ab78b524d463582eb28013c9da2c`; `TURBO_FORCE=true corepack pnpm@10.34.5 verify` exit `0` in 58,1 s senza cache: lint/build 11/11, typecheck 12/12, unit 42 pass/1 skip host, integration 9/9, contract 18/18, security 19 pass/3 skip host, policy/scan/artifact 3.205 file PASS. | Pubblicare il solo change set documentale tramite PR protetta, poi selezionare `BL-004`; nessun deploy reale. |

## Chiusura

- **Commit/PR:** branch `codex/gov-002-document-integrity` su base `15382d547638333e33992be96479a6f0cbff1a29`; candidato e PR non ancora disponibili.
- **Comandi eseguiti:** preflight Git/fingerprint, audit mirato di checker/workflow e `corepack pnpm@11.13.0 verify:docs`.
- **Exit code:** baseline documentale `0`; test implementativi e full gate non ancora eseguiti.
- **Report/CI URL o path:** design GOV-002; CI task `N/A — implementazione non iniziata`.
- **Migration head:** `000002_feature_flags` invariato.
- **Contract/schema/event version:** `api-contract-v1` / SemVer `1.0.0` / `schemaVersion: 1`, invariati.
- **Prompt/model/eval version:** `N/A` — nessuna modifica AI.
- **Documenti aggiornati:** design GOV-002, task e contesto operativo.
- **Rischi residui/TODO tracciati:** review utente della spec, piano TDD, implementazione, gate HIGH_RISK e delivery protetta; freeze Vercel invariato.
- **Task successivo reso READY:** nessuno sul branch; lo stato canonico resta su `main` fino al merge. `BL-079` resta `BACKLOG` finché `BL-080` non fornisce staging reale.


## 21. Context Sync Log

Registrare soltanto cambiamenti che alterano il contesto operativo. Non usare questa tabella come sostituto di Git o degli ADR.

| Data | Commit | Task | Documento/componente | Modifica | Task da riesaminare |
|---|---|---|---|---|---|
| 2026-07-13 | `N/A` | Creazione `TASKS.md` | Baseline | Derivato il piano operativo dalla spec SHA `f6692930e752108b8ddba52867679514e1fd14e6343ba7b6736d9d6b61cb71b1`. | Tutti, alla prima esecuzione |
| 2026-07-13 | `N/A` | Allineamento BL-051 | `docs/MVP_SPEC.md` / tool suite | Corretto il conteggio da 21 a 23 tool per allinearlo all’allowlist obbligatoria. | BL-032, BL-051, DOC-RULES-001 |
| 2026-07-13 | `N/A` | GOV-001 | `AGENTS.md`, `TASKS.md`, `docs/MVP_SPEC.md` | Creato e validato l’entry point agente (SHA `1c53683f00393fd1a992287d7efdd8d1b8bb9b107b6804869ead80761148756c`), formalizzati workflow, clean code, documentazione e uso sicuro del browser; aggiunti backlink. Nuova spec SHA `fe49613992adf7f476bbd56bc279ca76ddfc79bfc7b8d20272da2142c5594a83` dovuta alla sola navigazione. | GOV-001, GOV-002, tutti i task alla cold start |
| 2026-07-13 | `N/A` | GOV-001 | Contesto living e UX/UI | Completato il bootstrap, accettata ADR-0001, aggiunto `BL-079` P0 e aggiornata la spec alla baseline mobile-first SHA `b639a75c26ca0dc17e54d9f1c8816de7514a5e2d54ea4cfa733f275e18fbcd84`. | BL-001, BL-002, BL-012, BL-019, BL-027, BL-040, QA-001, GOV-002 |
| 2026-07-13 | `6cda07a` | BL-001 | Backlog, monorepo e confini | Allineati consumer UX→`BL-079`, dipendenze differite e riferimenti; creati 10 workspace, policy import/task graph, test negativi, overview e ADR-0002. Spec SHA `5bdf152a6c535470d239ad72772603d17d53cc82cc3c02f09bf44cbe1ef47e90`. | BL-002, BL-003, BL-004, BL-079, GOV-002, QA-001 |
| 2026-07-13 | `6cda07a` | BL-001 closure | Front matter e baseline | Registrato il commit verificato nei documenti living; corpo normativo invariato. Nuova spec SHA `ed2c7882f94fa751e30dc6f1c73e279388891d7e0fcd686db30aad3b565096f6`. | Tutti i task aperti alla prossima cold start |
| 2026-07-13 | `f9330fe` | BL-002 | Pipeline, ADR-0003 e trust boundary | Aggiunti gate fail-closed, SAST/secret/audit, artifact allowlisted e remote GitHub; registrato il blocco Ruleset del piano privato senza modificare privacy o spesa. | BL-002, BL-070, QA-001, GOV-002 |
| 2026-07-13 | `0497484` | BL-002 CI fix | Artifact Next standalone | Accettati soltanto i symlink Linux già confinati nel mirror traced; ogni target esterno continua a richiedere rimappatura allowlisted. | BL-002, BL-070 |
| 2026-07-13 | `7c6c707` | BL-002 CI fix | Artifact negative path | Limitata l'eccezione ai soli output Next configurati; il negative test Linux non-Next resta fail-closed. | BL-002, BL-070 |
| 2026-07-13 | `7c6c707` | BL-002 remote evidence | GitHub PR/check/artifact | Run positiva e negativa, log scan e artifact remoto verificati; task bloccato unicamente dal piano GitHub che non espone Ruleset/branch protection sul repository privato. | BL-002, BL-079 |
| 2026-07-13 | `f1be878` | BL-002 closure | GitHub Ruleset e negative merge gate | Repository pubblico verificato; attivata Ruleset `18877721` active/strict/no bypass e confermato `mergeStateStatus=BLOCKED` sulla PR negativa #3/run `29256736728`. BL-002 chiuso e BL-079 reso READY. | BL-079, GOV-002, BL-070 |
| 2026-07-13 | `ae88583` | BL-002 post-merge | `main` e CI | PR #1 unita senza bypass; post-merge run `29257721274` con quality, tests, security, build artifact e merge gate tutti `SUCCESS`. | BL-079, GOV-002 |
| 2026-07-13 | `1090a2a` | BL-003 | Config/runtime, secret boundary e documentazione | Aggiunti `runtime-config-v1`, startup fail-fast, template/scanner `.env`, TLS/auth managed e ADR-0004; corretto il private-hoist artifact fail-closed; `BL-004` ora dipende dal profilo migration e `BL-080` non dipende semanticamente dalla shell BL-079. Spec SHA `7441fdb71426deb22e3106e5e03fe0b364a711bcc3f5ff776fb74f3ad544f43f`. | BL-004, BL-005, BL-008, BL-010, BL-079, BL-080, GATE-M0 |
| 2026-07-13 | `f571413` | BL-003 closure | Secret scanner, clean verification e CI | Aggiunta discovery ignore-aware dei file speciali untracked dopo il failure path FIFO Ubuntu; clean verify e run `29285998646` chiudono BL-003. BL-080 passa a READY; BL-079 resta BACKLOG. Spec SHA `0b7ce963316cb601c7178340876de1b8932bc63b7c672adb1b37554d3b139f0c`. | BL-004, BL-005, BL-008, BL-010, BL-079, BL-080, GATE-M0 |
| 2026-07-14 | `0065c01` | BL-080 start | Preview/staging scope e contesto | PR #6 integrata e post-merge CI `29315052002` PASS; selezionato BL-080 sul branch isolato con scope esterno limitato a web e risorse non-production. Nessun secret o provider resource creato. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `50efcbe` | BL-080 foundation | Desired state staging, health e smoke OIDC | Congelata la foundation disabilitata: manifest Vercel branch-closed, GitHub environment `staging`, workflow a sequenza chiusa con OIDC breve e verifiche locali complete. Il task resta al 50% finché binding, deploy, smoke e redeploy remoti non sono provati. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `52bf58d` | BL-080 remote evidence | PR #7, `main` e CI | Foundation disabilitata integrata; run PR `29321410036` e post-merge `29321531038` entrambe 5/5 job `SUCCESS`. Nessun deploy Vercel può partire finché i binding restano `null` e l'auto-deploy è spento. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `770206d` | BL-080 provider binding | Vercel Hobby e GitHub integration | Autorizzazione account esclusivo verificata in forma redatta; creato project `dnd-ai-web`, configurato `apps/web`/Next.js/`fra1` e collegato a `Emacore17/dnd-ai` senza env o deploy. Registrati project ID/scope; attivazione bloccata in modo sicuro perché Production Branch è ancora `main`, Trusted Sources e grant/installation ID non sono verificati. Policy futura corretta a globstar `**` con esclusione esplicita di `release/production`. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `770206d` + working tree | BL-080 provider trust | Trusted Source e grant GitHub App | Trusted Source OIDC configurata e riletta con claim exact-match; installation ID `41079282` acquisito. Il grant è però ampio (`isAccessRestricted=false`, 8 repository) e Production Branch resta `main`: nessun deploy e nessuna attivazione finché i due blocker non sono corretti. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `1766406` | BL-080 hardening evidence | PR #10 e CI | Policy globstar/production deny, config Vercel e binding all-or-none verificati localmente e nella run `29326093430` 5/5 `SUCCESS`; provider ancora a zero deployment. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `ef803ad` + working tree | BL-080 branch protection e rischio accettato | GitHub `release/production`, Ruleset e binding Vercel | La decisione PO supersede il precedente blocker repository-only: l'installazione condivisa `41079282` resta invariata per non togliere accesso ad altri progetti, con rischio residuo accettato e controlli project-level. `release/production` è stata creata da `main` a `ef803add249d16ded6f94936c59531047c8a92fa` e protetta da `release-production-required-ci` (`18926413`) strict/no-bypass; Ruleset main `18877721` ed environment `staging` sono invariati. Vercel resta a zero deploy e Production Branch=`main`: impostarla a `release/production` è l'unico blocker provider pre-attivazione. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `70f726d` + working tree | BL-080 activation | Vercel Branch Tracking, binding e policy Preview | Production Branch Vercel riletta come `release/production` con zero deployment; il change set registra atomicamente project ID/scope/origin/installation ID, abilita soltanto `main`, nega `release/production` e rende obbligatorio `deploy:check:linked`. Contract 18/18 e policy locali PASS; PR, Preview e smoke restano aperti. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `c64d095` + working tree | BL-080 activation incident | Vercel target, aliases e smoke dispatch | PR #12/CI sono verdi e la PR non ha creato deploy; il merge su `main` ha però creato `target=production`. Il payload `ready` è stato rifiutato dal workflow smoke, il deployment è stato rimosso dopo assegnazione alias e deployment/alias del progetto sono tornati vuoti. Hotfix fail-closed in corso; BL-079 resta BACKLOG. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `61e5cbd` + working tree | BL-080 containment and guard | Build target policy | PR #13 ha ripristinato lo stato fail-closed senza nuovi deploy. Avviato un guard versionato che separa build locale e build Vercel, rifiuta metadata mancanti/incoerenti e autorizza esclusivamente Preview; auto-deploy Git resta disabilitato. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `ee5f129` + working tree | BL-080 CLI payload | `.vercelignore` e dry-run policy | PR #14 ha integrato il guard senza deploy. Il primo bootstrap è fallito prima della delivery per cache locale oltre 100 MB; la nuova policy root-only e il parser JSON bounded rendono obbligatorio un dry-run sotto budget prima di ogni upload. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `1060228` + working tree | BL-080 deployment freeze | Mismatch target e interlock manuale | PR #15 ha integrato payload policy e dry-run bounded. Il successivo bootstrap con selector Preview ha creato un record Production, poi osservato `ERROR` e rimosso per ID esatto; deployment/alias project-scoped per `dnd-ai-web` sono tornati a zero. Il percorso manuale approvato ora fallisce chiuso finché una PR separata non riapre la policy; il possibile bypass diretto owner resta un rischio procedurale esplicito. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `1cb655a` | BL-080 deployment freeze implementation | Manual bootstrap policy e runbook | Interlock `manualDeployment.enabled=false`, gate CLI statico, binding provider obbligatori alla futura riapertura e contratti anti-drift/runbook sono congelati nel commit verificato. Full gate senza cache PASS; nessun deploy reale eseguito dal change set. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `e5dff7b` | BL-080 clean verification | Evidence sync | Il commit documentale finale è stato verificato da working tree pulito con full gate senza cache in 57,2 s; nessun deploy Vercel è stato eseguito. | BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `aa9342d` | BL-080 freeze integration e provider evidence | PR #16, target audit e blocco | Freeze integrato con CI PR/post-merge 5/5 e zero deployment. L'audit prova l'omissione client; regola first-deployment e issue `vercel/vercel#17069` sostengono un'ipotesi server non confermata e senza fix supportato. BL-080 passa `BLOCKED/PARTIAL`, BL-004 `READY`. Il metadata GitHub vuoto creato accidentalmente da `gh api -f` è stato rimosso per ID esatto e verificato assente. | BL-004, BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `b84f4eb` | BL-080 provider evidence clean verification | Source audit e allineamento living docs | Distinti fatti client e ipotesi server, corrette dipendenze/stati e verificato il commit pulito con full gate in 58,1 s; nessuna azione Vercel o GitHub Deployment eseguita. | BL-004, BL-079, GATE-M0, BL-070, DOC-OPS-001 |
| 2026-07-14 | `b103050` | BL-004 | PostgreSQL migration foundation | Aggiunti head `000001_postgresql_foundation`, contract `database-baseline-v1`, runner/manifest fail-closed, pgvector pin a digest, rollback local-only, harness/CI e ADR-0006. Mirati, full gate, audit e clean verify PASS; PR/CI in chiusura. | BL-005, BL-007, BL-015, BL-036, BL-008, QA-001, DOC-ARCH-001 |
| 2026-07-14 | `aaa17b2` | BL-004 closure | PR protetta, CI e stato backlog | [PR #18](https://github.com/Emacore17/dnd-ai/pull/18) e run `29351291907` 5/5 chiudono la baseline PostgreSQL; `BL-008` passa `READY`, `BL-079` resta `BACKLOG` e il freeze Vercel non cambia. | BL-005, BL-007, BL-008, BL-015, BL-036, BL-079, QA-001, DOC-ARCH-001 |
| 2026-07-14 | candidate head derivato da Git | GOV-003 throughput | Workflow agente e gate locali | Baseline 60,7% docs-only; introdotti corsie/budget, delivery derivata, docs check tracked+untracked e affected selection fail-closed. Candidate in 43 minuti, full gate unico e review senza P0/P1; CI/Ruleset/Vercel invariati. | BL-008, GOV-002 |
| 2026-07-15 | `99a4f3f` + design branch | BL-008 design | Osservabilità e privacy boundary | Approvato e versionato `observability-baseline-v1`: OTel unica autorità trace, Pino redatto, Sentry error-only off-by-default, test senza rete e nessuna azione Vercel; implementazione subordinata a review della spec scritta e piano TDD. | BL-010, BL-066, DOC-ARCH-001, GATE-M0 |
| 2026-07-15 | `3d27865` | BL-008 implementation | Runtime osservabilità e privacy boundary | Implementati kernel browser-safe, runtime OTel Node, Pino redatto, Sentry error-only lazy, plugin API e wrapper worker; gate mirati verdi e ADR-0007 accepted. Stato branch-local `IN_REVIEW/90%/PASSING`; full/clean/PR pendenti. | BL-010, BL-066, DOC-ARCH-001, GATE-M0 |
| 2026-07-15 | `3d27865` + candidate docs | BL-008 candidate | Full gate e stato branch-local | Review senza P0/P1; full gate verde dopo l'avvio del daemon Docker richiesto, senza modifiche al repository. Proposta `DONE/100%/PASSING`; clean checkout e delivery protetta restano gate esterni immediati. | BL-009, BL-010, BL-066, DOC-ARCH-001, GATE-M0 |
| 2026-07-15 | `b9b707f` + CI correction | BL-008 PR correction | Audit bulk e pnpm 11 | PR #20/run `29413088682` ha isolato HTTP `410` nel solo audit pnpm 10. Upgrade coerente a pnpm 11, policy progetto migrate in YAML e deny esplicito Sentry CLI; lockfile invariato, audit high e contratti mirati verdi. | BL-009, BL-010, BL-066, DOC-ARCH-001, GATE-M0 |
| 2026-07-15 | `ccecd683` | BL-008 closure | PR protetta e CI main | PR #20 integrata senza bypass; run post-merge `29415397361` con Quality, Tests, Security, Build artifact e merge gate 5/5 `SUCCESS`. BL-009 selezionato; freeze Vercel invariato. | BL-009, BL-010, BL-066, DOC-ARCH-001, GATE-M0 |
| 2026-07-15 | `ccecd683` + working tree | BL-009 implementation | `api-contract-v1` e compatibility boundary | Aggiunti Zod strict, UUIDv7/version gate, JSON Schema/OpenAPI components-only, generator deterministic, freeze Git dei major pubblicati e root guard junction; TDD mirato verde, full/clean/CI pendenti. | GOV-002, BL-021, BL-022, BL-028, QA-001 |
| 2026-07-15 | candidate head derivato da Git | BL-009 candidate | Full gate e review indipendente | Quattro P1 chiusi e re-check senza P0/P1; full finale exit `0` in 86,8 s dopo regressioni su ownership generated e pnpm annidato. Proposta `DONE/100%/PASSING`; clean checkout e delivery protetta restano gate esterni immediati. | GOV-002, BL-021, BL-022, BL-028, QA-001 |
| 2026-07-15 | candidate head derivato da Git | BL-010 candidate | Feature flag e kill switch server-side | Aggiunti `database-feature-flags-v1`, migration `000002_feature_flags`, store PostgreSQL con audit atomico, CAS, idempotenza/replay stabile e CLI operatore redatta. Tre review subagent sono andate in timeout; il pass manuale P0/P1 ha corretto il replay idempotente dopo toggle successivo. Mirati verdi e full gate finale exit `0`; proposta `DONE/100%/PASSING`. | BL-005, BL-007, BL-015, BL-021, BL-022, BL-028, QA-001 |


## 22. Checklist di fine sessione dell’agente

Prima di terminare una sessione di coding:

- [ ] lo stato/progresso del task riflette il lavoro realmente completato;
- [ ] nessun task è `DONE` con test diverso da `PASSING`;
- [ ] i test falliti sono registrati con causa, non nascosti;
- [ ] il repository resta buildabile o il task è `BLOCKED` con istruzioni di recupero;
- [ ] `docs/CONTEXT.md` indica task attivo, commit, migration/contract/prompt version e rischi;
- [ ] `docs/TRACEABILITY.md` è aggiornato per nuovi test/requisiti;
- [ ] documenti e codice non si contraddicono;
- [ ] nuovi bug/decisioni sono task o ADR, non TODO anonimi;
- [ ] il successivo task `READY` è corretto in base alle dipendenze;
- [ ] non sono stati avviati task P1/P2/Post-MVP senza autorizzazione;
- [ ] secret, PII, prompt sensibili e output non redatti non sono stati committati;
- [ ] le evidenze riportano data assoluta, head Git/PR esterni ed environment senza commit autoreferenziali.

---

## Regola finale

Lo scopo dell’agente non è “chiudere più task”, ma produrre una vertical slice affidabile. In presenza di test incompleti, contesto non verificato, documentazione stale o comportamento non riproducibile, il task deve restare aperto.
