---
status: active
owner: frontend-and-product-design
last_reviewed: 2026-07-16
last_verified_commit: dac74168f56a422ca36aad1a8297f447ee174c9b
source_refs:
  - docs/MVP_SPEC.md#31-backlog-iniziale
  - docs/TASKS.md#bl-079--design-system-core-e-shell-statica-mobile-first
  - docs/product/UX_UI_DESIGN.md#14-piano-di-implementazione
  - docs/adr/0001-mobile-first-conversational-ui.md
  - docs/superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md
related_tasks:
  - BL-079
  - BL-005
  - BL-081
  - QA-002
code_refs:
  - apps/web
  - package.json
  - pnpm-lock.yaml
test_refs:
  - tests/contracts
  - tests/integration
supersedes: null
---

# BL-079 — Piano di implementazione design system core

> Piano esecutivo TDD per la fondazione visuale e la shell statica mobile-first. La decomposizione e la direzione UX sono già approvate; questo piano non riapre lo scope di GOV-004.

## Obiettivo

Consegnare una fondazione Next.js server-rendered basata su Tailwind CSS v4 e shadcn/ui `new-york` con primitive Radix, token semantici, Geist locale, Lucide e una shell statica premium comprensibile a 320–430 px. Desktop amplia la stessa gerarchia. Il change set non introduce AI Elements, Motion, Rive, state machine, drawer interattivi, API o deploy.

## Decisioni implementative

- shadcn CLI non interattiva, base Radix; installare soltanto `Button`, `Card`, `Badge`, `Separator` e `Input`.
- Tailwind v4 con `@tailwindcss/postcss`, `@import "tailwindcss"`, token OKLCH e `components.json` con config vuota.
- `geist` locale per Sans/Mono: nessuna fetch font durante build o nel browser.
- Server Components per layout, pagina e shell; nessun `'use client'` in BL-079.
- Fixture statica italiana, player-safe e non canonica; i controlli sono rappresentativi ma non inviano comandi.
- CSS semantic-first; niente palette Tailwind ad hoc, gradienti invasivi, glassmorphism o decorazione fantasy.
- Test Node nativi: contract sul design system e smoke HTTP del vero standalone Next.js; QA-002 resta owner del harness browser condiviso.

## Corsia e gate

`HIGH_RISK` perché cambiano dipendenze e lockfile. Durante lo sviluppo usare test mirati RED/GREEN. Sul candidato finale eseguire una sola `pnpm verify` senza cache e una verifica da checkout pulito con install frozen, build e smoke mirato. Nessuna azione Vercel.

## Task 1 — Attivazione e contratto RED

**Files**

- Modify: `docs/TASKS.md`
- Modify: `docs/CONTEXT.md`
- Create: `tests/contracts/web-design-system.test.mjs`

- [x] Registrare BL-079 `IN_PROGRESS/25%/PARTIAL`, branch/base, corsia, failure path e fuori scope.
- [x] Scrivere il contract che richiede `components.json` `new-york`/Radix, Tailwind v4, alias, Lucide, token semantici, font locale, focus e touch target.
- [x] Richiedere esplicitamente l'assenza di AI Elements, Motion e Rive dal manifest web.
- [x] Eseguire `node --test tests/contracts/web-design-system.test.mjs` e osservare RED per la fondazione mancante.

## Task 2 — Bootstrap shadcn e dipendenze minime

**Files**

- Create/Modify: `apps/web/components.json`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/lib/utils.ts`
- Create: `apps/web/components/ui/{button,card,badge,separator,input}.tsx`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/app/globals.css`

- [x] Inizializzare con la CLI compatibile `new-york`, poi usare la CLI corrente per dry-run e add dei soli componenti previsti con base Radix.
- [x] Aggiungere `geist` locale e mantenere le versioni esatte coerenti con la policy pnpm.
- [x] Revisionare il diff CLI: nessun componente inutilizzato, nessun font remoto, nessun runtime AI/motion.
- [x] Portare il contract config/dependency a GREEN senza ancora implementare la shell.

## Task 3 — Token, tipografia e primitive

**Files**

- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Modify: `tests/contracts/web-design-system.test.mjs`

- [x] Definire token dark P0 per background/surface/foreground/muted/primary/success/warning/destructive, radius, spacing, safe area e touch target.
- [x] Applicare Geist Sans/Mono all'elemento `html` e mantenere metadata/copy in italiano.
- [x] Definire focus visibile globale, selection, reduced-motion fallback CSS e regole di overflow/word wrapping.
- [x] Rieseguire il contract fino a GREEN; lint e typecheck web devono restare verdi.

## Task 4 — Shell statica TDD

**Files**

- Create: `apps/web/components/static-game-shell.tsx`
- Create: `apps/web/lib/static-game-shell-fixture.ts`
- Modify: `apps/web/app/page.tsx`
- Create: `tests/integration/web-design-system.test.mjs`

- [x] Scrivere prima lo smoke HTTP RED sul vero HTML standalone: landmark, scena, stato essenziale, narrazione lunga, esito, feedback e controlli con label accessibili.
- [x] Implementare la shell statica minima con header compatto, feed dominante, esito canonico dimostrativo, due azioni e composer rappresentativo.
- [x] Conservare un solo livello primario, touch target e safe area; desktop amplia la misura senza introdurre funzionalità esclusive.
- [x] Portare smoke, contract, lint, typecheck e build web a GREEN.

## Task 5 — Verifica locale visuale e keyboard

**Files**

- Verify: `apps/web`
- Modify: documentazione/evidenze BL-079

- [x] Avviare il server locale production-like senza Vercel e verificare 320, 390 e 1440 px con la skill browser.
- [x] Controllare overflow orizzontale, safe area, focus order, label, target touch e comprensione in cinque secondi.
- [x] Salvare screenshot locali solo come artifact temporanei; non commettere output browser non richiesti.
- [x] Correggere ogni finding P0/P1 con un test riproducibile prima della modifica.

## Task 6 — Living docs, gate e delivery

**Files**

- Modify: `docs/TASKS.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/README.md`

- [x] Registrare inventario componenti/versioni, comandi, exit code, viewport verificate e assenza di azioni Vercel.
- [x] Aggiornare BL-079 a `DONE/100%/PASSING`; rendere `BL-005` e `BL-081` READY nel grafo, con selezione canonica successiva BL-005.
- [x] Applicare la checklist React best practices e una self-review P0/P1 del diff completo.
- [x] Eseguire `TURBO_FORCE=true corepack pnpm@11.13.0 verify` una sola volta sul candidato finale.
- [x] Verificare da checkout pulito: install frozen, contract UI, build web e smoke HTTP; rimuovere risorse temporanee.
- [ ] Creare un solo commit candidato, PR protetta e integrare soltanto con `CI / Merge gate` verde.

## Criteri di stop

- Se la CLI propone Base UI, registry completa o componenti non usati, interrompere e correggere la configurazione Radix selettiva.
- Se font o build richiedono rete a runtime/test, usare esclusivamente il pacchetto Geist locale.
- Se serve interattività client, Motion, AI Elements, Drawer o una state machine, spostare il requisito a BL-081 invece di ampliare BL-079.
- Se una prova richiede Vercel/staging, resta BL-080/GATE-M0 e non blocca il candidato locale.
