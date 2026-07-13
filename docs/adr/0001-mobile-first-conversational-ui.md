---
status: accepted
owner: product-design-and-frontend
last_reviewed: 2026-07-13
last_verified_commit: 778b634ce4ef3e9a2dbe2a6b225327e2538e2ed2
source_refs:
  - docs/MVP_SPEC.md#8-esperienza-utente
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#21-interfaccia-utente
  - docs/product/UX_UI_DESIGN.md
related_tasks:
  - GOV-001
  - BL-079
  - BL-005
  - BL-006
  - BL-012
  - BL-013
  - BL-014
  - BL-016
  - BL-017
  - BL-019
  - BL-027
  - BL-039
  - BL-040
code_refs:
  - apps/web/components.json
  - apps/web/src/app/globals.css
  - apps/web/src/components/ai-elements
  - apps/web/src/components/game
  - apps/web/src/components/motion
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/bl079-ui-foundation.test.mjs
  - apps/web/src/components/game/game-shell.test.tsx
  - apps/web/e2e/game-shell.spec.ts
  - docs/testing/BL-079_VERIFICATION.md
supersedes: null
---

# ADR-0001 — UI conversazionale mobile-first e stack visuale

## Stato

Accepted il 2026-07-13 su direzione del Product Owner.

## Contesto

La specifica iniziale definiva un prodotto desktop-first e responsive. La direzione approvata richiede invece poche informazioni a schermo, HUD semplice, esperienza ottimizzata per telefono, modello chatbot-like e qualità da gioco premium senza estetica medievale/fantasy nell’interfaccia.

Il frontend deve inoltre preservare REST+SSE, idempotenza, `TurnView`, `stateVersion` e separazione fra prosa AI e stato canonico.

## Decisione

1. Il prodotto è mobile-first: 320 px è il minimo funzionale, 360–430 px la baseline primaria; il desktop è progressive enhancement.
2. Il core loop usa una shell conversazionale con feed, decisione corrente e composer sticky. HUD secondaria apre drawer/sheet.
3. shadcn/ui `new-york` su base Radix e token semantici è la fondazione dei componenti.
4. AI Elements viene adottato selettivamente per primitive di conversazione e rendering AI. I componenti sono adattati a `TurnView`; `useChat` e un protocollo chat generico non sostituiscono REST+SSE.
5. Motion for React è lo strato standard per micro-interazioni coordinate, con `LazyMotion`, feature subset e reduced-motion.
6. CSS resta preferibile per feedback semplici. Rive è un’opzione gated e lazy-loaded per asset isolati; non entra nella shell base senza benchmark.
7. Il visual language è contemporaneo, scuro, neutro e tipografico, con un accento primario. Sono esclusi chrome pseudo-medievale, texture pergamena, font gotici, oro ornamentale, gradienti invasivi e HUD dense.

## Alternative considerate

### Desktop-first con sidebar permanenti

Rifiutata: riduce la qualità del percorso principale sul telefono e incentiva densità informativa non necessaria.

### Chat custom costruita interamente da zero

Rifiutata: duplica primitive di scroll, message rendering, focus e composer già disponibili come source-owned components. I wrapper di dominio restano comunque obbligatori.

### AI SDK/`useChat` come protocollo del gioco

Rifiutata: il turno del gioco ha state machine, commit, retry e idempotenza più forti di un messaggio chat generico. AI Elements viene usato soltanto nella presentazione.

### Canvas/WebGL o game engine per tutta la schermata

Rifiutata per P0: aumenta bundle, consumo e complessità di accessibilità senza migliorare il loop testuale.

### Lottie/Rive per animazioni diffuse

Rifiutata come default: asset runtime diffusi rischiano jank e incoerenza. Rive può essere valutato per uno o due momenti con fallback e budget.

## Conseguenze positive

- un’unica gerarchia informativa da mobile a desktop;
- componenti accessibili e source-owned;
- feed AI curato senza accoppiare dominio e provider UI;
- motion coerente, misurabile e disattivabile;
- stile premium derivato dal comportamento e non da cliché visivi.

## Svantaggi e costi

- richiede wrapper di dominio sopra shadcn/AI Elements;
- drawer, tastiera virtuale e scroll del feed richiedono test mobile reali;
- Motion e un eventuale Rive aggiungono budget e disciplina di caricamento;
- dark theme P0 richiede contrast audit accurato per muted/disabled/status.

## Guardrail e condizione di revisione

La decisione va riesaminata se:

- test con utenti mostrano che il feed conversazionale impedisce comprensione tattica;
- i pannelli mobile richiedono più di due livelli di drawer per azioni frequenti;
- Motion supera il budget o causa regressioni di input/scroll sul device target;
- Rive non supera il performance gate di `BL-079`;
- AI Elements impone tipi/trasporto incompatibili con `TurnView` o REST+SSE.

Ogni revisione aggiorna ADR, specifica, studio UX, task e test nello stesso change set.

## Evidenza di implementazione BL-079

La decisione è implementata nella fondazione `apps/web`: shadcn/ui `new-york` su Radix, AI Elements selettivi senza `useChat`, shell conversation-first da 320 px, drawer HUD, enhancement desktop, Motion lazy/reduced e contratti strutturati per stati, retry e scelte.

Il gate ha scelto il ramo più semplice previsto dall'ADR: Rive non entra nella shell P0. Il bundle, la performance delle interazioni, gli screenshot multipiattaforma e la matrice automatizzata sono registrati in `docs/testing/BL-079_VERIFICATION.md`. I gate con utenti, device e browser reali restano condizioni di chiusura del task, non modifiche alla decisione architetturale.
