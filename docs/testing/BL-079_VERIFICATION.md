---
status: active
owner: product-design-frontend-and-qa
last_reviewed: 2026-07-13
last_verified_commit: a557d73b6c8cec530e67f5292c7d48f10e987c53
source_refs:
  - docs/MVP_SPEC.md#8-esperienza-utente
  - docs/MVP_SPEC.md#114-stack-selezionato
  - docs/MVP_SPEC.md#21-interfaccia-utente
  - docs/MVP_SPEC.md#231-target-misurabili
  - docs/MVP_SPEC.md#268-end-to-end
  - docs/MVP_SPEC.md#322-criteri-supplementari-di-qualità
  - docs/product/UX_UI_DESIGN.md#13-criteri-di-verifica
  - docs/adr/0001-mobile-first-conversational-ui.md
related_tasks:
  - BL-002
  - BL-079
  - BL-080
  - BL-040
  - QA-001
code_refs:
  - apps/web/components.json
  - apps/web/playwright.config.ts
  - apps/web/src/app/globals.css
  - apps/web/src/components/ai-elements
  - apps/web/src/components/game
  - apps/web/src/components/motion
  - apps/web/src/hooks/use-visual-viewport-height.ts
  - apps/web/src/lib/game-shell-state.ts
  - apps/web/src/lib/narrative-live-announcement.ts
  - apps/web/artifact-runtime/start.mjs
  - scripts/smoke-build-artifact.mjs
test_refs:
  - tests/contracts/bl079-ui-foundation.test.mjs
  - apps/web/src/components/game/choice-set.test.tsx
  - apps/web/src/components/game/domain-view-contracts.test.tsx
  - apps/web/src/components/game/free-action-composer.test.tsx
  - apps/web/src/components/game/game-shell.test.tsx
  - apps/web/src/components/game/narrative-turn.test.tsx
  - apps/web/src/lib/narrative-live-announcement.test.ts
  - apps/web/e2e/game-shell.spec.ts
  - apps/web/e2e/__screenshots__
  - tests/integration/artifact-runtime.test.mjs
supersedes: null
---

# Evidenze BL-079 — fondazione UX/UI mobile-first

## Identità e verdetto

| Campo | Valore |
|---|---|
| Data | 2026-07-13 |
| Ambiente locale | Windows 11 Pro, Node `24.11.0`, pnpm `10.34.5`, Chromium Playwright `1.61.1` |
| Branch | `codex/bl-079-mobile-shell` |
| Base verificata | `d530f3a0bab8cc20b8eee9f63ef222e6c4bb19f8` |
| Contenuto verificato | implementation `778b634`; isolamento performance CI `a557d73b6c8cec530e67f5292c7d48f10e987c53`; documentazione corrente |
| Spec SHA-256 | `aa892faafb3e54b76a0a37a31d3a919c9e9f05681a64501239de9c0351322805` |
| Migration/schema/event/prompt/eval | `N/A` — BL-079 non modifica questi contratti |
| Stato task | `IN_REVIEW / 90% / PARTIAL` |

L'implementazione e tutti i gate automatici locali specifici di BL-079 sono verdi. Il task non è `DONE`: restano i gate umani o ambientali richiesti dalla card — screen reader reale, telefono reale, review di comprensione con cinque utenti interni, browser manuali non Chromium, zoom 200%, staging posseduto da `BL-080` e CI sostitutiva del fix performance.

La route è una fixture deterministica della shell P0. Non implementa API, REST/SSE, `useChat`, inventario o combattimento reali e non modifica stato canonico.

## Inventario implementato

| Area | Artefatti e comportamento |
|---|---|
| Fondazione | shadcn/ui `new-york`, base `radix-ui`, Tailwind CSS 4, token semantici, Geist self-hosted e Lucide |
| AI UI selettiva | wrapper source-owned per conversation, message e prompt input; nessun trasporto chat parallelo |
| Shell | feed e composer dominanti; due azioni primarie; HUD mobile in drawer; pannelli desktop progressivi con stesso ordine DOM |
| View contract | dieci stati canonici; retry con `retryable` e `stateApplied`; choice one-shot per `choiceSetId`; DC visibile/nascosta; source e risorse party strutturate |
| Mobile hardening | 320 px, landscape corto, Visual Viewport, tastiera ridotta e safe area top/bottom/left/right, inclusi portal dei drawer |
| Accessibilità | focus trap/restore, Tab/Shift+Tab, Escape, target touch, live announcement per blocchi narrativi e un solo announcer dello stato turno |
| Motion | `LazyMotion` con `domAnimation` dinamico, reduced-motion hydration-safe, press CSS e dado decorativo legato al risultato già canonico |
| Sicurezza contenuto | Markdown AI limitato a `p`, `em`, `strong`, `ul`, `ol`, `li`; HTML raw, link, heading e code non vengono renderizzati |
| Harness | Vitest/Testing Library, Playwright su otto viewport, axe WCAG 2.2 AA, screenshot Windows/Linux e performance observer persistente |

## Versioni visuali principali

| Dipendenza | Versione | Uso |
|---|---:|---|
| `next` | `16.2.10` | App Router e build |
| `react` / `react-dom` | `19.2.7` | runtime UI |
| `tailwindcss` | `4.3.2` | token e layout |
| `shadcn` | `4.13.0` | CLI/source ownership |
| `radix-ui` | `1.6.2` | primitive accessibili |
| `motion` | `12.42.2` | transizioni coordinate e risultato canonico |
| `streamdown` | `2.5.0` | Markdown AI allowlisted |
| `geist` | `1.7.2` | font sans/mono |
| `lucide-react` | `1.24.0` | icone |
| `vaul` | `1.1.2` | drawer mobile |
| `vitest` / Testing Library | `4.1.10` / `16.3.2` | component test |
| Playwright / axe | `1.61.1` / `4.12.1` | E2E, visual e a11y |

## Comandi ed esiti

| Comando | Esito osservato |
|---|---|
| `corepack pnpm@10.34.5 --filter @dnd-ai/web lint` | exit `0` |
| `corepack pnpm@10.34.5 --filter @dnd-ai/web typecheck` | exit `0`; Next typegen e TypeScript strict |
| `node --test tests/contracts/bl079-ui-foundation.test.mjs` | exit `0`; `9/9`, incluso isolamento worker senza rilassare `0` long task |
| `corepack pnpm@10.34.5 test:component` | exit `0`; `7` file, `26/26` test |
| `pnpm exec playwright test --config playwright.config.ts` da `apps/web` | exit `0`; `160` enumerati, `37` applicabili passati, `123` skip condizionali |
| visual Windows senza update | exit `0`; `7` pass, `25` skip |
| visual Linux in `mcr.microsoft.com/playwright:v1.61.1-noble` senza update | exit `0`; `7` pass, `25` skip |
| performance smoke `mobile-390` | exit `0`; `0` long task, CLS `0.0000245` |
| performance smoke con `CI=true`, un worker | exit `0`; focused `1/1` in `8,0 s`; matrice `37/37` applicabili e `123` skip condizionali in `49,7 s` |
| `corepack pnpm@10.34.5 build` | exit `0`; `10/10` workspace build |
| `corepack pnpm@10.34.5 --filter @dnd-ai/web analyze` | exit `0`; report `.next/diagnostics/analyze` |
| `corepack pnpm@10.34.5 verify` | clean implementation `778b634` con `TURBO_FORCE=true` exit `0` in `66,1 s`; fix `a557d73` più documentazione sincronizzata exit `0` in `74,9 s`, 0 cache hit, contract complessivi `17/17` e boot HTTP `PASS` |
| clean commit/checkout | `PASS`; 10/10 lint/typecheck/build, unit/component/integration/contract/security, policy, secret scan, artifact verify e boot HTTP |
| PR #5, run `29271004267` | `FAIL` fail-closed; unico errore performance con due worker concorrenti, `36` pass/`123` skip; quality e security `PASS`, build skipped |
| CI sostitutiva e staging | `PENDING`; fix `a557d73` pronto, staging posseduto da `BL-080` |

Gli skip Playwright sono intenzionali: ogni scenario viene eseguito solo sui progetti rappresentativi dichiarati nel test. Nessun caso applicabile è skipped.

## Matrice automatizzata

| Progetto | Viewport | Copertura specifica | Stato |
|---|---:|---|---|
| `mobile-320` | 320×568 | minimo funzionale, feed iniziale, azioni, composer, HUD | `PASS` |
| `mobile-360` | 360×800 | baseline mobile | `PASS` |
| `mobile-390` | 390×844 | keyboard, drawer, axe, reduced-motion, long feed, performance e stati | `PASS` |
| `tablet-768` | 768×1024 | passaggio responsive | `PASS` |
| `desktop-1024` | 1024×768 | progressive enhancement | `PASS` |
| `desktop-1440` | 1440×900 | pannelli persistenti, axe e visual | `PASS` |
| `landscape-568` | 568×320 | layout corto a due colonne e safe area L/R | `PASS` |
| `landscape-844` | 844×390 | landscape ampio | `PASS` |

Sono inoltre verificati 320×300 e 390×ridotto come proxy della tastiera virtuale, safe area portrait e landscape tramite CDP, contenuto lungo, reconnect, errore pre-commit, focus cycling, scroll completo del drawer, Enter/Shift+Enter e assenza di mismatch hydration con reduced-motion.

## Accessibilità e contenuto non affidabile

- axe usa `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` e `wcag22aa`: zero violazioni sulla shell mobile/desktop e sul drawer aperto;
- i controlli touch frequenti sono almeno 44×44 CSS px e i primari almeno 48 px;
- il log sospende la live region durante lo stream e annuncia solo l'ultimo blocco narrativo completo; lo stato turno usa un announcer separato e atomico;
- retry e safety non creano live region concorrenti; il contenuto resta raggiungibile nella normale lettura;
- il drawer conserva focus, Escape, restore e scroll fino alla fine anche su viewport corte;
- i test negativi di `MessageResponse` impediscono HTML raw e gli elementi Markdown fuori allowlist.

Questi controlli non sostituiscono il gate con screen reader reale, che resta aperto.

## Performance e decisione Rive

Il build finale locale misura la route `/` a `1.229.757` byte JS first-load non compressi, `365.057` byte gzip e `311.655` byte Brotli su `9` chunk. `/_not-found` misura `514.449` byte non compressi e `145.136` byte gzip. Questa è la baseline comparativa della fondazione, non un'autorizzazione a crescite non misurate: un consumer UI che aggiunge oltre il 10% gzip deve registrare motivazione e nuovo trace.

Il performance smoke persistente azzera gli observer dopo font/load e misura scroll-to-latest, apertura/chiusura drawer e submit fixture. Il run locale registra `0` long task e CLS `0.0000245`, sotto il guardrail `0.1`. La prima CI Ubuntu lo eseguiva in parallelo a `desktop-1024` e, al retry, a `desktop-1440`, rilevando rispettivamente `[83, 63]` e `[85, 53]` ms. Il fix imposta un solo worker e un contratto conserva esplicitamente `toEqual([])`: la soglia non è stata alzata né filtrata. Il caricamento iniziale e i device reali saranno rivalidati nei gate successivi.

Rive è **rimosso dalla decisione P0 della shell**: nessun package o riferimento `@rive-app/*` è presente in manifest, lockfile, source o bundle iniziale. Motion e CSS coprono i momenti richiesti con fallback testuale e reduced-motion. Un task consumer può riaprire la decisione solo con lazy loading isolato, fallback statico e benchmark migliore della baseline.

## Gate residui prima di `DONE`

| Gate | Stato | Owner/condizione |
|---|---|---|
| Screen reader reale su progresso, fine turno, dado, retry e stream | `PENDING MANUAL` | Product/QA con VoiceOver o TalkBack; registrare device e finding |
| Telefono reale, safe area e tastiera | `PENDING MANUAL` | QA; almeno un device touch |
| Zoom testo/browser 200% | `PENDING MANUAL` | QA; verificare reflow e CTA |
| Firefox, Safari e Edge correnti | `PENDING` | `QA-001` consolida la matrice; smoke BL-079 richiesto prima del `DONE` |
| Five-second comprehension con cinque utenti interni | `PENDING HUMAN` | Product Design; i sei compiti sono in `UX_UI_DESIGN.md` §13 |
| `pnpm verify` sul change set BL-079 | `PASS` | clean implementation `778b634` in `66,1 s`; fix `a557d73` più documentazione sincronizzata in `74,9 s`; cache forzata off e boot HTTP inclusi |
| Commit/checkout pulito | `PASS` | implementation `778b634`; performance fix `a557d73`; sincronizzazione documentale nel commit corrente |
| CI branch | `PENDING RE-RUN` | PR #5; run `29271004267` fallita chiusa sul performance smoke concorrente, fix `a557d73` verificato localmente |
| Preview/staging e shell smoke | `PENDING DEPENDENCY` | `BL-080`, dopo la typed config di `BL-003`; `BL-070` possiede solo hardening/load/restore |

## Verdetto

La vertical slice visuale è pronta per review e per essere consumata dai task successivi, ma BL-079 resta correttamente `IN_REVIEW`: gli automatismi sono verdi, mentre i gate che richiedono persone, device, browser aggiuntivi o staging non sono stati simulati né dichiarati passati.
