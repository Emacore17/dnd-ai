---
status: active
owner: engineering
last_reviewed: 2026-07-14
last_verified_commit: 13032743552654f9f68d87050eb11cabbdd92325
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md
related_tasks:
  - GOV-001
  - BL-001
  - BL-002
  - BL-003
  - BL-079
  - BL-080
code_refs:
  - .github/workflows/ci.yml
  - scripts/lib/build-artifact.mjs
  - scripts/lib/ci-workflow-policy.mjs
  - packages/config
  - apps/api/src/runtime.ts
  - apps/worker/src/runtime.ts
  - scripts/lib/secret-scanner.mjs
  - .github/workflows/deployment-smoke.yml
  - apps/web/app/health/route.ts
  - apps/web/vercel.json
  - apps/web/package.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - .vercelignore
  - infra/deployment/vercel-staging.json
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-smoke.mjs
  - turbo.json
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/ci-workflow.test.mjs
  - tests/unit/build-artifact.test.mjs
  - tests/unit/runtime-config.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/security/environment-file-policy.test.mjs
  - docs/testing/BL-003_VERIFICATION.md
  - tests/unit/deployment-smoke.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
  - docs/testing/BL-080_VERIFICATION.md
supersedes: null
---

# Changelog documentale e contrattuale

## 2026-07-14

### Added

- Avviato `BL-080` da `main` dopo il merge verificato di BL-003; creato il desired state `staging-foundation-v1` per il solo web.
- Aggiunti `apps/web/vercel.json`, Route Handler `/health` con contratto `web-health-v1`, workflow `Staging smoke` e verifier redatto con OIDC breve, senza credenziali Vercel persistenti in Actions.
- Aggiunte suite unit, standalone integration, contract e security per origin/installation identity, OIDC, regione, timeout, failure propagation e leakage.
- Creato l'environment GitHub `staging`, limitato a `main`, senza bypass amministratore, secret o variabili.
- Creata la branch riservata `release/production` da `ef803add249d16ded6f94936c59531047c8a92fa` e protetta con la Ruleset dedicata `18926413`, attiva e senza bypass; la Ruleset `main-required-ci` `18877721` è rimasta invariata.
- Autorizzato il solo piano Vercel Hobby personale/non commerciale e verificata in modo redatto l'identità esclusiva indicata dal Product Owner; creato `dnd-ai-web` (`prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`) nello scope `emacore17s-projects` e collegato a `Emacore17/dnd-ai` (repository ID `1299266814`) senza produrre deployment.
- Creati ADR-0005 proposed, `docs/operations/PREVIEW_STAGING.md` e `docs/testing/BL-080_VERIFICATION.md`.
- Aggiunti `.vercelignore` root-only e un checker JSON del dry-run Vercel con output statico, budget sorgente e allowlist degli input obbligatori.

### Changed

- Il Quality gate verifica anche il desired state deploy; `verify` include la deployment policy.
- Documentati Vercel/`fra1` come proposta reversibile, Git Integration nativa, `main` come Preview staging e `release/production` come Production Branch riservata.
- Chiarito che il web ha zero variabili applicative e che i soli metadata Vercel del health endpoint non sono secret né config di dominio.
- `BL-080` passa a `IN_PROGRESS/50%/PARTIAL`; `BL-079` resta `BACKLOG` finché project, deploy, smoke e redeploy remoti non sono provati.
- La review indipendente ha distinto action Preview `vercel.deployment.ready` da `state.type=success`, vincolato ref/repository ai metadata runtime e l'evento all'installation ID, ignorato l'URL del payload, imposto origin esatta + Standard Protection/OIDC, vietato step/job/permission drift, limitato lo streaming body e reso il Git connect a due fasi con policy di attivazione branch-closed ricorsiva `{"**": false, "main": true, "release/production": false}`; `**` evita che branch con `/` sfuggano alla deny-all.
- Un readback provider intermedio ha confermato Root Directory `apps/web`, Next.js, `fra1`, Fork Protection, system environment variables ed emissione OIDC abilitate, zero variabili applicative e Standard Protection con SSO predefinito `all_except_custom_domains`. In quel checkpoint la Trusted Source GitHub Actions era configurata con claim exact-match e installation ID `41079282` acquisito, mentre Production Branch Vercel ancora `main` e alias branch non registrato mantenevano `BL-080` parziale.
- Allineata la sequenza di attivazione: l'alias branch documentato viene versionato atomicamente prima del merge, poi il primo deployment deve materializzare e confermare la stessa origin; l'URL del dispatch resta ignorato.
- Registrata la decisione esplicita del Product Owner di non restringere l'installation GitHub App condivisa `41079282` (`isAccessRestricted=false`, 8 repository), perché si perderebbe accesso ad altri progetti. Il grant non è più un blocker: il rischio residuo è accettato con link project/repository/ID esatti, Trusted Source OIDC exact-match, Fork/Standard Protection, deny-all Git ricorsiva con solo `main`, environment `staging` limitato a `main`, smoke fail-closed e readback drift come controlli compensativi.
- Riletta Vercel Production Branch=`release/production` con zero deployment; il blocker pre-attivazione è chiuso senza cambiare account, piano o grant condiviso.
- Preparato il change set `codex/bl-080-enable-preview`: project ID, scope, origin main e installation ID sono registrati atomicamente; `source.autoDeploy=true` coincide con `git.deploymentEnabled={"**": false, "main": true, "release/production": false}` e il Quality gate usa `deploy:check:linked`. La PR resta deny-all e non deve produrre deploy; l'origin sarà materializzata solo dal merge protetto su `main`.
- Resi adattivi i negative test di drift attivazione e binding all-or-none, così restano efficaci sia nella foundation disabilitata sia nello stato linked.
- Integrata l'attivazione tramite PR #12 dopo CI 5/5 verde e zero deployment sulla PR; il primo deploy del merge `c64d095` è stato però classificato Production da Vercel nonostante Production Branch=`release/production`.
- Il deployment ha raggiunto `success` e ricevuto alias prima della rimozione; il dispatch `ready` è stato rifiutato dal job smoke. Deployment e alias project-scoped sono poi tornati a zero e gli URL a `404`.
- Integrato il contenimento `codex/bl-080-fail-closed-hotfix` tramite commit `4d3d4ba`, PR #13 e merge `61e5cbd`: binding versionati `null`, `source.autoDeploy=false`, `git.deploymentEnabled=false`, Quality gate `deploy:check` e negative test pre-attivazione sono nuovamente la baseline sicura. CI PR e post-merge sono 5/5 verdi; nessun nuovo dispatch o deployment è stato osservato. `BL-080` resta `IN_PROGRESS/50%/FAILING`; ADR-0005 resta proposed e `BL-079` BACKLOG.
- Aggiunto un guard build Preview-only dentro `apps/web`: il percorso Vercel strict richiede `VERCEL=1`, `VERCEL_ENV=preview` e `VERCEL_TARGET_ENV=preview`, mentre il normale build locale accetta soltanto l'assenza completa dei tre metadata. `vercel.json` impone il guard prima di `pnpm run build`; Turbo include i tre metadata nella cache key e il deployment contract rifiuta qualunque drift del comando.
- Chiarito che il guard impedisce a un target non-Preview di completare il build, ma non impedisce al provider di creare inizialmente un deployment record. Il futuro bootstrap resta diagnostico one-shot con selector CLI `--target=preview`, `--no-wait`, inspect immediato, rimozione per deployment ID esatto e auto-deploy Git spento; `--skip-domain` è escluso perché richiede `--prod`, mentre `--prod`, `--prebuilt` e promote restano vietati.
- Integrato il guard tramite PR #14/merge `ee5f129` con CI PR `29335696502` e post-merge `29335856323` 5/5 verdi e zero deployment. Il primo bootstrap successivo è terminato sul limite file prima di creare una delivery, perché `.turbo` portava il payload a 773,1 MiB e conteneva un file oltre il limite Hobby di 100 MB.
- Il retry Preview ora richiede prima un dry-run ufficiale dalla root del monorepo e il suo passaggio nel checker: Next.js/root/input obbligatori regolari con hash valido, mode file/directory zero-byte, massimo 10 MiB complessivi, 5 MiB per file, 15.000 entry e nessun symlink o discendente cache/output/env. `--cwd apps/web`, `--archive` come workaround, override project-level, `--prebuilt`, Production e promote sono vietati.

### Verification

- Base `0065c012` verificata dalla CI post-merge `29315052002`, 5/5 job `SUCCESS`.
- Foundation disabilitata integrata tramite [PR #7](https://github.com/Emacore17/dnd-ai/pull/7): run PR [`29321410036`](https://github.com/Emacore17/dnd-ai/actions/runs/29321410036) e run post-merge [`29321531038`](https://github.com/Emacore17/dnd-ai/actions/runs/29321531038) entrambe 5/5 job `SUCCESS`; artifact post-merge 3.247 file.
- Full verify della foundation pre-provider PASS in 58,0 s senza cache Turbo: unit 29 pass/1 skip host, integration 9/9, contract 16/16, security 11 pass/3 skip host; artifact 3.205 file.
- Hardening corrente verificato con `TURBO_FORCE=true pnpm verify` exit `0` in 75,4 s: unit 29 pass/1 skip host, integration 9/9, contract 18/18, security 11 pass/3 skip host, deployment/task/secret policy e artifact 3.205 file `PASS`. Il checker ora confronta `apps/web/vercel.json` con il desired state e rifiuta sia la glob singola `*` sia qualunque popolamento parziale dei quattro binding provider.
- Commit hardening `1766406b9bd701a9880705b371fdc0b05a73abe1` pubblicato nella [PR #10](https://github.com/Emacore17/dnd-ai/pull/10): [run `29326093430`](https://github.com/Emacore17/dnd-ai/actions/runs/29326093430) 5/5 `SUCCESS`; readback provider post-PR ancora a zero deployment.
- Readback GitHub post-creazione: `release/production` punta alla base `ef803add249d16ded6f94936c59531047c8a92fa`, Ruleset dedicata `18926413` attiva senza bypass, Ruleset `main` `18877721` e environment `staging` invariati; il readback Vercel resta a zero deployment.
- Checkpoint documentale e normativo verificato con `TURBO_FORCE=true pnpm verify` exit `0` in 70,8 s: unit 29 pass/1 skip host, integration 9/9, contract 18/18, security 11 pass/3 skip host, task/deploy policy, secret scan e artifact 3.205 file `PASS`.
- Nel checkpoint pre-attivazione `deploy:check:linked` falliva intenzionalmente sui binding versionati ancora `null`. L'identità Vercel autorizzata e il piano Hobby risultavano verificati in modo redatto, ma la lista deployment era vuota e i blocker provider impedivano di presentare il progetto collegato come staging reale.
- Checkpoint di attivazione: CLI Vercel `55.0.0` mostra `Production → release/production` e zero deployment; audit GitHub conferma Ruleset release `18926413`, Ruleset main `18877721` ed environment `staging` senza drift. `TURBO_FORCE=true corepack pnpm@10.34.5 verify` passa in 65,3 s con lint/build 11/11, typecheck 12/12, unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host, policy/secret scan e artifact 3.205 file; PR e prove remote restano pending.
- PR #12: run `29331343752` e post-merge `29331482831` 5/5 `SUCCESS`; deployment Production confermato anche da GitHub deployment `5440323678`/status `success`; smoke run `29331534774` `skipped`; Vercel deletion alle `2026-07-14T12:10:52.918Z` e readback finale deployment/alias zero.
- Hotfix fail-closed verificato localmente con `TURBO_FORCE=true corepack pnpm@10.34.5 verify` PASS in 61,0 s: unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host, policy/scan/artifact 3.205 file.
- Contenimento pubblicato nella [PR #13](https://github.com/Emacore17/dnd-ai/pull/13): run PR `29332953627` e post-merge `29333105276` con 5/5 job `SUCCESS`; merge `61e5cbd2c3c1c258769fef6b3ad89853d7b7ca61`; readback successivo con zero deployment e nessun nuovo smoke dispatch.
- Guard Preview-only mirato: unit 4/4, security subprocess 3/3 e deployment contract 5/5 `PASS`; `deploy:check`, task graph, ESLint e Prettier mirati `PASS`. La simulazione Production, anche con `--allow-local`, termina con exit `1`/`target-not-preview` prima di Next; la simulazione Preview completa il build Next.js `16.2.10` e genera `/health`. Le review indipendenti finali non rilevano P0/P1/P2 residui.
- Full gate del guard: `TURBO_FORCE=true corepack pnpm@10.34.5 verify` exit `0` in 60,2 s sul diff e in 57,1 s sul commit pulito `519052649c88d84c45da92c3b35131819291a73a`; unit 33 pass/1 skip host, integration 9/9, contract 18/18, security 14 pass/3 skip host, policy/scan/artifact verdi.
- Policy payload mirata: TDD rosso su moduli mancanti; 14/14 test unit/security/contract verdi, `deploy:check` ed ESLint mirati PASS. Il dry-run Vercel `55.0.0` passa il checker con 158 entry, 1.093.594 byte, file massimo 263.569 byte e deployment list ancora vuota.
- Full gate della policy payload: `TURBO_FORCE=true corepack pnpm@10.34.5 verify` exit `0` in 69,1 s sul diff e in 56,2 s sul commit pulito `13032743552654f9f68d87050eb11cabbdd92325`, sempre senza cache; unit 39 pass/1 skip host, integration 9/9, contract 18/18, security 17 pass/3 skip host, policy/scan/artifact verdi. Le review indipendenti finali non rilevano P0/P1/P2 residui.

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
- Aggiunto `BL-080` in M0 per possedere provisioning e primo smoke preview/staging; `BL-003` ne fornisce il contratto di configurazione e `BL-070` resta dedicato all'hardening pre-release.
- Aggiunto `@dnd-ai/config` con Zod 4, profili API/worker/migration, CLI redatta, output frozen e config error senza valori/cause.
- Aggiunti startup API validate-before-bind, composition boundary worker, template `.env.example` service-scoped e ADR-0004.
- Creati `docs/operations/CONFIGURATION.md` e `docs/testing/BL-003_VERIFICATION.md`; aggiunte suite unit, process integration, contract e security per `BL-003`.

### Changed

- Corretti i link fra `AGENTS.md`, `docs/MVP_SPEC.md` e `docs/TASKS.md`; il path canonico del backlog è `docs/TASKS.md`.
- Allineata la specifica da desktop-first a mobile-first: 320 px minimo funzionale, 360–430 px baseline primaria, desktop come progressive enhancement.
- Resi normativi feed conversazionale, composer sticky, HUD on demand, target touch, safe area, tastiera virtuale, reduced-motion e stile contemporaneo non pseudo-medievale.
- Selezionati shadcn/ui `new-york` con Radix, AI Elements come presentational layer e Motion come motion layer; Rive resta opzionale e subordinato a performance gate.
- Estesi backlog, test UI e gate M0 per includere mobile matrix, accessibility, visual regression e performance trace.
- Resi espliciti `BL-079` e i riferimenti UX/ADR in ogni task che modifica UI; sostituite le dipendenze differite testuali con task/gate verificabili.
- Chiarita l’ownership: `BL-079` crea il browser harness minimo di feature, `QA-001` lo consolida senza blocco circolare.
- Aggiunto un override pnpm a `postcss@8.5.10` per correggere il finding moderato transitivo `GHSA-qx2v-qp2m-jg93`; audit successivo senza vulnerabilità note.
- Il quality contract locale ora include format, unit, integration, contract, security, workflow policy, build e artifact verification; le suite future restano assegnate ai task proprietari.
- Attivata sul repository pubblico la Ruleset `main-required-ci` (`18877721`), strict e senza bypass, con `CI / Merge gate` richiesto da GitHub Actions; `BL-002` passa a `DONE` e `BL-079` a `READY`.
- Corrette le dipendenze di `BL-079`: il primo staging non è più un gate senza owner, ma una dipendenza esplicita da `BL-080`; `BL-003` resta il task attivo e la foundation UX/UI non viene anticipata in questo change set.
- Precisata la DoD: un prerequisito del primo ambiente può chiudere con evidence local/contract motivata, mentre `BL-080` possiede il primo deploy/smoke reale.
- `BL-004` dipende da `BL-003` per il profilo migration; `config` è un leaf server-only importabile solo dai composition root API/worker.
- Il minimo Node passa a `>=22.12.0`; `typecheck` costruisce prima le declaration delle dipendenze workspace per funzionare da checkout pulito.
- Staging/production richiedono URL strutturali, credenziali service-scoped, PostgreSQL TLS con un solo `sslmode` allowlisted e Redis `rediss:`.
- Il secret scanner rifiuta qualsiasi `.env`/`.env.*` tracciato salvo `.env.example`, anche senza pattern token noto, e scopre file untracked/speciali mediante traversal Git-ignore-aware senza seguire symlink o junction.
- Il packager omette soltanto i private-hoist pnpm non tracciati e privi di mirror nell'output Next standalone; target esterni e link ordinari senza mirror restano fail-closed.
- `BL-003` passa a `DONE`; `BL-080` diventa il prossimo task `READY`, mentre `BL-079` resta `BACKLOG` fino alla disponibilità dello staging.

### Verification

- Repository: Git `main`; implementation commit BL-001 `6cda07a60022665f321b48dd82fbeb1d9bef586f`.
- BL-002: gate locali `PASS`, evidenze remote e commit di implementazione ancora in chiusura; report `docs/testing/BL-002_VERIFICATION.md`.
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
- La prima CI BL-003, run `29285442650` su `4622d5c`, ha fallito Security `11/12` perché il solo indice Git non enumerava un FIFO untracked; Build artifact è stato saltato e il merge gate ha fallito. Il failure path ha prodotto il fix ignore-aware `f571413`.
- BL-003 verificato su head `f57141341efe5df0707c77ff8ccef4f6fa15f675`: full verify locale exit `0` in `60,4 s`, artifact `3.191` file; worktree pulito con install frozen forzata exit `0` e verify exit `0` in `61,0 s`, artifact `3.554` file. Il primo install frozen nel worktree era un no-op e il verify preliminare ha fallito per dipendenze non materializzate; non è stato contato come gate applicativo.
- Run finale `29285998646`: Quality, Tests, Security, Build artifact e `CI / Merge gate` tutti `SUCCESS`; Security Linux `12/12`, artifact Ubuntu `3.233` file e PR #6 `MERGEABLE/CLEAN`; audit senza vulnerabilità note.
- Spec baseline corrente: SHA `0b7ce963316cb601c7178340876de1b8932bc63b7c672adb1b37554d3b139f0c`; include il contratto config e l'ownership staging `BL-080`, senza evidenze d'implementazione `BL-079`.
- Evidenze: `AGENTS_VALIDATION.txt`; `docs/testing/BL-001_VERIFICATION.md`.
