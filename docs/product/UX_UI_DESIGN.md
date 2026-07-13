---
status: active
owner: product-design-and-frontend
last_reviewed: 2026-07-13
last_verified_commit: 2765c49959d6b4094367120e3615a0728a58be0a
source_refs:
  - docs/MVP_SPEC.md#8-esperienza-utente
  - docs/MVP_SPEC.md#21-interfaccia-utente
  - docs/MVP_SPEC.md#23-requisiti-non-funzionali
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
  - BL-071
  - BL-072
  - BL-073
  - BL-074
  - BL-076
  - BL-078
code_refs:
  - apps/web/components.json
  - apps/web/src/app/globals.css
  - apps/web/src/components/ai-elements
  - apps/web/src/components/game
  - apps/web/src/components/motion
  - apps/web/e2e/game-shell.performance.spec.ts
  - apps/web/e2e/performance-budget.mjs
  - apps/web/e2e/start-production-server.mjs
  - apps/web/playwright.config.ts
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/bl079-ui-foundation.test.mjs
  - apps/web/src/components/game/game-shell.test.tsx
  - apps/web/e2e/game-shell.spec.ts
  - apps/web/e2e/game-shell.performance.spec.ts
  - apps/web/e2e/__screenshots__
  - tests/unit/performance-budget.test.mjs
  - docs/testing/BL-079_VERIFICATION.md
supersedes: null
---

# Studio UX/UI — gioco conversazionale mobile-first

## 1. Esito dello studio

La direzione consigliata è una **conversation-first game UI**: il giocatore deve percepire la semplicità di una chat, la chiarezza di un’app consumer e la risposta tattile di un gioco premium. La fiction rimane fantasy; il chrome dell’interfaccia no.

Il core loop visivo è:

```text
leggi l’ultima conseguenza → scegli o scrivi un’azione → osserva la risoluzione → continua
```

Tutto ciò che non serve a questo loop è secondo livello. Il telefono è la superficie primaria; il desktop amplia il contesto ma non introduce una diversa architettura dell’informazione.

## 2. Obiettivi P0

1. Comprendere in meno di cinque secondi dove ci si trova, cosa è appena accaduto e cosa si può fare.
2. Completare il loop con una mano su viewport da 320 a 430 px.
3. Tenere visibili feed, decisione corrente, stato tecnico essenziale e composer senza una HUD densa.
4. Rendere distinguibili narrazione AI, azione del giocatore, risultato deterministico e cambiamento canonico.
5. Comunicare qualità premium con tipografia, ritmo, motion e feedback, non con decorazione fantasy.
6. Conservare accessibilità, affidabilità e comprensibilità con animazioni disattivate.

Non-obiettivi P0:

- mappa tattica o canvas 3D;
- pannelli desktop indispensabili;
- inventario sempre visibile;
- skin medievale, texture pergamena, cornici araldiche o font gotici;
- asset generato per ogni turno;
- voce, vibrazione obbligatoria o audio continuo;
- installazione di intere registry quando bastano pochi componenti.

## 3. Utente e contesto d’uso

Il giocatore target è un adulto casual gamer, non necessariamente esperto di GdR, che usa sessioni brevi e interrompibili. Il design deve tollerare:

- uso a una mano e attenzione parziale;
- rete mobile instabile e reconnect;
- ritorno alla campagna dopo ore o giorni;
- tastiera virtuale che occupa una parte importante della viewport;
- regole non note a memoria;
- sessioni narrative lunghe senza perdere l’ultimo punto decisionale.

Conseguenza progettuale: la schermata non deve sembrare un character sheet permanente. Deve sembrare una conversazione giocabile con stato affidabile.

## 4. Gerarchia dell’informazione

### Livello 1 — sempre disponibile

- scena corrente in forma breve;
- stato connessione/salvataggio/turno;
- HP e condizioni critiche del protagonista;
- ultima narrazione e ultimo dialogo rilevante;
- decisione corrente;
- composer o controlli dell’azione corrente.

### Livello 2 — on demand

- obiettivo completo;
- party e compagni;
- formula del dado e dettagli della regola;
- inventario, equipaggiamento e consumabili;
- missioni, relazioni, NPC presenti e cronaca.

### Livello 3 — fuori dal loop

- impostazioni account/accessibilità;
- export/delete;
- dati diagnostici e amministrativi;
- trace, costi, schema, prompt e payload.

Regola: se una superficie contiene più di un’azione primaria o più di tre gruppi informativi concorrenti su mobile, va ridotta o spostata al livello successivo.

## 5. Shell mobile

```text
┌──────────────────────────────────────┐
│ Porto Sommerso       Salvato · Menu  │  header 48–56 px
│ 18/24 HP · Affaticato                │  status essenziale
├──────────────────────────────────────┤
│                                      │
│ DM                                   │
│ La luce si spegne dietro la porta.   │
│ Mara ti guarda: «Decidiamo ora.»     │
│                                      │
│ Tu                                   │
│ Cerco una via d’uscita silenziosa.   │
│                                      │
│ Percezione · Successo   [Dettagli]   │  esito canonico
│ Hai trovato: Passaggio di servizio   │  state diff utile
│                                      │
│ [Segui il passaggio]                 │
│ [Resta con Mara]          [Altre]    │
├──────────────────────────────────────┤
│ Scrivi la tua azione…          [↑]   │  composer sticky
│ Obiettivo · Party · Inventario       │  HUD on demand
└──────── safe-area-inset-bottom ──────┘
```

Comportamento:

- l’header non cresce con metadati secondari;
- il feed mantiene la posizione se arrivano progress event o reconnect;
- lo scroll automatico avviene solo se l’utente era già vicino al fondo;
- due azioni suggerite sono visibili; `Altre` apre un drawer;
- il composer cresce fino a un’altezza massima, poi scorre internamente;
- con tastiera aperta, la decisione e il submit restano raggiungibili;
- inventario/quest/party aprono drawer dal basso con snap point e focus gestito.

## 6. Desktop come progressive enhancement

A partire dallo spazio disponibile, party e obiettivo possono diventare pannelli laterali. Il feed centrale conserva larghezza leggibile, ordine DOM e composer. Nessun dato essenziale deve esistere soltanto in una sidebar.

```text
┌──────────────────── header compatto ────────────────────┐
│ party contestuale │ feed + composer │ obiettivo/scena   │
│ 240–280 px        │ 640–760 px      │ 240–320 px        │
└──────────────────────────────────────────────────────────┘
```

La colonna centrale è il prodotto; le laterali sono contesto. Evitare tre dashboard equivalenti.

## 7. Modello conversazionale

| Parte | Presentazione | Densità | Azione |
|---|---|---:|---|
| Narrazione DM | blocco full-width, tipografia editoriale leggibile | media | nessuna azione nascosta nel testo |
| Dialogo NPC | speaker label + testo; avatar statico opzionale | bassa | risposta tramite composer/suggerimenti |
| Azione giocatore | blocco compatto e distinto, non una card dominante | bassa | nessuna modifica dopo ack |
| Risultato regola | riga sintetica; formula in collapsible/drawer | bassa | `Dettagli` |
| State diff | solo cambiamenti utili al giocatore | bassa | link alla superficie pertinente |
| Progress | una sola riga stabile, non token-by-token | minima | annulla soltanto quando autorizzato |
| Errore/retry | banner inline con `stateApplied` comprensibile | minima | retry solo se sicuro |

La narrazione definitiva usa `TurnView`, non message parts del provider. AI Elements è un renderer e una base di composizione, non modifica il modello canonico del turno.

## 8. HUD e navigazione

La HUD mobile ha tre accessi persistenti al massimo:

1. obiettivo;
2. party;
3. inventario.

Missioni, relazioni, cronaca e accessibilità restano nel drawer/menu e diventano prominenti solo quando il contesto lo richiede. Badge numerici sono riservati a eventi nuovi o condizioni che richiedono azione; non decorano ogni icona.

In combattimento:

- il composer libero lascia spazio a un action dock contestuale;
- azione, bersaglio e conferma sono un flusso progressivo, non tre pannelli simultanei;
- iniziativa completa e log dadi sono in drawer;
- HP critici, turno corrente e azioni legali restano inline;
- il ritorno al composer avviene appena la modalità lo consente.

## 9. Design system

### Fondazione

- shadcn/ui style `new-york`;
- base primitive Radix per compatibilità con AI Elements e comportamento accessibile;
- Tailwind CSS con token semantici;
- Geist Sans per UI e testo narrativo; Geist Mono solo per formule, ID e debug;
- Lucide per icone, normalmente 16–20 px dentro target più grandi;
- dark theme P0; struttura dei token compatibile con light theme futuro.

### Direzione cromatica

Palette proposta, da validare con contrast test:

- `background`: graphite quasi nero, non nero assoluto;
- `card/popover`: superfici neutre leggermente più chiare;
- `foreground`: bianco caldo ad alto contrasto;
- `muted`: grigio freddo leggibile;
- `primary`: blu cobalto luminoso, usato con parsimonia per azione e focus;
- `success`, `warning`, `destructive`: token semantici, mai sostituti dell’etichetta.

Da evitare: viola “AI” in gradienti, oro fantasy, beige pergamena, neon multipli, glassmorphism esteso, shadow glow continuo.

### Forma e densità

- raggio coerente, non una famiglia diversa per ogni componente;
- una sola densità per superficie mobile;
- card soltanto quando esiste un confine semantico;
- separatori e spazio prima di annidare card;
- testo narrativo con line-height confortevole e misura contenuta;
- target touch ≥44×44 CSS px, azioni primarie frequenti ≥48 px.

## 10. Mappa componenti

| Dominio | Primitive consigliate | Nota |
|---|---|---|
| Feed | AI Elements `Conversation`, `ConversationContent`, `ConversationScrollButton` | adattare auto-scroll al reconnect |
| Narrazione | `Message`, `MessageContent`, `MessageResponse` | allowlist link/Markdown; no raw HTML |
| Composer | parti di `PromptInput` + shadcn `Button`/`Textarea` | rimuovere attachment/model selector P0; invio con idempotency key applicativa |
| Suggerimenti | shadcn `Button`, `ButtonGroup`, `Drawer`, `Collapsible` | due visibili su mobile |
| HUD mobile | `Drawer` con snap point, `Badge`, `Separator` | focus trap e safe area |
| Pannelli desktop | `Sheet`/layout persistente, `ScrollArea` | stesso contenuto/ordine semantico |
| Regole/dadi | `Collapsible`, `Card`, `Progress` | sintesi inline, formula on demand |
| Choice irreversibile | `AlertDialog` | non usare `Dialog` generico |
| Loading/empty/error | `Skeleton`, `Spinner`, `Empty`, `Alert`, `Sonner` | toast mai unico canale per errori critici |
| Impostazioni | `Tabs`, `Field`, `Switch`, `Select` | form mobile a singola colonna |

Installare soltanto i componenti usati. Prima dell’installazione usare `shadcn ... --dry-run`/`view` quando disponibile e mantenere le estensioni nei wrapper di dominio.

## 11. Motion system

### Livelli

| Livello | Esempi | Tecnologia | Regola |
|---|---|---|---|
| Feedback immediato | press, focus, hover, toggle | CSS | 80–140 ms indicativi; mai `transition: all` |
| Transizione UI | drawer, lista azioni, state diff, progress | Motion | 160–260 ms indicativi; transform/opacity |
| Risoluzione di gioco | dado, reward, level-up, scena | Motion; Rive gated | breve, skippabile, risultato già canonico |
| Ambient loop | nessuno nel core P0 | non previsto | evita batteria, distrazione e jank |

Regole normative:

- Motion viene caricato con `LazyMotion` e subset adeguato quando porta un beneficio misurabile;
- `useReducedMotion` sostituisce spostamenti ampi con opacity o aggiornamento istantaneo;
- layout/paint animation viene evitata nei percorsi frequenti; preferire `transform` e `opacity`;
- nessun `setTimeout` simula lo stato reale di backend o provider;
- la durata dell’animazione non prolunga artificialmente un turno già completato;
- Rive viene lazy-loaded a livello di feature, con fallback statico e performance marks nel prototipo;
- motion e feedback non generano una seconda fonte di verità.

### Momenti premium P0

1. Press/submit con risposta tattile visiva breve.
2. Turn progress che cambia stato senza salti di layout.
3. Comparsa dell’esito regola con gerarchia chiara.
4. Dado decorativo che converge al risultato server-side.
5. State diff che evidenzia cosa è cambiato e poi si stabilizza.
6. Drawer che segue il gesto e conserva focus/scroll.

Il gate `BL-079` ha escluso Rive dalla shell P0: Motion e CSS soddisfano i momenti base con un bundle e un failure path più semplici. Un consumer futuro può riaprire la sperimentazione per un asset isolato soltanto con lazy loading, fallback statico e benchmark documentato rispetto alla baseline BL-079.

## 12. Stati e failure path

| Stato | UI mobile | Requisito |
|---|---|---|
| `idle` | composer attivo, azioni disponibili | nessun invio duplicato |
| `submitting` | submit locked, feedback locale | ack rapido, draft conservato fino ad ack |
| `queued` | progress compatto e reconnect | niente percentuali inventate |
| `processing_rules` | stato testuale, drawer HUD read-only | nessuna mutazione concorrente |
| `streaming_provisional` | testo marcato provvisorio | non presentare state diff definitivo |
| `committing` | attesa breve, controlli locked | non offrire retry |
| `completed` | esito e state diff, composer riattivato | `stateVersion` valido |
| `failed_precommit` | banner inline | retry stessa key se autorizzato |
| `completed_with_delivery_error` | stato applicato, recupero via GET | mai reinviare automaticamente |
| `blocked_safety` | guidance breve e non colpevolizzante | riformulazione, nessun contenuto unsafe |

## 13. Criteri di verifica

### Mobile e responsività

- 320×568: flusso completo senza overflow orizzontale;
- 360×800 e 390×844: viewport primarie di design;
- 768 px: tablet portrait;
- 1024 e 1440 px: progressive enhancement desktop;
- portrait e landscape;
- tastiera virtuale aperta, safe area superiore/inferiore e zoom testo 200%;
- nessuna CTA coperta o raggiungibile solo via hover.

### Accessibilità

- WCAG 2.2 AA e target touch di prodotto ≥44 px;
- keyboard-only, focus order, focus restore e escape/dismiss corretti;
- screen reader su progress, fine turno, dado, danno, reward ed errori;
- contrasto token e stati disabled/focus;
- reduced-motion e contenuto equivalente;
- touch target e spaziatura verificati nel DOM, non soltanto nello screenshot.

### Performance

- trace su runtime production per submit, drawer e scroll; il dice tray reale è verificato dal consumer `BL-040`;
- animazioni core senza layout thrashing o long task attribuibili al motion layer;
- Motion tree-shaken/lazy dove possibile;
- Rive assente dal bundle iniziale e caricato una sola volta nella feature che lo usa;
- visual regression e test del layout dopo font load, reconnect e contenuto lungo.

Guardrail misurabili introdotti da `BL-079`:

- suite dedicata sulla build standalone production, dopo font e quiet window, con un browser worker, tre campioni e zero retry;
- ogni fase `scroll-latest`, `drawer-open`, `drawer-close` e `composer-submit` deve contenere un input catturato; lo scroll resta misurato fino al fondo stabile;
- Event Timing per le interazioni osservabili ≤ `104 ms`, con processing `<50 ms`;
- `0 ms` di `blockingDuration` per Long Animation Frame che interseca una fase; long task fuori fase restano diagnostici e non vengono attribuiti alla shell;
- CLS delle interazioni ≤ `0.1`;
- JSON di fasi, input, Event Timing, LoAF, long task e layout shift allegato prima delle asserzioni e conservato dalla CI soltanto in caso di failure;
- baseline first-load della route registrata nel report BL-079; una crescita gzip superiore al 10% richiede misura, motivazione e review;
- Rive resta assente da manifest, lockfile, source e bundle iniziale finché un ADR o task consumer non supera il gate.

### Test di comprensione

Con un prototipo e cinque utenti interni non coinvolti nell’implementazione, verificare:

1. identificazione di scena, HP e obiettivo;
2. invio di un’azione libera;
3. comprensione che i suggerimenti non sono obbligatori;
4. apertura dell’inventario senza perdere il punto nel feed;
5. distinzione fra narrazione, dado e stato applicato;
6. ripresa dopo una simulazione di reconnect.

Gli errori osservati diventano finding con severità e task, non note informali.

## 14. Piano di implementazione

`BL-079` deve produrre, nell’ordine:

1. `components.json` Radix e token semantici;
2. font, icon policy, radius, spacing e touch-target contract;
3. shell mobile statica con dati fixture;
4. wrapper `GameConversation`, `NarrativeTurn`, `FreeActionComposer`, `GameDrawer` e motion primitives;
5. stati idle/loading/error/reconnect/completed con fake deterministico;
6. responsive desktop enhancement;
7. test component, keyboard, accessibility, reduced-motion, visual regression e performance trace;
8. decisione documentata su Rive: adottare con budget o rimuovere.

Le feature M1–M3 consumano questa fondazione; non ridefiniscono palette, spacing, componenti chat o motion localmente.

### 14.1 Dipendenze dei task UI

Ogni task che crea o modifica una superficie utente dipende esplicitamente da `BL-079` e cita sia questo contratto sia `docs/adr/0001-mobile-first-conversational-ui.md`. La regola vale anche per identity, recovery e backlog differito: un gate di milestone transitivo non sostituisce il collegamento al design system concretamente consumato.

`BL-079` possiede il setup component/browser minimo necessario a dimostrare shell, accessibilità e responsive behavior. `QA-001` lo consolida successivamente nel harness comune per tutto il repository; non è una dipendenza di `BL-079` e non ne duplica le fixture.

### 14.2 Profilo implementato da BL-079

La fondazione verificata usa una shell dark graphite/cobalto con Geist, Lucide, radius morbidi e gerarchia tipografica contemporanea. Su mobile il primo livello contiene scena, feed, due azioni, composer e HUD a tre ingressi; party, obiettivo e inventario vivono in drawer. Su desktop gli stessi dati diventano pannelli laterali senza cambiare ordine semantico o introdurre funzioni esclusive.

I viewport corti usano due colonne in landscape e una modalità feed+composer quando la tastiera riduce fortemente l'altezza. Safe area top, bottom, left e right proteggono shell e contenuti portalled. Una risposta più alta del feed apre sullo speaker e sull'inizio; streaming e reconnect restano invece ancorati all'ultimo contenuto.

La UI non deduce esiti da copy localizzato: tono, DC visibile/nascosta, fonte, risorse party, `stateApplied`, `retryable` e `choiceSetId` sono view contract strutturati. Il testo AI è non affidabile e usa una allowlist Markdown senza HTML raw. Gli annunci live separano stato turno e blocchi narrativi, evitando annunci per token.

Inventario, comandi, numeri di bundle e gate ancora manuali sono registrati in `docs/testing/BL-079_VERIFICATION.md`; quel report prevale su note o screenshot locali per lo stato di verifica.

## 15. Rischi e mitigazioni

| Rischio | Segnale | Mitigazione |
|---|---|---|
| HUD troppo densa | più pannelli sempre visibili del feed | gerarchia a livelli e review mobile prima del desktop |
| “Sembra una dashboard” | card annidate e metadati concorrenti | feed dominante, separator/spacing, drawer on demand |
| “Sembra una chat generica” | nessun feedback su regole/stato | rule result e state diff canonici, motion sui momenti di risoluzione |
| “Sembra fantasy economico” | pergamena, oro, font gotici | neutral design system contemporaneo; fiction nei contenuti |
| Jank mobile | frame drop, input lento, scroll instabile | transform/opacity, LazyMotion, asset gated, trace su device |
| AI Elements detta il dominio | `UIMessage` o `useChat` sostituisce `TurnView` | adapter/wrapper; REST+SSE e state machine restano canonici |
| Animazione nasconde lo stato | risultato disponibile solo a fine effetto | testo immediato, skip e reduced-motion |
| Drawer blocca il composer | focus/scroll non ripristinati | primitive accessibili e test E2E con tastiera virtuale |

## 16. Fonti ufficiali consultate

Consultate il 2026-07-13; verificare nuovamente API e CLI al task di implementazione:

- [shadcn/ui — Components](https://ui.shadcn.com/docs/components)
- [shadcn/ui — Drawer](https://ui.shadcn.com/docs/components/base/drawer)
- [AI Elements — Conversation](https://elements.ai-sdk.dev/components/conversation)
- [AI Elements — Message](https://elements.ai-sdk.dev/components/message)
- [AI Elements — Prompt Input](https://elements.ai-sdk.dev/components/prompt-input)
- [Motion — React](https://motion.dev/docs/react)
- [Motion — LazyMotion](https://motion.dev/docs/react-lazy-motion)
- [Motion — useReducedMotion](https://motion.dev/docs/react-use-reduced-motion)
- [Rive — State Machine Playback](https://rive.app/docs/runtimes/state-machines)
- [Rive — Web runtime parameters e performance marks](https://rive.app/docs/runtimes/web/rive-parameters)
- [W3C — WCAG 2.2 target size minimo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [W3C — target size enhanced 44×44](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced)
- [MDN — CSS `env()` e safe area](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
- [web.dev — high-performance CSS animations](https://web.dev/articles/animations-guide)
- [Playwright — CI, un worker per stabilità](https://playwright.dev/docs/ci)
- [Next.js — Production checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [W3C — Event Timing](https://www.w3.org/TR/event-timing/)
- [Chrome Developers — Long Animation Frames](https://developer.chrome.com/docs/web-platform/long-animation-frames)
- [W3C — Long Tasks](https://www.w3.org/TR/longtasks-1/)
- [web.dev — Interaction to Next Paint](https://web.dev/articles/inp)
