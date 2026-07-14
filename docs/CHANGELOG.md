---
status: active
owner: engineering
last_reviewed: 2026-07-14
last_verified_commit: 1766406b9bd701a9880705b371fdc0b05a73abe1
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
  - infra/deployment/vercel-staging.json
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/deployment-smoke.mjs
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
- Autorizzato il solo piano Vercel Hobby personale/non commerciale e verificata in modo redatto l'identità esclusiva indicata dal Product Owner; creato `dnd-ai-web` (`prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`) nello scope `emacore17s-projects` e collegato a `Emacore17/dnd-ai` (repository ID `1299266814`) senza produrre deployment.
- Creati ADR-0005 proposed, `docs/operations/PREVIEW_STAGING.md` e `docs/testing/BL-080_VERIFICATION.md`.

### Changed

- Il Quality gate verifica anche il desired state deploy; `verify` include la deployment policy.
- Documentati Vercel/`fra1` come proposta reversibile, Git Integration nativa, `main` come Preview staging e `release/production` come Production Branch riservata.
- Chiarito che il web ha zero variabili applicative e che i soli metadata Vercel del health endpoint non sono secret né config di dominio.
- `BL-080` passa a `IN_PROGRESS/50%/PARTIAL`; `BL-079` resta `BACKLOG` finché project, deploy, smoke e redeploy remoti non sono provati.
- La review indipendente ha distinto action Preview `vercel.deployment.ready` da `state.type=success`, vincolato ref/repository ai metadata runtime e l'evento all'installation ID, ignorato l'URL del payload, imposto origin esatta + Standard Protection/OIDC, vietato step/job/permission drift, limitato lo streaming body e reso il Git connect a due fasi con policy di attivazione branch-closed ricorsiva `{"**": false, "main": true, "release/production": false}`; `**` evita che branch con `/` sfuggano alla deny-all.
- Il readback provider conferma Root Directory `apps/web`, Next.js, `fra1`, Fork Protection, system environment variables ed emissione OIDC abilitate, zero variabili applicative e Standard Protection con SSO predefinito `all_except_custom_domains`. Trusted Source GitHub Actions configurata con claim exact-match e installation ID `41079282` acquisito; Production Branch ancora `main`, grant App ampio (`isAccessRestricted=false`, 8 repository), origin non acquisita e blocco dell'automazione UI locale mantengono `BL-080` parziale.

### Verification

- Base `0065c012` verificata dalla CI post-merge `29315052002`, 5/5 job `SUCCESS`.
- Foundation disabilitata integrata tramite [PR #7](https://github.com/Emacore17/dnd-ai/pull/7): run PR [`29321410036`](https://github.com/Emacore17/dnd-ai/actions/runs/29321410036) e run post-merge [`29321531038`](https://github.com/Emacore17/dnd-ai/actions/runs/29321531038) entrambe 5/5 job `SUCCESS`; artifact post-merge 3.247 file.
- Full verify della foundation pre-provider PASS in 58,0 s senza cache Turbo: unit 29 pass/1 skip host, integration 9/9, contract 16/16, security 11 pass/3 skip host; artifact 3.205 file.
- Hardening corrente verificato con `TURBO_FORCE=true pnpm verify` exit `0` in 75,4 s: unit 29 pass/1 skip host, integration 9/9, contract 18/18, security 11 pass/3 skip host, deployment/task/secret policy e artifact 3.205 file `PASS`. Il checker ora confronta `apps/web/vercel.json` con il desired state e rifiuta sia la glob singola `*` sia qualunque popolamento parziale dei quattro binding provider.
- Commit hardening `1766406b9bd701a9880705b371fdc0b05a73abe1` pubblicato nella [PR #10](https://github.com/Emacore17/dnd-ai/pull/10): [run `29326093430`](https://github.com/Emacore17/dnd-ai/actions/runs/29326093430) 5/5 `SUCCESS`; readback provider post-PR ancora a zero deployment.
- `deploy:check:linked` fallisce intenzionalmente sui binding versionati ancora `null`. L'identità Vercel autorizzata e il piano Hobby risultano verificati in modo redatto, ma la lista deployment è vuota e i blocker provider impediscono di presentare il progetto collegato come staging reale.

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
