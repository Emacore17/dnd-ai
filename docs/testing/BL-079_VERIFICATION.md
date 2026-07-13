---
status: active
owner: product-design-frontend-and-qa
last_reviewed: 2026-07-13
last_verified_commit: 2765c49959d6b4094367120e3615a0728a58be0a
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
  - .github/workflows/ci.yml
  - apps/web/components.json
  - apps/web/playwright.config.ts
  - apps/web/e2e/game-shell.performance.spec.ts
  - apps/web/e2e/performance-budget.mjs
  - apps/web/e2e/start-production-server.mjs
  - apps/web/src/app/globals.css
  - apps/web/src/components/ai-elements
  - apps/web/src/components/game
  - apps/web/src/components/motion
  - apps/web/src/hooks/use-visual-viewport-height.ts
  - apps/web/src/lib/game-shell-state.ts
  - apps/web/src/lib/narrative-live-announcement.ts
  - apps/web/artifact-runtime/start.mjs
  - scripts/smoke-build-artifact.mjs
  - scripts/lib/ci-workflow-policy.mjs
test_refs:
  - tests/contracts/bl079-ui-foundation.test.mjs
  - apps/web/src/components/game/choice-set.test.tsx
  - apps/web/src/components/game/domain-view-contracts.test.tsx
  - apps/web/src/components/game/free-action-composer.test.tsx
  - apps/web/src/components/game/game-shell.test.tsx
  - apps/web/src/components/game/narrative-turn.test.tsx
  - apps/web/src/lib/narrative-live-announcement.test.ts
  - apps/web/e2e/game-shell.spec.ts
  - apps/web/e2e/game-shell.performance.spec.ts
  - apps/web/e2e/__screenshots__
  - tests/unit/performance-budget.test.mjs
  - tests/contracts/ci-workflow.test.mjs
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
| Contenuto verificato | implementation `778b634`; tentativo intermedio `a557d73`; performance gate attribuibile `2765c49959d6b4094367120e3615a0728a58be0a`; documentazione corrente |
| Spec SHA-256 | `aa892faafb3e54b76a0a37a31d3a919c9e9f05681a64501239de9c0351322805` |
| Migration/schema/event/prompt/eval | `N/A` — BL-079 non modifica questi contratti |
| Stato task | `IN_REVIEW / 90% / PARTIAL` |

L'implementazione e tutti i gate automatici locali e CI specifici di BL-079 sono verdi. Il task non è `DONE`: restano i gate umani o ambientali richiesti dalla card — screen reader reale, telefono reale, review di comprensione con cinque utenti interni, browser manuali non Chromium, zoom 200% e staging posseduto da `BL-080`.

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
| Harness | Vitest/Testing Library, Playwright su otto viewport, axe WCAG 2.2 AA, screenshot Windows/Linux e suite performance production dedicata |

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
| `node --test tests/contracts/bl079-ui-foundation.test.mjs` | exit `0`; `9/9`, incluso runtime standalone production e suite performance dedicata |
| `node --test tests/unit/performance-budget.test.mjs` | exit `0`; `4/4`, inclusi boundary, failure, lavoro fuori fase e input mancante |
| `corepack pnpm@10.34.5 test:component` | exit `0`; `7` file, `26/26` test |
| `$env:CI = "true"; corepack pnpm@10.34.5 test:e2e:functional` | exit `0`; build standalone production, `36` applicabili passati e `116` skip condizionali in `35,9 s` |
| visual Windows senza update | exit `0`; `7` pass, `25` skip |
| visual Linux in `mcr.microsoft.com/playwright:v1.61.1-noble` senza update | exit `0`; `7` pass, `25` skip |
| `$env:CI = "true"; corepack pnpm@10.34.5 test:e2e:performance` | exit `0`; `3/3` campioni production, un worker e zero retry in `15,0 s` |
| `$env:CI = "true"; corepack pnpm@10.34.5 --filter @dnd-ai/web exec playwright test --config playwright.config.ts game-shell.performance.spec.ts --project=mobile-390 --repeat-each=20 --retries=0` | exit `0`; `20/20` campioni, quattro fasi input per campione, Event Timing massimo `40 ms`, processing massimo `14,7 ms`, CLS massimo `0.0000246`, `0` LoAF/long task osservati e `0` violazioni |
| `corepack pnpm@10.34.5 build` | exit `0`; `10/10` workspace build |
| `corepack pnpm@10.34.5 --filter @dnd-ai/web analyze` | exit `0`; report `.next/diagnostics/analyze` |
| `$env:TURBO_FORCE = "true"; corepack pnpm@10.34.5 verify` | exit `0` in `71,5 s`; 0 cache hit, lint/typecheck/build `10/10`, unit `14` pass/`1` skip host, component `26`, integration `4`, contract `18`, security `8`, policy, secret scan, artifact `3.172` file e boot HTTP `PASS` |
| clean commit/checkout | `PASS`; implementation `778b634`, performance gate `2765c49` e documentazione congelata nel commit di chiusura |
| PR #5, run `29271004267` | `FAIL` fail-closed; vecchio observer globale ha riportato `[83, 63]` ms e retry `[85, 53]` durante una matrice a due worker; quality/security `PASS`, build skipped |
| PR #5, run `29272004975` | `FAIL` fail-closed anche con un worker: `[59]` ms e retry `[63]`; ha invalidato la diagnosi “solo contesa” e confermato la necessità di attribuzione per fase |
| PR #5, run `29274592866` | `PASS`; Quality, Tests, Security, Build artifact e `CI / Merge gate` verdi; functional `36/116`, performance `3/3` in `14,7 s`, diagnostica failure-only correttamente skipped |
| Staging | `PENDING`; posseduto da `BL-080` dopo `BL-003` |

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

Le due failure Ubuntu hanno corretto la diagnosi. La run `29271004267` ha osservato long task mentre due browser condividevano il runner; la successiva `29272004975` ha però riprodotto `[59]` e `[63]` ms con un solo worker. Il vecchio smoke usava `next dev`, creava observer globali `buffered` prima della navigation, non delimitava le interazioni e allegava il JSON dopo gli assert: i numeri non potevano distinguere bootstrap/browser dalla shell.

Il commit `2765c49` usa una suite separata sulla build standalone production. Gli observer vengono creati dopo route, font e quiet window senza buffer storico; User Timing delimita `scroll-latest`, `drawer-open`, `drawer-close` e `composer-submit`; un input raw obbligatorio prova che ogni fase è stata esercitata e lo scroll spring resta aperto fino al fondo stabile. Il gate richiede Event Timing ≤ `104 ms`, processing `<50 ms`, CLS ≤ `0.1` e nessun Long Animation Frame che interseca la fase con `blockingDuration >0`; i long task fuori fase restano diagnostici. Tre campioni devono passare senza retry. JSON, LoAF/script attribution, long task e layout shift vengono allegati prima delle asserzioni e la CI conserva la directory Playwright solo sul failure per tre giorni.

La calibrazione locale production da venti campioni è `20/20 PASS`: tutte le quattro fasi possiedono input, Event Timing massimo `40 ms`, processing massimo `14,7 ms`, CLS massimo `0.0000246`, nessun LoAF/long task osservato e zero violazioni. Il dice tray reale non esiste ancora nella fixture BL-079: il relativo trace appartiene a `BL-040`, evitando di dichiarare copertura simulata.

Rive è **rimosso dalla decisione P0 della shell**: nessun package o riferimento `@rive-app/*` è presente in manifest, lockfile, source o bundle iniziale. Motion e CSS coprono i momenti richiesti con fallback testuale e reduced-motion. Un task consumer può riaprire la decisione solo con lazy loading isolato, fallback statico e benchmark migliore della baseline.

## Gate residui prima di `DONE`

| Gate | Stato | Owner/condizione |
|---|---|---|
| Screen reader reale su progresso, fine turno, dado, retry e stream | `PENDING MANUAL` | Product/QA con VoiceOver o TalkBack; registrare device e finding |
| Telefono reale, safe area e tastiera | `PENDING MANUAL` | QA; almeno un device touch |
| Zoom testo/browser 200% | `PENDING MANUAL` | QA; verificare reflow e CTA |
| Firefox, Safari e Edge correnti | `PENDING` | `QA-001` consolida la matrice; smoke BL-079 richiesto prima del `DONE` |
| Five-second comprehension con cinque utenti interni | `PENDING HUMAN` | Product Design; i sei compiti sono in `UX_UI_DESIGN.md` §13 |
| `pnpm verify` sul change set BL-079 | `PASS` | sync finale senza cache in `71,5 s`; 0 cache hit, 14 unit pass/1 skip host, 26 component, 4 integration, 18 contract, 8 security, build/artifact/boot verdi |
| Commit/checkout pulito | `PASS` | implementation `778b634`; gate attribuibile `2765c49`; documentazione congelata nel commit di chiusura |
| CI branch | `PASS` | PR #5 run `29274592866`: 5/5 job verdi, performance `3/3`, gate required verde; PR draft `MERGEABLE/CLEAN` |
| Preview/staging e shell smoke | `PENDING DEPENDENCY` | `BL-080`, dopo la typed config di `BL-003`; `BL-070` possiede solo hardening/load/restore |

## Verdetto

La vertical slice visuale è pronta per review e per essere consumata dai task successivi, ma BL-079 resta correttamente `IN_REVIEW`: gli automatismi sono verdi, mentre i gate che richiedono persone, device, browser aggiuntivi o staging non sono stati simulati né dichiarati passati.
