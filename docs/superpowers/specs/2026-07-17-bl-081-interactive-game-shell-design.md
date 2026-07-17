---
status: active
owner: engineering-and-product-design
last_reviewed: 2026-07-17
last_verified_commit: c30c6db616ebb69434e4b04dcccb97e48530f6a9
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md#bl-081--shell-conversazionale-interattiva-e-motion-layer
  - docs/product/UX_UI_DESIGN.md
  - docs/adr/0001-mobile-first-conversational-ui.md
  - docs/superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md
related_tasks:
  - BL-079
  - BL-081
  - QA-002
  - BL-040
code_refs:
  - apps/web/app/page.tsx
  - apps/web/app/globals.css
  - apps/web/components.json
  - apps/web/components/static-game-shell.tsx
  - apps/web/components/ui
  - apps/web/lib/static-game-shell-fixture.ts
test_refs:
  - tests/contracts/web-design-system.test.mjs
  - tests/integration/web-game-shell.test.mjs
supersedes: null
---

# BL-081 — Design della shell conversazionale interattiva

## 1. Stato della decisione

Questo documento è il contratto di design `interactive-game-shell-v1`, approvato dal Product Owner il 2026-07-17. Raffina la decomposizione local-first di GOV-004 e trasforma la shell statica di BL-079 in una superficie interattiva verificabile senza anticipare API turno, SSE o stato campagna.

La slice usa la corsia `HIGH_RISK`: cambia dipendenze e lockfile del frontend, introduce rendering di testo AI, stato client, primitive overlay e un motion layer. L'implementazione può iniziare soltanto dopo la review di questo documento e un piano TDD versionato.

## 2. Obiettivo e confini

BL-081 deve consentire a un giocatore di:

1. leggere narrazione, azione giocatore e risultato di regola in un feed dominante;
2. scegliere una delle due azioni suggerite principali oppure scrivere liberamente fino a 2.000 caratteri;
3. usare composer e HUD con una mano da 320 px, rispettando safe area e tastiera virtuale;
4. aprire obiettivo, party e inventario in un drawer mobile accessibile;
5. comprendere gli stati `idle`, `submitting`, `progress`, `completed`, `reconnect` ed `error` senza affidarsi all'animazione;
6. ottenere lo stesso contenuto e lo stesso ordine semantico su desktop, con contesto laterale soltanto come progressive enhancement.

Restano fuori scope: API turno, BFF di gioco, SSE, `useChat`, `UIMessage` come contratto di dominio, optimistic mutation canoniche, campagna reale, persistenza del draft oltre la pagina, allegati, selettore modello, voce, dadi interattivi, Rive, Playwright comune, smoke remoto, deploy, release e qualsiasi azione Vercel.

## 3. Approcci considerati

### A. Wrapper di dominio, reducer puro e primitive selettive — scelto

Installare soltanto le primitive AI Elements necessarie, adattarle dietro wrapper di dominio e governare la fixture con un reducer puro. Motion resta in un boundary lazy e sostituibile; il rendering continua a ricevere un view model del gioco.

Vantaggi: conserva `TurnView`/REST+SSE come architettura target, rende ogni stato deterministico, limita dipendenze e offre una migrazione diretta verso il backend futuro. Costo: richiede adapter espliciti e test negativi sul bundle.

### B. Componenti conversazionali interamente custom

Costruire feed, scroll management e Markdown esclusivamente con shadcn e codice prodotto. Offre controllo totale, ma duplica primitive già disponibili, aumenta il rischio di scroll e streaming non accessibili e viola la direzione AI Elements approvata.

### C. AI SDK `useChat` come stato e trasporto

Usare direttamente `UIMessage`, `useChat` e un endpoint chat. Riduce il codice dimostrativo, ma introduce un secondo protocollo rispetto al REST+SSE normativo, sposta l'autorità fuori da `TurnView` e rende la fixture una falsa architettura di produzione.

## 4. Architettura scelta

La shell è una feature client confinata in `apps/web`. È composta da quattro wrapper pubblici e tre boundary interni:

- `GameConversation`: feed, auto-scroll controllato e ripristino della posizione;
- `NarrativeTurn`: adattamento del view model di gioco a `Message`, `MessageContent` e `MessageResponse`;
- `FreeActionComposer`: draft, counter, submit lock, safe area e azioni suggerite;
- `GameDrawer`: HUD mobile e progressive enhancement desktop;
- `game-shell-model`: tipi discriminati del view model e degli eventi fixture;
- `game-shell-reducer`: transizioni pure e rifiuto degli eventi invalidi;
- `GameMotionProvider`: caricamento lazy del feature subset Motion e fallback reduced/off.

AI Elements e Motion sono dettagli presentazionali. Nessun tipo dei due pacchetti attraversa i props pubblici dei wrapper di dominio, le fixture o i futuri adapter REST+SSE.

## 5. Modello locale e stato

Il contratto locale usa union discriminate equivalenti a:

```ts
type GameShellStatus =
  | "idle"
  | "submitting"
  | "progress"
  | "completed"
  | "reconnect"
  | "error";

type GameDrawerSection = "objective" | "party" | "inventory";

interface GameShellViewModel {
  readonly scene: SceneSummary;
  readonly turns: readonly NarrativeTurnView[];
  readonly suggestedActions: readonly SuggestedActionView[];
  readonly hud: GameHudView;
  readonly status: GameShellStatus;
  readonly draft: string;
  readonly activeDrawer: GameDrawerSection | null;
  readonly progress: TurnProgressView | null;
  readonly failure: SafeTurnFailureView | null;
}
```

`NarrativeTurnView` distingue almeno `narration`, `player_action` e `rule_result`. `SafeTurnFailureView` contiene obbligatoriamente `retryable` e `stateApplied`; il reducer consente `retry` soltanto quando `retryable=true` e `stateApplied=false`.

Il reducer non usa clock, RNG, rete o timer. Riceve eventi espliciti da un `FixtureTurnSource` iniettato. I test controllano la sequenza evento per evento; la pagina dimostrativa può consumare una sequenza statica, ma non usa `setTimeout` per fingere latenza di backend o provider.

## 6. Transizioni e data flow

Il flusso è unidirezionale:

```text
fixture tipizzata → view model → wrapper di dominio → primitive UI
azione utente → evento locale → reducer puro → nuovo view model
```

Le transizioni ammesse sono:

- `idle → submitting` dopo un submit valido;
- `submitting → progress | completed | reconnect | error` in base all'evento fixture;
- `progress → progress | completed | reconnect | error`;
- `reconnect → progress | completed | error` senza nuovo submit;
- `error → submitting` soltanto tramite retry sicuro;
- `completed → idle` quando la fixture espone il turno successivo.

Un evento incompatibile con lo stato corrente è rifiutato dal reducer e non altera il view model. Il draft viene cancellato soltanto dopo ack fixture; errore pre-ack e reconnect lo conservano. Il submit è bloccato durante `submitting`, `progress` e `reconnect`.

## 7. Componenti e dipendenze UI

### 7.1 AI Elements

L'implementazione usa soltanto gli item registry `conversation`, `message` e le parti necessarie di `prompt-input`. Prima dell'installazione il piano deve registrare `view`/dry-run, dipendenze e file introdotti.

- `Conversation`, `ConversationContent` e `ConversationScrollButton` forniscono il contenitore del feed;
- `Message`, `MessageContent` e `MessageResponse` renderizzano testo AI/Markdown senza raw HTML;
- `PromptInput`, `PromptInputTextarea` e `PromptInputSubmit` compongono il composer;
- export per attachment, model selector, voice, reasoning, tool call o download non entrano nel percorso P0.

Il prodotto non importa `useChat`, `DefaultChatTransport` o endpoint AI SDK. I wrapper ricevono solo il view model locale; un adapter futuro convertirà `TurnView` senza cambiare la loro API pubblica.

### 7.2 shadcn/ui

Il progetto conserva style `new-york`, base Radix, Geist e token semantici. `Drawer`, `Textarea`, `Progress`, `Collapsible` e le primitive strettamente richieste vengono aggiunti selettivamente tramite CLI; il codice registry resta sorgente posseduto dal progetto.

Le azioni distruttive non appartengono a BL-081. Il drawer gestisce focus, Escape, overlay e ripristino del trigger; non viene ricreato con `div` generici.

### 7.3 Motion

Motion viene importato tramite `LazyMotion` con feature subset `domAnimation` e componenti `m`, usando strict mode per impedire import accidentali del bundle completo. Le animazioni frequenti modificano soltanto `transform` e `opacity`.

## 8. Gerarchia mobile e desktop

### 8.1 Mobile 320–430 px

- header compatto con scena e stato salvataggio;
- feed come unica area scrollabile;
- narrazione senza card annidate, azione giocatore compatta e risultato regola sintetico;
- due azioni suggerite visibili sopra il composer; eventuali azioni ulteriori nel drawer/collapsible;
- composer persistente con CTA primaria da almeno 48 px e `env(safe-area-inset-bottom)`;
- HUD con massimo tre accessi da almeno 44 px: obiettivo, party e inventario.

Il drawer non copre il focus corrente senza ripristinarlo alla chiusura. Il contenuto più importante resta nel feed: nessun dato necessario esiste soltanto nel pannello.

### 8.2 Desktop

Da breakpoint largo, party e obiettivo possono diventare pannelli contestuali laterali. Feed e composer mantengono lo stesso ordine DOM e una misura leggibile; l'inventario resta on demand. Non esistono azioni disponibili soltanto tramite hover o sidebar.

## 9. Composer e azioni suggerite

Il composer:

- accetta testo multilinea fino a 2.000 caratteri;
- mostra il counter soltanto vicino alla soglia, senza rumore permanente;
- usa `Enter` per inviare quando il comportamento è inequivocabile e `Shift+Enter` per newline;
- non invia stringhe vuote o composte soltanto da whitespace;
- conserva il draft fino ad ack;
- mantiene label accessibile, live feedback e focus visibile;
- non espone attachment, modello, microfono o comandi slash.

Selezionare un suggerimento compila una scelta esplicita e la invia tramite lo stesso evento del testo libero; non esiste una mutazione parallela. Due suggerimenti sono sempre visibili su mobile e restano chiaramente facoltativi.

## 10. Stati, errori e reconnect

- `idle`: composer e suggerimenti disponibili;
- `submitting`: submit locked, draft ancora visibile, feedback breve annunciato;
- `progress`: una sola riga stabile descrive la fase fixture, senza token streaming fittizio;
- `completed`: nuovo turno e state diff diventano definitivi insieme;
- `reconnect`: banner inline, composer locked e posizione feed preservata;
- `error`: messaggio sicuro, focus sul banner e retry mostrato soltanto quando consentito.

Toast e animazione non sono mai l'unico canale. `stateApplied=true` vieta il retry e indica che il client deve recuperare lo stato, non reinviare. La shell non costruisce stato canonico né applica optimistic update irreversibili.

## 11. Motion e reduced motion

I soli momenti Motion P0 sono:

1. ingresso/uscita del drawer;
2. presenza della riga progress;
3. comparsa del risultato regola già canonico nella fixture;
4. evidenza temporanea dello state diff;
5. riordinamento delle azioni suggerite quando cambia lo stato.

Durate indicative: 160–260 ms, senza ambient loop, glow continuo o layout animation nei percorsi frequenti. `useReducedMotion` sostituisce gli spostamenti con opacity breve o aggiornamento immediato. Disabilitando JavaScript motion o caricando lentamente le feature, contenuto, focus order e azioni restano disponibili.

Rive è esplicitamente assente da dipendenze, import e artifact iniziale. Una sua futura valutazione richiede task separato e benchmark su device.

## 12. Sicurezza del rendering

- il testo fixture/AI passa attraverso `MessageResponse` con escaping predefinito;
- raw HTML e `dangerouslySetInnerHTML` sono vietati;
- link Markdown devono rispettare la policy allowlisted del renderer prima di diventare navigabili;
- nessun contenuto AI decide classi, componenti, URL o handler arbitrari;
- fixture e messaggi di errore non includono PII, secret o identificatori reali;
- draft e stato fixture restano memoria React locale, non `localStorage`, `sessionStorage` o cookie.

## 13. Bundle e performance

Il piano deve misurare il client chunk della route prima e dopo BL-081 e registrare il delta, senza inventare una soglia non presente nella specifica. Il gate fallisce se rileva:

- `useChat`, `@ai-sdk/react` o trasporti chat;
- Rive o runtime grafici equivalenti;
- import `motion` completi dentro il boundary `LazyMotion`;
- registry AI Elements non usati;
- dipendenze per attachment, voice, model selector o upload non consumate;
- animazioni basate su proprietà che causano layout/paint frequente.

Il feed non viene virtualizzato in BL-081: la fixture di contenuto lungo verifica scroll e misura senza introdurre un secondo sistema complesso prima di evidenza reale.

## 14. Strategia TDD e gate

La sequenza di implementazione è:

1. contract test RED per inventory, confini AI Elements/Motion, assenza `useChat`/Rive e dipendenze selettive;
2. reducer RED/GREEN per tutte le transizioni valide e invalide, submit lock, draft, retry e reconnect;
3. wrapper RED/GREEN per narrazione lunga, Markdown escaped, suggerimenti e composer;
4. drawer RED/GREEN per keyboard, focus restore, Escape e contenuto equivalente desktop;
5. motion RED/GREEN per `LazyMotion`, strict mode, reduced-motion e fallback;
6. smoke Next locale a 320×800, 390×844 e 1440×900 per overflow, safe area, touch target, focus e console;
7. bundle inspection, audit dipendenze, `verify:affected`, review terminale e checkout pulito perché cambiano dependency graph e lockfile.

`QA-002` consoliderà successivamente Playwright, axe, visual regression e browser matrix comune. BL-081 mantiene soltanto smoke e fixture minimi necessari a provare la feature.

## 15. Definition of Done

BL-081 è terminale soltanto quando:

- i quattro wrapper di dominio sono implementati e documentati;
- tutti e sei gli stati fixture e le transizioni negative sono deterministici;
- AI Elements non modifica il contratto applicativo e non introduce un trasporto alternativo;
- composer, suggerimenti, drawer e desktop enhancement funzionano con tastiera e touch;
- reduced-motion conserva contenuto, focus e azioni;
- Rive è assente e il delta bundle è registrato;
- viewport, contenuto lungo, reconnect ed error state superano i gate locali;
- documentazione, task graph, audit, full gate HIGH_RISK e checkout pulito sono verdi;
- nessun provider, deploy o azione Vercel è stato eseguito.

## 16. Condizioni di revisione

Il design deve essere riesaminato se un task successivo rende disponibile un `TurnView` incompatibile con il view model, se il registry AI Elements richiede un trasporto o dipendenze non isolabili, se il drawer non soddisfa focus/safe-area sui browser target o se Motion produce long task/jank osservabile nel profilo mobile concordato.
