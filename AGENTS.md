---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: 049748443aa6fa83496bfc5b996560312b6fd48d
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md
  - docs/product/UX_UI_DESIGN.md
related_tasks:
  - GOV-001
  - BL-002
  - BL-079
code_refs:
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/ci-workflow.test.mjs
supersedes: null
---

# AGENTS.md — Punto di ingresso per gli agenti di coding

> **Leggere questo file prima di qualsiasi modifica al repository.** Le istruzioni valgono per l’intero progetto. Un eventuale `AGENTS.md` in una sottocartella può aggiungere regole più specifiche, ma non può indebolire i vincoli qui definiti, la specifica MVP o i controlli di sicurezza.

## Navigazione essenziale

- **Specifica canonica di prodotto e architettura:** [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md)
- **Backlog, stato, dipendenze, test ed evidenze:** [`docs/TASKS.md`](docs/TASKS.md)
- **Contesto operativo corrente:** [`docs/CONTEXT.md`](docs/CONTEXT.md).
- **Indice della documentazione:** [`docs/README.md`](docs/README.md).
- **Studio e contratto UX/UI:** [`docs/product/UX_UI_DESIGN.md`](docs/product/UX_UI_DESIGN.md).
- **Decisioni architetturali:** [`docs/adr/`](docs/adr/) — il registro automatico completo è pianificato in `GOV-002`.
- **Tracciabilità requisito → task → test → evidenza:** [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md).

`AGENTS.md` definisce **come lavorare**. Non deve duplicare lo stato volatile del programma: milestone, task attivo, versioni di schema/prompt, migration head, rischi correnti e commit verificato appartengono a `docs/CONTEXT.md` e `docs/TASKS.md`.

---

## 1. Missione dell’agente

L’agente deve trasformare la specifica approvata in una vertical slice completa, verificabile, sicura e manutenibile del browser game single player con AI Dungeon Master.

Il comportamento atteso è quello di uno sviluppatore senior responsabile del risultato:

1. comprende prima il requisito e i suoi invarianti;
2. seleziona un task eseguibile e ne aggiorna lo stato;
3. definisce test e failure path prima o insieme al codice;
4. implementa il change set minimo ma completo;
5. valida il comportamento con evidenze riproducibili;
6. aggiorna contesto, documentazione e tracciabilità nello stesso change set;
7. lascia il repository in uno stato più ordinato di come lo ha trovato.

L’agente non deve limitarsi a produrre codice plausibile. Deve dimostrare che il comportamento richiesto funziona, che gli errori sono gestiti e che la documentazione rappresenta il sistema implementato.

---

## 2. Ordine di lettura obbligatorio

All’inizio di ogni sessione o dopo un cambio significativo di branch/commit:

1. leggere il `AGENTS.md` più vicino alla root e gli eventuali file omonimi applicabili alla cartella da modificare;
2. leggere `docs/CONTEXT.md`, se presente;
3. leggere `docs/TASKS.md`, in particolare gerarchia delle fonti, Definition of Done, task attivo, dipendenze e Context Sync Log;
4. leggere soltanto le sezioni di [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md) indicate dal task, più gli invarianti del §3 di questo file;
5. leggere gli ADR `accepted`, la documentazione di feature, i contratti e i runbook collegati;
6. ispezionare codice, migration, schema generati e test esistenti: la documentazione da sola non prova lo stato reale;
7. verificare branch, working tree, commit e fingerprint della specifica.

Comandi iniziali di riferimento:

```bash
git status --short --branch
git rev-parse HEAD
sha256sum docs/MVP_SPEC.md
```

Se il repository non è ancora inizializzato, registrare `unversioned` invece di inventare un commit. Se `docs/CONTEXT.md` non esiste, non ignorare il problema: proseguire con `GOV-001` usando il fallback dichiarato nella navigazione essenziale.

---

## 3. Gerarchia delle fonti della verità

Applicare la stessa gerarchia definita in `docs/TASKS.md`:

1. ADR con stato `accepted`, purché le modifiche normative siano riflesse nello stesso change set nella specifica e nei documenti interessati;
2. `docs/MVP_SPEC.md` per scope, requisiti, architettura, API previste, invarianti e criteri globali;
3. contratti versionati o generati, migration head, JSON Schema, OpenAPI ed event schema per il comportamento implementato;
4. documentazione living di feature, sicurezza, testing e operazioni;
5. codice e test come prova dello stato implementato;
6. `docs/TASKS.md` per ordine, dipendenze, avanzamento ed evidenze.

Un’istruzione diretta del Product Owner può cambiare una decisione, ma non deve restare soltanto nella chat: l’agente deve aggiornare specifica, ADR, task e contesto nello stesso change set.

### 3.1 Gestione dei conflitti

Non scegliere silenziosamente la fonte più comoda.

- Se il conflitto è reversibile e non cambia scope, sicurezza, dati, costi o contratti, scegliere l’opzione più semplice coerente con gli invarianti e registrarla come decisione provvisoria.
- Se il conflitto modifica scope, costi, privacy, sicurezza, legalità, compatibilità o un confine architetturale, creare o aggiornare un ADR/decision task e marcare `BLOCKED` solo i task realmente dipendenti.
- Se la specifica contiene un’assunzione esplicita, applicarla fino a decisione contraria.
- Dopo la risoluzione, aggiornare tutte le fonti coinvolte e rieseguire test documentali e contrattuali.

Chat, memoria del modello, commenti non versionati e schermate del browser non sono fonti della verità.

---

## 4. Invarianti non negoziabili del prodotto

Ogni modifica deve preservare i seguenti vincoli.

### 4.1 Stato canonico e AI

- PostgreSQL e il backend deterministico sono la fonte della verità per HP, statistiche, dadi, danni, condizioni, iniziativa, inventario, equipaggiamento, quest, posizione, relazioni e progressione.
- L’AI genera narrazione, dialoghi, classificazioni e **proposte**; non modifica direttamente il database.
- Ogni mutazione originata dall’AI passa da output strutturato, validazione, autorizzazione, Rules Engine, transazione ed evento append-only.
- L’output del modello, incluse tool call e memorie candidate, è input non affidabile.
- Nessun tool generico SQL, shell o “update arbitrary record” può essere esposto al modello.

### 4.2 Eventi, consistenza e retry

- Le azioni rilevanti producono eventi append-only con ordine, causation ID e correlation ID.
- Proiezioni e eventi devono essere aggiornati atomicamente o tramite pattern esplicitamente progettato e testato.
- Ogni comando mutante deve essere idempotente.
- Un retry non può duplicare dadi, danni, oggetti, reward, aggiornamenti quest o relazioni.
- Redis migliora lock e coordinamento, ma il database deve mantenere un vincolo di sicurezza anche in sua assenza.
- Snapshot e replay devono convergere allo stesso stato/checksum.

### 4.3 Rules Engine

- Il Rules Engine è deterministico, modulare e testabile senza AI, HTTP o database.
- L’AI può proporre difficoltà, intenzioni e tattiche; il backend applica limiti e formule.
- RNG di produzione e RNG seedato di test devono essere iniettati, mai nascosti in funzioni globali.
- Il regolamento è originale e d20-compatible; non copiare testo, nomenclatura distintiva o contenuti proprietari non autorizzati.

### 4.4 Memoria e conoscenza

- Stato canonico, eventi, scena, turni recenti, riassunto, memorie episodiche, memoria NPC e Campaign Bible sono strati distinti.
- pgvector supporta retrieval narrativo, non determina dati canonici.
- Visibilità, ownership, entity filter, knowledge boundary e source event devono essere applicati prima del ranking semantico.
- Un NPC non deve ricevere fatti, segreti o convinzioni che non conosce.

### 4.5 Campagna e finale

- La Campaign Bible è validata, versionata e modificata soltanto tramite amendment tracciati.
- Atti, milestone, story clocks e condizioni di finale hanno predicate verificabili dal backend.
- Il modello non può concludere autonomamente una campagna; `request_campaign_ending` richiede un gate deterministico.
- L’epilogo usa uno snapshot finale congelato e non muta la campagna.

### 4.6 Forma del sistema

- MVP come modular monolith TypeScript; niente microservizi senza evidenza che il monolite non soddisfi i requisiti.
- Un solo AI Dungeon Master orchestra NPC e compagni; niente agenti autonomi per entità nell’MVP.
- Provider AI dietro adapter; il dominio non importa SDK proprietari.
- REST per i comandi e le query iniziali, SSE per progresso e streaming.
- PostgreSQL + JSONB + pgvector; niente vector database separato senza ADR e metriche che lo giustifichino.
- P1, P2 e Post-MVP non devono rallentare la vertical slice P0.

---

## 5. Selezione e tracciamento del lavoro

### 5.1 Scelta del task

- Selezionare il primo task `READY` P0 le cui dipendenze siano `DONE`.
- Mantenere normalmente un solo task `IN_PROGRESS` per agente.
- Non iniziare task `DEFERRED`, P1, P2 o Post-MVP senza decisione esplicita registrata.
- Non nascondere lavoro necessario dentro un task non correlato: creare `BUG-xxx`, `DEC-xxx`, `GOV-xxx`, `QA-xxx` o `DOC-xxx` quando serve un deliverable separatamente verificabile.
- Non creare micro-task amministrativi privi di criterio di accettazione.

### 5.2 Aggiornamento dello stato

Prima di modificare il codice:

- impostare il task a `IN_PROGRESS`;
- usare il livello di progresso previsto da `docs/TASKS.md`;
- registrare data assoluta, branch, commit o SHA dei file se il repository non è versionato;
- compilare scope, test previsti, failure path e fuori scope nel registro del task attivo.

Durante il lavoro, aggiornare lo stato quando cambia realmente. Non usare `90%` per indicare “quasi finito” in modo soggettivo: significa `IN_REVIEW` con test specifici passati e soli gate finali/evidenze ancora aperti.

Un task è `DONE` soltanto con `100%`, test `PASSING`, documentazione aggiornata ed evidenze riproducibili. Un risultato parziale resta `IN_PROGRESS` o `BLOCKED`.

---

## 6. Ciclo operativo standard

### 6.1 Preflight

1. verificare working tree e modifiche preesistenti;
2. non sovrascrivere lavoro non proprio;
3. leggere riferimenti e test del task;
4. ricostruire il comportamento attuale prima di proporre la modifica;
5. identificare happy path, negative path, retry, concorrenza, timeout, rollback e autorizzazione applicabili;
6. confermare che il task sia la più piccola vertical slice completa.

### 6.2 Test e progettazione

- Per un bug, aggiungere prima un test che fallisce senza la correzione.
- Per una feature, definire test di accettazione e contratti prima o insieme all’implementazione.
- Per una migration, definire test da database vuoto, upgrade e rollback/forward-fix supportato.
- Per una modifica AI, predisporre fixture deterministiche, output invalido, timeout, tool non autorizzata e almeno un’eval pertinente.
- Per una decisione non banale, documentare motivazione, alternative, svantaggi e condizione di revisione.

### 6.3 Implementazione

- Implementare il change set minimo che soddisfa per intero il criterio di accettazione.
- Mantenere i confini di modulo; non spostare logica di dominio in controller, componenti UI, query SQL o prompt.
- Rendere espliciti errori, limiti, transazioni e idempotenza.
- Aggiornare documentazione e contratti mentre cambia il comportamento, non alla fine “se avanza tempo”.
- Non ampliare silenziosamente lo scope.

### 6.4 Verifica

Eseguire prima i test mirati, poi i gate più ampi applicabili. Il contratto target è definito in `docs/TASKS.md` §5:

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

Finché lo scaffold non espone questi script, usare comandi equivalenti espliciti e registrarli nelle evidenze. Non dichiarare un test “passato” se non è stato eseguito sul commit o sul contenuto indicato.

Il check remoto stabile da rendere obbligatorio su `main` è `CI / Merge gate`: usa `always()` e fallisce se quality, test, security o build/artifact non terminano con `success`. La CI su codice PR usa soltanto `pull_request`, permessi minimi e action pin a SHA completo; `pull_request_target` è vietato. La cache ammessa nel workflow base è il solo store pnpm lockfile-scoped, mai `.env`, output, log o artifact.

### 6.5 Chiusura

1. rileggere il diff completo;
2. verificare che non contenga segreti, PII, debug, snapshot accidentali o file generati non necessari;
3. aggiornare `docs/TASKS.md`, `docs/CONTEXT.md`, tracciabilità, changelog, ADR e documenti di feature applicabili;
4. registrare comandi, exit code, environment, commit, report, migration head e versioni di schema/prompt/eval;
5. eseguire la verifica da checkout/worktree pulito quando possibile;
6. passare a `IN_REVIEW`, poi a `DONE` soltanto se la Definition of Done è soddisfatta;
7. rendere `READY` il successivo task realmente sbloccato.

---

## 7. Comportamento professionale e autonomia

L’agente è autorizzato a prendere decisioni tecniche reversibili e coerenti con la specifica senza chiedere conferme per ogni dettaglio.

Deve:

- preferire la soluzione più semplice che conserva invarianti, testabilità e possibilità di evoluzione;
- rendere esplicite le assunzioni;
- usare evidenze invece di affermazioni non verificate;
- comunicare subito blocchi concreti, regressioni o rischi rilevanti;
- correggere incoerenze documentali incontrate nello scope del task;
- proteggere il lavoro esistente e mantenere il progetto eseguibile;
- fermare soltanto il lavoro realmente bloccato, continuando le parti indipendenti quando possibile.

Non deve:

- inventare output di test, commit, trace ID, metriche o configurazioni;
- aggirare un controllo perché “temporaneamente scomodo”;
- indebolire, saltare o cancellare test per ottenere verde;
- lasciare una decisione importante soltanto in un commento o nella chat;
- introdurre astrazioni speculative, framework o servizi “per il futuro” senza requisito;
- cambiare API, schema, eventi o comportamento pubblico senza versionamento e documentazione;
- dichiarare completato lavoro che non è stato eseguito o verificato.

---

## 8. Regole per codice pulito e progetto ordinato

### 8.1 Lingua e naming

- Codice, identificatori, nomi di file, API, eventi, schema e messaggi tecnici in inglese.
- Documentazione di progetto e copy utente MVP in italiano, salvo termini tecnici consolidati.
- Nomi orientati al dominio: `TurnRequest`, `CampaignState`, `QuestProgressed`; evitare `Manager`, `Helper`, `Utils` generici.
- Un nome deve esprimere intento, unità e stato: `timeoutMs`, `occurredAtTurn`, `estimatedCostCents`.
- Gli eventi usano passato compiuto; i comandi usano forma imperativa o intenzionale.

### 8.2 TypeScript

- Abilitare e mantenere strict mode.
- Vietato `any` non motivato. Preferire `unknown` con narrowing ai confini.
- Vietati `@ts-ignore`, cast doppi e non-null assertion usati per nascondere errori; ogni eccezione richiede commento, issue/task e test.
- Usare branded/opaque ID o tipi distinti per evitare scambi fra `CampaignId`, `TurnId`, `NpcId` e `UserId`.
- Separare DTO esterni, comandi applicativi, entità di dominio e record persistence.
- Validare una volta ai confini con Zod/JSON Schema; non propagare oggetti non validati nel dominio.
- Evitare enum TypeScript quando union literal e mapping esaustivi offrono contratti più chiari.
- Ogni `switch` su union di dominio deve essere esaustivo.

### 8.3 Funzioni e moduli

- Funzioni piccole e coese con un solo livello di astrazione prevalente.
- Effetti collaterali espliciti e confinati nell’application/infrastructure layer.
- Funzioni di dominio e Rules Engine pure quando possibile.
- Dipendenze iniettate, soprattutto clock, RNG, provider, repository e logger.
- Evitare singleton globali e stato mutabile condiviso.
- Non estrarre un’astrazione dopo una sola somiglianza accidentale; astrarre quando esiste un contratto stabile o duplicazione significativa.
- Eliminare codice morto. Un TODO deve avere ID task/bug, motivo e condizione di rimozione.

### 8.4 Errori

- Errori attesi di dominio sono tipizzati e mappati in modo esplicito verso error envelope/API status.
- Errori inattesi conservano causa e stack nei log interni, con messaggio sicuro verso l’utente.
- Non usare eccezioni come normale controllo di flusso nel dominio quando un result type è più chiaro.
- Non ignorare promise, callback error o risultati parziali.
- Ogni retry deve avere limite, backoff, classificazione retryable/non-retryable e idempotency key.

### 8.5 Configurazione e costanti

- Nessuna chiave, URL sensibile, model ID, prezzo o limite provider hard-coded nel dominio.
- Configurazione tipizzata e validata all’avvio; fail-fast per valori mancanti o incoerenti.
- Limiti di prodotto condivisi in cataloghi/versioni canoniche, non duplicati fra UI, API e worker.
- Feature flag e kill switch devono avere default sicuro, owner e audit quando influenzano comportamento sensibile.

### 8.6 Dipendenze

- Aggiungere una dipendenza solo dopo aver verificato necessità, manutenzione, licenza, dimensione, superficie di attacco e alternative native.
- Usare versioni compatibili con il lockfile e aggiornare lockfile nello stesso change set.
- Non introdurre due librerie per lo stesso scopo senza ADR.
- Nessun import profondo da API interne di una dipendenza.
- I file generati non si modificano a mano; cambiare la sorgente e rigenerare.

### 8.7 Commenti e documentazione nel codice

- I commenti spiegano **perché**, invarianti, trade-off e failure mode; non ripetono il codice.
- Documentare API pubbliche, algoritmi non ovvi, formule del Rules Engine e vincoli di sicurezza.
- Non lasciare blocchi di codice commentato.
- Esempi e snippet devono compilare o essere chiaramente marcati come pseudocodice.

---

## 9. Confini architetturali e struttura target

La struttura iniziale da validare nel task `BL-001` è un monorepo con confini equivalenti a:

```text
apps/
  web/          # Next.js, UI e BFF strettamente necessari
  api/          # Fastify, auth, REST, SSE e application entry point
  worker/       # BullMQ, turn orchestration e job asincroni
packages/
  contracts/    # DTO, Zod/JSON Schema, OpenAPI/event schema
  domain/       # Entità, value object, command/result ed invarianti puri
  rules/        # Rules Engine deterministico
  ai/           # AIProvider, prompt builder, schema e provider adapter
  persistence/  # Repository, query tenant-safe, migration e transaction helpers
  observability/# tracing, metriche, log e redaction
  testing/      # fixture/fake condivisi senza logica di produzione
```

La struttura può essere raffinata da ADR, ma deve mantenere queste direzioni:

- `domain` e `rules` non dipendono da framework web, database, queue o SDK AI;
- `contracts` non importa implementazioni infrastrutturali;
- `ai` dipende da contratti e porte, non da persistence concreta;
- `api` e `worker` orchestrano application service, non contengono regole di gioco;
- `web` non ricostruisce stato canonico né applica mutazioni ottimistiche irreversibili;
- `persistence` implementa porte definite dal dominio/application layer;
- dipendenze cicliche fra package sono vietate e testate automaticamente.

---

## 10. Regole per area tecnica

### 10.1 Frontend

- Progettare mobile-first: il loop completo deve essere comodo a una mano da 320 px, con composer e controlli persistenti rispettosi di tastiera virtuale e safe area; il desktop amplia la stessa gerarchia senza introdurre funzioni essenziali esclusive.
- Usare shadcn/ui `new-york` con base Radix e token semantici come fondazione; i wrapper di dominio restano nel codice del prodotto. AI Elements può fornire primitive di conversazione e rendering del testo AI, ma non sostituisce i contratti REST/SSE né la state machine del turno.
- Conservare una direzione contemporanea, premium e accessibile per casual gamer: niente font pseudo-medievali, pergamena, cornici araldiche, texture fantasy decorative, gradienti invasivi o HUD permanentemente densa.
- Usare Motion per le micro-interazioni non banali, rispettare `prefers-reduced-motion` e mantenere ogni azione comprensibile anche senza animazione. Rive o runtime grafici più pesanti richiedono lazy loading, budget misurato e criterio di rimozione; non appartengono alla shell P0 per default.
- Mantenere target touch di almeno 44×44 CSS px, 48 px per le azioni primarie frequenti, focus visibile e gerarchia basata su progressive disclosure.
- Il server state proviene dalle API; Zustand è riservato a stato UI locale/effimero.
- Non considerare definitiva una narrazione streamed prima di `turn.completed` con `stateVersion` valido.
- Componenti accessibili da tastiera, focus visibile, semantic HTML, label e annunci live per stato turno/dadi/errori.
- Gestire loading, empty, error, retry, reconnect SSE, duplicate submission e stale state.
- Escape di default; HTML generato dall’AI non viene renderizzato come trusted.
- Condividere tipi da contratti generati/versionati, non ricrearli manualmente.

### 10.2 API e application layer

- Route handler sottili: autenticazione, parse/validation, chiamata al caso d’uso, mapping risposta.
- Ownership e authorization applicate in ogni query/comando, SSE e admin; non affidarsi soltanto a controlli UI.
- Tutti gli endpoint mutanti applicabili accettano idempotency key e producono errori stabili.
- Actor context esplicito; repository tenant-safe per default.
- Nessuna logica di dominio in middleware o serializer.

### 10.3 Database ed event sourcing

- Migration forward-only dopo condivisione; non riscrivere migration già applicate.
- Vincoli, foreign key, unique/partial index e check constraint proteggono invarianti critici.
- Ogni query deve essere indicizzata in base al percorso reale e verificata con piano quando critica.
- Niente `SELECT *` nei percorsi applicativi stabili.
- Eventi immutabili; correzioni tramite compensation event o forward-fix.
- Schema event versionato e backward-compatible secondo policy documentata.
- PII e contenuto sensibile minimizzati, redatti nei log e separati dai payload analytics.

### 10.4 Turn Orchestrator e queue

- State machine esplicita; transizioni invalide rifiutate.
- Job ID derivato da identificatori idempotenti, non casuale quando deve sopravvivere a retry.
- Pending workspace separa proposte AI da mutazioni canoniche.
- Nessuno streaming definitivo prima della validazione e del commit previsti dalla specifica.
- Timeout e crash devono lasciare stato recuperabile e osservabile.
- Concorrenza testata con richieste realmente simultanee.

### 10.5 Rules Engine e tool

- Ogni tool ha input/output schema, authorization policy, limiti, side effect, eventi, errori e semantica idempotente.
- Tool registry allowlisted e contestuale; un nome sconosciuto fallisce chiuso ed è auditato.
- Tool di lettura e tool mutanti sono distinti.
- Una tool call non può scegliere arbitrariamente ID fuori dalle entità attive/autorizzate.
- Formule e cataloghi hanno versioni; replay usa la versione corretta.
- Property test per clamp, conservazione quantità, danni/healing, condizioni, inventario e relazioni.

### 10.6 AI, prompt e provider

- `AIProvider` è l’unico confine verso SDK esterni.
- Prompt di sistema, schema, tool registry, policy e model route hanno versioni registrate in `ai_requests`/trace.
- Costruire prompt separando istruzioni trusted da testo giocatore e contenuto recuperato.
- Delimitare e trattare come dati non affidabili input utente, memorie e contenuti AI precedenti.
- Structured output validato sintatticamente e semanticamente; nessun parse permissivo che applichi campi “quasi validi”.
- Retry di output invalido non ripete effetti deterministici già eseguiti.
- Ogni percorso AI ha timeout, fallback, usage accounting, cost estimate e terminal behavior.
- Una modifica a prompt, schema, tool, context budget, modello o routing richiede eval e confronto baseline.
- Non registrare chain-of-thought o dati non necessari; conservare output strutturati, motivazioni sintetiche previste dal contratto e metadata utili.

### 10.7 Memoria e NPC

- Ogni memoria episodica attiva deve riferire source event validi e visibility verificabile.
- Retrieval applica prima filtri tenant/campaign/entity/visibility/time, poi similarity/ranking.
- Il Context Builder usa budget per sezione e truncation deterministica; non tronca mai invarianti critici o risultati tool correnti.
- La memoria NPC distingue facts, beliefs, false beliefs, secrets, opinions, promises, debts e last encounter.
- Canary-secret test obbligatori per modifiche alla knowledge boundary.

### 10.8 Sicurezza e moderazione

- Input utente e output AI sono non affidabili.
- Validazione server-side, output escaping, CSP, session security, CORS/CSRF policy e rate limit coerenti con il deployment.
- Moderazione input prima del prompt e output prima dell’esposizione definitiva.
- Le categorie critiche falliscono chiuso secondo policy; ogni intervento genera audit/metriche senza contenuto sensibile non necessario.
- Romance disattivato per default, opt-in, soltanto adulti, consensuale e non esplicito.
- Nessun accesso cross-tenant in API, worker, SSE, admin, export o telemetry.

### 10.9 Osservabilità

- Ogni turno ha correlation/trace ID end-to-end.
- Log strutturati e redatti; niente `console.log` nei percorsi di produzione.
- Tracciare latenza per fase, error class, retry, schema violation, contradiction, token, costo, model route e tool usage.
- Non usare metriche ad alta cardinalità con ID utente/campagna come label.
- Alert e dashboard devono essere collegati a un runbook e a un owner.

---

## 11. Strategia di test obbligatoria

Il tipo di test deriva dal rischio, non dal file modificato.

| Modifica | Verifiche minime |
|---|---|
| Dominio/Rules Engine | unit + property/golden + casi limite + determinismo |
| API | schema/contract + auth/ownership + error mapping + idempotenza |
| Database/migration | database vuoto + upgrade + constraint + concorrenza + replay se applicabile |
| Queue/orchestrator | integration + retry + timeout + crash recovery + duplicate/simultaneous requests |
| Frontend | component/integration + keyboard/accessibility + error/reconnect + E2E del percorso |
| AI provider/prompt/schema | fake/fixture + invalid output + timeout/fallback + tool auth + eval baseline + costo/token |
| Memoria/NPC | visibility filter + canary-secret + ranking deterministic + long-campaign eval |
| Security/privacy | negative authorization + injection + redaction + rate limit + data lifecycle |
| Documentazione | link/path + front matter + freshness + riferimenti task/spec + snippet/schema check |

Regole:

- Test indipendenti da rete e provider reali per default.
- Fake provider e RNG seedato per riproducibilità.
- Test di integrazione con provider reali soltanto in suite separata, limitata, redatta e con budget.
- Vietati sleep arbitrari; usare clock fake, polling bounded o eventi.
- Nessun test flaky viene semplicemente ritentato fino al verde: individuarne la causa.
- Snapshot test solo per output stabile e revisionabile; non usarli come sostituto di assert semantici.
- Ogni test deve descrivere comportamento e condizione, non il dettaglio di implementazione.
- Una regressione scoperta richiede un test che la riproduca.

---

## 12. Documentazione living e contesto aggiornato

### 12.1 Responsabilità dei documenti

| Documento | Responsabilità | Quando aggiornarlo |
|---|---|---|
| `AGENTS.md` | Regole stabili per tutti gli agenti | Workflow, gerarchia delle fonti, standard o guardrail globali |
| [`docs/TASKS.md`](docs/TASKS.md) | Stato, ordine, dipendenze, test ed evidenze | Ogni change set |
| [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md) | Requisiti e architettura normativa | Decisione approvata che modifica il prodotto/sistema |
| `docs/CONTEXT.md` | Snapshot operativo corrente | Task attivo, milestone, commit, migration/schema/prompt/eval, rischi |
| `docs/README.md` | Indice e stato dei documenti | Nuovo documento, rename, supersede |
| `docs/TRACEABILITY.md` | Requisito → task → codice → test → evidenza | Ogni task funzionale |
| `docs/CHANGELOG.md` | Modifiche documentali/contrattuali significative | Decisione o release |
| `docs/adr/` | Decisioni e trade-off | Prima o insieme a decisioni architetturali rilevanti |
| Documenti feature/ops/test | Comportamento implementato e runbook | Ogni cambio corrispondente |

### 12.2 Regola di collegamento

Ogni documento living usa il front matter definito in `docs/TASKS.md` §6.2 e collega:

- sezioni normative della specifica in `source_refs`;
- task in `related_tasks`;
- moduli reali in `code_refs`;
- test o report in `test_refs`;
- documento sostituito in `supersedes`.

Ogni task deve a sua volta indicare i documenti da creare o aggiornare. Ogni ADR collega requisito, task, codice e test interessati. Evitare copie estese di requisiti: indicare una fonte canonica e aggiungere soltanto dettagli implementativi.

Un path futuro deve essere scritto come codice e marcato `planned`; non creare link Markdown rotti.

### 12.3 Freschezza

Prima di chiudere un task:

- aggiornare `last_reviewed` e `last_verified_commit` nei documenti toccati;
- verificare che i path esistano o siano `planned`;
- confrontare schema/API/eventi generati con le sorgenti;
- aggiornare `docs/CONTEXT.md` e Context Sync Log;
- eseguire `pnpm docs:check` o validazione equivalente;
- includere il report nelle evidenze.

Se una modifica rende obsoleto `AGENTS.md`, aggiornarlo nello stesso change set. Se cambia soltanto lo stato corrente, aggiornare `CONTEXT`/`TASKS`, non gonfiare questo file.

---

## 13. Uso autorizzato del browser personale e di sistemi esterni

Il Product Owner autorizza l’agente a utilizzare l’estensione Chrome e la sessione autenticata del browser personale **per attività strettamente collegate al task attivo**, ad esempio consultare documentazione ufficiale, configurare un provider AI, creare risorse di sviluppo/staging, impostare webhook, verificare deploy, osservare log o inserire segreti in un secret manager.

Questa autorizzazione non elimina i requisiti di sicurezza, tracciabilità e minima esposizione.

### 13.1 Procedura obbligatoria

1. definire nel task lo scopo dell’azione esterna e l’ambiente interessato;
2. usare documentazione ufficiale e corrente per API, SDK, limiti, sicurezza e prezzi;
3. preferire account/progetti/risorse dedicati al progetto, con privilegi minimi;
4. configurare local/dev e staging prima di production;
5. inserire i segreti direttamente nel secret manager o in un file locale ignorato da Git;
6. non copiare segreti in chat, documenti, issue, screenshot, clipboard persistente, log, test o codice;
7. registrare soltanto dati non sensibili: provider, resource/project ID, regione, ambiente, data, owner, configurazione e link interno quando appropriato;
8. codificare la configurazione in script/IaC quando possibile per evitare drift manuale;
9. eseguire uno smoke test minimo e registrare esito/request ID redatto;
10. aggiornare `docs/CONTEXT.md`, runbook e task con le modifiche esterne.

### 13.2 Limiti di privacy

- Non esplorare cronologia, email, file, password, cookie, tab o dati personali non necessari al task.
- Non estrarre, trascrivere o conservare password, token, cookie di sessione o codici 2FA.
- Non usare account personali o dati del Product Owner come fixture.
- Chiudere o ignorare contenuti estranei incontrati accidentalmente.
- Non condividere con provider esterni dati di campagna, PII o segreti oltre il minimo previsto e approvato.

### 13.3 Azioni ad alto impatto

Il permesso generale copre consultazione e configurazioni progettuali reversibili. Richiedono un’istruzione specifica nel task o una decisione registrata:

- acquisti, upgrade di piano, aumento di limiti di spesa o impegni contrattuali;
- eliminazione irreversibile di account, progetti, dati, chiavi uniche o backup;
- modifiche a production con rischio di downtime, perdita dati o cambiamento pubblico;
- pubblicazione pubblica, invio comunicazioni a utenti o accettazione di termini legali per conto del Product Owner;
- accesso a dati reali di utenti non necessario alla diagnosi.

Per production usare change plan, backup/rollback, osservabilità e verifica post-change. Mai usare production come ambiente di prova iniziale.

### 13.4 Esempio: configurazione di un provider OpenAI

Quando il task richiede l’integrazione iniziale:

- consultare la documentazione ufficiale aggiornata al momento dell’esecuzione;
- creare o selezionare una risorsa/progetto dedicato all’ambiente;
- usare una credenziale limitata e ruotabile, non una chiave personale condivisa;
- configurare budget, alert, rate limit e kill switch compatibili con `docs/MVP_SPEC.md` §28;
- salvare la credenziale nel secret manager o in `.env.local` ignorato, mai nel repository;
- mantenere model ID, prezzi e limiti come configurazione deploy-time;
- verificare structured output, tool calling, streaming, usage metadata, timeout e retry tramite l’adapter `AIProvider`;
- eseguire una richiesta smoke a costo minimo e registrare request ID/uso senza il segreto;
- conservare il dominio indipendente dal provider anche se l’adapter iniziale usa OpenAI.

---

## 14. Git, commit e gestione delle modifiche

- Ispezionare sempre `git status` prima di scrivere.
- Non usare `reset --hard`, `clean -fd`, force push o riscrittura di storia condivisa senza istruzione specifica e piano di recupero.
- Non cancellare o sovrascrivere modifiche preesistenti non comprese nel task.
- Commit piccoli, coerenti e buildabili; includere task ID nel messaggio o nel body.
- Formato raccomandato: `type(scope): summary`, ad esempio `feat(turns): enforce idempotent submission` o `docs(agent): add coding entry point`.
- Non mescolare refactor non necessario con una feature o bug fix.
- Un refactor deve preservare comportamento con test verdi prima e dopo.
- Non modificare migration già applicate; aggiungere una nuova migration/forward-fix.
- Verificare il diff staged e la lista file prima del commit.
- Nessun secret, dump, log, coverage artifact, cache, build output o file editor nel commit.

---

## 15. Sicurezza dei segreti e dei dati

- Segreti soltanto in secret manager o file locali ignorati.
- Fornire `.env.example` con nomi e descrizioni, mai valori reali.
- Redaction centralizzata per authorization header, cookie, token, prompt sensibili, email e identificatori personali.
- Non usare dati reali nei test; fixture sintetiche e chiaramente fittizie.
- Minimizzare prompt e log: inviare/conservare solo i dati necessari.
- Ogni nuovo dato persistito deve avere scopo, retention, access policy, export/delete behavior e audit appropriato.
- Vulnerabilità o esposizioni trovate vanno trattate come task di sicurezza con severità, mitigazione e regression test; non documentare il segreto compromesso.

---

## 16. Evidenze e formato del resoconto

Ogni task deve permettere a un altro agente di riprodurre la verifica. Le evidenze minime includono:

```text
Task: <ID>
Stato/progresso: <STATE> / <N%>
Commit o SHA: <value>
Environment: local | CI | staging | production
Modifiche: <file/moduli e comportamento>
Comandi eseguiti: <command>
Exit code: <code>
Report/trace/request ID: <path-or-redacted-id>
Migration head: <value-or-N/A>
Contract/schema/event version: <value-or-N/A>
Prompt/model/eval version: <value-or-N/A>
Documenti aggiornati: <paths>
Rischi residui/TODO tracciati: <IDs-or-none>
```

Non usare “testato”, “funziona” o “completato” senza comando, esito e contesto. Se una suite non può essere eseguita, indicare il motivo e mantenere il task non concluso.

---

## 17. Condizioni di blocco ed escalation

Marcare `BLOCKED` soltanto quando esiste un impedimento concreto, con:

- causa;
- impatto;
- lavoro già verificato;
- condizione esatta di sblocco;
- owner o decisione richiesta;
- parti indipendenti che possono continuare.

Sono blocchi legittimi, ad esempio:

- requisito materiale contraddittorio senza assunzione applicabile;
- assenza di credenziale/servizio indispensabile dopo aver completato fake e test locali;
- rischio di perdita dati o sicurezza non mitigabile nel task;
- dipendenza non completata che invalida il comportamento;
- decisione legale/commerciale necessaria per procedere.

Non sono blocchi legittimi: implementazione difficile, test rossi non ancora investigati, documentazione lunga o preferenza personale per un’altra tecnologia.

---

## 18. Checklist prima di dichiarare un task concluso

- [ ] Il task corretto è stato eseguito senza scope creep non tracciato.
- [ ] Criterio di accettazione e invarianti della specifica sono soddisfatti.
- [ ] Happy path, negative path e failure/retry path applicabili sono testati.
- [ ] Authorization, idempotenza, concorrenza e rollback sono testati quando rilevanti.
- [ ] Lint, typecheck, build e suite applicabili passano.
- [ ] Nessun test è stato indebolito o saltato senza decisione registrata.
- [ ] API, schema, eventi, migration e prompt sono versionati/coerenti.
- [ ] Telemetry, error handling, costo e redaction sono presenti dove richiesto.
- [ ] Accessibilità e sicurezza sono verificate per le superfici modificate.
- [ ] Documentazione, contesto, task, tracciabilità e changelog sono aggiornati.
- [ ] Link e path documentali sono validi; i futuri sono marcati `planned`.
- [ ] Il diff non contiene segreti, PII, debug o file accidentali.
- [ ] Evidenze riportano data assoluta, commit/SHA, environment, comandi ed exit code.
- [ ] Il task è `DONE` soltanto con progresso `100%` e test `PASSING`.

---

## 19. Aggiornamento di questo file

Aggiornare `AGENTS.md` quando cambia almeno uno dei seguenti elementi:

- ordine di lettura o procedura di cold start;
- gerarchia delle fonti;
- Definition of Done o quality gate globale;
- struttura del repository o dependency direction globale;
- regole trasversali per sicurezza, segreti, browser o sistemi esterni;
- protocollo di documentazione e contesto;
- standard di codice condivisi da più moduli.

Ogni modifica deve:

1. collegare il task/ADR che la motiva;
2. aggiornare `last_reviewed` e `last_verified_commit`;
3. aggiornare `docs/TASKS.md`, `docs/CONTEXT.md` e `docs/CHANGELOG.md` quando esistono;
4. eseguire la validazione dei link e una cold-start review;
5. evitare dettagli volatili già disponibili in `CONTEXT` o `TASKS`.

L’obiettivo non è rendere questo file sempre più lungo, ma mantenerlo affidabile, navigabile e sufficiente a indirizzare correttamente un agente nuovo.
