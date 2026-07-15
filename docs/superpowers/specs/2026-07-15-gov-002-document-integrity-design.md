---
status: draft
owner: engineering
last_reviewed: 2026-07-15
last_verified_commit: 15382d547638333e33992be96479a6f0cbff1a29
source_refs:
  - docs/MVP_SPEC.md#2612-ci-quality-gates
  - docs/MVP_SPEC.md#323-traceability-p0
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
  - docs/TASKS.md#gov-002--validazione-automatica-della-documentazione-e-tracciabilità
related_tasks:
  - GOV-002
  - GOV-003
  - BL-002
  - BL-009
code_refs:
  - scripts/check-docs.mjs
  - scripts/generate-contracts.mjs
  - scripts/lib/document-policy.mjs
  - scripts/lib/document-integrity-policy.mjs (planned)
  - scripts/lib/mermaid-policy.mjs (planned)
  - scripts/validate-mermaid-worker.mjs (planned)
  - scripts/lib/task-graph.mjs
  - scripts/lib/ci-workflow-policy.mjs
test_refs:
  - tests/contracts/document-policy.test.mjs
  - tests/contracts/document-integrity.test.mjs (planned)
  - tests/contracts/agent-workflow-contract.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/contracts/contracts-generated.test.mjs
supersedes: null
---

# GOV-002 — Integrità automatica della documentazione

## Contesto e obiettivo

`GOV-003` verifica già front matter, freshness dei documenti modificati, path, link relativi, whitespace e task graph. `BL-009` possiede il controllo canonico del drift JSON Schema/OpenAPI. Restano scoperti gli anchor di sezione, i riferimenti numerici `§`, la sintassi Mermaid e un registro ADR completo.

`GOV-002` compone questi controlli in `pnpm docs:check` senza duplicare parser, generatori o regole già implementate. Il risultato deve essere deterministico, offline, fail-closed e abbastanza rapido da restare utilizzabile nella corsia `FAST` per i successivi task documentali.

## Decisione

Adottare una policy modulare con tre responsabilità:

1. `document-policy.mjs` continua a possedere discovery, front matter, freshness, path e link.
2. `document-integrity-policy.mjs` possiede heading, anchor, riferimenti `§` e completezza del registro ADR.
3. `mermaid-policy.mjs` estrae i fence `mermaid` e li valida tramite `mermaid@11.16.0` in un worker Node bounded.

`docs:check` orchestra inoltre i checker già canonici per task graph e artifact contrattuali. Non ricrea la logica di `task-graph.mjs` o `generate-contracts.mjs`.

### Alternative escluse

- Regex Mermaid: leggera, ma non dimostra che un diagramma sia accettato dal parser reale.
- Mermaid CLI con Chromium: offre rendering completo, ma amplia installazione, superficie di attacco e tempo CI senza aggiungere un criterio P0 rispetto alla validazione sintattica.
- `@mermaid-js/parser` diretto: non copre in modo affidabile tutte le famiglie presenti, in particolare flowchart ed ER; il contratto usa quindi l'API pubblica `mermaid.parse` del package principale.

## Contratti di validazione

### Heading e anchor

La policy costruisce per ogni documento il catalogo degli heading Markdown ATX fuori dai code fence. Gli anchor seguono la normalizzazione GitHub usata dai link del repository: testo in lowercase, markup e punteggiatura rimossi, spazi convertiti in `-` e duplicati suffissati in ordine (`-1`, `-2`).

Devono esistere:

- il fragment di ogni link Markdown locale;
- il fragment di ogni `source_refs`, `code_refs` o `test_refs` che punta a Markdown;
- il target di ogni riferimento esplicito nel formato `` `path/file.md` §... ``.

Per i riferimenti `§`, la policy accetta liste e range numerici, inclusi `§§8, 11.4, 21`, `§18.4–18.9` e `§§1–7`. Ogni valore singolo e ogni estremo di range deve corrispondere al prefisso numerico di un heading del documento target. Testo descrittivo successivo al numero non partecipa al confronto.

I riferimenti privi di path esplicito restano testo editoriale e non vengono interpretati automaticamente, evitando associazioni ambigue fra documenti.

### Registro ADR

`docs/adr/README.md` elenca ogni ADR numerato una sola volta con titolo, stato e link relativo. La policy fallisce se un ADR numerato manca dal registro, è duplicato, punta a un file inesistente o dichiara uno stato diverso dal front matter del documento.

### Mermaid

Ogni fence `mermaid` viene validato con `mermaid.parse` in un worker thread separato. Il worker:

- non renderizza SVG e non avvia browser o rete;
- riceve soltanto path, indice e sorgente del diagramma;
- rifiuta fence vuoti e diagrammi oltre 128 KiB;
- processa al massimo 64 diagrammi per repository;
- ha un timeout complessivo di 10 secondi e viene terminato dal parent in caso di hang;
- restituisce soltanto tipo o errore normalizzato, senza stack o sorgente completa.

L'errore pubblico è stabile e ordinabile: `<path>: mermaid-invalid block <n>`. Dettagli del parser vengono troncati a 240 caratteri e normalizzati su una sola riga.

## Composizione dei comandi e CI

`pnpm docs:check` esegue, in ordine:

1. build mirata di `@dnd-ai/contracts`;
2. `generate-contracts.mjs --check` per drift e compatibilità;
3. `check-docs.mjs` per metadata, riferimenti, ADR e Mermaid;
4. `check-task-graph.mjs` per ID, dipendenze e stati.

Gli script root usano comandi diretti e non invocano un `pnpm` globale annidato. `verify:docs` aggiunge `git diff --check HEAD` e secret scan. Il job Quality della CI usa un solo step `pnpm docs:check` al posto degli step separati per contratti e task graph; `ci-workflow-policy.mjs` impedisce la rimozione o duplicazione del gate.

Il full `verify` conserva gli stessi primitive checker una sola volta. Nessun controllo documentale usa provider, rete, Vercel o credenziali.

### Budget prestazionale

Il worker Mermaid viene avviato una sola volta per run e valida tutti i diagrammi in batch. Sul repository corrente, dopo l'installazione frozen, `docs:check` deve concludersi entro 30 secondi senza cache Turbo e una seconda run entro 10 secondi. Il test registra la durata ma usa come gate soltanto questi limiti larghi e riproducibili; un superamento apre un finding invece di introdurre retry automatici.

## Error handling e sicurezza

- Tutti i risultati sono ordinati per path, codice e posizione per garantire output deterministico.
- Path e fragment vengono decodificati e confinati al repository prima della lettura.
- Fence, inline code e link esterni non vengono interpretati come riferimenti normativi locali.
- Mermaid è input non affidabile proveniente da una PR: limiti dimensionali e worker terminabile impediscono che un parser bloccato occupi indefinitamente il job.
- Il package Mermaid è una dev dependency esatta; lockfile, licenza MIT, dependency audit e assenza dall'artifact applicativo vengono verificati.

## Test

Il ciclo TDD introduce fixture minime e isolate:

- anchor valido, anchor mancante, percent-encoding invalido e heading duplicati;
- riferimenti `§` singoli, liste e range validi, più sezione target mancante;
- registro ADR valido, ADR mancante, duplicato e stato divergente;
- Mermaid reale valido per flowchart, sequence, state ed ER; diagramma malformato, fence vuoto, limite byte, limite quantità e timeout worker;
- `docs:check` che fallisce su drift contrattuale tramite il checker esistente e passa sulla fixture valida;
- workflow CI che richiede esattamente il gate composto.
- smoke prestazionale cold/warm entro 30/10 secondi e artifact applicativo privo di Mermaid.

I test mirati precedono l'implementazione. Poiché cambiano dependency graph, lockfile e workflow CI, la corsia è `HIGH_RISK`: audit dipendenza, test contract mirati, un solo `pnpm verify` sul candidato finale, clean checkout e una review indipendente.

## Documentazione e stato

Lo stesso change set:

- crea `docs/adr/README.md`;
- consolida `docs/TRACEABILITY.md` e `docs/CHANGELOG.md` senza duplicare evidenze già nelle card;
- aggiorna `docs/README.md`, `docs/TASKS.md` e `docs/CONTEXT.md` al comportamento implementato;
- non modifica `MVP_SPEC.md`, perché scope e decisioni normative restano invariati.

## Fuori scope

- rendering visuale o snapshot SVG/PNG dei diagrammi;
- lint editoriale, grammaticale o stilistico del testo italiano;
- verifica dei link HTTP esterni;
- generazione automatica del changelog;
- modifica dei contratti applicativi o dei loro artifact;
- azioni Vercel, deploy, staging o provider.

## Criterio di chiusura

`GOV-002` è completo quando una fixture valida passa e fixture con front matter mancante, link/anchor rotto, task ID duplicato, riferimento `§` inesistente, Mermaid invalido, ADR non registrato o artifact generato in drift falliscono con output deterministico; la CI protetta esegue il gate composto e il full gate finale passa senza includere Mermaid negli artifact runtime.
