---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-14
last_verified_commit: 770206d9e2aba1b6b8b5d19bf72e7226b3df3d82
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

`BL-080` resta `IN_PROGRESS/50%`: contratto, health endpoint e workflow sono integrati su `main`; l'account Hobby autorizzato è stato verificato in modo redatto e il progetto Vercel è stato creato e collegato con auto-deploy disabilitato. La Trusted Source OIDC è configurata e l'installation ID è stata acquisita. Non esiste alcun deployment. Production Branch, grant GitHub App repository-only, origin staging, smoke, failure deploy e redeploy restano aperti; ADR-0005 resta `proposed`.

| Campo | Valore |
|---|---|
| Data | 2026-07-14 |
| Ambiente locale | Windows; Node `24.11.0`; pnpm `10.34.5` |
| Branch di implementazione | `codex/bl-080-staging-activation` |
| Base verificata | `770206d9e2aba1b6b8b5d19bf72e7226b3df3d82`; CI post-merge `29322330969` 5/5 `SUCCESS` |
| Commit task iniziale | `4a9754b61a3693145ebe5f42a0eef43e47b4c364` |
| Commit implementazione | `50efcbe620ad7c1fc6eb3cf1b79cdb27b0c383af` |
| Foundation su `main` | PR #7; merge `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578` |
| Spec SHA-256 | `0b7ce963316cb601c7178340876de1b8932bc63b7c672adb1b37554d3b139f0c` |
| Deploy contract | `staging-foundation-v1`; project ID `prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`; scope `emacore17s-projects`; installation ID `41079282`; origin `pending`; binding versionati ancora atomicamente incompleti |
| Health contract | `web-health-v1` |
| Provider/regione | Vercel Hobby/`fra1` verificati per il solo web; CDN globale; `OD-08` non chiuso |

## Preflight e failure path

- Il link locale `apps/web/.vercel/project.json` esiste ed è ignorato; non viene committato.
- Il link CLI aveva creato anche `apps/web/.env.local` con credenziale effimera: il file ignorato è stato rimosso senza leggerlo e non viene usato dal build finale.
- Vercel CLI `55.0.0` è stata eseguita in modo pinned. Identità esclusiva autorizzata e piano Hobby personale/non commerciale risultano `PASS` in forma redatta; email, token e dati account non sono stati registrati.
- `pnpm deploy:check` passa sul desired state.
- `pnpm deploy:check:linked` fallisce intenzionalmente con exit `1` sui binding versionati ancora `null`: project ID, scope slug, origin branch e GitHub App installation ID. I primi tre identificatori non-origin sono noti esternamente, ma non vengono presentati come un link completo finché l'origin manca e il grant App non è repository-only.
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
| GitHub App | installation ID `41079282`; namespace `Emacore17`; `isAccessRestricted=false`; 8 repository accessibili: `BLOCKER` |
| Binding mancanti | origin staging; il manifest mantiene atomicamente null anche gli altri tre binding finché grant/origin non sono validi |
| Deployment | lista vuota; nessun deploy Preview o Production |
| UI automation | bloccata localmente; nessun bypass, cambio account o indebolimento dei controlli |

L'emissione OIDC e la Trusted Source sono due controlli distinti; entrambi risultano ora configurati. Lo smoke remoto resta comunque indisponibile perché la Production Branch è errata, il grant App è troppo ampio, l'origin non esiste e auto-deploy è spento.

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
| `TURBO_FORCE=true pnpm verify` | PASS corrente in 75,4 s; zero cache Turbo; artifact 3.205 file |

Il primo full verify post-review è terminato per timeout host con exit `124` dopo 184 s e ha lasciato processi `corepack pnpm verify`/Turbo typecheck figli. I soli processi identificati sono stati terminati, `pnpm typecheck` è passato isolatamente e un rerun completo con cache Turbo forzatamente ignorata ha chiuso i gate in 61,4 s. Dopo l'hardening OIDC/origin, un primo rerun si è fermato correttamente al format check di `deployment-foundation.mjs`; Prettier ha corretto il solo layout e il successivo gate è passato in 58,0 s. Il change set corrente aggiunge la policy branch `**`, il confronto con `apps/web/vercel.json` e l'atomicità dei quattro binding: `TURBO_FORCE=true pnpm verify` è passato con exit `0` in 75,4 s; targeted unit 29+1 skip host, integration 9/9, contract 18/18, security 11+3 skip host e artifact 3.205 file risultano tutti verdi. Il build web successivo alla rimozione di `.env.local` è passato senza caricare il file. Né timeout né format failure vengono contati come PASS.

## Gate ancora aperti

- Production Branch `release/production` impostata e riletta mentre auto-deploy è spento; `main` corrente è un hard blocker;
- grant dell'installazione GitHub App `41079282` ridotto da 8 repository al solo `Emacore17/dnd-ai` e riletto con `isAccessRestricted=true`;
- origin branch reale acquisita e tutti i binding registrati insieme;
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
- La foundation non ha prodotto deploy. Il progetto/provider è stato collegato soltanto dopo l'integrazione, con `git.deploymentEnabled=false` e `source.autoDeploy=false`; la lista deployment è rimasta vuota.

Finché questi punti non sono provati, `BL-079` resta `BACKLOG` e nessuna evidenza locale viene presentata come staging disponibile.
