---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-14
last_verified_commit: 519052649c88d84c45da92c3b35131819291a73a
source_refs:
  - docs/MVP_SPEC.md#293-ambienti
  - docs/MVP_SPEC.md#294-cicd
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
  - docs/adr/0005-vercel-web-preview-and-staging.md
related_tasks:
  - BL-003
  - BL-079
  - BL-080
code_refs:
  - .vercelignore
  - apps/web/app/health/route.ts
  - apps/web/package.json
  - apps/web/vercel.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - infra/deployment/vercel-staging.json
  - .github/workflows/deployment-smoke.yml
  - .github/workflows/ci.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-smoke.mjs
  - scripts/smoke-web-deployment.mjs
  - turbo.json
test_refs:
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/unit/deployment-smoke.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
supersedes: null
---

# Evidenze BL-080

## Stato corrente

`BL-080` è `IN_PROGRESS/50%/FAILING`. [PR #12](https://github.com/Emacore17/dnd-ai/pull/12) ha generato un deployment Vercel `target=production` da `main`, poi eliminato; il job `Staging / Smoke` lo ha rifiutato. [PR #13](https://github.com/Emacore17/dnd-ai/pull/13) ha integrato il contenimento e [PR #14](https://github.com/Emacore17/dnd-ai/pull/14) il guard Preview-only nel merge `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`; CI PR `29335696502` e post-merge `29335856323` sono 5/5 verdi e non hanno creato deployment. Il primo bootstrap CLI esplicito successivo si è fermato prima della delivery: il payload locale era 773,1 MiB e conteneva un file cache `.turbo` da 156,5 MB, oltre il limite Hobby di 100 MB per file. La lista deployment è rimasta vuota. Il change set corrente aggiunge `.vercelignore` root-only e validazione JSON del dry-run prima di ogni upload, ma nessuno staging esiste ancora, la causa del target provider resta sconosciuta e ADR-0005 resta `proposed`.

| Campo | Valore |
|---|---|
| Data | 2026-07-14 |
| Ambiente locale | Windows; Node `24.11.0`; pnpm `10.34.5` |
| Branch di implementazione | `codex/bl-080-cli-payload` |
| Base verificata | `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`; merge guard PR #14 su `main` |
| Commit task iniziale | `4a9754b61a3693145ebe5f42a0eef43e47b4c364` |
| Commit implementazione | `50efcbe620ad7c1fc6eb3cf1b79cdb27b0c383af` |
| Foundation su `main` | PR #7; merge `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578` |
| Hardening corrente | commit `1766406b9bd701a9880705b371fdc0b05a73abe1`; PR #10; run `29326093430` 5/5 `SUCCESS`; merge `ef803add249d16ded6f94936c59531047c8a92fa` |
| Contenimento corrente | commit `4d3d4baad1a57b5340c0092209cc640499aa4da8`; PR #13; CI PR `29332953627` e post-merge `29333105276` 5/5 `SUCCESS`; merge `61e5cbd2c3c1c258769fef6b3ad89853d7b7ca61`; zero deployment successivi |
| Guard Preview-only | commit `519052649c88d84c45da92c3b35131819291a73a`; PR #14; merge `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`; CI PR/post-merge 5/5; zero deployment |
| Contratto payload CLI | `.vercelignore` root-only; dry-run parser bounded; merge/CI pending |
| Spec SHA-256 | `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c` |
| Deploy contract | `staging-foundation-v1`; provider remoto ancora collegato, mentre il repository mantiene binding versionati `null`, `source.autoDeploy=false`, `git.deploymentEnabled=false` e build guard Preview-only |
| Health contract | `web-health-v1` |
| Provider/regione | Vercel Hobby/`fra1` verificati per il solo web; CDN globale; `OD-08` non chiuso |

## Preflight e failure path

- Il link locale `apps/web/.vercel/project.json` esiste ed è ignorato; non viene committato.
- Il link CLI aveva creato anche `apps/web/.env.local` con credenziale effimera: il file ignorato è stato rimosso senza leggerlo e non viene usato dal build finale.
- Vercel CLI `55.0.0` è stata eseguita in modo pinned. Identità esclusiva autorizzata e piano Hobby personale/non commerciale risultano `PASS` in forma redatta; email, token e dati account non sono stati registrati.
- Il change set di attivazione passava `deploy:check:linked`; la controprova remota ha invalidato l'assunzione sul target. Il contenimento integrato torna a `deploy:check`, mentre `deploy:check:linked` deve fallire sui binding versionati `null`.
- Il CLI smoke senza provider metadata fallisce con JSON redatto; token OIDC mancante/malformato fallisce prima del fetch. Origin estranea, redirect, timeout e identity mismatch sono coperti da test deterministici.
- La review indipendente ha distinto l'action `vercel.deployment.ready` dal payload valido `state.type=success`; entrambi i valori sono obbligatori.
- `/health` e lo smoke confrontano anche ref e repository runtime; l'evento è legato all'installation ID. L'URL del payload è ignorato e il token breve raggiunge soltanto l'origin branch esatta registrata.
- Il workflow dichiara `contents: read` + `id-token: write`, ma action, SHA, script OIDC e verifier formano una sequenza chiusa: permission override, step o job aggiuntivi falliscono. I body chunked vengono interrotti oltre 8 KiB e le direttive media/cache sono confrontate esattamente.
- `git.deploymentEnabled=false` e `source.autoDeploy=false` hanno impedito deploy durante connect e dopo il merge del contenimento. La policy linked `{"**": false, "main": true, "release/production": false}` non ha garantito `target=preview` dopo il merge; resta quindi ritirata senza simulare una nuova attivazione.
- `apps/web/vercel.json` impone il `buildCommand` strict `node scripts/assert-vercel-preview-build.mjs && pnpm run build`. Il primo guard richiede la tripla esatta `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`; il normale build locale consente soltanto l'assenza completa dei tre metadata. Valori mancanti, incoerenti, Production, Development, custom o case-variant falliscono con errori statici senza riflettere l'environment.
- Il guard non seleziona il target e non impedisce la creazione iniziale di un deployment record provider: blocca il completamento del build prima di Next quando il target osservato non è Preview. Il futuro bootstrap one-shot deve usare anche il selector CLI `--target=preview`, `--no-wait`, inspect immediato e rimozione per deployment ID esatto su mismatch; `--skip-domain` è escluso perché richiede `--prod`, mentre `--prod`, `--prebuilt`, promote e override manuali dei metadata `VERCEL*` restano vietati.
- Il CLI dalla root non eredita le esclusioni della `.gitignore` come policy completa: il primo payload ha incluso `.turbo` e il comando si è fermato su `File size limit exceeded (100 MB)` prima di creare un deployment. La root `.vercelignore` è ora l'unica denylist Vercel versionata; `apps/web/.vercelignore` è vietato perché avrebbe precedenza nel monorepo.
- Prima del retry, `vercel@55.0.0 deploy . --project dnd-ai-web --scope emacore17s-projects --target=preview --dry --format=json --yes` deve terminare con exit `0` e il JSON deve passare `scripts/check-vercel-deploy-dry-run.mjs`. Il checker richiede root/Next.js/input esatti come file regolari con hash valido, mode file/directory zero-byte, massimo 15.000 entry, 10 MiB totali, 5 MiB per file, path univoci e nessun discendente cache, generato, privato o non relativo. Il dry-run non carica sorgenti e non crea deployment; `--cwd apps/web` e archivi come workaround restano vietati.

## GitHub environment

Environment `staging` creato sul repository pubblico il 2026-07-14:

- environment ID `18116457061`;
- branch policy custom ID `54588096`, unico branch `main`;
- bypass amministratore disabilitato;
- zero environment secret e zero environment variable;
- project Vercel collegato al repository; deployment Production incidentale rimosso; zero deployment e zero alias del progetto al cutoff dell'audit.

Il branch `release/production` è stato creato da `main` a `ef803add249d16ded6f94936c59531047c8a92fa` e protetto dalla Ruleset dedicata `release-production-required-ci` (`18926413`): `CI / Merge gate` è strict e `current_user_can_bypass=never`. La Ruleset `main-required-ci` (`18877721`) e l'environment `staging` sono rimasti invariati.

Il permesso `id-token: write` non crea un environment secret: il JWT è breve, viene mascherato dal workflow e non è disponibile finché il job protetto non viene eseguito. Il provider mantiene Standard Protection e la Trusted Source configurata lo accetta soltanto con audience `https://github.com/Emacore17`, repository `Emacore17/dnd-ai`, repository ID `1299266814`, ref `refs/heads/main`, environment `staging` e target `preview`.

La configurazione è stata riletta tramite API dopo la mutazione. Un primo update con `prevent_self_review` ma senza reviewer è fallito in sicurezza con `422`; la richiesta corretta ha poi disabilitato il bypass senza aggiungere reviewer. Non è stato creato alcun secret, deployment o dominio.

## Checkpoint provider parziale

| Controllo esterno | Esito 2026-07-14 |
|---|---|
| Progetto/scope | `dnd-ai-web`; `prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`; `emacore17s-projects` |
| Repository collegato | `Emacore17/dnd-ai`; repository ID `1299266814` |
| Build settings | Root Directory `apps/web`; Next.js; regione `fra1` |
| Project security/config | Fork Protection, system environment variables ed emissione OIDC abilitate; zero variabili applicative |
| Deployment Protection | Standard; SSO predefinito `all_except_custom_domains`; una Trusted Source GitHub Actions exact-match configurata e riletta |
| Production Branch | `release/production`: `PASS` tramite readback CLI Vercel `55.0.0` |
| GitHub App | installation ID `41079282`; namespace `Emacore17`; `isAccessRestricted=false`; 8 repository accessibili: rischio residuo accettato dal PO, non blocker |
| Branch release GitHub | `release/production` da `ef803add249d16ded6f94936c59531047c8a92fa`; Ruleset `release-production-required-ci` (`18926413`), `CI / Merge gate` strict, `current_user_can_bypass=never`; Ruleset main `18877721` invariata |
| Binding | remoto collegato; manifest versionato unlinked/fail-closed integrato su `main` con PR #13 |
| Deployment | storico: `dpl_Cag…`/GitHub deployment `5440323678`, environment Production, status `success`; corrente: lista deployment e alias progetto vuota, URL/alias `404` |
| UI automation | evidenza storica: browser runtime `Cannot redefine property: process`; un fallback Windows precedente `GetCursorPos failed: Accesso negato. (0x80070005)` e quello successivo non ha potuto verificare l'URL corrente; nessun bypass o cambio account. Il salvataggio manuale è confermato dal readback CLI |

L'emissione OIDC e la Trusted Source sono due controlli distinti; entrambi risultano configurati. Il grant condiviso resta invariato per decisione PO e compensato a livello project. Questi controlli hanno impedito che il job smoke accettasse il deployment Production, ma non ne hanno impedito la creazione: nessuna evidenza locale o readback Branch Tracking viene più trattata come prova sufficiente del target.

## Incidente di attivazione

| Timestamp UTC | Evidenza |
|---|---|
| 2026-07-14T11:42:57.456Z | Vercel activity `production-branch-updated`: `release/production` |
| 2026-07-14T12:09:56Z | PR #12 integrata nel merge `c64d09528dae2c1fd5e4ba3de7d17d15573dd71a` |
| 2026-07-14T12:09:59.088Z | Vercel activity deployment `dpl_Cag…`, branch `main`, `target=production` |
| 2026-07-14T12:10:45Z | GitHub deployment `5440323678`, environment `Production`, status `success` |
| 2026-07-14T12:10:47Z | dispatch `vercel.deployment.ready`; run `29331534774`, job `Staging / Smoke` `skipped` |
| 2026-07-14T12:10:52.918Z | Vercel activity `deployment-delete`; deployment rimosso |

La rimozione è stata richiesta quando il CLI mostrava ancora `BUILDING`, ma l'activity log e GitHub Deployment API provano che il deployment ha raggiunto `success` e ricevuto alias prima che l'eliminazione terminasse. Al cutoff `2026-07-14T12:19:14Z`, deployment e alias project-scoped sono `0`; URL deployment, alias branch e alias progetto rispondono `404`. Non è stato eseguito alcuno smoke. La causa resta `unknown`. Il contenimento fail-closed è ora integrato; il guard Preview-only aggiunge una seconda barriera prima di un nuovo bootstrap diagnostico.

## Failure bootstrap payload

| Evidenza | Esito |
|---|---|
| Base/branch | `main == origin/main == ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`; working tree pulito |
| Selector | CLI pinned `55.0.0`, project/scope esatti, solo `--target=preview`; nessun `--prod`, `--prebuilt`, archive o override env |
| Primo source scan | 1.274 entry; 810.694.388 byte (773,1 MiB); `.turbo` 807.932.836 byte; file massimo 156.548.806 byte |
| Risultato comando | exit `1`, `File size limit exceeded (100 MB)` prima della creazione del deployment |
| Readback immediato | deployment list vuota; nessun dispatch smoke |
| Policy corrente | `.vercelignore` root-only; nessun `apps/web/.vercelignore`; contract anti-drift e parser dry-run versionati |
| Dry-run dopo policy | `nextjs`, root esatta, 158 entry, 1.093.267 byte, file massimo 263.569 byte; checker `PASS`; zero upload/deployment |

Il dry-run iniziale con exit `0` non era sufficiente: descriveva correttamente anche il payload sovradimensionato. Per questo la policy non si limita al comando provider ma valida semanticamente JSON, budget e path. Non sono stati eliminati cache o artifact locali per ottenere il verde e non è stato usato `--archive`: il confine deve restare riproducibile da un checkout pulito con normali output di sviluppo presenti.

## Verifiche locali parziali

| Verifica | Esito |
|---|---|
| web lint/typecheck/build | PASS; `/health` route dinamica |
| `tests/unit/deployment-smoke.test.mjs` | 12/12 PASS dopo i regression test di review |
| `tests/integration/*.test.mjs` | 9/9 PASS; server standalone reale e `/health` no-store |
| `tests/contracts/*.test.mjs` | 18/18 PASS; evento, permission, policy branch e binding provider all-or-none fail-closed |
| `tests/security/*.test.mjs` + secret scan | 11 PASS, 3 skip host Windows; zero failure |
| unit completa | 29 PASS, 1 skip host Windows; zero failure |
| `pnpm deploy:check` | PASS |
| `pnpm deploy:check:linked` | expected FAIL exit `1` sui quattro binding hotfix `null`; nessun binding parziale |
| `pnpm ci:workflow:check` | PASS sul contenimento integrato; Quality usa `deploy:check` e non `deploy:check:linked` |
| `TURBO_FORCE=true pnpm verify` | PASS change set di attivazione in 65,3 s; zero cache Turbo; artifact 3.205 file |
| `TURBO_FORCE=true corepack pnpm@10.34.5 verify` sul hotfix | PASS in 61,0 s; zero cache Turbo; unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host, policy/scan/artifact 3.205 file |
| `tests/unit/vercel-preview-build-policy.test.mjs` | 4/4 PASS: locale esplicito, Preview esatta, target vietati e metadata incompleti |
| `tests/security/vercel-preview-build-guard.test.mjs` | 3/3 PASS: subprocess, exit code, argomenti invalidi e output redatto |
| `tests/unit/vercel-deploy-dry-run.test.mjs` | 6/6 PASS: schema/root/framework, budget, path vietati, placeholder directory ignorate, mode/hash/symlink, input/duplicati/totali |
| `tests/security/vercel-deploy-dry-run.test.mjs` | 3/3 PASS: manifest valido, JSON/path non affidabili redatti, argomenti e stdin oltre 8 MiB fail-closed |
| payload + deployment contract mirati | 14/14 PASS; `deploy:check`, task graph, secret scan ed ESLint mirati PASS |
| dry-run Vercel reale | PASS: 158 entry, 1.093.267 byte, max 263.569 byte; framework/root/input esatti; zero deployment |
| `TURBO_FORCE=true corepack pnpm@10.34.5 verify` sulla policy payload | PASS in 69,1 s; zero cache Turbo; unit 39 pass/1 skip host, integration 9/9, contract 18/18, security 17 pass/3 skip host, policy/scan/artifact verdi |
| guard + deployment contract mirati | 5/5 contract PASS; `deploy:check` e task graph PASS; ESLint/Prettier mirati PASS |
| Review indipendenti finali | zero P0/P1/P2; incluso il caso regressione Production con `--allow-local`, che termina ancora su `target-not-preview` |
| Build Command simulato con Production | expected FAIL exit `1` su `target-not-preview` prima dell'avvio di Next |
| Build Command simulato con Preview | PASS; Next.js `16.2.10` compila e genera `/`, `/_not-found`, `/health` |
| `TURBO_FORCE=true corepack pnpm@10.34.5 verify` sul guard | PASS preliminare in 60,2 s e PASS sul commit pulito `5190526` in 57,1 s; zero cache Turbo; unit 33 pass/1 skip host, integration 9/9, contract 18/18, security 14 pass/3 skip host, policy/scan/artifact verdi |

Il primo full verify post-review è terminato per timeout host con exit `124` dopo 184 s e ha lasciato processi `corepack pnpm verify`/Turbo typecheck figli. I soli processi identificati sono stati terminati, `pnpm typecheck` è passato isolatamente e un rerun completo con cache Turbo forzatamente ignorata ha chiuso i gate in 61,4 s. Dopo l'hardening OIDC/origin, un primo rerun si è fermato correttamente al format check di `deployment-foundation.mjs`; Prettier ha corretto il solo layout e il successivo gate è passato in 58,0 s. Il change set della policy branch `**`, confronto con `apps/web/vercel.json` e atomicità dei quattro binding è passato in 75,4 s. Il checkpoint documentale precedente ha aggiunto la decisione normativa sul grant condiviso, la branch/Ruleset release e la sequenza origin non circolare: `TURBO_FORCE=true pnpm verify` è passato con exit `0` in 70,8 s. Sul change set di attivazione `TURBO_FORCE=true corepack pnpm@10.34.5 verify` è passato con exit `0` in 65,3 s: lint e build 11/11, typecheck 12/12, unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host, task/deploy/CI policy, secret scan e artifact 3.205 file tutti verdi, con zero cache Turbo. Il guard corrente ha poi chiuso lo stesso gate con exit `0` in 60,2 s; le suite aggiornate contano 33 unit PASS/1 skip host e 14 security PASS/3 skip host. Il build web successivo alla rimozione di `.env.local` è passato senza caricare il file. Né timeout né format failure vengono contati come PASS.

## Gate ancora aperti

- causa del target Production identificata e mitigata con evidenza ufficiale;
- contratto payload/dry-run integrato su `main`, CI verde e readback zero deploy;
- bootstrap CLI diagnostico Preview con inspect immediato;
- deploy automatico Preview identificato da SHA/deployment ID, senza Production;
- workflow smoke remoto su `main` e GitHub environment `staging`;
- deploy fallito senza action `ready`, smoke o promozione;
- redeploy dello stesso SHA oppure revert+deploy, seguito da smoke;
- checkout pulito del change set di attivazione.

## Evidenza GitHub della foundation

- [PR #7](https://github.com/Emacore17/dnd-ai/pull/7) integrata senza bypass nel merge commit `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578`.
- [Run PR `29321410036`](https://github.com/Emacore17/dnd-ai/actions/runs/29321410036): Quality, Tests, Security, Build artifact e `CI / Merge gate` tutti `SUCCESS`.
- [Run post-merge `29321531038`](https://github.com/Emacore17/dnd-ai/actions/runs/29321531038): 5/5 job `SUCCESS`; artifact allowlisted 3.247 file, artifact ID `8306136134`.
- [PR #10](https://github.com/Emacore17/dnd-ai/pull/10), commit `1766406b9bd701a9880705b371fdc0b05a73abe1`: [run `29326093430`](https://github.com/Emacore17/dnd-ai/actions/runs/29326093430) con Quality, Tests, Security, Build artifact e `CI / Merge gate` tutti `SUCCESS`; readback Vercel successivo con zero deployment.
- [PR #12](https://github.com/Emacore17/dnd-ai/pull/12), commit `7335053c59838cf3b581d7f09645450372aa0429`: [run `29331343752`](https://github.com/Emacore17/dnd-ai/actions/runs/29331343752) 5/5 `SUCCESS`; merge `c64d09528dae2c1fd5e4ba3de7d17d15573dd71a`; post-merge [CI `29331482831`](https://github.com/Emacore17/dnd-ai/actions/runs/29331482831) 5/5 `SUCCESS`. La CI verde non costituisce evidenza Preview.
- [PR #13](https://github.com/Emacore17/dnd-ai/pull/13), commit `4d3d4baad1a57b5340c0092209cc640499aa4da8`: [run PR `29332953627`](https://github.com/Emacore17/dnd-ai/actions/runs/29332953627) e [post-merge `29333105276`](https://github.com/Emacore17/dnd-ai/actions/runs/29333105276) 5/5 `SUCCESS`; merge `61e5cbd2c3c1c258769fef6b3ad89853d7b7ca61`; nessun nuovo dispatch e zero deployment Vercel al readback successivo.
- [PR #14](https://github.com/Emacore17/dnd-ai/pull/14), guard commit `519052649c88d84c45da92c3b35131819291a73a`: [run PR `29335696502`](https://github.com/Emacore17/dnd-ai/actions/runs/29335696502) e [post-merge `29335856323`](https://github.com/Emacore17/dnd-ai/actions/runs/29335856323) 5/5 `SUCCESS`; merge `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`; zero deployment prima e dopo il merge.
- L'hardening è stato integrato su `main` a `ef803add249d16ded6f94936c59531047c8a92fa`; `release/production` è stato creato da quello SHA e protetto dalla Ruleset `18926413` strict/no-bypass senza modificare la Ruleset main `18877721` o l'environment `staging`.
- La foundation e il merge di contenimento non hanno prodotto deploy. Il progetto/provider resta collegato, ma `git.deploymentEnabled=false` e `source.autoDeploy=false` impediscono l'auto-deploy mentre il guard viene integrato e verificato; la lista deployment corrente è vuota.

Finché questi punti non sono provati, `BL-079` resta `BACKLOG` e nessuna evidenza locale viene presentata come staging disponibile.
