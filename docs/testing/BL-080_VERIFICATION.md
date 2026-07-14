---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-14
last_verified_commit: ef803add249d16ded6f94936c59531047c8a92fa
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
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/deployment-smoke.mjs
test_refs:
  - tests/unit/deployment-smoke.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
supersedes: null
---

# Evidenze BL-080

## Stato corrente

`BL-080` resta `IN_PROGRESS/50%`: contratto, health endpoint e workflow sono integrati su `main`; l'account Hobby autorizzato è stato verificato in modo redatto e il progetto Vercel è stato creato e collegato con auto-deploy disabilitato. La Trusted Source OIDC è configurata e l'installation ID è stata acquisita. Su decisione esplicita del Product Owner l'installazione GitHub App condivisa non viene ristretta, perché la restrizione toglierebbe accesso ad altri progetti: il grant ampio è un rischio residuo accettato con controlli compensativi project-level, non più un blocker. `release/production` esiste ed è protetta; non esiste alcun deployment. La Production Branch Vercel ancora `main` è l'unico blocker provider pre-attivazione; origin staging, binding, attivazione, smoke, failure deploy e redeploy restano aperti. ADR-0005 resta `proposed`.

| Campo | Valore |
|---|---|
| Data | 2026-07-14 |
| Ambiente locale | Windows; Node `24.11.0`; pnpm `10.34.5` |
| Branch di implementazione | `codex/bl-080-activate-staging` |
| Base verificata | `ef803add249d16ded6f94936c59531047c8a92fa`; hardening PR #10 integrato su `main` |
| Commit task iniziale | `4a9754b61a3693145ebe5f42a0eef43e47b4c364` |
| Commit implementazione | `50efcbe620ad7c1fc6eb3cf1b79cdb27b0c383af` |
| Foundation su `main` | PR #7; merge `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578` |
| Hardening corrente | commit `1766406b9bd701a9880705b371fdc0b05a73abe1`; PR #10; run `29326093430` 5/5 `SUCCESS`; merge `ef803add249d16ded6f94936c59531047c8a92fa` |
| Spec SHA-256 | `26b3e86fdd4d0ef7835b2e9f5486820dbeac671c78d50de7a01c78471393fa1c` |
| Deploy contract | `staging-foundation-v1`; project ID `prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`; scope `emacore17s-projects`; installation ID `41079282`; origin `pending`; binding versionati ancora atomicamente incompleti |
| Health contract | `web-health-v1` |
| Provider/regione | Vercel Hobby/`fra1` verificati per il solo web; CDN globale; `OD-08` non chiuso |

## Preflight e failure path

- Il link locale `apps/web/.vercel/project.json` esiste ed è ignorato; non viene committato.
- Il link CLI aveva creato anche `apps/web/.env.local` con credenziale effimera: il file ignorato è stato rimosso senza leggerlo e non viene usato dal build finale.
- Vercel CLI `55.0.0` è stata eseguita in modo pinned. Identità esclusiva autorizzata e piano Hobby personale/non commerciale risultano `PASS` in forma redatta; email, token e dati account non sono stati registrati.
- `pnpm deploy:check` passa sul desired state.
- `pnpm deploy:check:linked` fallisce intenzionalmente con exit `1` sui binding versionati ancora `null`: project ID, scope slug, origin branch e GitHub App installation ID. I tre identificatori non-origin sono noti esternamente, ma non vengono presentati come un link completo finché l'origin manca e la Production Branch Vercel non è separata da `main`.
- Il CLI smoke senza provider metadata fallisce con JSON redatto; token OIDC mancante/malformato fallisce prima del fetch. Origin estranea, redirect, timeout e identity mismatch sono coperti da test deterministici.
- La review indipendente ha distinto l'action `vercel.deployment.ready` dal payload valido `state.type=success`; entrambi i valori sono obbligatori.
- `/health` e lo smoke confrontano anche ref e repository runtime; l'evento è legato all'installation ID. L'URL del payload è ignorato e il token breve raggiunge soltanto l'origin branch esatta registrata.
- Il workflow dichiara `contents: read` + `id-token: write`, ma action, SHA, script OIDC e verifier formano una sequenza chiusa: permission override, step o job aggiuntivi falliscono. I body chunked vengono interrotti oltre 8 KiB e le direttive media/cache sono confrontate esattamente.
- `git.deploymentEnabled=false` e `source.autoDeploy=false` hanno impedito deploy durante il connect. L'attivazione richiederà tutti i binding reali, gate linked e la deny-all ricorsiva `{"**": false, "main": true, "release/production": false}`: `*` non copre in modo affidabile branch con `/`. La PR resta disabilitata e solo il merge su `main` può produrre la Preview.

## GitHub environment

Environment `staging` creato sul repository pubblico il 2026-07-14:

- environment ID `18116457061`;
- branch policy custom ID `54588096`, unico branch `main`;
- bypass amministratore disabilitato;
- zero environment secret e zero environment variable;
- project Vercel collegato al repository, con auto-deploy spento e zero deployment.

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
| Production Branch | ancora `main`: `BLOCKER`; target desiderato `release/production` |
| GitHub App | installation ID `41079282`; namespace `Emacore17`; `isAccessRestricted=false`; 8 repository accessibili: rischio residuo accettato dal PO, non blocker |
| Branch release GitHub | `release/production` da `ef803add249d16ded6f94936c59531047c8a92fa`; Ruleset `release-production-required-ci` (`18926413`), `CI / Merge gate` strict, `current_user_can_bypass=never`; Ruleset main `18877721` invariata |
| Binding mancanti | origin staging; il manifest mantiene atomicamente null anche gli altri tre binding finché Production Branch Vercel e origin non sono validi |
| Deployment | lista vuota; nessun deploy Preview o Production |
| UI automation | configurazione Production Branch non eseguita: browser runtime `Cannot redefine property: process`; fallback Windows `GetCursorPos failed: Accesso negato. (0x80070005)`; nessun bypass, cambio account o mutazione provider parziale |

L'emissione OIDC e la Trusted Source sono due controlli distinti; entrambi risultano configurati. Il Product Owner ha istruito esplicitamente di non restringere l'installazione GitHub App condivisa `41079282`, perché la modifica toglierebbe accesso ad altri progetti. Il rischio residuo di visibilità su 8 repository è accettato e compensato a livello project da link esatto a `Emacore17/dnd-ai`/repository ID `1299266814`, Trusted Source exact-match, GitHub environment `staging` protetto, Ruleset branch senza bypass e policy Vercel branch-closed. Lo smoke remoto resta indisponibile perché la Production Branch Vercel è ancora `main`, l'origin non esiste e auto-deploy è spento.

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
| `pnpm deploy:check:linked` | expected FAIL sui quattro binding provider ancora `null` |
| `pnpm ci:workflow:check` | PASS con `deploy:check` nel Quality gate |
| `TURBO_FORCE=true pnpm verify` | PASS corrente in 70,8 s; zero cache Turbo; artifact 3.205 file |

Il primo full verify post-review è terminato per timeout host con exit `124` dopo 184 s e ha lasciato processi `corepack pnpm verify`/Turbo typecheck figli. I soli processi identificati sono stati terminati, `pnpm typecheck` è passato isolatamente e un rerun completo con cache Turbo forzatamente ignorata ha chiuso i gate in 61,4 s. Dopo l'hardening OIDC/origin, un primo rerun si è fermato correttamente al format check di `deployment-foundation.mjs`; Prettier ha corretto il solo layout e il successivo gate è passato in 58,0 s. Il change set della policy branch `**`, confronto con `apps/web/vercel.json` e atomicità dei quattro binding è passato in 75,4 s. Il checkpoint corrente aggiunge la decisione normativa sul grant condiviso, la branch/Ruleset release e la sequenza origin non circolare: `TURBO_FORCE=true pnpm verify` è passato con exit `0` in 70,8 s; targeted unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host e artifact 3.205 file risultano tutti verdi. Il build web successivo alla rimozione di `.env.local` è passato senza caricare il file. Né timeout né format failure vengono contati come PASS.

## Gate ancora aperti

- Production Branch Vercel `release/production` impostata e riletta mentre auto-deploy è spento; `main` corrente è l'unico blocker provider pre-attivazione;
- alias branch deterministico documentato registrato con tutti i binding e confermato dal primo deployment;
- secondo change set con `source.autoDeploy=true`, config Git branch-closed `{"**": false, "main": true, "release/production": false}` e Quality gate `deploy:check:linked`;
- deploy automatico Preview identificato da SHA/deployment ID;
- workflow smoke remoto su `main` e GitHub environment `staging`;
- deploy fallito senza action `ready`, smoke o promozione;
- redeploy dello stesso SHA oppure revert+deploy, seguito da smoke;
- checkout pulito del successivo change set di attivazione.

## Evidenza GitHub della foundation

- [PR #7](https://github.com/Emacore17/dnd-ai/pull/7) integrata senza bypass nel merge commit `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578`.
- [Run PR `29321410036`](https://github.com/Emacore17/dnd-ai/actions/runs/29321410036): Quality, Tests, Security, Build artifact e `CI / Merge gate` tutti `SUCCESS`.
- [Run post-merge `29321531038`](https://github.com/Emacore17/dnd-ai/actions/runs/29321531038): 5/5 job `SUCCESS`; artifact allowlisted 3.247 file, artifact ID `8306136134`.
- [PR #10](https://github.com/Emacore17/dnd-ai/pull/10), commit `1766406b9bd701a9880705b371fdc0b05a73abe1`: [run `29326093430`](https://github.com/Emacore17/dnd-ai/actions/runs/29326093430) con Quality, Tests, Security, Build artifact e `CI / Merge gate` tutti `SUCCESS`; readback Vercel successivo con zero deployment.
- L'hardening è stato integrato su `main` a `ef803add249d16ded6f94936c59531047c8a92fa`; `release/production` è stato creato da quello SHA e protetto dalla Ruleset `18926413` strict/no-bypass senza modificare la Ruleset main `18877721` o l'environment `staging`.
- La foundation non ha prodotto deploy. Il progetto/provider è stato collegato soltanto dopo l'integrazione, con `git.deploymentEnabled=false` e `source.autoDeploy=false`; la lista deployment è rimasta vuota.

Finché questi punti non sono provati, `BL-079` resta `BACKLOG` e nessuna evidenza locale viene presentata come staging disponibile.
