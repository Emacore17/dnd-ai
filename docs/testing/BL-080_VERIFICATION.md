---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-14
last_verified_commit: c64d09528dae2c1fd5e4ba3de7d17d15573dd71a
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
  - apps/web/app/health/route.ts
  - apps/web/vercel.json
  - infra/deployment/vercel-staging.json
  - .github/workflows/deployment-smoke.yml
  - .github/workflows/ci.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/deployment-smoke.mjs
  - scripts/smoke-web-deployment.mjs
test_refs:
  - tests/unit/deployment-smoke.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
supersedes: null
---

# Evidenze BL-080

## Stato corrente

`BL-080` è `IN_PROGRESS/50%/FAILING`. [PR #12](https://github.com/Emacore17/dnd-ai/pull/12) ha superato tutti i gate senza deployment sulla PR, ma il merge `c64d09528dae2c1fd5e4ba3de7d17d15573dd71a` su `main` ha generato un deployment Vercel `target=production` nonostante il readback Production Branch=`release/production`. GitHub Deployment API lo registra come environment `Production` e status `success`; il job `Staging / Smoke` è stato rifiutato dal predicate Preview ed è `skipped`. Il deployment è stato eliminato e URL/alias ora rispondono `404`; deployment e alias del progetto sono tornati a zero. Il hotfix `codex/bl-080-fail-closed-hotfix` ripristina la configurazione versionata disabilitata. La causa del target mismatch resta sconosciuta, nessuno staging esiste e ADR-0005 resta `proposed`.

| Campo | Valore |
|---|---|
| Data | 2026-07-14 |
| Ambiente locale | Windows; Node `24.11.0`; pnpm `10.34.5` |
| Branch di implementazione | `codex/bl-080-fail-closed-hotfix` |
| Base verificata | `c64d09528dae2c1fd5e4ba3de7d17d15573dd71a`; merge di attivazione PR #12 su `main` |
| Commit task iniziale | `4a9754b61a3693145ebe5f42a0eef43e47b4c364` |
| Commit implementazione | `50efcbe620ad7c1fc6eb3cf1b79cdb27b0c383af` |
| Foundation su `main` | PR #7; merge `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578` |
| Hardening corrente | commit `1766406b9bd701a9880705b371fdc0b05a73abe1`; PR #10; run `29326093430` 5/5 `SUCCESS`; merge `ef803add249d16ded6f94936c59531047c8a92fa` |
| Spec SHA-256 | `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c` |
| Deploy contract | `staging-foundation-v1`; provider remoto ancora collegato, ma il hotfix riporta binding versionati a `null`, `source.autoDeploy=false` e `git.deploymentEnabled=false` |
| Health contract | `web-health-v1` |
| Provider/regione | Vercel Hobby/`fra1` verificati per il solo web; CDN globale; `OD-08` non chiuso |

## Preflight e failure path

- Il link locale `apps/web/.vercel/project.json` esiste ed è ignorato; non viene committato.
- Il link CLI aveva creato anche `apps/web/.env.local` con credenziale effimera: il file ignorato è stato rimosso senza leggerlo e non viene usato dal build finale.
- Vercel CLI `55.0.0` è stata eseguita in modo pinned. Identità esclusiva autorizzata e piano Hobby personale/non commerciale risultano `PASS` in forma redatta; email, token e dati account non sono stati registrati.
- Il change set di attivazione passava `deploy:check:linked`; la controprova remota ha invalidato l'assunzione sul target. Il hotfix torna a `deploy:check`, mentre `deploy:check:linked` deve fallire sui binding versionati `null`.
- Il CLI smoke senza provider metadata fallisce con JSON redatto; token OIDC mancante/malformato fallisce prima del fetch. Origin estranea, redirect, timeout e identity mismatch sono coperti da test deterministici.
- La review indipendente ha distinto l'action `vercel.deployment.ready` dal payload valido `state.type=success`; entrambi i valori sono obbligatori.
- `/health` e lo smoke confrontano anche ref e repository runtime; l'evento è legato all'installation ID. L'URL del payload è ignorato e il token breve raggiunge soltanto l'origin branch esatta registrata.
- Il workflow dichiara `contents: read` + `id-token: write`, ma action, SHA, script OIDC e verifier formano una sequenza chiusa: permission override, step o job aggiuntivi falliscono. I body chunked vengono interrotti oltre 8 KiB e le direttive media/cache sono confrontate esattamente.
- `git.deploymentEnabled=false` e `source.autoDeploy=false` hanno impedito deploy durante connect e PR precedenti. La policy linked `{"**": false, "main": true, "release/production": false}` non ha garantito `target=preview` dopo il merge; viene quindi ritirata dal hotfix senza simulare una nuova attivazione.

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
| Binding | remoto collegato; manifest hotfix unlinked/fail-closed in attesa di merge |
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

La rimozione è stata richiesta quando il CLI mostrava ancora `BUILDING`, ma l'activity log e GitHub Deployment API provano che il deployment ha raggiunto `success` e ricevuto alias prima che l'eliminazione terminasse. Al cutoff `2026-07-14T12:19:14Z`, deployment e alias project-scoped sono `0`; URL deployment, alias branch e alias progetto rispondono `404`. Non è stato eseguito alcuno smoke. La causa resta `unknown`; il solo intervento autorizzato è il ripristino fail-closed.

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
| `pnpm ci:workflow:check` | storico attivazione PASS; hotfix deve ripristinare `deploy:check` |
| `TURBO_FORCE=true pnpm verify` | PASS change set di attivazione in 65,3 s; zero cache Turbo; artifact 3.205 file |
| `TURBO_FORCE=true corepack pnpm@10.34.5 verify` sul hotfix | PASS in 61,0 s; zero cache Turbo; unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host, policy/scan/artifact 3.205 file |

Il primo full verify post-review è terminato per timeout host con exit `124` dopo 184 s e ha lasciato processi `corepack pnpm verify`/Turbo typecheck figli. I soli processi identificati sono stati terminati, `pnpm typecheck` è passato isolatamente e un rerun completo con cache Turbo forzatamente ignorata ha chiuso i gate in 61,4 s. Dopo l'hardening OIDC/origin, un primo rerun si è fermato correttamente al format check di `deployment-foundation.mjs`; Prettier ha corretto il solo layout e il successivo gate è passato in 58,0 s. Il change set della policy branch `**`, confronto con `apps/web/vercel.json` e atomicità dei quattro binding è passato in 75,4 s. Il checkpoint documentale precedente ha aggiunto la decisione normativa sul grant condiviso, la branch/Ruleset release e la sequenza origin non circolare: `TURBO_FORCE=true pnpm verify` è passato con exit `0` in 70,8 s. Sul change set di attivazione corrente `TURBO_FORCE=true corepack pnpm@10.34.5 verify` è passato con exit `0` in 65,3 s: lint e build 11/11, typecheck 12/12, unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host, task/deploy/CI policy, secret scan e artifact 3.205 file tutti verdi, con zero cache Turbo. Il build web successivo alla rimozione di `.env.local` è passato senza caricare il file. Né timeout né format failure vengono contati come PASS.

## Gate ancora aperti

- hotfix fail-closed integrato su `main` con zero nuovi deployment;
- causa del target Production identificata e mitigata con evidenza ufficiale;
- controllo preventivo indipendente che garantisca `target=preview`;
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
- L'hardening è stato integrato su `main` a `ef803add249d16ded6f94936c59531047c8a92fa`; `release/production` è stato creato da quello SHA e protetto dalla Ruleset `18926413` strict/no-bypass senza modificare la Ruleset main `18877721` o l'environment `staging`.
- La foundation non ha prodotto deploy. Il progetto/provider è stato collegato soltanto dopo l'integrazione, con `git.deploymentEnabled=false` e `source.autoDeploy=false`; la lista deployment è rimasta vuota.

Finché questi punti non sono provati, `BL-079` resta `BACKLOG` e nessuna evidenza locale viene presentata come staging disponibile.
