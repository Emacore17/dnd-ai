---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-14
last_verified_commit: 4a9754b61a3693145ebe5f42a0eef43e47b4c364
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

`BL-080` resta `IN_PROGRESS/50%`: contratto, health endpoint, workflow e GitHub environment sono implementati e verificati localmente; l'auto-deploy è disabilitato per rendere sicuro il futuro Git connect. Account/project Vercel, deploy remoto, smoke, failure deploy e redeploy non sono ancora disponibili. ADR-0005 resta `proposed` fino all'autorizzazione del piano/termini e alla prova reale.

| Campo | Valore |
|---|---|
| Data | 2026-07-14 |
| Ambiente locale | Windows; Node `24.11.0`; pnpm `10.34.5` |
| Branch | `codex/bl-080-staging-foundation` |
| Base verificata | `0065c012ae359450b4cd38da41b001f9e922eeb8`; CI post-merge `29315052002` 5/5 `SUCCESS` |
| Commit task iniziale | `4a9754b61a3693145ebe5f42a0eef43e47b4c364` |
| Spec SHA-256 | `0b7ce963316cb601c7178340876de1b8932bc63b7c672adb1b37554d3b139f0c` |
| Deploy contract | `staging-foundation-v1`; project ID/scope/origin/App installation `pending` |
| Health contract | `web-health-v1` |
| Provider/regione | Vercel/`fra1` proposti; CDN globale; `OD-08` non chiuso |

## Preflight e failure path

- `.vercel/project.json` era assente e `.vercel/` è ora ignorata.
- Vercel CLI `50.28.0` e `55.0.0` sono state eseguite in modo pinned; `whoami` ha restituito exit `1` con `No existing credentials found`, senza token o dati account.
- `pnpm deploy:check` passa sul desired state.
- `pnpm deploy:check:linked` fallisce intenzionalmente con exit `1` sui binding ancora `null`: project ID, scope slug, origin branch e GitHub App installation ID.
- Il CLI smoke senza provider metadata fallisce con JSON redatto; token OIDC mancante/malformato fallisce prima del fetch. Origin estranea, redirect, timeout e identity mismatch sono coperti da test deterministici.
- La review indipendente ha distinto l'action `vercel.deployment.ready` dal payload valido `state.type=success`; entrambi i valori sono obbligatori.
- `/health` e lo smoke confrontano anche ref e repository runtime; l'evento è legato all'installation ID. L'URL del payload è ignorato e il token breve raggiunge soltanto l'origin branch esatta registrata.
- Il workflow dichiara `contents: read` + `id-token: write`, ma action, SHA, script OIDC e verifier formano una sequenza chiusa: permission override, step o job aggiuntivi falliscono. I body chunked vengono interrotti oltre 8 KiB e le direttive media/cache sono confrontate esattamente.
- `git.deploymentEnabled=false` e `source.autoDeploy=false` impediscono deploy durante il connect. L'attivazione richiederà tutti i binding reali, gate linked e la policy `{"*": false, "main": true}`: la PR resta disabilitata e solo il merge su `main` può produrre la Preview.

## GitHub environment

Environment `staging` creato sul repository pubblico il 2026-07-14:

- environment ID `18116457061`;
- branch policy custom ID `54588096`, unico branch `main`;
- bypass amministratore disabilitato;
- zero environment secret e zero environment variable;
- provider/project Vercel non ancora collegato.

Il permesso `id-token: write` non crea un environment secret: il JWT è breve, viene mascherato dal workflow e non è disponibile finché il job protetto non viene eseguito. Il provider dovrà mantenere Standard Protection e accettarlo soltanto tramite Trusted Source vincolata a repository ID `1299266814`, ref `main`, environment `staging` e target `preview`.

La configurazione è stata riletta tramite API dopo la mutazione. Un primo update con `prevent_self_review` ma senza reviewer è fallito in sicurezza con `422`; la richiesta corretta ha poi disabilitato il bypass senza aggiungere reviewer. Non è stato creato alcun secret, deployment o dominio.

## Verifiche locali parziali

| Verifica | Esito |
|---|---|
| web lint/typecheck/build | PASS; `/health` route dinamica |
| `tests/unit/deployment-smoke.test.mjs` | 12/12 PASS dopo i regression test di review |
| `tests/integration/*.test.mjs` | 9/9 PASS; server standalone reale e `/health` no-store |
| `tests/contracts/*.test.mjs` | 16/16 PASS; evento, permission e activation gate fail-closed |
| `tests/security/*.test.mjs` + secret scan | 11 PASS, 3 skip host Windows; zero failure |
| unit completa | 29 PASS, 1 skip host Windows; zero failure |
| `pnpm deploy:check` | PASS |
| `pnpm deploy:check:linked` | expected FAIL sui quattro binding provider ancora `null` |
| `pnpm ci:workflow:check` | PASS con `deploy:check` nel Quality gate |
| `TURBO_FORCE=true pnpm verify` | PASS finale in 58,0 s; zero cache Turbo; artifact 3.205 file |

Il primo full verify post-review è terminato per timeout host con exit `124` dopo 184 s e ha lasciato processi `corepack pnpm verify`/Turbo typecheck figli. I soli processi identificati sono stati terminati, `pnpm typecheck` è passato isolatamente e un rerun completo con cache Turbo forzatamente ignorata ha chiuso i gate in 61,4 s. Dopo l'hardening OIDC/origin, un primo rerun finale si è fermato correttamente al format check di `deployment-foundation.mjs`; Prettier ha corretto il solo layout. La verifica conclusiva, inclusa la policy di attivazione branch-closed, è ripartita senza cache ed è passata in 58,0 s con unit 29+1 skip host, integration 9/9, contract 16/16, security 11+3 skip host e artifact 3.205 file. Né timeout né format failure vengono contati come PASS.

## Gate ancora aperti

- conferma esplicita di un account/piano Vercel compatibile e dei relativi termini/permessi GitHub App;
- foundation disabilitata integrata in `main`, perché workflow e config del Git connect devono provenire dalla default branch;
- project ID, scope slug, origin branch e installation ID reali; Root Directory, Fork Protection, system env e Production Branch riservata verificati mentre auto-deploy è spento;
- Standard Protection/Vercel Authentication e Trusted Source GitHub OIDC configurate e rilette senza bypass secret;
- secondo change set con `source.autoDeploy=true`, config Git branch-closed `{"*": false, "main": true}` e Quality gate `deploy:check:linked`;
- deploy automatico Preview identificato da SHA/deployment ID;
- workflow smoke remoto su `main` e GitHub environment `staging`;
- deploy fallito senza action `ready`, smoke o promozione;
- redeploy dello stesso SHA oppure revert+deploy, seguito da smoke;
- checkout pulito e CI della PR; il full verify forzato sul working tree è PASS.

Finché questi punti non sono provati, `BL-079` resta `BACKLOG` e nessuna evidenza locale viene presentata come staging disponibile.
