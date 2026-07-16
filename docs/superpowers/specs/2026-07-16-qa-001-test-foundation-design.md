---
status: active
owner: engineering
last_reviewed: 2026-07-16
last_verified_commit: a698592b0a610735297a1026c80eae5e5114355c
source_refs:
  - docs/MVP_SPEC.md#26-strategia-di-testing
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
  - docs/TASKS.md#qa-001--fondazione-comune-per-test-fixture-e-comandi-di-qualità
  - docs/product/UX_UI_DESIGN.md#141-dipendenze-dei-task-ui
related_tasks:
  - QA-001
  - QA-002
  - BL-004
  - BL-079
  - GOV-002
code_refs:
  - package.json
  - packages/testing
  - scripts/lib/postgres-test-container.mjs
  - .github/workflows/ci.yml
test_refs:
  - tests/unit/ci-gate.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/contracts/ci-workflow.test.mjs
supersedes: null
---

# QA-001 — Fondazione comune dei test

## Contesto

Il repository usa già `node:test`, comandi root separati per corsia e un harness PostgreSQL reale basato su Docker CLI. Mancano però un contratto comune per runner e report, primitive deterministiche riusabili, isolamento esplicito dei processi e un lifecycle condiviso per PostgreSQL e Redis.

La card originale `QA-001` includeva anche browser matrix, accessibility e visual regression. Questo confliggeva con il contratto UX: `BL-079` possiede il primo setup browser/component necessario a verificare la shell, mentre la fondazione comune può consolidarlo soltanto dopo che esiste. Il Product Owner ha approvato il 2026-07-16 la decomposizione in due task:

- `QA-001` costruisce ora la fondazione test non-browser;
- `QA-002` consolida Playwright, accessibility e visual regression dopo `BL-079` e `QA-001`.

## Decisione

Mantenere il runner nativo di Node `24.11.0` e introdurre il contratto versionato `testing-foundation-v1`. Non migrare a Vitest e non mantenere due runner concorrenti.

La soluzione aggiunge tre unità indipendenti:

1. `@dnd-ai/testing` espone primitive pure e deterministiche per clock, RNG, ID e fixture.
2. `@dnd-ai/testing/node` espone il lifecycle Node-only dei container reali e non entra nei bundle applicativi o browser.
3. Un runner root versionato orchestra le corsie registrate, applica isolamento/timeout, propaga ogni failure e produce report JUnit e coverage deterministici.

Il package `testcontainers` non viene introdotto: il repository possiede già un harness Docker CLI PostgreSQL robusto, con porta loopback effimera, polling bounded e cleanup fail-closed. `QA-001` generalizza quel contratto e aggiunge Redis con gli stessi invarianti, evitando una seconda libreria per lo stesso scopo.

### Alternative escluse

- **Vitest + Testcontainers:** reporter e fixture mature, ma richiedono una migrazione ampia delle suite esistenti, nuove dipendenze e un cambio simultaneo del lifecycle database già verificato.
- **Node e Vitest in parallelo:** consente adozione graduale, ma duplica configurazione, semantica di isolamento, reporter e failure behavior; non soddisfa l'obiettivo di uniformità.
- **Script futuri no-op:** farebbero apparire presenti E2E/eval non ancora implementati. Una corsia entra nel catalogo soltanto quando possiede almeno una suite reale.

## Scope di QA-001

### Runner e command contract

Il runner riceve una corsia allowlisted e opzioni bounded. Le corsie iniziali sono `unit`, `integration`, `database`, `contract` e `security`; `all` è una sequenza esplicita delle sole corsie registrate. Input sconosciuti, corsie vuote, path fuori repository, reporter duplicati e directory report collegate falliscono prima di avviare processi.

Ogni corsia dichiara:

- glob o file test canonici;
- build prerequisite;
- concorrenza massima;
- timeout di processo;
- reporter di console e destinazione JUnit opzionale;
- coverage applicabile;
- owner task e failure behavior.

Il database resta seriale. Le altre corsie usano `node:test` con isolamento `process`; nessun retry automatico è ammesso. Un processo figlio non eredita secret o variabili applicative non allowlisted dal contratto del test.

I comandi esistenti `test:unit`, `test:integration`, `db:migrate:test`, `test:contract` e `test:security` restano le superfici pubbliche. Vengono collegati al runner senza cambiare il significato delle suite e senza eseguire install impliciti.

### Primitive deterministiche

L'export root di `@dnd-ai/testing` resta platform-neutral e senza effetti collaterali. Fornisce:

- RNG seedato con sequenza stabile, range validati e seed serializzabile;
- fake clock monotono controllato esplicitamente dal test;
- factory di fixture che produce copie detached e applica override validati;
- test ID nel formato `<TASK-ID>:<case-slug>`, usato nei report e nei failure message;
- helper di cleanup registrati dal test, mai metodi test-only sulle classi di produzione.

Seed, orario iniziale e test ID sono obbligatori nei builder condivisi. Nessuna primitive legge `Date.now`, `Math.random`, `process.env` o stato globale mutabile senza una dipendenza esplicita.

### Container PostgreSQL e Redis

Il subpath Node-only generalizza il lifecycle già usato da `BL-004`:

- immagini pin a digest;
- nome e porta host unici per processo;
- bind esclusivo su loopback;
- readiness con polling bounded, senza sleep arbitrari;
- URL restituiti soltanto al processo test e mai stampati;
- cleanup idempotente in successo, failure, timeout e signal;
- failure di cleanup visibile e non convertita in successo.

PostgreSQL conserva immagine, estensione pgvector e contratto migration esistenti. Redis usa un'immagine ufficiale pin a digest e un database effimero senza persistenza o esposizione non-loopback. Lo smoke comune prova contemporaneamente isolamento dei dati e assenza di collisioni fra due processi.

### Report e coverage

I report sono output generati, ignorati da Git e confinati in una directory dedicata. JUnit usa ordinamento stabile per corsia/file/test ID e non include environment, URL, stack completi o payload sensibili. Il coverage usa il supporto nativo Node e applica inizialmente la soglia `80%` a `@dnd-ai/testing`; domain e rules entrano nel gate quando possiedono codice produttivo reale.

La CI genera e valida i report della job Tests. Un artifact dedicato può contenere soltanto JUnit, LCOV e un manifest con schema `testing-foundation-v1`, task ID, commit, conteggi e checksum. Retention massima sette giorni; nessun log grezzo, `.env`, output applicativo o contenuto del database è ammesso.

## Failure behavior

- Una fixture intenzionalmente rossa deve produrre exit non-zero e non può entrare nelle glob normali.
- Un test process terminato, scaduto o privo di report fallisce la corsia.
- Un JUnit malformato, duplicato o riferito a un task ID sconosciuto fallisce la validazione.
- Un container non pronto entro il budget viene rimosso e restituisce un errore statico redatto.
- Se il cleanup fallisce dopo test verdi, la corsia resta fallita.
- Il runner non effettua retry; una regressione flaky richiede causa e test deterministico.

## Strategia TDD e verifica

L'implementazione segue cicli RED/GREEN separati:

1. contract test del catalogo runner e degli input vietati;
2. self-test subprocess che osserva exit rosso, verde e isolamento fra due processi;
3. unit test di RNG, clock, fixture e test ID con golden sequence;
4. smoke reale PostgreSQL + Redis con due ambienti concorrenti e cleanup verificato;
5. report JUnit/coverage generati due volte e confrontati dopo normalizzazione dei campi runtime;
6. policy CI/artifact con fixture negative per path, symlink, secret e report mancanti;
7. gate `HIGH_RISK`, perché cambiano workflow, artifact e lifecycle container.

La chiusura richiede test mirati, audit dipendenze, un full `verify` sul candidato, checkout pulito e CI protetta. Nessun provider esterno, account, deploy o azione Vercel appartiene al task.

## QA-002 — Browser, accessibility e visual regression

`QA-002` dipende da `QA-001` e `BL-079`. Consolida, senza duplicare le fixture della feature:

- Playwright e lifecycle del server locale;
- viewport 320, 390 e 1440 px e profilo touch;
- tastiera, focus, zoom e safe area;
- `prefers-reduced-motion` e accessibility scan;
- visual regression e artifact deterministici;
- failure path per server non pronto, browser crash e snapshot drift.

`QA-002` non riapre il freeze Vercel. Il browser harness deve funzionare localmente; smoke Preview/staging e provider restano proprietà di `BL-080` e dei gate che lo dipendono.

## Fuori scope

- componenti UI, shadcn/ui, AI Elements, Motion e shell di gioco;
- E2E di feature non ancora implementate;
- eval AI, bot campaign, load/chaos e DAST;
- migration o schema applicativi nuovi;
- provider reali, Vercel, staging o Production;
- retry automatici per rendere verdi test flaky.

## Condizioni di revisione

Riconsiderare il runner soltanto se il supporto Node non può produrre report/coverage richiesti in modo deterministico, oppure se almeno due suite reali dimostrano un limite non risolvibile senza duplicazione significativa. La preferenza di libreria o la disponibilità di plugin non sono evidenze sufficienti.
