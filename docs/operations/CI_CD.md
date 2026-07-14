---
status: active
owner: engineering-and-security
last_reviewed: 2026-07-14
last_verified_commit: 50efcbe620ad7c1fc6eb3cf1b79cdb27b0c383af
source_refs:
  - docs/MVP_SPEC.md#2612-ci-quality-gates
  - docs/MVP_SPEC.md#294-cicd
related_tasks:
  - BL-002
  - BL-003
  - BL-080
  - QA-001
  - BL-070
code_refs:
  - .github/workflows/ci.yml
  - .github/actions/setup-workspace/action.yml
  - packages/config
  - scripts/assert-ci-results.mjs
  - scripts/create-build-artifact.mjs
  - .github/workflows/deployment-smoke.yml
  - infra/deployment/vercel-staging.json
  - scripts/check-deployment-foundation.mjs
  - scripts/smoke-web-deployment.mjs
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
  - docs/testing/BL-080_VERIFICATION.md
supersedes: null
---

# Pipeline CI/CD

## Contratto corrente

| Job | Responsabilità | Failure behavior |
|---|---|---|
| `Quality` | format, lint, typecheck con declaration dependency build, confini, task graph, policy CI e desired state deploy | blocca build e gate |
| `Tests` | unit, integration e contract | la fixture rossa prova exit `1` |
| `Security` | SAST locale, test/secret scan e dependency audit | warning SAST, high/critical o scan fallito bloccano |
| `Build artifact` | build completo, staging allowlisted, manifest e upload | manca/secret/checksum/symlink non sicuro bloccano |
| `CI / Merge gate` | fan-in con `always()` | passa solo con quattro risultati `success` |

Trigger: PR, push su `main`, merge queue e dispatch manuale. Il workflow non usa path filter, così il check richiesto non resta pending su cambi non selezionati.

## Ruleset obbligatoria su `main`

La Ruleset GitHub deve essere `active`, target `~DEFAULT_BRANCH`, richiedere una pull request e il solo status check `CI / Merge gate`, senza bypass ordinario. Il check va selezionato dopo almeno una run completata; GitHub identifica il contesto con il nome del job, non con il nome del workflow.

Stato corrente: la Ruleset [`main-required-ci` (`18877721`)](https://github.com/Emacore17/dnd-ai/rules/18877721) è `active` sul repository pubblico, target `~DEFAULT_BRANCH`, senza bypass. Richiede una pull request e il solo check `CI / Merge gate` in modalità strict, vincolato a GitHub Actions con `integration_id=15368`. L'API delle regole applicabili a `main` conferma la stessa configurazione.

Verifica operativa:

1. aprire una PR pulita e attendere tutti i job verdi;
2. attivare la Ruleset e controllare che `CI / Merge gate` sia required;
3. aprire una seconda PR con una unit fixture intenzionalmente fallita;
4. verificare job rosso, gate rosso e merge state `BLOCKED`;
5. chiudere la PR negativa, rimuovere la branch e registrare URL/ruleset ID nel report.

La verifica di accettazione è registrata in `docs/testing/BL-002_VERIFICATION.md`: la PR negativa #3/run `29256736728` ha prodotto gate rosso e `mergeStateStatus=BLOCKED`, quindi è stata chiusa senza merge; la PR #1/run `29257544214` è stata unita senza bypass e la run push `29257721274` su `main` è passata.

Non disabilitare il gate per risolvere una coda. Se un job viene cancellato o saltato, `scripts/assert-ci-results.mjs` lo considera fallito.

## Preview/staging web

`BL-080` aggiunge un workflow separato `Staging smoke`; non modifica il trust boundary della PR e non distribuisce da GitHub Actions. Vercel Git Integration è la sorgente proposta del deploy automatico e invia `repository_dispatch` con action `vercel.deployment.ready` quando una Preview è costruita ma non promossa. Il payload valido porta `state.type=success`: action e state appartengono a due contratti distinti e sono entrambi verificati.

Il job `Staging / Smoke`:

- usa soltanto `contents: read` e `id-token: write`; le quattro action/step, i relativi SHA e lo script OIDC sono una sequenza chiusa verificata per contratto;
- entra nell'environment GitHub `staging`, protetto dalla sola branch policy `main` e privo di secret;
- accetta soltanto project `dnd-ai-web`, ref `main`, environment `preview`, action `ready` e state `success`;
- passa il payload non affidabile tramite `GITHUB_EVENT_PATH` al verifier, mai a una shell interpolation;
- ottiene con `core.getIDToken()` un token GitHub OIDC breve, mascherato, e lo inoltra solo nell'header `x-vercel-trusted-oidc-idp-token`;
- ignora l'URL dell'evento e usa esclusivamente l'origin branch esatta versionata dopo aver verificato installation ID della GitHub App, project/deployment ID, SHA, ref, repository, environment, regione e `/health`;
- propaga ogni failure e annulla run stale per project/ref.

La Preview conserva Standard Protection. Vercel Trusted Sources limita l'OIDC a issuer GitHub, audience account, repository + repository ID immutabile/ref/environment esatti e target `preview`; il workflow non pubblica un URL non validato nell'environment GitHub. Non introdurre `VERCEL_TOKEN`, automation bypass secret, Deploy Hook, `pull_request_target`, `vercel deploy --prod` o checkout del commit indicato dall'evento. La Git Integration ricostruisce il commit anziché caricare `artifacts/bl002`; l'identità immutabile del deploy è quindi project ID + deployment ID + SHA + health contract.

Desired state e procedura sono in [`PREVIEW_STAGING.md`](PREVIEW_STAGING.md). Project ID, scope slug, branch origin e GitHub App installation ID sono ancora `null` e l'auto-deploy è spento: `pnpm deploy:check` passa sul piano, mentre `pnpm deploy:check:linked` fallisce chiuso fino al link reale. Il manifest versiona già la policy di attivazione `{"*": false, "main": true}`; il contract test la impone nella config Vercel e richiede automaticamente `deploy:check:linked` nel Quality gate quando `source.autoDeploy` diventa `true`.

## Cache e artifact

La setup action installa Node/pnpm pin e usa soltanto `setup-node` con cache `pnpm` e `pnpm-lock.yaml`. Non aggiungere env, home, workspace, `.turbo`, `.next`, `node_modules` o report al path cache.

L’artifact caricato è soltanto `artifacts/bl002`, directory ignorata da Git e rigenerata da zero. `manifest.json` usa schema `build-artifact-v1`; `payload/` contiene gli output ammessi, incluso `packages/config/dist` ma mai file ambientali. `include-hidden-files: true` è necessario per la struttura `.next`, ma è sicuro soltanto perché lo staging rifiuta `.env`, credenziali, log, symlink esterni e file con pattern secret prima dell’upload.

Comandi locali:

```powershell
corepack pnpm@10.34.5 verify
corepack pnpm@10.34.5 scan:sast
corepack pnpm@10.34.5 audit --audit-level=high
corepack pnpm@10.34.5 artifact:prepare
corepack pnpm@10.34.5 artifact:verify
corepack pnpm@10.34.5 deploy:check
corepack pnpm@10.34.5 deploy:check:linked
```

## Gate differiti e owner

| Gate normativo | Owner |
|---|---|
| migration dry run/PG/Redis | `BL-004`, `QA-001` |
| schema/OpenAPI/event compatibility | `BL-009` |
| coverage rules/domain ≥80% e report | `QA-001` |
| browser, bundle e accessibility budget | `BL-079`, `QA-001` |
| secret manager, preview/staging M0, deploy smoke e rollback minimo | `BL-080`; contratto di injection già in `BL-003` |
| eval prompt/schema | `BL-068` |
| container, SBOM, image scan, load/chaos, restore e release hardening | `BL-070` |

I comandi non ancora implementati non hanno placeholder verdi: entrano nel workflow insieme al rispettivo runtime e acceptance test.
`BL-080` è il primo owner deployabile della milestone M0: sceglie secret manager/provider e registra project/resource ID, regione, environment, commit e run URL senza includere credenziali. Deve usare `runtime-config-v1`, dati sintetici e un environment protetto; il suo smoke sblocca i consumer pianificati e `GATE-M0`. La separazione definitiva staging/production, il load profile e i drill operativi restano a `BL-070`.
