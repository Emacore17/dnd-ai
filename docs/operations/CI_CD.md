---
status: active
owner: engineering-and-security
last_reviewed: 2026-07-13
last_verified_commit: ae88583dc2cc8ae9d8e869f5ca324c5b3585095e
source_refs:
  - docs/MVP_SPEC.md#2612-ci-quality-gates
  - docs/MVP_SPEC.md#294-cicd
related_tasks:
  - BL-002
  - BL-080
  - QA-001
  - BL-070
code_refs:
  - .github/workflows/ci.yml
  - .github/actions/setup-workspace/action.yml
  - apps/web/artifact-runtime/start.mjs
  - scripts/assert-ci-results.mjs
  - scripts/create-build-artifact.mjs
  - scripts/smoke-build-artifact.mjs
test_refs:
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/integration/artifact-runtime.test.mjs
  - tests/security/sast-config.test.mjs
  - docs/testing/BL-002_VERIFICATION.md
supersedes: null
---

# Pipeline CI/CD

## Contratto corrente

| Job | Responsabilità | Failure behavior |
|---|---|---|
| `Quality` | format, lint, typecheck, confini, task graph e policy CI | blocca build e gate |
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

## Cache e artifact

La setup action installa Node/pnpm pin e usa soltanto `setup-node` con cache `pnpm` e `pnpm-lock.yaml`. Non aggiungere env, home, workspace, `.turbo`, `.next`, `node_modules` o report al path cache.

L’artifact caricato è soltanto `artifacts/bl002`, directory ignorata da Git e rigenerata da zero. `manifest.json` usa schema `build-artifact-v1`; `payload/` contiene gli output ammessi. `include-hidden-files: true` è necessario per la struttura `.next`, ma è sicuro soltanto perché lo staging rifiuta `.env`, credenziali, log, symlink esterni e file con pattern secret prima dell’upload. I private-hoist link pnpm non materializzati da Next vengono omessi senza dereferenziare lo store esterno; `web/start.mjs` ripristina la risoluzione soltanto verso il mirror incluso nel payload. Dopo checksum e secret scan, `artifact:smoke` avvia il standalone isolato, richiede `/`, verifica la shell e chiude il processo con timeout bounded.

Comandi locali:

```powershell
corepack pnpm@10.34.5 verify
corepack pnpm@10.34.5 scan:sast
corepack pnpm@10.34.5 audit --audit-level=high
corepack pnpm@10.34.5 artifact:prepare
corepack pnpm@10.34.5 artifact:verify
corepack pnpm@10.34.5 artifact:smoke
```

## Gate differiti e owner

| Gate normativo | Owner |
|---|---|
| migration dry run/PG/Redis | `BL-004`, `QA-001` |
| schema/OpenAPI/event compatibility | `BL-009` |
| coverage rules/domain ≥80% e report | `QA-001` |
| browser, bundle e accessibility budget | `BL-079`, `QA-001` |
| preview/staging M0, deploy smoke e rollback minimo | `BL-003`, `BL-080` |
| eval prompt/schema | `BL-068` |
| container, SBOM, image scan, load/chaos, restore e release hardening | `BL-070` |

I comandi non ancora implementati non hanno placeholder verdi: entrano nel workflow insieme al rispettivo runtime e acceptance test.

`BL-080` è il primo owner deployabile della milestone M0: registra provider, project/resource ID, regione, environment, commit e run URL senza includere credenziali. Deve usare la typed config di `BL-003`, dati sintetici e un environment protetto; il suo smoke rende verificabili BL-079 e `GATE-M0`. La separazione definitiva staging/production, il load profile e i drill operativi restano a `BL-070`.
