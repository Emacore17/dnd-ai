---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-17
last_verified_commit: feaf49c3d13a5ac87544d6583fc3c8e7e0457706
source_refs:
  - docs/MVP_SPEC.md#268-end-to-end
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
  - docs/TASKS.md#qa-002--browser-accessibility-e-visual-regression-harness
  - docs/product/UX_UI_DESIGN.md#13-criteri-di-verifica
  - docs/product/UX_UI_DESIGN.md#141-dipendenze-dei-task-ui
  - docs/adr/0001-mobile-first-conversational-ui.md
  - docs/superpowers/specs/2026-07-16-qa-001-test-foundation-design.md
related_tasks:
  - QA-001
  - QA-002
  - BL-079
  - BL-081
code_refs:
  - package.json
  - scripts/run-tests.mjs
  - scripts/lib/test-lane-policy.mjs
  - scripts/lib/test-report-policy.mjs
  - .github/workflows/ci.yml
test_refs:
  - tests/unit/test-lane-policy.test.mjs
  - tests/unit/test-report-policy.test.mjs
  - tests/contracts/ci-workflow.test.mjs
supersedes: null
---

# QA-002 — Design del browser harness

## 1. Decisione

Il contratto `browser-harness-v1` estende la fondazione `testing-foundation-v1` con una corsia `e2e` reale. Il runner root continua a essere l'unico punto di ingresso: costruisce `@dnd-ai/web`, avvia Playwright Chromium con ambiente allowlisted, usa il server Next standalone su una porta loopback effimera e normalizza il JUnit nello stesso artifact verificato delle altre corsie.

La soluzione usa `@playwright/test` `1.61.1` e `@axe-core/playwright` `4.12.1`, entrambi come dev dependency root. Viene installato soltanto Chromium pinato dalla versione Playwright; Firefox, WebKit, cloud browser, Vercel e staging sono fuori scope.

## 2. Approcci considerati

### A. Corsia `e2e` nel runner e nell'artifact comuni — scelto

La lane browser ha executor Playwright, ma condivide build prerequisite, isolamento dell'ambiente, timeout, report normalizzato, manifest e CI fail-closed di QA-001. In questo modo `pnpm test:e2e`, `pnpm test:all` e `pnpm verify` descrivono test realmente eseguiti e non un secondo sistema parallelo.

### B. Workflow Playwright indipendente

È escluso perché duplicherebbe installazione, report, artifact, policy di failure e check richiesto. Renderebbe inoltre possibile una PR verde nel gate principale mentre il browser workflow è rosso o non avviato.

### C. Conservare gli smoke custom di BL-081

È escluso come soluzione finale: gli smoke di feature non coprono axe, browser lifecycle, snapshot drift, touch, zoom e reduced-motion con un contratto comune. Restano test mirati utili, ma non sostituiscono QA-002.

## 3. Confine del runner

`TEST_LANES.e2e` dichiara:

- executor `playwright` e owner `QA-002`;
- pattern chiuso `tests/e2e/*.spec.mjs`;
- build filter `@dnd-ai/web`;
- concorrenza `1`, retry `0`, timeout di processo `300000 ms`;
- browser Chromium soltanto;
- output raw confinato in `test-results/testing-foundation-v1/e2e/raw`;
- JUnit normalizzato in `test-results/testing-foundation-v1/e2e/junit.xml`.

Il runner sceglie una porta libera, la chiude prima dello spawn e passa soltanto `HOSTNAME=127.0.0.1`, `PORT`, `PLAYWRIGHT_JUNIT_OUTPUT_FILE` e l'ambiente già allowlisted da QA-001. `reuseExistingServer` è sempre `false`: una collisione o un server estraneo produce errore, mai riuso silenzioso.

Il comando normale non crea snapshot mancanti. L'aggiornamento delle baseline usa una superficie esplicita locale, rifiutata quando `CI` è attivo. Browser assente, config invalida, server non pronto, crash e report mancante mantengono exit non-zero.

## 4. Server locale e browser

Playwright avvia l'output standalone già costruito di Next e attende `/health` con polling bounded. Non usa `next dev`, rete esterna, provider o valori `.env`. Il processo viene terminato da Playwright anche dopo test falliti; il runner conserva come successo soltanto un exit code Playwright `0` seguito da report valido.

La CI installa `playwright install --with-deps chromium` dopo il frozen install. Non viene aggiunta una cache browser perché la policy CI consente soltanto lo store pnpm lockfile-scoped. La toolchain locale espone anche `playwright install chromium` per il primo setup.

## 5. Matrice funzionale

La shell reale `/` viene verificata su Chromium headless con:

| Profilo | Viewport | Touch | Obiettivo |
|---|---:|---:|---|
| small-mobile | 320×800 | no | minimo funzionale, composer e HUD raggiungibili |
| phone-touch | 390×844 | sì | baseline mobile e tap reale |
| desktop | 1440×900 | no | progressive enhancement senza funzioni esclusive |

La suite prova overflow orizzontale assente, target da almeno 44 px e CTA primaria da almeno 48 px, invio libero, scelta suggerita, apertura/chiusura drawer con focus restore, ordine tastiera, zoom CSS 200%, safe-area bottom simulata a 34 px e contenuto equivalente con `prefers-reduced-motion: reduce`.

Non vengono introdotte nuove fixture applicative: la home usa lo stesso `createInitialGameShellState()` e lo stesso `FIXTURE_TURN_SOURCE` di BL-081.

## 6. Accessibility

Una fixture Playwright comune costruisce `AxeBuilder` con tag WCAG A/AA supportati e scansiona la shell dopo font readiness e stabilizzazione dello stato. Qualsiasi violazione con impatto `critical` o `serious`, e qualsiasi violazione dei tag A/AA selezionati, fallisce il test.

Il negative path usa `page.setContent()` con un controllo intenzionalmente privo di nome accessibile. Non aggiunge route o componente al prodotto: prova che la stessa funzione di assertion riconosca la violazione `button-name` e blocchi il gate. L'automazione non viene presentata come sostituto di tastiera, focus, zoom o test con utenti.

## 7. Regressione visuale

`toHaveScreenshot()` verifica la shell iniziale a 320, 390 e 1440 px dopo `document.fonts.ready`, con caret nascosto e animazioni disabilitate. Le baseline PNG sono versionate sotto `tests/e2e/__screenshots__/{platform}` e usano confronto pixel-exact sulla stessa piattaforma.

Windows e Linux hanno baseline distinte perché font rasterization e rendering differiscono per host. Le baseline Linux vengono generate nel container Playwright ufficiale con tag uguale alla dipendenza; la CI Ubuntu usa esclusivamente i PNG Linux. Un comando normale non aggiorna file: snapshot mancante o differente fallisce.

Tracce, video e raw accessibility payload non vengono caricati. In caso di failure Playwright può creare actual/diff nella directory ignorata locale, ma l'artifact CI pubblico resta il solo JUnit normalizzato e redatto di `testing-foundation-v1`.

## 8. Failure path

Una spec di auto-verifica esegue tre fixture escluse dalla discovery normale e richiede exit non-zero per:

1. `webServer` che termina prima della readiness;
2. browser Chromium chiuso prima di una successiva operazione pagina;
3. snapshot testuale intenzionalmente diverso dalla baseline versionata.

Il test principale resta verde soltanto quando tutti e tre i processi figli falliscono come previsto. Output e durata sono bounded; nessun retry converte una failure in successo.

## 9. CI, report e performance

Il job `Tests` installa Chromium una volta, mantiene le quattro corsie non-security esistenti, aggiunge `pnpm test:e2e` e prepara/verifica l'artifact con `e2e`. `CI / Merge gate` continua a dipendere dallo stesso job, quindi non cambia il nome del check protetto.

La lane usa un solo worker e un solo browser per minimizzare RAM e variabilità. Le verifiche della matrice riusano pagine/contesti quando l'isolamento lo consente; i tre subprocess negativi sono piccoli e senza server applicativo salvo il caso readiness. Il target è mantenere l'incremento CI sotto due minuti, senza retry né cache browser non autorizzate.

## 10. Sicurezza e fuori scope

Sono vietati: URL remoti, credenziali, `.env`, reuse di server locali, HTML AI trusted, upload di trace/video/raw axe, browser cloud, DAST, provider, preview, staging e azioni Vercel. I path test/snapshot/report devono essere regolari, non symlink e confinati nel repository.

Restano fuori scope cambi a componenti shadcn/AI Elements/Motion, nuovi journey identity o campagna, Safari/Firefox, device farm, performance lab, smoke remoto e test utente. Un finding reale della shell scoperto dal nuovo harness viene corretto soltanto se necessario al criterio QA-002; altrimenti riceve un task separato.

## 11. Definition of Done

QA-002 può diventare `DONE` quando:

- `test:e2e` è una corsia reale nel runner/report comuni;
- matrice 320/390/1440 e touch è verde;
- tastiera/focus, zoom 200%, safe-area e reduced-motion sono verdi;
- axe passa sulla shell e la fixture negativa fallisce;
- baseline Windows/Linux passano in due run consecutive e il drift intenzionale resta rosso;
- server failure e browser crash propagano exit non-zero;
- workflow, artifact e secret policy sono verificati;
- test mirati, un solo full `verify`, checkout pulito e CI protetta passano;
- nessuna azione Vercel è stata eseguita.
