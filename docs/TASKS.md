---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: 049748443aa6fa83496bfc5b996560312b6fd48d
source_refs:
  - docs/MVP_SPEC.md
related_tasks:
  - GOV-001
  - BL-001
  - BL-002
  - BL-079
code_refs:
  - apps
  - packages
  - .github/workflows/ci.yml
  - scripts/lib/build-artifact.mjs
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/lib/secret-scanner.mjs
  - scripts/lib/workspace-boundaries.mjs
  - scripts/lib/task-graph.mjs
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/security/secret-scanner.test.mjs
supersedes: null
---

# TASKS.md — Piano operativo e registro di avanzamento dell’MVP

> **Scopo:** fonte operativa per gli agenti di coding AI incaricati di trasformare la specifica in un MVP verificato.
> **Punto di ingresso agente:** [`AGENTS.md`](../AGENTS.md)
> **Specifica canonica:** [`docs/MVP_SPEC.md`](MVP_SPEC.md)
> **Studio UX/UI:** [`docs/product/UX_UI_DESIGN.md`](product/UX_UI_DESIGN.md)
> **Baseline specifica:** SHA-256 `ed2c7882f94fa751e30dc6f1c73e279388891d7e0fcd686db30aad3b565096f6`
> **Data baseline:** `2026-07-13`
> **Versione schema task:** `1.0.0`
> **Stato del programma:** `IN_PROGRESS`
> **Milestone corrente:** `M0 — Fondamenta`
> **Task attivo:** `BL-002 — Pipeline test, scan, build e artifact`
> **Prossimo task READY:** `—`
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

## 3. Procedura obbligatoria per ogni sessione dell’agente

1. Leggere `AGENTS.md` quando esiste; altrimenti eseguire prima `GOV-001`.
2. Verificare la baseline:
   ```bash
   sha256sum docs/MVP_SPEC.md
   git rev-parse HEAD
   ```
   Il primo valore deve coincidere con la baseline dichiarata o deve essere registrata una revisione del diff.
3. Leggere `docs/CONTEXT.md`, questo file, gli ADR vigenti e tutti i riferimenti del task.
4. Controllare codice, migration head, contratti generati e test esistenti: la documentazione da sola non prova lo stato.
5. Selezionare il primo task `READY` P0 con dipendenze `DONE`; non iniziare P1/P2/Post-MVP.
6. Aggiornare subito il task a `IN_PROGRESS`, progresso `25%`, contesto verificato con commit e data assoluta.
7. Scrivere o aggiornare prima i test che definiscono il comportamento; per bug, aggiungere un test che fallisce senza la correzione.
8. Implementare il minimo change set completo, senza estendere silenziosamente lo scope.
9. Eseguire i test specifici, poi i gate globali applicabili.
10. Aggiornare documentazione, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, ADR/contratti/event catalog e questo task.
11. Passare a `IN_REVIEW` al `90%`, rieseguire la verifica da checkout/worktree pulito.
12. Marcare `DONE`/`100%`/`PASSING` solo dopo aver compilato le evidenze.
13. Rendere `READY` il successivo task le cui dipendenze siano tutte `DONE`.

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
- [ ] il task è stato verificato da checkout/worktree pulito;
- [ ] per UI: keyboard flow e accessibility scan senza blocker;
- [ ] per security/privacy: threat/data review aggiornata;
- [ ] per AI: eval pertinente e impatto token/costo registrati;
- [ ] staging smoke test eseguito quando il task modifica un percorso deployabile.

Un’implementazione “funzionante a mano” ma senza test/evidenze resta `IN_PROGRESS` o `BLOCKED`, mai `DONE`.

## 5. Contratto dei comandi di qualità

I seguenti comandi costituiscono il target del repository. `BL-002` e `QA-001` devono renderli disponibili; fino ad allora usare equivalenti espliciti e registrarli nelle evidenze.

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
pnpm verify
```

`pnpm verify` deve aggregare almeno lint, typecheck, unit, contract, test documentali e build. Le suite più costose possono essere CI/nightly, ma il task non è `DONE` finché l’evidenza richiesta non esiste.

## 6. Contesto e documentazione living

### 6.1 Registro documenti

| Documento | Stato iniziale | Autorità | Aggiornamento obbligatorio |
|---|---|---|---|
| `docs/MVP_SPEC.md` | Esistente, canonico | Scope/architettura/requisiti | Quando una decisione approvata cambia la specifica. |
| `docs/TASKS.md` | Esistente, operativo | Stato/dipendenze/evidenze | In ogni change set. |
| [`AGENTS.md`](../AGENTS.md) | Esistente, `active` | Entry point agente | Quando cambia workflow, source hierarchy, boundary globali o policy browser/sicurezza. |
| [`docs/CONTEXT.md`](CONTEXT.md) | Esistente, `active` | Snapshot corrente | Ogni modifica a architettura, comandi, versioni, milestone o rischio. |
| [`docs/README.md`](README.md) | Esistente, `active` | Indice documentazione | A ogni nuovo documento/supersede. |
| [`docs/TRACEABILITY.md`](TRACEABILITY.md) | Esistente, `active`; automatizzazione pianificata in `GOV-002` | Requisito→task→test→evidenza | In ogni task funzionale. |
| [`docs/CHANGELOG.md`](CHANGELOG.md) | Esistente, `active`; consolidamento pianificato in `GOV-002` | Modifiche documentali/contrattuali | A ogni release/decisione significativa. |
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
| `docs/api/` | Planned | Contratti API generated + guide | Ogni endpoint/schema version. |
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
- aggiornare `last_verified_commit` nei documenti toccati;
- registrare in `docs/CONTEXT.md`: milestone, task attivo, migration head, contract version, prompt/eval version, feature flag/kill switch e rischi;
- eseguire `pnpm docs:check`.

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
| M0 — Fondamenta | `IN_PROGRESS` | 6% | 16 | `GATE-M0` | Pipeline, auth, dati, osservabilità, fondazione UX/UI e contesto agenti operativi. |
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

- **Stato:** `IN_REVIEW`
- **Progresso:** `90%`
- **Esito test:** `PARTIAL`
- **Contesto verificato:** `YES` — base commit iniziale `74af8947932443de5b4df2f42f4c6aebfff7a109`; branch base dopo collegamento remote `6b9f5d281fb0185f5f6c98813e2ffcee6424e658`; spec SHA `ed2c7882f94fa751e30dc6f1c73e279388891d7e0fcd686db30aad3b565096f6`; data: `2026-07-13`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001
- **Dipendenze operative aggiuntive:** BL-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §26.12 CI quality gates; `docs/MVP_SPEC.md` §29.4 CI/CD; `docs/MVP_SPEC.md` §31 `BL-002`; `docs/MVP_SPEC.md` §35.1 Definition of Done per user story
- **Obiettivo:** Come team voglio una CI che blocchi regressioni.
- **Deliverable:** Pipeline test, scan, build e artifact.
- **Criterio di accettazione:** PR non mergeabile su gate fallito; cache non espone secret.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: PR non mergeabile su gate fallito; cache non espone secret.
  - [ ] Pipeline su PR con job lint, typecheck, unit, integration/contract e build; un fixture fallito deve bloccare il merge.
  - [ ] Verifica che cache, log e artifact CI non contengano secret.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/0003-ci-trust-boundary-and-artifacts.md`; `docs/operations/CI_CD.md`; `docs/testing/BL-002_VERIFICATION.md`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `origin` è stato collegato durante il task. Ruleset e branch protection su repository privato restituiscono `403` sul piano GitHub corrente; servono una decisione esplicita su piano compatibile o pubblicazione. Restano la pipeline GitHub e la PR negativa; senza enforcement remoto il criterio “PR non mergeabile” non può essere dichiarato soddisfatto.

### BL-003 — Typed config, secret manager, local template

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** BL-001
- **Dipendenze operative aggiuntive:** BL-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §5 Assunzioni; `docs/MVP_SPEC.md` §22.10 Segreti e cifratura; `docs/MVP_SPEC.md` §29.3 Ambienti; `docs/MVP_SPEC.md` §31 `BL-003`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come operatore voglio config separata per ambiente.
- **Deliverable:** Typed config, secret manager, local template.
- **Criterio di accettazione:** Startup fallisce su config mancante; nessun secret committato.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Startup fallisce su config mancante; nessun secret committato.
  - [ ] Unit test della typed config per valori validi, mancanti e malformati.
  - [ ] Smoke test separato local/staging; startup fail-fast senza variabili obbligatorie.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-004 — Tool migration e schema baseline

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001
- **Dipendenze operative aggiuntive:** BL-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §19.5 Migrazioni e compatibilità; `docs/MVP_SPEC.md` §29.5 Migrazioni zero-downtime; `docs/MVP_SPEC.md` §26.4 Integration test database; `docs/MVP_SPEC.md` §31 `BL-004`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come backend voglio migrations riproducibili.
- **Deliverable:** Tool migration e schema baseline.
- **Criterio di accettazione:** Migrazione da DB vuoto e rollback operativo documentato.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Migrazione da DB vuoto e rollback operativo documentato.
  - [ ] Migration test da database vuoto all’head e replay su database già aggiornato.
  - [ ] Test rollback/forward-fix documentato e verifica vincoli/indici con PostgreSQL reale.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/`; `docs/data/DATA_MODEL.md` e migration notes
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

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

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001, BL-003
- **Dipendenze operative aggiuntive:** BL-001, BL-003
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §24 Osservabilità; `docs/MVP_SPEC.md` §29.1 Topologia MVP; `docs/MVP_SPEC.md` §35.1 Definition of Done; `docs/MVP_SPEC.md` §31 `BL-008`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come operatore voglio request e trace ID end-to-end.
- **Deliverable:** OTel/log/Sentry baseline.
- **Criterio di accettazione:** Trace web→API→worker fake; log redaction test pass.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Trace web→API→worker fake; log redaction test pass.
  - [ ] Integration test web→API→worker fake con propagazione correlation/trace ID.
  - [ ] Test di redazione PII/secret nei log e cattura errori Sentry senza payload sensibili.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-009 — Zod, JSON Schema, OpenAPI generation

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001
- **Dipendenze operative aggiuntive:** BL-001
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §12.6 Schema del turno; `docs/MVP_SPEC.md` §12.8 Schemi separati; `docs/MVP_SPEC.md` §20 API; `docs/MVP_SPEC.md` §29.4 CI/CD; `docs/MVP_SPEC.md` §31 `BL-009`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come client voglio DTO runtime-validati.
- **Deliverable:** Zod, JSON Schema, OpenAPI generation.
- **Criterio di accettazione:** Contract compile e response validation; schema versionato.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Contract compile e response validation; schema versionato.
  - [ ] Contract test di parse/serialize e validazione runtime per request/response/event schema.
  - [ ] Test di compatibilità/versionamento e verifica OpenAPI/JSON Schema generati senza diff non committato.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/`; schema/OpenAPI/eventi generati, senza modifica manuale dei file generated
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-010 — Flag store/config auditato

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** BL-003, BL-008
- **Dipendenze operative aggiuntive:** BL-003, BL-008
- **Riferimenti obbligatori:** `docs/MVP_SPEC.md` §23.2 Backpressure e degradazione; `docs/MVP_SPEC.md` §28.6 Budget enforcement; `docs/MVP_SPEC.md` §29.6 Scaling; `docs/MVP_SPEC.md` §31 `BL-010`; `docs/MVP_SPEC.md` §35.1
- **Obiettivo:** Come operatore voglio feature flag e kill switch server-side.
- **Deliverable:** Flag store/config auditato.
- **Criterio di accettazione:** Disabilita start/turn/model route senza deploy; audit event.
- **Test obbligatori prima di `DONE`:**
  - [ ] Test di accettazione automatizzato: Disabilita start/turn/model route senza deploy; audit event.
  - [ ] Integration test di ogni kill switch senza deploy e con audit event.
  - [ ] Test fail-safe: flag store indisponibile usa il default sicuro documentato.
- **Documentazione e contesto:** `docs/CONTEXT.md`; `docs/TRACEABILITY.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/adr/`
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report/CI `—`; migration/eval/trace ID `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** `—`

### BL-079 — Fondazione design system e shell conversazionale mobile-first

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `M`
- **Dipendenze:** BL-001, BL-002
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
- **Documentazione e contesto:** `docs/product/UX_UI_DESIGN.md`, `docs/adr/0001-mobile-first-conversational-ui.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, `docs/testing/TEST_STRATEGY.md` quando creato
- **Evidenze di chiusura:** commit/PR `—`; comandi e exit code `—`; report visual/a11y/performance `—`; component inventory/versioni `—`; docs aggiornati `—`
- **Note, rischi o bloccanti:** Non installare tutte le registry AI Elements; non introdurre `useChat` o un trasporto parallelo; Rive è opzionale e non può bloccare la shell. `BL-079` possiede il setup browser/component minimo necessario ai propri test; `QA-001` lo consolida nel harness comune senza diventare una dipendenza circolare.

### GOV-002 — Validazione automatica della documentazione e tracciabilità

- **Stato:** `BACKLOG`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
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
- **Note, rischi o bloccanti:** `—`

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
- **Dipendenze:** GOV-001, GOV-002, QA-001, DOC-ARCH-001, BL-001..BL-010, BL-079
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
| AC-25 | Staging/production separati | BL-003, BL-070, DOC-OPS-001 | IaC/environment/restore review |


## 20. Registro dell’ultima esecuzione

Compilare questa sezione durante il lavoro; mantenerne una sola istanza per il task attivo. Alla chiusura, trasferire le informazioni sintetiche nella card del task e conservare qui l’ultima esecuzione finché non viene selezionato il task successivo.

```yaml
active_task: BL-002
last_completed_task: BL-001
next_ready_task: null
status: IN_REVIEW
progress: 90
started_at: 2026-07-13
updated_at: 2026-07-13
agent: Codex development agent
git_branch: codex/bl-002-ci-foundation
base_commit: 6b9f5d281fb0185f5f6c98813e2ffcee6424e658
current_commit: 049748443aa6fa83496bfc5b996560312b6fd48d
spec_sha256: ed2c7882f94fa751e30dc6f1c73e279388891d7e0fcd686db30aad3b565096f6
context_verified: true
test_status: PARTIAL
```

## Contesto letto

- [x] `docs/MVP_SPEC.md` sezioni indicate nel task
- [x] `docs/TASKS.md`
- [x] `AGENTS.md`
- [x] `docs/CONTEXT.md`
- [x] ADR vigenti — ADR-0001, ADR-0002 e ADR-0003
- [x] documenti collegati — `docs/architecture/SYSTEM_OVERVIEW.md`; `docs/operations/CI_CD.md`; report BL-001 e BL-002
- [x] codice, migration, contratti e test correnti — workspace e sei contract test presenti; workflow CI, suite unit/integration, scan e artifact assenti al preflight

## Piano e scope

- **Obiettivo verificabile:** creare una pipeline PR riproducibile che renda obbligatori quality, test, security e build prima dell'artifact, senza propagare secret in cache, log o artifact.
- **File/moduli previsti:** workflow GitHub Actions; script CI per secret scan, policy e manifest artifact; suite unit/integration/contract con failure fixture; ADR/runbook/report; aggiornamenti a package scripts e documenti living.
- **Test da scrivere prima/durante:** contratto workflow e action pin; fixture fallita con exit non-zero; secret sintetico rifiutato; cache e artifact allowlisted; artifact mancante/path non ammesso fail-closed; integrazione dei comandi reali.
- **Rischi/failure path:** action o tool non pin; `pull_request_target`; permessi write e credenziali checkout; failure inghiottita; cache/artifact troppo ampi; symlink/path traversal; audit dipendenze non disponibile; branch protection non configurabile senza remote.
- **Fuori scope:** database/migration e Testcontainers (`BL-004`/`QA-001`); schema compatibility (`BL-009`); browser/a11y e UI budget (`BL-079`/`QA-001`); eval (`BL-068`); container/SBOM/image scan, deploy staging/production e rollback (`BL-070`).

## Diario sintetico

| Data/ora assoluta | Progresso | Decisione/finding | Test/evidenza | Prossimo passo |
|---|---:|---|---|---|
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

## Chiusura

- **Commit/PR:** branch `codex/bl-002-ci-foundation`; verified implementation head `049748443aa6fa83496bfc5b996560312b6fd48d`; PR #1 aperta
- **Comandi eseguiti:** `pnpm format:check`; `pnpm lint`; `pnpm typecheck`; `pnpm test:unit`; `pnpm test:integration`; `pnpm test:contract`; `pnpm test:security`; `pnpm scan:sast`; `pnpm boundaries:check`; `pnpm tasks:check`; `pnpm ci:workflow:check`; `pnpm build`; `pnpm artifact:prepare`; `pnpm artifact:verify`; `pnpm audit --audit-level=moderate`
- **Exit code:** `0` per i comandi completati incluso full `pnpm verify` e clean-worktree verify dell'head in 63,4 s; fixture CI intenzionale `1` asserito; la prima CI remota ha fallito chiuso sul caso Linux ora corretto
- **Report/CI URL o path:** `docs/testing/BL-002_VERIFICATION.md`; PR/CI URL in preparazione
- **Migration head:** `N/A`
- **Contract/schema/event version:** `N/A`
- **Prompt/model/eval version:** `N/A`
- **Documenti aggiornati:** `AGENTS.md`; `docs/CONTEXT.md`; `docs/TASKS.md`; `docs/TRACEABILITY.md`; `docs/CHANGELOG.md`; `docs/README.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; ADR-0003; `docs/operations/CI_CD.md`; report BL-002
- **Rischi residui/TODO tracciati:** Ruleset/run CI/negative PR ancora da verificare; gate differiti mappati a `BL-004`, `BL-009`, `BL-079`, `QA-001`, `BL-068`, `BL-070`
- **Task successivo reso READY:** nessuno finché `BL-002` non supera il gate esterno


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
| — | — | — | — | — | — |


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
- [ ] le evidenze riportano data assoluta, commit ed environment.

---

## Regola finale

Lo scopo dell’agente non è “chiudere più task”, ma produrre una vertical slice affidabile. In presenza di test incompleti, contesto non verificato, documentazione stale o comportamento non riproducibile, il task deve restare aperto.
