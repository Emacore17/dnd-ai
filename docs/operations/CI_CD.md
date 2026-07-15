---
status: active
owner: engineering-and-security
last_reviewed: 2026-07-15
last_verified_commit: f9fbb24be26e45d00f425a762ba90bc559f038b3
source_refs:
  - docs/MVP_SPEC.md#2612-ci-quality-gates
  - docs/MVP_SPEC.md#264-integration-test-database
  - docs/MVP_SPEC.md#294-cicd
  - docs/adr/0008-zod-first-contract-generation.md
related_tasks:
  - BL-002
  - BL-003
  - BL-004
  - BL-008
  - BL-009
  - GOV-002
  - BL-080
  - QA-001
  - BL-070
code_refs:
  - .vercelignore
  - .github/workflows/ci.yml
  - .github/actions/setup-workspace/action.yml
  - packages/config
  - packages/observability
  - packages/observability/dist
  - packages/contracts/src
  - packages/contracts/generated/v1
  - scripts/generate-contracts.mjs
  - scripts/lib/contract-artifact-policy.mjs
  - scripts/lib/contract-compatibility-policy.mjs
  - scripts/lib/owned-path-policy.mjs
  - scripts/check-docs.mjs
  - scripts/lib/document-policy.mjs
  - scripts/lib/document-integrity-policy.mjs
  - scripts/lib/mermaid-policy.mjs
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migrations/000001_postgresql_foundation.ts
  - scripts/lib/postgres-test-container.mjs
  - infra/local/postgres.compose.yml
  - scripts/assert-ci-results.mjs
  - scripts/create-build-artifact.mjs
  - .github/workflows/deployment-smoke.yml
  - apps/web/package.json
  - apps/web/vercel.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - infra/deployment/vercel-staging.json
  - scripts/check-deployment-foundation.mjs
  - scripts/assert-vercel-preview-bootstrap-enabled.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - scripts/smoke-web-deployment.mjs
  - turbo.json
test_refs:
  - tests/unit/build-artifact.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/security/sast-config.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - docs/testing/BL-002_VERIFICATION.md
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-preview-bootstrap-policy.test.mjs
  - tests/security/vercel-preview-bootstrap-gate.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
  - docs/testing/BL-080_VERIFICATION.md
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/database/database-migration-failure.test.mjs
  - tests/database/database-migrations.test.mjs
  - docs/testing/BL-004_VERIFICATION.md
  - tests/unit/observability-core.test.mjs
  - tests/unit/observability-node.test.mjs
  - tests/integration/observability-flow.test.mjs
  - tests/contracts/observability-contract.test.mjs
  - tests/security/observability-security.test.mjs
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/contracts-runtime.test.mjs
  - tests/contracts/contracts-artifacts.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/unit/owned-path-policy.test.mjs
  - tests/contracts/document-policy.test.mjs
  - tests/contracts/document-integrity.test.mjs
supersedes: null
---

# Pipeline CI/CD

## Contratto corrente

| Job | Responsabilità | Failure behavior |
|---|---|---|
| `Quality` | format, lint, typecheck con declaration dependency build, gate documentale composto, confini, policy CI e desired state deploy | blocca build e gate |
| `Tests` | unit, integration, migration PostgreSQL reale e contract | fixture rossa o failure/cleanup database propagano exit non-zero |
| `Security` | SAST locale, test/secret scan e dependency audit | warning SAST, high/critical o scan fallito bloccano |
| `Build artifact` | build completo, staging allowlisted, manifest e upload | manca/secret/checksum/symlink non sicuro bloccano |
| `CI / Merge gate` | fan-in con `always()` | passa solo con quattro risultati `success` |

Trigger: PR, push su `main`, merge queue e dispatch manuale. Il workflow non usa path filter, così il check richiesto non resta pending su cambi non selezionati.

## Ruleset obbligatorie su `main` e `release/production`

Le due Ruleset GitHub devono essere `active`, richiedere una pull request e il solo status check `CI / Merge gate`, senza bypass ordinario. `main-required-ci` usa il target `~DEFAULT_BRANCH`; `release-production-required-ci` usa l'inclusione esatta `refs/heads/release/production`. Il check va selezionato dopo almeno una run completata; GitHub identifica il contesto con il nome del job, non con il nome del workflow.

Stato corrente: la Ruleset [`main-required-ci` (`18877721`)](https://github.com/Emacore17/dnd-ai/rules/18877721) è `active` sul repository pubblico, target `~DEFAULT_BRANCH`, senza bypass. Richiede una pull request e il solo check `CI / Merge gate` in modalità strict, vincolato a GitHub Actions con `integration_id=15368`. L'API delle regole applicabili a `main` conferma la stessa configurazione.

La branch riservata `release/production` è stata creata da `ef803add249d16ded6f94936c59531047c8a92fa` e protetta dalla Ruleset dedicata [`18926413`](https://github.com/Emacore17/dnd-ai/rules/18926413), attiva e senza bypass. Il contenimento commit `4d3d4ba` è stato integrato con PR #13 nel merge `61e5cbd`; run PR `29332953627` e post-merge `29333105276` sono 5/5 `SUCCESS`, senza nuovi deployment Vercel nel readback successivo. Ruleset `main`, branch release ed environment GitHub `staging` non sono stati modificati.

Verifica operativa:

1. aprire una PR pulita e attendere tutti i job verdi;
2. attivare la Ruleset e controllare che `CI / Merge gate` sia required;
3. aprire una seconda PR con una unit fixture intenzionalmente fallita;
4. verificare job rosso, gate rosso e merge state `BLOCKED`;
5. chiudere la PR negativa, rimuovere la branch e registrare URL/ruleset ID nel report.

La verifica di accettazione è registrata in `docs/testing/BL-002_VERIFICATION.md`: la PR negativa #3/run `29256736728` ha prodotto gate rosso e `mergeStateStatus=BLOCKED`, quindi è stata chiusa senza merge; la PR #1/run `29257544214` è stata unita senza bypass e la run push `29257721274` su `main` è passata.

Non disabilitare il gate per risolvere una coda. Se un job viene cancellato o saltato, `scripts/assert-ci-results.mjs` lo considera fallito.

## Preview/staging web

`BL-080` aggiunge un workflow separato `Staging smoke`; non modifica il trust boundary della PR e non distribuisce da GitHub Actions. La PR #12 è rimasta senza deployment, ma il merge su `main` ha generato un deployment Production. Il relativo `repository_dispatch` ha creato un job `Staging / Smoke` `skipped`, perché il predicate accetta soltanto payload Preview validi. Contenimento PR #13, guard PR #14, payload PR #15 e freeze PR #16 sono integrati; PR #16/merge `aa9342d` ha CI `29343319207`/`29343526054` 5/5 verde e zero deployment Vercel. Git auto-deploy resta disabilitato e CI verde non viene trattata come prova del target provider.

La build Vercel usa un entrypoint distinto e obbligatorio: `apps/web/vercel.json` imposta `buildCommand` a `node scripts/assert-vercel-preview-build.mjs && pnpm run build`; il primo controllo strict prosegue soltanto con la tripla esatta `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`. Il normale `pnpm build` locale accetta soltanto l'assenza contemporanea dei tre metadata; valori parziali, incoerenti, Production, development o custom falliscono prima di Next con errore statico redatto. `turbo.json` include i tre valori nella chiave del task build, così una cache locale non può confondere modalità local e Preview.

Il guard non seleziona l'environment e non impedisce al provider di creare un record deployment: può soltanto bloccare il completamento della build dopo che Vercel ha scelto il target. Dopo policy payload e dry-run valido, il singolo retry con `--target=preview` ha creato comunque un record `target=production`, poi rimosso. L'audit del tag CLI `55.0.0` prova che il parser conserva Preview, ma `@vercel/client 17.6.4` lo imposta a `undefined` prima della POST; la regola first-deployment e `vercel/vercel#17069` sostengono l'ipotesi server più forte, senza confermarla né fornire un fix supportato. Nessun nuovo smoke è partito.

La CLI ha un confine sorgenti distinto dall'artifact CI: la denylist root `.vercelignore` esclude cache e output generati, e non deve esistere un override `apps/web/.vercelignore`. Il dry-run `vercel@55.0.0 deploy . --project dnd-ai-web --scope emacore17s-projects --target=preview --dry --format=json --yes` resta ammesso senza upload/deployment e il JSON deve superare `scripts/check-vercel-deploy-dry-run.mjs`. Il checker richiede root esatta, framework `nextjs`, file indispensabili regolari con hash valido, mode file/directory zero-byte supportati, path univoci e sicuri, massimo 15.000 entry, massimo 10 MiB totali e massimo 5 MiB per file. `source.manualDeployment.enabled=false` e `deploy:bootstrap:check` rendono fail-closed il percorso operativo approvato; non sono enforcement provider contro un owner. Un exit `0` richiederebbe comunque un nuovo runbook approvato. `--cwd apps/web`, `--prebuilt`, archivi, `--prod`, `promote`, `redeploy`, `--skip-domain`, custom target e override manuali `VERCEL*` restano vietati; `git.deploymentEnabled=false` e `source.autoDeploy=false` restano invariati.

Il job `Staging / Smoke`:

- usa soltanto `contents: read` e `id-token: write`; le quattro action/step, i relativi SHA e lo script OIDC sono una sequenza chiusa verificata per contratto;
- entra nell'environment GitHub `staging`, protetto dalla sola branch policy `main` e privo di secret;
- accetta soltanto project `dnd-ai-web`, ref `main`, environment `preview`, action `ready` e state `success`;
- passa il payload non affidabile tramite `GITHUB_EVENT_PATH` al verifier, mai a una shell interpolation;
- ottiene con `core.getIDToken()` un token GitHub OIDC breve, mascherato, e lo inoltra solo nell'header `x-vercel-trusted-oidc-idp-token`;
- ignora l'URL dell'evento e usa esclusivamente l'origin branch esatta versionata dopo aver verificato installation ID della GitHub App, project/deployment ID, SHA, ref, repository, environment, regione e `/health`;
- propaga ogni failure e annulla run stale per project/ref.

Il progetto applica Standard Protection con policy SSO predefinita `all_except_custom_domains`; la Trusted Source limita già l'OIDC a issuer GitHub, audience account, repository + repository ID immutabile/ref/environment esatti e target `preview`. Il workflow non pubblica un URL non validato nell'environment GitHub. Non introdurre `VERCEL_TOKEN`, automation bypass secret, Deploy Hook, `pull_request_target`, `vercel deploy --prod`, `--prebuilt`, `promote` o checkout del commit indicato dall'evento. La Git Integration ricostruisce il commit anziché caricare `artifacts/bl002`; l'identità immutabile del deploy è quindi project ID + deployment ID + SHA + health contract.

Desired state e procedura sono in [`PREVIEW_STAGING.md`](PREVIEW_STAGING.md). Production Branch Vercel continua a essere riletta `release/production`, ma né policy linked né selector CLI hanno impedito i record Production nello stato iniziale senza deployment. PR #13 ha riportato Quality a `pnpm deploy:check`, binding `null` e Git spento; PR #16 ha integrato il freeze. Project/link/Trusted Source remoti e grant condiviso restano invariati. Dry-run e contenimento sono verificati, ma ogni nuova creazione è congelata; Preview, smoke, failure e redeploy restano aperti. `BL-080` è `BLOCKED/50%/PARTIAL`, `BL-004` `DONE/100%/PASSING` e `BL-079` `BACKLOG`.

## Osservabilità nel gate

`BL-008` usa i job esistenti senza modificare workflow, permessi, cache, Ruleset o provider. Unit e integration provano tracing, concorrenza e failure containment con exporter in-memory; contract e security provano dipendenze, startup, redazione, assenza di rete e confine bundle browser/Node. Sentry usa transport fake e nessuna suite richiede account, DSN reale, token o backend OTLP.

L'artifact può includere `packages/observability/dist` come output compilato allowlisted, ma non file ambientali, telemetry output o log. Il check sul bundle Next rifiuta marker Node/Sentry server negli artifact client; Replay, profiling, tunnel, source map upload e auto-instrumentation restano vietati.

La prima run della PR #20 ha fallito nel solo job Security perché pnpm 10 chiamava gli endpoint audit legacy rimossi dal registry con HTTP `410`; non era un finding di vulnerabilità. La correzione pinna pnpm `11.13.0`, che usa l'endpoint bulk, conserva il comando esatto `pnpm audit --audit-level=high` senza ignore e impone lo stesso pin in manifest e setup action tramite contract test. Il validator rifiuta flag aggiuntivi, inclusa la variante `--ignore-registry-errors`, che trasformerebbe un errore registry in successo. Le policy progetto sono migrate in `pnpm-workspace.yaml`; `@sentry/cli` resta esplicitamente negato in `allowBuilds`, global virtual store e peer auto-install sono disabilitati e `verifyDepsBeforeRun: error` impedisce install impliciti prima degli script. La correzione è integrata tramite PR #20/merge `ccecd683`; la run post-merge `29415397361` ha concluso tutti i cinque job con `SUCCESS`.

## Contratti generati nel gate

`BL-009` mantiene `pnpm contracts:check` come comando specialistico e il full `verify` usa direttamente lo stesso generator. `GOV-002` compone nel job Quality un solo `pnpm docs:check`: build di `@dnd-ai/contracts`, generated drift, metadata/link/anchor/section refs/registro ADR/Mermaid e task graph. Il comando non scrive nel workspace e fallisce su artifact missing, stale, unexpected, root collegati, modifiche a major pubblicati o documentazione incoerente.

Il solo writer supportato è `pnpm contracts:generate`. La compatibility baseline è il tree Git protetto: `origin/main` in locale e `HEAD^1` in CI. Quality usa `fetch-depth: 2` e passa `CONTRACT_BASE_REF=HEAD^1` al solo step `pnpm docs:check`; il checker non esegue fetch e fallisce se la base non è disponibile. Il bootstrap ammette il primo `v1`, poi ogni major pubblicato resta immutabile e un wire change richiede `v2` parallelo. Il workflow policy contract richiede comando, base e depth, così rimuoverli o reintrodurre step separati rende rossa la suite. JSON Schema viene inoltre compilato con Ajv 2020 e confrontato con Zod su fixture valide/negative; test temporanei provano breaking regeneration e junction senza toccare gli artifact reali.

## Cache e artifact

La setup action installa Node/pnpm pin e usa soltanto `setup-node` con cache `pnpm` e `pnpm-lock.yaml`. Non aggiungere env, home, workspace, `.turbo`, `.next`, `node_modules` o report al path cache.

L’artifact caricato è soltanto `artifacts/bl002`, directory ignorata da Git e rigenerata da zero. `manifest.json` usa schema `build-artifact-v1`; `payload/` contiene gli output ammessi, incluso `packages/config/dist` ma mai file ambientali. `include-hidden-files: true` è necessario per la struttura `.next`, ma è sicuro soltanto perché lo staging rifiuta `.env`, credenziali, log, symlink esterni e file con pattern secret prima dell’upload.

Comandi locali:

```powershell
corepack pnpm@11.13.0 verify
corepack pnpm@11.13.0 db:migrate:test
corepack pnpm@11.13.0 scan:sast
corepack pnpm@11.13.0 audit --audit-level=high
corepack pnpm@11.13.0 contracts:generate
corepack pnpm@11.13.0 contracts:check
corepack pnpm@11.13.0 docs:check
corepack pnpm@11.13.0 artifact:prepare
corepack pnpm@11.13.0 artifact:verify
corepack pnpm@11.13.0 deploy:check
$dryRun = corepack pnpm dlx vercel@55.0.0 deploy . --project dnd-ai-web --scope emacore17s-projects --target=preview --dry --format=json --yes
if ($LASTEXITCODE -ne 0) { throw "preview-dry-run: Vercel command failed" }
$dryRun | node scripts/check-vercel-deploy-dry-run.mjs
if ($LASTEXITCODE -ne 0) { throw "preview-dry-run: source manifest rejected" }
```

## Gate differiti e owner

| Gate normativo | Owner |
|---|---|
| migration PostgreSQL baseline, dry run e failure path | `BL-004` chiuso con CI PR `29351291907` 5/5 `SUCCESS` |
| harness condiviso PostgreSQL/Redis e suite database funzionali successive | `QA-001` e task proprietari |
| schema/OpenAPI/event compatibility | `BL-009`: implementata; review e full gate PASS, clean verify e CI PR pendenti |
| coverage rules/domain ≥80% e report | `QA-001` |
| browser, bundle e accessibility budget | `BL-079`, `QA-001` |
| secret manager, preview/staging M0, deploy smoke e rollback minimo | `BL-080`; contratto di injection già in `BL-003` |
| eval prompt/schema | `BL-068` |
| container, SBOM, image scan, load/chaos, restore e release hardening | `BL-070` |

I comandi non ancora implementati non hanno placeholder verdi: entrano nel workflow insieme al rispettivo runtime e acceptance test.
`BL-080` è il primo owner deployabile della milestone M0: sceglie secret manager/provider e registra project/resource ID, regione, environment, commit e run URL senza includere credenziali. Deve usare `runtime-config-v1`, dati sintetici e un environment protetto; il suo smoke sblocca i consumer pianificati e `GATE-M0`. La separazione definitiva staging/production, il load profile e i drill operativi restano a `BL-070`.
