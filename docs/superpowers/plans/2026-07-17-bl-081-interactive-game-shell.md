---
status: active
owner: frontend-and-product-design
last_reviewed: 2026-07-17
last_verified_commit: fe2d5e5dadad0e130a1685803532fb640ba89b99
source_refs:
  - docs/MVP_SPEC.md#31-backlog-iniziale
  - docs/TASKS.md#bl-081--shell-conversazionale-interattiva-e-motion-layer
  - docs/product/UX_UI_DESIGN.md#14-piano-di-implementazione
  - docs/adr/0001-mobile-first-conversational-ui.md
  - docs/superpowers/specs/2026-07-17-bl-081-interactive-game-shell-design.md
related_tasks:
  - BL-079
  - BL-081
  - QA-002
  - BL-040
code_refs:
  - apps/web
  - apps/web/components.json
  - apps/web/package.json
  - package.json
  - pnpm-lock.yaml
test_refs:
  - tests/contracts/web-design-system.test.mjs
  - tests/integration/web-game-shell.test.mjs
supersedes: null
---

# BL-081 Interactive Game Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current inline session. Do not delegate batches or create parallel worktrees.

**Goal:** Trasformare la shell statica BL-079 in una shell conversazionale interattiva, mobile-first e premium con reducer deterministico, AI Elements selettivi, drawer HUD accessibile e Motion lazy/reduced-first.

**Architecture:** `InteractiveGameShell` possiede soltanto stato UI fixture e orchestra quattro wrapper di dominio (`GameConversation`, `NarrativeTurn`, `FreeActionComposer`, `GameDrawer`). Un reducer puro riceve eventi espliciti da una sorgente fixture deterministica; AI Elements, shadcn/Radix, Streamdown e Motion restano dettagli presentazionali e non introducono `UIMessage`, `useChat`, rete o autorita canonica.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui `new-york` su Radix, AI Elements registry, Streamdown, Vaul, Motion `LazyMotion`, Node test runner, pnpm 11.13.0 e browser integrato locale.

## Global Constraints

- Corsia `HIGH_RISK`: cambiano dependency graph, lockfile, rendering Markdown non affidabile, stato client, overlay e motion layer.
- Esecuzione esclusivamente inline nella worktree `C:\Users\emanu\Documents\progetti\dnd-ai\.worktrees\bl-081-interactive-shell`; non usare subagenti e non toccare le modifiche utente nella worktree principale.
- Non usare Vercel, provider AI, endpoint remoti, account, secret, deploy, release o Production.
- Non introdurre `useChat`, `DefaultChatTransport`, `UIMessage` come contratto applicativo, route `/api/chat`, `@ai-sdk/react`, Rive, storage browser o timer per simulare backend/provider.
- Usare la CLI shadcn con `-c apps/web`; installare source registry, revisionarlo e mantenere soltanto export e dipendenze realmente consumati.
- Conservare `components.json` `new-york`/Radix, Geist, Lucide, token semantici e primitive BL-079 gia approvate. Ogni file esistente proposto in overwrite dalla CLI deve essere riconciliato esplicitamente.
- Il testo AI/fixture passa da `MessageResponse`; raw HTML, immagini e link navigabili provenienti dalla narrazione sono disabilitati nel boundary P0.
- Target touch minimo 44 CSS px, primaria 48 px; layout usabile da 320 px, safe area e tastiera virtuale incluse.
- Test mirati dopo ogni batch significativo; un solo `TURBO_FORCE=true corepack pnpm@11.13.0 verify` sul candidato finale.
- Checkout pulito obbligatorio per lockfile/install/build. Nessun commit separato di sola evidenza: documentazione terminale ed evidenze vengono incorporate nell'ultimo commit funzionale.
- `QA-002` resta owner di Playwright, axe, visual regression e browser matrix condivisa; BL-081 usa soltanto reducer test, contract/source guard, vero standalone Next e smoke browser locale mirato.

## Baseline e budget osservati

- Base integrata: `c30c6db616ebb69434e4b04dcccb97e48530f6a9`.
- Design approvato: commit `fe2d5e5dadad0e130a1685803532fb640ba89b99`, contract `interactive-game-shell-v1`.
- Install frozen: 701 package in 9,9 secondi.
- Build corretto tramite grafo: `corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/web`, tre task verdi.
- Build web diretto senza il prerequisito `@dnd-ai/observability:build`: failure attesa e gia spiegata dal grafo `^build`; non aggiungere workaround al package web.
- Home BL-079: 636.744 byte raw di JavaScript iniziale, dieci chunk; entry chunk `apps/web/app/page` 59.332 byte raw.
- Versioni registry/npm osservate il 2026-07-17: `motion@12.42.2`, `streamdown@2.5.0`, `use-stick-to-bottom@1.1.6`, `vaul@1.1.2`.
- La misura finale registra valore e delta, ma non inventa una soglia. Un aumento non spiegato da componenti usati o un runtime escluso e un finding bloccante.

## File map terminale

| File | Responsabilita |
|---|---|
| `apps/web/lib/game-shell/game-shell-model.ts` | Union discriminate, stato e porta fixture senza dipendenze UI |
| `apps/web/lib/game-shell/game-shell-reducer.ts` | Transizioni pure, guard retry/duplicate e invarianti draft |
| `apps/web/lib/game-shell/game-shell-fixtures.ts` | View model e sequenze eventi locali, tipizzate e senza timer |
| `apps/web/components/ai-elements/conversation.tsx` | Subset registry per feed e scroll-to-bottom |
| `apps/web/components/ai-elements/message.tsx` | Subset registry per messaggio e Markdown hardened |
| `apps/web/components/ai-elements/prompt-input.tsx` | Subset registry per form, textarea e submit |
| `apps/web/components/ui/{drawer,textarea,progress,collapsible}.tsx` | Primitive shadcn/Radix selettive |
| `apps/web/components/game/game-conversation.tsx` | Wrapper feed di dominio |
| `apps/web/components/game/narrative-turn.tsx` | Adapter delle tre varianti di turno |
| `apps/web/components/game/free-action-composer.tsx` | Draft, keyboard, counter, submit e lock |
| `apps/web/components/game/suggested-actions.tsx` | Due scelte primarie e progressive disclosure |
| `apps/web/components/game/game-drawer.tsx` | Obiettivo, party e inventario con focus restore |
| `apps/web/components/game/game-motion-provider.tsx` | Boundary `LazyMotion` strict e reduced-motion |
| `apps/web/components/game/game-motion-features.ts` | Chunk asincrono del solo `domAnimation` |
| `apps/web/components/game/interactive-game-shell.tsx` | Client container e orchestrazione fixture |
| `apps/web/app/page.tsx` | Ingresso server della shell interattiva |
| `apps/web/app/globals.css` | Source Streamdown, layout/safe area e motion fallback |
| `tests/unit/game-shell-reducer.test.mjs` | Matrice completa delle transizioni pure |
| `tests/contracts/web-interactive-game-shell.test.mjs` | Inventory, confini, dipendenze e guard bundle/source |
| `tests/contracts/web-design-system.test.mjs` | Evoluzione del contratto BL-079 senza regressioni |
| `tests/integration/web-game-shell.test.mjs` | Smoke del vero standalone Next |

---

### Task 1: Congelare il contract RED e l'audit registry

**Files:**
- Create: `tests/contracts/web-interactive-game-shell.test.mjs`
- Modify: `tests/contracts/web-design-system.test.mjs`

**Interfaces:**
- Consumes: `components.json`, `apps/web/package.json`, source sotto `apps/web/components` e design `interactive-game-shell-v1`.
- Produces: failure riproducibili prima di aggiungere model, wrapper, primitive e dipendenze.

- [ ] **Step 1: scrivere l'inventory contract prima del codice**

Il nuovo test deve leggere manifest e source senza importare React. Richiedere:

```js
const requiredDependencies = Object.freeze({
  motion: "12.42.2",
  streamdown: "2.5.0",
  "use-stick-to-bottom": "1.1.6",
  vaul: "1.1.2",
});

const forbiddenDependencies = Object.freeze([
  "@ai-sdk/react",
  "@rive-app/react-canvas",
  "@streamdown/cjk",
  "@streamdown/code",
  "@streamdown/math",
  "@streamdown/mermaid",
  "ai",
  "cmdk",
  "nanoid",
]);
```

Richiedere inoltre i quattro wrapper pubblici, i tre file AI Elements, le quattro primitive shadcn, il reducer, `LazyMotion` strict e l'assenza nei nuovi boundary `components/game`, `components/ai-elements` e `lib/game-shell` di `useChat`, `DefaultChatTransport`, `dangerouslySetInnerHTML`, `localStorage`, `sessionStorage`, `setTimeout`, import Rive e `/api/chat`. Non scansionare indiscriminatamente il BFF identity: usa legittimamente un timeout di rete bounded e resta fuori da BL-081.

- [ ] **Step 2: aggiornare il contratto BL-079 senza cancellarne i guardrail**

Nel test esistente sostituire le asserzioni che impongono una shell statica server-only con queste responsabilita:

- `page.tsx` resta un Server Component;
- il client boundary e confinato a `interactive-game-shell.tsx` e ai componenti interattivi;
- `button`, `card`, `badge`, `input` e `separator` esistenti non ricevono `'use client'` se non necessario;
- Streamdown e Motion sono consentiti soltanto dai file boundary previsti;
- Rive e AI SDK chat restano assenti.

- [ ] **Step 3: osservare RED per capability mancanti**

```powershell
node --test tests/contracts/web-design-system.test.mjs tests/contracts/web-interactive-game-shell.test.mjs
```

Expected: exit `1`; failure su dependency/component/model mancanti, nessuna failure dovuta a syntax o path errati.

- [ ] **Step 4: confermare il payload registry senza scritture**

```powershell
corepack pnpm@11.13.0 dlx shadcn@latest add https://elements.ai-sdk.dev/api/registry/conversation.json https://elements.ai-sdk.dev/api/registry/message.json https://elements.ai-sdk.dev/api/registry/prompt-input.json --dry-run -c apps/web
corepack pnpm@11.13.0 dlx shadcn@latest add drawer textarea progress collapsible --dry-run -c apps/web
```

Expected: il primo dry-run mostra tre item AI Elements e dipendenze/transitive piu ampie del P0; il secondo mostra soltanto quattro primitive. Se file o dipendenze differiscono materialmente dall'audit del 2026-07-17, fermare il batch e revisionare il piano prima di scrivere.

Non creare commit: questo task termina intenzionalmente RED.

---

### Task 2: Implementare model, reducer e fixture deterministiche

**Files:**
- Create: `apps/web/lib/game-shell/game-shell-model.ts`
- Create: `apps/web/lib/game-shell/game-shell-reducer.ts`
- Create: `apps/web/lib/game-shell/game-shell-fixtures.ts`
- Create: `tests/unit/game-shell-reducer.test.mjs`

**Interfaces:**
- No import React, Next, shadcn, Motion, Streamdown, storage, clock, RNG o rete.
- Node 24.11 importa direttamente i file `.ts`; usare soltanto TypeScript erasable e import relativi con estensione `.ts`.

- [ ] **Step 1: scrivere la matrice reducer RED**

Il test importa `createInitialGameShellState`, `FIXTURE_COMPLETED_TURN` e `reduceGameShell`. Coprire almeno:

1. draft trim/limite 2.000 senza submit vuoto;
2. `idle -> submitting` con `pendingAction` e draft conservato;
3. duplicate submit durante `submitting`, `progress` e `reconnect` restituisce la stessa istanza;
4. ack in `submitting` cancella il draft ma conserva `pendingAction`;
5. progress ammesso da `submitting`, `progress` e `reconnect`;
6. reconnect conserva feed, pending action e posizione logica;
7. completed applica turni e state diff insieme;
8. retry soltanto con `retryable=true` e `stateApplied=false`;
9. errore post-apply rifiuta retry;
10. evento incompatibile non muta lo stato;
11. apertura/chiusura drawer modifica solo `activeDrawer`;
12. `completed -> idle` avviene soltanto con `turn_ready`.

```powershell
node --test tests/unit/game-shell-reducer.test.mjs
```

Expected: exit `1`, `ERR_MODULE_NOT_FOUND` per i file game-shell ancora assenti.

- [ ] **Step 2: definire union e porta fixture**

Usare contratti equivalenti a:

```ts
export type GameShellStatus =
  | "idle"
  | "submitting"
  | "progress"
  | "completed"
  | "reconnect"
  | "error";

export type GameDrawerSection = "objective" | "party" | "inventory";

export type NarrativeTurnView =
  | Readonly<{
      id: string;
      kind: "narration";
      authorLabel: string;
      markdown: string;
    }>
  | Readonly<{
      id: string;
      kind: "player_action";
      text: string;
    }>
  | Readonly<{
      id: string;
      kind: "rule_result";
      label: string;
      formula: string;
      outcome: "success" | "failure";
      detail: string;
      stateDiff: string | null;
    }>;

export interface SafeTurnFailureView {
  readonly message: string;
  readonly retryable: boolean;
  readonly stateApplied: boolean;
}

export interface SceneSummaryView {
  readonly campaignLabel: string;
  readonly sceneTitle: string;
  readonly saveLabel: string;
  readonly hitPointsLabel: string;
  readonly conditionLabel: string;
}

export interface SuggestedActionView {
  readonly id: string;
  readonly label: string;
}

export interface GameHudView {
  readonly objective: string;
  readonly party: readonly string[];
  readonly inventory: readonly string[];
}

export interface GameShellViewModel {
  readonly scene: SceneSummaryView;
  readonly status: GameShellStatus;
  readonly draft: string;
  readonly pendingAction: string | null;
  readonly activeDrawer: GameDrawerSection | null;
  readonly turns: readonly NarrativeTurnView[];
  readonly suggestedActions: readonly SuggestedActionView[];
  readonly hud: GameHudView;
  readonly progress: Readonly<{ label: string; value: number }> | null;
  readonly failure: SafeTurnFailureView | null;
  readonly stateDiff: string | null;
}

export interface FixtureTurnSource {
  eventsFor(action: string): readonly GameShellEvent[];
  retryEventsFor(action: string): readonly GameShellEvent[];
}
```

L'evento `submit_requested` porta la stringa gia normalizzata; il reducer rifiuta stringa vuota o oltre limite invece di troncarla silenziosamente.

- [ ] **Step 3: implementare transizioni fail-closed**

Usare uno `switch` esaustivo per evento e piccole funzioni guard. Gli eventi minimi sono `draft_changed`, `submit_requested`, `command_acknowledged`, `progress_received`, `connection_lost`, `turn_failed`, `retry_requested`, `turn_completed`, `turn_ready`, `drawer_opened`, `drawer_closed`.

Un evento invalido restituisce `state` senza clone. `turn_completed` sostituisce feed/progress/failure/stateDiff in una sola nuova istanza. Nessuna funzione scrive fuori dallo stato restituito.

- [ ] **Step 4: aggiungere fixture italiane player-safe**

Creare scena, quattro suggerimenti ordinati, obiettivo, due membri party, inventario sintetico, sequenza happy path, errore retryable pre-apply, errore non-retryable post-apply e reconnect. Le fixture non contengono PII, ID reali, lore proprietaria, markup HTML o URL.

- [ ] **Step 5: portare il reducer a GREEN**

```powershell
node --test tests/unit/game-shell-reducer.test.mjs
corepack pnpm@11.13.0 exec turbo run typecheck --filter=@dnd-ai/web
```

Expected: reducer test `PASS`; typecheck e build dei prerequisiti dichiarati dal grafo Turbo exit `0` anche da checkout senza `dist` preesistenti.

- [ ] **Step 6: commit del batch puro**

```powershell
git add apps/web/lib/game-shell tests/unit/game-shell-reducer.test.mjs
git commit -m "feat(web): add deterministic game shell state"
```

---

### Task 3: Acquisire e ridurre AI Elements e shadcn

**Files:**
- Create: `apps/web/components/ai-elements/conversation.tsx`
- Create: `apps/web/components/ai-elements/message.tsx`
- Create: `apps/web/components/ai-elements/prompt-input.tsx`
- Create: `apps/web/components/ui/drawer.tsx`
- Create: `apps/web/components/ui/textarea.tsx`
- Create: `apps/web/components/ui/progress.tsx`
- Create: `apps/web/components/ui/collapsible.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tests/contracts/web-interactive-game-shell.test.mjs`

**Interfaces:**
- Final direct runtime dependencies nuove: soltanto `motion`, `streamdown`, `use-stick-to-bottom`, `vaul`.
- `MessageResponse` accetta solo `children`, `className` e stato animazione strettamente necessario; il caller non puo riabilitare link, immagini o raw HTML.

- [ ] **Step 1: installare source ufficiale con la CLI**

```powershell
corepack pnpm@11.13.0 dlx shadcn@latest add https://elements.ai-sdk.dev/api/registry/conversation.json https://elements.ai-sdk.dev/api/registry/message.json https://elements.ai-sdk.dev/api/registry/prompt-input.json drawer textarea progress collapsible --yes -c apps/web
git diff -- apps/web/components apps/web/package.json pnpm-lock.yaml
```

Expected: source registry presente; la CLI propone export e dipendenze non P0. Non committare il risultato grezzo.

- [ ] **Step 2: ridurre `conversation` al feed necessario**

Mantenere `Conversation`, `ConversationContent` e `ConversationScrollButton` con `use-stick-to-bottom`. Rimuovere download Markdown, `messagesToMarkdown`, empty-state non consumato e ogni import `UIMessage`/`ai`.

- [ ] **Step 3: ridurre `message` e chiudere il renderer**

Mantenere `Message`, `MessageContent` e `MessageResponse`. Sostituire `UIMessage["role"]` con la union locale `"user" | "assistant"`. Rimuovere actions, branches, toolbar, attachment e tutti i plugin `@streamdown/*`.

Il renderer deve fissare internamente:

```tsx
<Streamdown
  allowedImagePrefixes={[]}
  allowedLinkPrefixes={[]}
  className={cn(
    "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
    className,
  )}
  components={safeNarrativeComponents}
  skipHtml
>
  {children}
</Streamdown>
```

`safeNarrativeComponents` rende il testo dei link come `span` e restituisce `null` per immagini. Non accettare `components`, `rehypePlugins`, `allowedTags`, `urlTransform` o allowlist dai props pubblici.

- [ ] **Step 4: ridurre `prompt-input` al compound P0**

Mantenere soltanto `PromptInput` come `form`, `PromptInputTextarea` basato sulla primitive shadcn `Textarea` e `PromptInputSubmit` basato su `Button`. Rimuovere context attachment, upload, screenshot, model selector, command menu, hover card, input group, spinner e `nanoid`.

- [ ] **Step 5: riconciliare le primitive shadcn**

Mantenere `Drawer` Vaul e `Textarea`/`Progress`/`Collapsible` Radix. Eliminare file UI introdotti soltanto dal prompt input completo. Confrontare `button`, `input`, `separator`, `globals.css` e `components.json` con `HEAD`; preservare le versioni BL-079 salvo le modifiche deliberate di questo piano.

Correggere nello stesso batch il gotcha Tailwind v4/Geist indicato dalla skill shadcn: in `@theme inline` usare i nomi letterali `"Geist"`, `"Geist Fallback"`, `"Geist Mono"`, `"Geist Mono Fallback"`, mantenendo le classi variabile sull'elemento `html`. Aggiungere:

```css
@source "../node_modules/streamdown/dist/*.js";
```

- [ ] **Step 6: normalizzare dipendenze esatte**

Rimuovere ogni dipendenza diretta introdotta e non consumata, poi pinning esplicito:

```powershell
corepack pnpm@11.13.0 --filter @dnd-ai/web remove ai @streamdown/cjk @streamdown/code @streamdown/math @streamdown/mermaid cmdk nanoid
corepack pnpm@11.13.0 --filter @dnd-ai/web add --save-exact motion@12.42.2 streamdown@2.5.0 use-stick-to-bottom@1.1.6 vaul@1.1.2
corepack pnpm@11.13.0 install --lockfile-only
corepack pnpm@11.13.0 install --frozen-lockfile
```

Verificare manualmente che `apps/web/package.json` non contenga i nove package vietati dal contract.

- [ ] **Step 7: portare inventory e build a GREEN**

```powershell
node --test tests/contracts/web-design-system.test.mjs tests/contracts/web-interactive-game-shell.test.mjs
corepack pnpm@11.13.0 exec turbo run lint --filter=@dnd-ai/web
corepack pnpm@11.13.0 exec turbo run typecheck --filter=@dnd-ai/web
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/web
```

Expected: contract `PASS`; tre task web e prerequisiti `PASS`; nessun warning TypeScript soppresso.

- [ ] **Step 8: commit del source posseduto**

```powershell
git add apps/web/components/ai-elements apps/web/components/ui apps/web/app/globals.css apps/web/package.json pnpm-lock.yaml tests/contracts
git commit -m "feat(web): add selective conversational primitives"
```

---

### Task 4: Implementare feed, turni, suggerimenti e composer

**Files:**
- Create: `apps/web/components/game/game-conversation.tsx`
- Create: `apps/web/components/game/narrative-turn.tsx`
- Create: `apps/web/components/game/free-action-composer.tsx`
- Create: `apps/web/components/game/suggested-actions.tsx`
- Modify: `tests/contracts/web-interactive-game-shell.test.mjs`

**Interfaces:**
- I wrapper ricevono soltanto tipi da `game-shell-model.ts` e callback di dominio.
- Suggerimento e testo libero convergono su `onSubmitAction(action: string)`.

- [ ] **Step 1: estendere il contract RED sui wrapper**

Richiedere export nominati, marker `data-message-kind`, `aria-live`, `maxLength={2000}`, `isComposing`, `Shift+Enter`, due azioni sempre visibili, `Collapsible` per le ulteriori e nessun import da `ai`/`@ai-sdk/react`.

```powershell
node --test tests/contracts/web-interactive-game-shell.test.mjs
```

Expected: exit `1` sui quattro file wrapper mancanti.

- [ ] **Step 2: implementare `NarrativeTurn` esaustivo**

- `narration`: `Message from="assistant"`, label DM e `MessageResponse` per Markdown;
- `player_action`: `Message from="user"`, testo escaped da React senza Markdown;
- `rule_result`: primitive shadcn con formula mono, outcome semanticamente distinto, detail sicuro e state diff separato;
- switch esaustivo con helper `assertNever` locale.

- [ ] **Step 3: implementare `GameConversation`**

Comporre `Conversation`, `ConversationContent` e `ConversationScrollButton`; unico scroll container con `min-h-0`, `overscroll-contain`, label italiana e padding sufficiente per non coprire l'ultima decisione. Il feed non virtualizza e non ricostruisce stato canonico.

- [ ] **Step 4: implementare suggerimenti progressivi**

Mostrare esattamente le prime due azioni come target da almeno 44 px. Se la fixture ne contiene altre, usare `Collapsible` con trigger "Altre opzioni" e non un secondo percorso di submit. Disabilitare tutte le scelte quando il reducer blocca il composer.

- [ ] **Step 5: implementare il composer controllato**

Usare `PromptInput`, `PromptInputTextarea` e `PromptInputSubmit`. Requisiti:

- `maxLength=2000` e counter visibile da 1.800 caratteri;
- label accessibile e placeholder italiano;
- `Enter` invia, `Shift+Enter` inserisce newline, IME composition non invia;
- trim solo al confine di submit, nessuna stringa whitespace-only;
- CTA 48 px, focus ring e safe area;
- draft visibile finche il reducer non riceve ack;
- live region per lock/submitting/progress/reconnect/error.

- [ ] **Step 6: GREEN e commit**

```powershell
node --test tests/contracts/web-interactive-game-shell.test.mjs
corepack pnpm@11.13.0 exec turbo run lint --filter=@dnd-ai/web
corepack pnpm@11.13.0 exec turbo run typecheck --filter=@dnd-ai/web
git add apps/web/components/game tests/contracts/web-interactive-game-shell.test.mjs
git commit -m "feat(web): compose the conversational game loop"
```

Expected: contract/lint/typecheck `PASS`.

---

### Task 5: Collegare container, stati e vero standalone

**Files:**
- Create: `apps/web/components/game/interactive-game-shell.tsx`
- Modify: `apps/web/app/page.tsx`
- Delete: `apps/web/components/static-game-shell.tsx`
- Delete: `apps/web/lib/static-game-shell-fixture.ts`
- Modify: `tests/integration/web-game-shell.test.mjs`
- Modify: `tests/contracts/web-design-system.test.mjs`

**Interfaces:**
- `page.tsx` resta server-side e passa `createInitialGameShellState()` al client container.
- `InteractiveGameShell` usa `useReducer(reduceGameShell, initialViewModel)` e una `FixtureTurnSource` iniettata; nessun fetch o side effect esterno.

- [ ] **Step 1: riscrivere lo smoke standalone e osservarlo RED**

Il test esistente deve richiedere nel vero HTML production-like:

- `data-game-shell="interactive"` e `data-shell-status="idle"`;
- header scena/stato, feed, tre tipi di turno, due suggerimenti primari;
- `textarea` label/limite, submit, tre trigger HUD;
- regioni status/error, drawer title disponibili semanticamente;
- nessun raw `<script>` derivato dalla fixture, `javascript:` o HTML AI trusted.

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/web
node --test tests/integration/web-game-shell.test.mjs
```

Expected: smoke exit `1` per marker/static shell ancora presente.

- [ ] **Step 2: implementare il container event-driven**

`submitAction` normalizza una volta, dispatcha `submit_requested` e consuma nell'ordine gli eventi restituiti dalla fixture. Tra eventi usare soltanto il boundary asincrono naturale della sorgente; vietati delay temporali e timer. Una ref impedisce un secondo consumer concorrente oltre al guard reducer.

Per ogni stato rendere testo stabile:

| Stato | UI primaria | Composer |
|---|---|---|
| `idle` | decisione e suggerimenti | attivo |
| `submitting` | "Invio azione" | locked, draft visibile fino ad ack |
| `progress` | fase + `Progress` | locked |
| `completed` | turno e state diff definitivi | locked fino a `turn_ready` |
| `reconnect` | banner inline e recupero | locked |
| `error` | messaggio sicuro; retry solo se ammesso | locked |

Il retry usa `pendingAction` e lo stesso consumer; se `stateApplied=true` mostra istruzione di recupero, non un pulsante di reinvio.

- [ ] **Step 3: sostituire la shell statica senza doppioni**

Aggiornare `page.tsx`, eliminare i due file BL-079 sostituiti e rimuovere dal contract ogni path statico. Non conservare alias o componenti morti.

- [ ] **Step 4: GREEN del verticale locale**

```powershell
node --test tests/unit/game-shell-reducer.test.mjs
node --test tests/contracts/web-design-system.test.mjs tests/contracts/web-interactive-game-shell.test.mjs
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/web
node --test tests/integration/web-game-shell.test.mjs
```

Expected: reducer, due contract e smoke standalone `PASS`.

- [ ] **Step 5: commit del verticale interattivo**

```powershell
git add apps/web/app/page.tsx apps/web/components apps/web/lib tests
git commit -m "feat(web): activate the interactive game shell"
```

---

### Task 6: Aggiungere drawer, Motion e responsive polish

**Files:**
- Create: `apps/web/components/game/game-drawer.tsx`
- Create: `apps/web/components/game/game-motion-provider.tsx`
- Create: `apps/web/components/game/game-motion-features.ts`
- Modify: `apps/web/components/game/interactive-game-shell.tsx`
- Modify: `apps/web/components/game/narrative-turn.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `tests/contracts/web-interactive-game-shell.test.mjs`
- Modify: `tests/integration/web-game-shell.test.mjs`

**Interfaces:**
- Un solo `GameDrawer` controllato da `activeDrawer`; trigger massimo tre.
- Feature Motion caricate da import dinamico; i componenti usano `m`, mai `motion`.

- [ ] **Step 1: aggiungere contract RED per overlay e motion boundary**

Richiedere:

- `DrawerTitle`, `DrawerDescription`, close accessibile e callback restore;
- `LazyMotion` con `strict`, loader dinamico e `domAnimation` isolato;
- `MotionConfig reducedMotion="user"` e `useReducedMotion` per varianti;
- soltanto `opacity` e `transform` nelle varianti frequenti;
- assenza di loop infinito, glow continuo, `layout` sul feed e import `motion` completo.

- [ ] **Step 2: implementare `GameDrawer`**

I tre trigger aprono un solo drawer bottom-first. Titolo e contenuto dipendono da `activeDrawer`; Escape e close ripristinano focus al trigger che ha aperto il pannello. Il body puo scorrere, il titolo/close restano stabili e `pb-[var(--safe-area-bottom)]` protegge la home indicator area.

Desktop amplia larghezza/misura e spacing della stessa gerarchia; non introduce azioni o informazioni essenziali esclusive. Inventario resta on demand.

- [ ] **Step 3: implementare il boundary Motion asincrono**

`game-motion-features.ts` esporta soltanto `domAnimation`. Il provider usa un loader equivalente a:

```ts
const loadGameMotionFeatures = () =>
  import("./game-motion-features").then((module) => module.default);
```

Avvolgere la shell con `MotionConfig` e `LazyMotion strict`. Usare `m` per progress, risultato canonico e state diff; reduced-motion usa opacity breve o nessuna transizione, mantenendo lo stesso DOM e focus order.

- [ ] **Step 4: rifinire mobile e desktop**

Verificare via classi e CSS:

- `h-svh`, unica area feed `min-h-0`, footer `shrink-0`;
- textarea multilinea con altezza massima bounded e resize disabilitato;
- composer non copre decisione o ultimo messaggio;
- 320 px senza scroll orizzontale;
- 390 px con due azioni e composer nel primo livello;
- 1440 px con misura testo massima 65ch e nessuna HUD densa;
- fallback globale `prefers-reduced-motion` conservato.

- [ ] **Step 5: GREEN e commit**

```powershell
node --test tests/contracts/web-interactive-game-shell.test.mjs
corepack pnpm@11.13.0 exec turbo run lint --filter=@dnd-ai/web
corepack pnpm@11.13.0 exec turbo run typecheck --filter=@dnd-ai/web
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/web
node --test tests/integration/web-game-shell.test.mjs
git add apps/web/components/game apps/web/app/globals.css tests
git commit -m "feat(web): add accessible game motion and hud"
```

Expected: contract, lint, typecheck, build e smoke `PASS`.

---

### Task 7: Browser, bundle, living docs e candidato HIGH_RISK

**Files:**
- Modify: `docs/TASKS.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/README.md`
- Verify: `apps/web/.next`
- Verify: intera worktree e checkout pulito

**Interfaces:**
- Produce evidenza locale riproducibile; non produce deployment o artifact browser committati.

- [ ] **Step 1: smoke browser locale con la skill Browser**

Avviare il vero standalone costruito dal task 6 su un porto libero, in processo nascosto, con `HOSTNAME=127.0.0.1`. Usare il browser integrato sul solo URL locale e chiuderlo al termine.

Eseguire la matrice:

| Viewport | Verifica |
|---|---|
| 320x800 | zero overflow orizzontale; CTA 48 px; target 44 px; due suggerimenti visibili; composer/safe area non sovrapposti |
| 390x844 | narrazione, decisione e composer comprensibili; drawer scrollabile; Escape/focus restore |
| 1440x900 | stessa gerarchia e ordine; misura leggibile; nessuna funzione desktop-only |
| 390x844 reduced | stesso contenuto, ordine focus e azioni con motion ridotta |

Interazioni obbligatorie: Tab order, fill multilinea, `Shift+Enter`, submit con Enter, duplicate submit locked, apertura di tutte le sezioni HUD, chiusura Escape, scroll lontano dal fondo e `ConversationScrollButton`. Console: zero error/warning applicativi.

Se il browser integrato non puo attivare un evento React, registrare il limite e usare reducer/contract come evidenza dell'interazione; non dichiarare il click passato.

- [ ] **Step 2: misurare il bundle dopo build**

Dal file `apps/web/.next/server/app/index.html`, estrarre i path unici `/_next/static/chunks/*.js`, sommare le dimensioni raw sotto `apps/web/.next/static/chunks` e confrontare con 636.744 byte. Dal `page_client-reference-manifest.js`, sommare gli entry chunk unici di `apps/web/app/page` e confrontare con 59.332 byte.

Registrare valore finale, delta e chunk Motion asincrono. Eseguire:

```powershell
corepack pnpm@11.13.0 --filter @dnd-ai/web list --depth 0
corepack pnpm@11.13.0 --filter @dnd-ai/web why ai
corepack pnpm@11.13.0 --filter @dnd-ai/web why @ai-sdk/react
corepack pnpm@11.13.0 --filter @dnd-ai/web why @rive-app/react-canvas
corepack pnpm@11.13.0 --filter @dnd-ai/web why @streamdown/code
```

Expected: i quattro `why` non mostrano una catena installata. Se il delta include code/math/mermaid plugin AI Elements, attachment/model/voice, `ai`, Rive o Motion completo nel chunk iniziale, correggere prima dei gate.

- [ ] **Step 3: audit React e diff completo**

Applicare `vercel:react-best-practices` ai TSX modificati. Controllare manualmente:

```powershell
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- apps/web tests
rg -n "useChat|DefaultChatTransport|dangerouslySetInnerHTML|localStorage|sessionStorage|setTimeout|@rive-app|/api/chat" apps/web/components/game apps/web/components/ai-elements apps/web/lib/game-shell
```

Expected: `git diff --check` exit `0`; `rg` senza match; nessun finding P0/P1, secret, PII, debug o file generato accidentale.

- [ ] **Step 4: aggiornare living docs nello stesso candidato**

- BL-081 `DONE/100%/PASSING` soltanto dopo tutti i gate locali;
- dipendenze/versioni effettive, test, viewport, bundle baseline/finale/delta e failure path nella card;
- registro attivo terminale e `BL-007` ancora prossimo READY;
- `CONTEXT` con moduli realmente disponibili e prossima azione delivery protetta;
- `TRACEABILITY` con path/test implementati al posto di `planned`;
- `CHANGELOG` e indice README;
- nessun riferimento a provider o smoke remoto eseguito.

- [ ] **Step 5: eseguire l'unico full gate**

```powershell
$env:TURBO_FORCE="true"
corepack pnpm@11.13.0 verify
Remove-Item Env:TURBO_FORCE
```

Expected: exit `0`; lint, typecheck, build, tutte le lane, generated drift, docs, task graph, security, artifact e deployment policy `PASS`. Un failure reale viene corretto con test mirato; non rilanciare il full senza una modifica correlata.

- [ ] **Step 6: incorporare documentazione nel commit funzionale**

```powershell
git add docs apps/web tests package.json pnpm-lock.yaml
git commit --amend --no-edit
```

Expected: working tree pulita; nessun commit docs-only o evidence-only.

- [ ] **Step 7: clean checkout del candidato**

Creare una worktree detached sotto `.worktrees` con nome derivato dallo SHA candidato. Prima di rimuoverla verificare che il path assoluto risolto inizi con la directory `.worktrees` del repository.

Nel checkout pulito eseguire:

```powershell
corepack pnpm@11.13.0 install --frozen-lockfile
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/web
node --test tests/unit/game-shell-reducer.test.mjs
node --test tests/contracts/web-design-system.test.mjs tests/contracts/web-interactive-game-shell.test.mjs
node --test tests/integration/web-game-shell.test.mjs
corepack pnpm@11.13.0 verify:docs
```

Expected: install/build/test/docs `PASS`; cleanup della worktree registrata completato senza toccare altre directory.

- [ ] **Step 8: verifica finale prima della delivery**

Applicare `superpowers:verification-before-completion`, rileggere lo SHA effettivo e confermare:

```powershell
git status --short --branch
git log -5 --oneline
git diff --check origin/main...HEAD
```

Expected: branch pulita, candidato contiene codice/test/docs, nessuna azione Vercel. Solo a quel punto push e unica PR protetta; integrare esclusivamente con `CI / Merge gate` verde e senza bypass.

## Criteri di stop

- Il registry richiede Base UI, un transport chat, componenti non isolabili o overwrite distruttivi delle primitive BL-079.
- Il reducer necessita clock, timer, rete o stato canonico per far passare la fixture.
- Streamdown non puo disabilitare raw HTML, immagini e link AI senza aggiungere un renderer parallelo.
- Focus restore, Escape, safe area o keyboard risultano non verificabili con Drawer/Vaul corrente.
- Il client iniziale include Rive, AI SDK chat, plugin Streamdown non consumati o Motion completo.
- Il full gate trova regressioni P0/P1 non comprese nella slice: correggere soltanto se causate da BL-081; altrimenti registrare un task separato senza ampliare silenziosamente il change set.
