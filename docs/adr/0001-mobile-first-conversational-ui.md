---
status: accepted
owner: product-design-and-frontend
last_reviewed: 2026-07-16
last_verified_commit: 84357e83dbc173e9a3445b7df24a3b7e7157fbaa
source_refs:
  - docs/MVP_SPEC.md#8-esperienza-utente
  - docs/MVP_SPEC.md#11-architettura-generale
  - docs/MVP_SPEC.md#21-interfaccia-utente
  - docs/product/UX_UI_DESIGN.md
related_tasks:
  - GOV-001
  - GOV-004
  - BL-079
  - BL-081
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
  - QA-002
code_refs:
  - apps/web (planned)
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/e2e/mobile-game-loop.spec.ts (planned)
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
8. La fondazione visuale e la shell conversazionale sono verificabili in locale e CI e non dipendono dalla disponibilità di preview/staging. `BL-080` possiede provisioning e smoke remoto; `GATE-M0` ricompone entrambe le evidenze prima dell'uscita da M0.

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
- Rive non supera il performance gate di `BL-081`;
- AI Elements impone tipi/trasporto incompatibili con `TurnView` o REST+SSE.

Ogni revisione aggiorna ADR, specifica, studio UX, task e test nello stesso change set.
