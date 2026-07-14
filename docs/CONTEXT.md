---
status: active
owner: engineering
last_reviewed: 2026-07-14
last_verified_commit: ef803add249d16ded6f94936c59531047c8a92fa
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
  - apps
  - packages
  - packages/config
  - apps/api/src/runtime.ts
  - apps/worker/src/runtime.ts
  - scripts/lib/workspace-boundaries.mjs
  - scripts/lib/task-graph.mjs
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/lib/build-artifact.mjs
  - scripts/lib/secret-scanner.mjs
  - infra/deployment/vercel-staging.json
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
  - apps/web/app/health/route.ts
  - .github/workflows/deployment-smoke.yml
  - scripts/lib/deployment-smoke.mjs
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/unit/build-artifact.test.mjs
  - tests/security/sast-config.test.mjs
  - tests/security/secret-scanner.test.mjs
  - docs/testing/BL-002_VERIFICATION.md
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

# Contesto operativo corrente

## Baseline verificata

| Campo | Valore |
|---|---|
| Data assoluta | 2026-07-14 |
| Repository | GitHub pubblico `Emacore17/dnd-ai`; remote `origin` collegato durante `BL-002` |
| Delivery/commit | foundation applicativa integrata tramite PR #7 nel merge `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578`; hardening branch-closed integrato tramite PR #10 su `main` a `ef803add249d16ded6f94936c59531047c8a92fa`; provider riletto a zero deployment |
| Specifica canonica | `docs/MVP_SPEC.md` |
| SHA-256 specifica | `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c` |
| Milestone | `M0 — Fondamenta` |
| Task attivo | `BL-080 — IN_PROGRESS/50%/PARTIAL` |
| Ultimo task completato | `BL-003 — DONE/100%/PASSING` |
| Prossimo task READY | `—`; `BL-079` resta `BACKLOG` fino alla chiusura di `BL-080` |
| Stato programma | `IN_PROGRESS` |

## Stato reale del repository

`BL-001` ha creato il workspace pnpm/Turborepo con tre app; il repository contiene otto package condivisi dopo l'aggiunta di `config`. `BL-002` ha verificato pipeline, artifact, failure path e Ruleset. `BL-003` implementa `runtime-config-v1` ed è integrato in `main`. Il web Next è l'unico runtime oggi deployabile; API e worker non hanno container/daemon. La foundation disabilitata di `BL-080` è integrata in `main` tramite PR #7 e l'hardening branch-closed tramite PR #10 nel commit `ef803add249d16ded6f94936c59531047c8a92fa`: desired state Vercel, health contract e workflow smoke sono quindi presenti sulla default branch. Il Product Owner ha autorizzato il solo piano Hobby personale/non-commerciale, la sola identità Vercel esclusiva verificata in forma redatta e GitHub `Emacore17`; account alternativi, acquisti e upgrade restano vietati. Il project `dnd-ai-web` (`prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`) nello scope `emacore17s-projects` è collegato a `Emacore17/dnd-ai` (`repository_id=1299266814`) con root `apps/web`, Next.js, `fra1`, fork protection, system env/OIDC e Standard Protection predefinita; contiene zero env applicative e zero deploy. La Trusted Source GitHub Actions è configurata e riletta con audience, repository/repository ID, ref, environment e target `preview` esatti. Project ID, scope e installation ID `41079282` sono reali; l'origin resta `null`. Su decisione esplicita del Product Owner l'installazione GitHub App condivisa resta invariata (`isAccessRestricted=false`, 8 repository), perché restringerla toglierebbe accesso ad altri progetti: il perimetro più ampio è un rischio residuo accettato, mitigato da link project/repository esatto, Trusted Source exact-match, environment protetto e policy Git branch-closed. Il branch `release/production` è stato creato da `main` a `ef803add249d16ded6f94936c59531047c8a92fa` e protetto dalla Ruleset dedicata `release-production-required-ci` (`18926413`) con `CI / Merge gate` strict e `current_user_can_bypass=never`; la Ruleset main `18877721` e GitHub environment `staging` restano invariati. La Production Branch Vercel riletta è ancora `main`, auto-deploy resta disabilitato e non esiste alcun deployment. `BL-079` resta fuori scope e bloccato fino allo staging reale.

## Decisioni operative vigenti

- Modular monolith TypeScript con `apps/web`, `apps/api`, `apps/worker` e package separati secondo `AGENTS.md` §9.
- PostgreSQL/backend deterministico sono la fonte della verità; l’AI propone e narra.
- REST per comandi/query iniziali, SSE per progress e delivery; idempotenza e `stateVersion` restano obbligatori.
- UI mobile-first e conversation-first; desktop come progressive enhancement.
- shadcn/ui `new-york` su Radix; AI Elements solo presentational layer; Motion per micro-interazioni; Rive opzionale e performance-gated.
- Visual language premium contemporaneo per casual gamer, senza chrome pseudo-medievale/fantasy.
- Workspace e direzioni di dipendenza secondo ADR-0002; manifest/import/cicli falliscono chiuso tramite checker versionato.
- Configurazione runtime server-only validata ai composition root; nessun valore secret nel client, nei default, nei log o nei documenti. ADR-0004 accepted durante `BL-003`.
- Preview/staging web in preparazione su Vercel Hobby con Root Directory `apps/web`, compute `fra1`, Git Integration nativa e policy futura `{"**": false, "main": true, "release/production": false}`; project/link e Trusted Source exact-match esistono. Il grant condiviso `41079282` non viene ristretto per decisione esplicita del Product Owner ed è trattato come rischio residuo accettato con controlli compensativi project-level. L'attivazione resta chiusa finché la Production Branch Vercel non è impostata e riletta come `release/production`; ADR-0005 resta proposed fino alle prove remote complete.

Decisioni vigenti: [`ADR-0001`](adr/0001-mobile-first-conversational-ui.md), [`ADR-0002`](adr/0002-monorepo-package-boundaries.md), [`ADR-0003`](adr/0003-ci-trust-boundary-and-artifacts.md) e [`ADR-0004`](adr/0004-runtime-configuration-and-secret-injection.md). ADR-0005 è [`proposed`](adr/0005-vercel-web-preview-and-staging.md). Contratto di design: [`UX_UI_DESIGN.md`](product/UX_UI_DESIGN.md). Configurazione operativa: [`CONFIGURATION.md`](operations/CONFIGURATION.md) e [`PREVIEW_STAGING.md`](operations/PREVIEW_STAGING.md). Architettura implementata: [`SYSTEM_OVERVIEW.md`](architecture/SYSTEM_OVERVIEW.md).

## Versioni e head

| Elemento | Versione/head | Stato |
|---|---|---|
| Migration head | `N/A` | package persistence presente come scaffold; migration non implementate |
| Contract/API/event schema | `N/A` | package contracts presente come scaffold; schema non implementati |
| Rules version | `N/A` | package rules presente come scaffold; cataloghi/formule non implementati |
| Prompt version | `N/A` | package AI presente come scaffold; prompt/provider non implementati |
| Eval suite version | `N/A` | harness non creato |
| Runtime config contract | `runtime-config-v1` | parser/config CLI e composition root implementati; test mirati PASS; nessun secret reale |
| Deploy/health contract | `staging-foundation-v1` / `web-health-v1` | project Vercel, link Git, installation ID e Trusted Source reali; locale PASS; GitHub environment protetto e invariato; grant condiviso accettato con compensazioni; auto-deploy spento, Production Branch Vercel/origin/binding/deploy pending |
| Design contract | `ux-ui-2026-07-13` | documentato, non implementato |
| ADR UI | `ADR-0001 accepted` | vigente |
| Toolchain | Node `24.11.0` (engine `>=22.12.0`); pnpm `10.34.5`; Turbo `2.10.4`; TypeScript `6.0.3` | pinning e lockfile presenti |
| Web/API | Next `16.2.10`; React `19.2.7`; Fastify `5.10.0` | web scaffold; API senza route ma con startup validate-before-bind |
| Package boundary policy | `boundary-policy-v1` | checker + fixture negativa presenti |
| Task graph policy | `task-graph-v1` | ID, range, status, parity spec e consumer UX verificati |
| CI policy | `ci-policy-v1` | gate base + `deploy:check`; workflow smoke separato con `contents: read`, OIDC breve e step allowlisted su repository dispatch; post-merge BL-003 run `29315052002` 5/5 job PASS |
| Main Ruleset | `main-required-ci` / `18877721` | active, strict, PR richiesta, nessun bypass; check GitHub Actions `integration_id=15368` |
| Release Ruleset | `release-production-required-ci` / `18926413` | branch `release/production` creato da `ef803add249d16ded6f94936c59531047c8a92fa`; active, `CI / Merge gate` strict, `current_user_can_bypass=never`; Ruleset main invariata |
| Artifact schema | `build-artifact-v1` | baseline remota BL-002 `3.205` file; checkout pulito BL-003 `3.554` file e CI Ubuntu `3.233` file, secret/checksum verification PASS |

## Comandi disponibili

Sono disponibili i comandi locali del perimetro `BL-001`/`BL-002`/`BL-003`:

```powershell
corepack pnpm@10.34.5 lint
corepack pnpm@10.34.5 typecheck
corepack pnpm@10.34.5 build
corepack pnpm@10.34.5 format:check
corepack pnpm@10.34.5 test:unit
corepack pnpm@10.34.5 test:integration
corepack pnpm@10.34.5 test:contract
corepack pnpm@10.34.5 test:security
corepack pnpm@10.34.5 boundaries:check
corepack pnpm@10.34.5 tasks:check
corepack pnpm@10.34.5 ci:workflow:check
corepack pnpm@10.34.5 deploy:check
corepack pnpm@10.34.5 deploy:check:linked
corepack pnpm@10.34.5 deploy:smoke
corepack pnpm@10.34.5 scan:sast
corepack pnpm@10.34.5 scan:secrets
corepack pnpm@10.34.5 artifact:prepare
corepack pnpm@10.34.5 artifact:verify
corepack pnpm@10.34.5 config:check
corepack pnpm@10.34.5 verify
```

E2E, eval, bot, load, migration e il test harness container/browser completo restano pianificati nei task proprietari, soprattutto `QA-001`; non vanno sostituiti da no-op.

Verifiche documentali manuali correnti:

```powershell
Get-FileHash -Algorithm SHA256 docs\MVP_SPEC.md
Get-ChildItem -Recurse -Filter *.md
```

Il report riproducibile di `GOV-001` è `AGENTS_VALIDATION.txt`.

## Decisioni aperte

Le decisioni `OD-01..OD-20` restano in `docs/MVP_SPEC.md` §34. Quelle che possono bloccare M0 sono soprattutto:

- `OD-07` auth build vs managed;
- `OD-08` regione dati/telemetry.
- Production Branch Vercel da impostare e rileggere come `release/production`; il branch GitHub e la Ruleset dedicata esistono già. La Trusted Source OIDC è exact-match e il piano/account Vercel Hobby è autorizzato soltanto per uso personale/non commerciale e con identità esclusiva. L'installazione condivisa `41079282` non viene ristretta per decisione PO e resta un rischio residuo accettato, non una decisione aperta.

Il dettaglio cromatico finale e l’eventuale uso di Rive non sono blocchi di prodotto: `BL-079` deve validarli tramite contrast/performance gate e può scegliere il fallback più semplice.

## Rischi correnti

| ID | Rischio | Mitigazione/owner |
|---|---|---|
| CTX-R02 | `tasks:check` copre il grafo, non l’intero `docs:check` | `GOV-002` estende a link/front matter/Mermaid/generated drift |
| CTX-R03 | App e package di dominio restano scaffold; il web non contiene ancora la foundation UX/UI | task M0 proprietari; non inferire comportamento applicativo dalle entry point minime |
| CTX-R04 | Mobile UX potrebbe essere implementata tardi | `BL-079` resta in M0 e dipende dalla foundation operativa `BL-080` |
| CTX-R05 | Motion/Rive possono degradare device mobili | Motion lazy/reduced e Rive gated o rimosso nel task `BL-079` |
| CTX-R11 | Preview/staging M0 non è ancora disponibile; `BL-070` arriverebbe troppo tardi | `BL-080` è `IN_PROGRESS` e deve creare l'ambiente prima di sbloccare lo smoke BL-079/GATE-M0 |
| CTX-R13 | Config errata o troppo ampia può esporre credenziali fra servizi o negli errori | `BL-003` usa parser service-scoped, messaggi redatti, template separati e scanner path-based/ignore-aware |
| CTX-R14 | Il project Vercel collegato espone ancora Production Branch=`main`; l'installazione condivisa `41079282` vede 8 repository e non può essere ristretta senza togliere accesso ad altri progetti | Production Branch GitHub separata e Ruleset `18926413` strict/no-bypass; Trusted Source exact-match, link project/repository esatto, environment `staging` protetto e policy branch-closed compensano il grant condiviso accettato dal PO. `git.deploymentEnabled=false`; non attivare finché Vercel non rilegge Production Branch=`release/production` |

## Prossima azione

Mantenere il project collegato senza deploy e, usando esclusivamente l'identità autorizzata, impostare/rileggere in Vercel Production Branch=`release/production`: è l'unico blocker provider pre-attivazione. Il branch GitHub e la Ruleset dedicata sono già pronti; Trusted Source, Ruleset main ed environment `staging` vanno preservati. I tentativi di automazione non hanno modificato il provider: il runtime browser ha restituito `Cannot redefine property: process` e il fallback Windows `GetCursorPos failed: Accesso negato. (0x80070005)`. Dopo il readback registrare atomicamente installation ID e alias branch deterministico documentato, quindi abilitare `main` con un secondo change set/PR che non distribuisce dalla PR; il primo deployment deve materializzare e confermare la stessa origin. Dopo il merge provare Preview, smoke, failure senza promozione e redeploy dello stesso SHA; `BL-079` inizierà soltanto dopo la disponibilità reale dell'ambiente.

## Rischi chiusi

| ID | Chiusura | Evidenza |
|---|---|---|
| CTX-R01 | Git inizializzato e clean-worktree verification completata | commit `6cda07a60022665f321b48dd82fbeb1d9bef586f`; `docs/testing/BL-001_VERIFICATION.md` |
| CTX-R08 | BL-002 verificato da worktree detached pulito con install frozen e cache forzata off | head `7c6c7071d027c55aeffbc7279b8ca3765ea26c37`; `TURBO_FORCE=true pnpm verify` exit `0` in 66,0 s |
| CTX-R06 | Pipeline e failure path verificati realmente su GitHub | PR #1/run `29257544214` tutti verdi; PR #3/run `29256736728` con tests/gate rossi, build skipped e merge state `BLOCKED`; post-merge run `29257721274` PASS |
| CTX-R07 | Blocco del piano privato rimosso dal Product Owner e enforcement attivato | repository pubblico; Ruleset `18877721` active/strict/no bypass; regole applicabili a `main` verificate via API |
| CTX-R12 | Configurazione runtime BL-003 verificata localmente, da checkout pulito e su Linux | head `f571413`; clean verify `61,0 s`; run `29285998646` 5/5 job PASS; failure path FIFO `29285442650` registrato e corretto |
