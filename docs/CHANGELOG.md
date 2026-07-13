---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: 2765c49959d6b4094367120e3615a0728a58be0a
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md
related_tasks:
  - GOV-001
  - BL-001
  - BL-002
  - BL-079
  - BL-080
code_refs:
  - .github/workflows/ci.yml
  - apps/web/components.json
  - apps/web/src/app/globals.css
  - apps/web/src/components/ai-elements
  - apps/web/src/components/game
  - apps/web/src/components/motion/game-motion.tsx
  - apps/web/artifact-runtime/start.mjs
  - apps/web/e2e/game-shell.performance.spec.ts
  - apps/web/e2e/performance-budget.mjs
  - apps/web/e2e/start-production-server.mjs
  - scripts/lib/build-artifact.mjs
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/smoke-build-artifact.mjs
  - apps/web/playwright.config.ts
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/bl079-ui-foundation.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - apps/web/src/components/game/choice-set.test.tsx
  - apps/web/src/components/game/domain-view-contracts.test.tsx
  - apps/web/src/components/game/game-shell.test.tsx
  - apps/web/src/components/game/narrative-turn.test.tsx
  - apps/web/e2e/game-shell.spec.ts
  - apps/web/e2e/game-shell.performance.spec.ts
  - tests/unit/performance-budget.test.mjs
  - tests/integration/artifact-runtime.test.mjs
  - docs/testing/BL-079_VERIFICATION.md
supersedes: null
---

# Changelog documentale e contrattuale

## 2026-07-13

### Added

- Creati `docs/README.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md` e questo changelog per completare il bootstrap documentale di `GOV-001`.
- Creato `docs/product/UX_UI_DESIGN.md` con studio, gerarchia, wireframe, component mapping, motion system, criteri mobile/accessibilità/performance e piano di implementazione.
- Accettato ADR-0001 per shell conversazionale mobile-first, shadcn/ui su Radix, AI Elements selettivo, Motion e Rive gated.
- Aggiunto `BL-079` come task P0 di fondazione UX/UI prima delle feature giocatore.
- Creato il monorepo pnpm/Turborepo con `apps/web`, `apps/api`, `apps/worker` e sette package modulari per `BL-001`.
- Aggiunti checker e contract test per package boundaries e task graph, inclusi casi vietati che falliscono chiuso.
- Creati `docs/architecture/SYSTEM_OVERVIEW.md` e ADR-0002 sui confini del monorepo.
- Aggiunti workflow GitHub Actions, policy CI versionata, suite unit/integration/security, SAST locale fail-on-warning, secret scan, dependency audit, artifact allowlisted e ADR-0003 per `BL-002`.
- Creati `docs/operations/CI_CD.md` e `docs/testing/BL-002_VERIFICATION.md`.
- Creata la fondazione UI `BL-079`: shadcn/ui `new-york` su Radix, token semantici dark, Geist/Lucide, primitive AI Elements selettive, wrapper di gioco e shell fixture adattiva.
- Aggiunti Motion lazy/reduced, hook Visual Viewport, stati deterministici del turno, test componenti e matrice Playwright/axe per la shell.
- Creato `docs/testing/BL-079_VERIFICATION.md` come registro riproducibile dei gate passati e ancora pendenti; Rive è esplicitamente non adottato nella shell base.
- Aggiunti screenshot Playwright Windows/Linux, performance harness poi reso attribuibile su production, safe area orizzontali, feed anchor per risposte alte, live announcement a blocchi e contratti UI per choice, DC/source, risorse party e retry.
- Aggiunto `BL-080` in M0 per possedere provisioning e primo smoke preview/staging; `BL-003` ne fornisce la config e `BL-070` resta dedicato all'hardening pre-release.
- Aggiunti launcher standalone e boot smoke HTTP dell'artifact, con regressione per la risoluzione pnpm materializzata.
- Aggiunta una suite performance BL-079 separata con runtime standalone production, User Timing, Event Timing, Long Animation Frames, CLS, evaluator puro e diagnostica Playwright failure-only.

### Changed

- Corretti i link fra `AGENTS.md`, `docs/MVP_SPEC.md` e `docs/TASKS.md`; il path canonico del backlog è `docs/TASKS.md`.
- Allineata la specifica da desktop-first a mobile-first: 320 px minimo funzionale, 360–430 px baseline primaria, desktop come progressive enhancement.
- Resi normativi feed conversazionale, composer sticky, HUD on demand, target touch, safe area, tastiera virtuale, reduced-motion e stile contemporaneo non pseudo-medievale.
- Selezionati shadcn/ui `new-york` con Radix, AI Elements come presentational layer e Motion come motion layer; il gate BL-079 ha escluso Rive dalla shell P0, lasciando future prove isolate subordinate a task/ADR e benchmark.
- Estesi backlog, test UI e gate M0 per includere mobile matrix, accessibility, visual regression e performance trace.
- Resi espliciti `BL-079` e i riferimenti UX/ADR in ogni task che modifica UI; sostituite le dipendenze differite testuali con task/gate verificabili.
- Chiarita l’ownership: `BL-079` crea il browser harness minimo di feature, `QA-001` lo consolida senza blocco circolare.
- Aggiunto un override pnpm a `postcss@8.5.10` per correggere il finding moderato transitivo `GHSA-qx2v-qp2m-jg93`; audit successivo senza vulnerabilità note.
- Il quality contract locale ora include format, unit, integration, contract, security, workflow policy, build e artifact verification; le suite future restano assegnate ai task proprietari.
- Attivata sul repository pubblico la Ruleset `main-required-ci` (`18877721`), strict e senza bypass, con `CI / Merge gate` richiesto da GitHub Actions; `BL-002` passa a `DONE` e `BL-079` a `READY`.
- Spostata la route web nello `src/app`, configurati Tailwind CSS 4 e il contratto alias/token, e aggiunti al quality contract i component test e il browser harness posseduti da `BL-079`.
- Corrette le dipendenze di `BL-079`: lo staging non è più un gate senza owner futuro, ma una dipendenza esplicita da `BL-080`; `BL-003` è il prossimo task `READY` mentre la review UI attende i gate manuali.
- Corretto il packager su Windows/Next 16: i private-hoist senza mirror vengono omessi senza leggere lo store esterno; il launcher usa soltanto il mirror incluso e la CI richiede ora `artifact:smoke` prima dell'upload.
- Serializzata la matrice Playwright come primo tentativo dopo la run `29271004267`; la successiva `29272004975` ha riprodotto il failure a worker singolo e ha invalidato la diagnosi “solo contesa”.
- Sostituito il gate globale `0 long task` con budget delimitati su quattro interazioni: Event Timing ≤ `104 ms`, processing `<50 ms`, zero `blockingDuration` per LoAF che interseca una fase e CLS ≤ `0.1`; tre campioni, zero retry e lavoro fuori fase solo diagnostico.
- Separati browser funzionale e performance in CI; la build web precede entrambi e i risultati Playwright vengono caricati soltanto sul failure, da path ristretto e per tre giorni.

### Verification

- Repository: Git `main`; implementation commit BL-001 `6cda07a60022665f321b48dd82fbeb1d9bef586f`.
- Snapshot intermedio BL-002: gate locali `PASS`, evidenze remote e commit di implementazione allora ancora in chiusura; lo stato conclusivo è registrato nelle righe successive e nel report `docs/testing/BL-002_VERIFICATION.md`.
- Full verify BL-002 locale: exit `0` in 74,4 s; 9+1 unit, 3 integration, 8 contract, 7 security, 10/10 lint/typecheck/build e artifact da 3.184 file verificati.
- Commit di implementazione BL-002 `f9330fed11e623e84fa7e32032dca95c4e7ee308`: install frozen e `TURBO_FORCE=true pnpm verify` da worktree detached pulito entrambi exit `0`.
- Corretto il packager artifact per i symlink Linux di Next già confinati nel mirror standalone; la prima run remota ha confermato che build/gate falliscono chiuso prima della correzione.
- Fix Linux `049748443aa6fa83496bfc5b996560312b6fd48d` verificato da worktree detached pulito: frozen install e `TURBO_FORCE=true pnpm verify` exit `0` in 63,4 s.
- Limitata l'eccezione per symlink interni al solo artifact Next con mirror configurato dopo che la suite Ubuntu ha eseguito il negative test non disponibile sull'host Windows.
- Head `7c6c7071d027c55aeffbc7279b8ca3765ea26c37` verificato da worktree detached pulito: frozen install e `TURBO_FORCE=true pnpm verify` exit `0` in 66,0 s.
- Prima della pubblicazione, CI Ubuntu verde sulla PR #1 (`29254494868`), log e artifact remoto verificati; PR negativa #2 ha fallito il gate ma restava mergeable per assenza di Ruleset nel piano privato.
- Dopo la pubblicazione, run positiva `29255261423` tutta verde e PR negativa #3/run `29256736728` con tests/gate rossi, artifact skipped e `mergeStateStatus=BLOCKED`; PR chiusa senza merge e branch rimossa.
- Working tree di chiusura BL-002: `TURBO_FORCE=true pnpm verify` exit `0` in 53,9 s; front matter/link documentali, task graph, CI policy e secret scan `PASS`.
- PR #1 unita senza bypass nel commit `ae88583dc2cc8ae9d8e869f5ca324c5b3585095e`; post-merge run `29257721274` su `main` con tutti i cinque job `SUCCESS`.
- Spec baseline corrente: SHA `aa892faafb3e54b76a0a37a31d3a919c9e9f05681a64501239de9c0351322805`, inclusa l'ownership preview/staging `BL-080` e la freshness BL-079; il run BL-002 usava `5bdf152a6c535470d239ad72772603d17d53cc82cc3c02f09bf44cbe1ef47e90` prima degli aggiornamenti successivi.
- Evidenze: `AGENTS_VALIDATION.txt`; `docs/testing/BL-001_VERIFICATION.md`.
- Baseline locale iniziale BL-079: lint/typecheck exit `0`; contract UI `9/9`; Vitest `7` file e `26/26`; Playwright `37` casi applicabili passati e `123` skip condizionali; visual Windows e Linux `7/7` ciascuno; build `10/10` workspace.
- Performance BL-079: calibrazione standalone production `20/20 PASS`; quattro fasi input per campione, Event Timing massimo `40 ms`, processing `14,7 ms`, CLS `0.0000246`, nessun LoAF/long task osservato e zero violazioni; route `/` a `1.229.757` byte JS first-load non compressi, `365.057` gzip e `311.655` Brotli; Rive assente.
- BL-079 passa a `IN_REVIEW/90%/PARTIAL`: automatismi locali e CI Ubuntu del nuovo gate verdi; screen reader/device/browser reali, zoom 200%, review con cinque utenti e staging restano aperti nel report dedicato.
- Verify pre-hardening del working tree BL-079: exit `0` in `62,3 s`; unit `10` pass/`1` skip host, component `26`, integration `4`, contract `16`, security `8`, build `10/10`; artifact `3.172` file con checksum, secret scan e boot HTTP `PASS`.
- Implementation commit BL-079 `778b634ce4ef3e9a2dbe2a6b225327e2538e2ed2` verificato da working tree pulito con `TURBO_FORCE=true pnpm verify`: exit `0` in `66,1 s`, 0 cache hit e boot artifact `PASS`.
- PR #5/run `29271004267`: quality e security verdi; tests falliti chiusi sul solo performance smoke (`[83, 63]` ms e retry `[85, 53]` ms) eseguito insieme a un secondo browser; build skipped e merge gate rosso.
- Fix `a557d73b6c8cec530e67f5292c7d48f10e987c53`: contratto `9/9`, focused CI-profile `1/1` e matrice seriale `37/37` applicabili in `49,7 s`; la diagnosi solo-worker, ancora da attestare in CI, è stata poi smentita dalla run successiva.
- Verify del fix più documentazione sincronizzata: exit `0` in `74,9 s`, 0 cache hit, 10/10 workspace lint/typecheck/build, unit `10` pass/`1` skip host, component `26`, integration `4`, contract `17`, security `8` e boot HTTP artifact `PASS`.
- Seconda run PR #5 `29272004975`: quality/security verdi; tests e merge gate rossi sul solo vecchio smoke (`[59]` ms, retry `[63]`) nonostante il worker singolo; build skipped come previsto dal fan-in.
- Commit `2765c49959d6b4094367120e3615a0728a58be0a`: contract UI `9/9`, evaluator `4/4`, functional production `36` pass/`116` skip, performance `3/3`, calibrazione `20/20` e secret scan `PASS`.
- Run PR #5 `29274592866`: Quality, Tests, Security, Build artifact e `CI / Merge gate` tutti verdi; functional `36/116`, performance production `3/3` in `14,7 s`; upload diagnostico correttamente skipped sul successo e PR draft `MERGEABLE/CLEAN`.
- Sync finale BL-079: matrice Playwright production `37` pass/`123` skip in `40,3 s`; `TURBO_FORCE=true pnpm verify` exit `0` in `71,5 s` con 0 cache hit, unit `14` pass/`1` skip host, component `26`, integration `4`, contract `18`, security `8`, build `10/10`, artifact `3.172` file e boot HTTP `PASS`.
