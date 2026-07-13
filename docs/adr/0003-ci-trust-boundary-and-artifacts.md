---
status: accepted
owner: engineering-and-security
last_reviewed: 2026-07-13
last_verified_commit: f1be878b291a535ea6c8e0d995ee5e3c80ef164c
source_refs:
  - docs/MVP_SPEC.md#2612-ci-quality-gates
  - docs/MVP_SPEC.md#294-cicd
related_tasks:
  - BL-002
code_refs:
  - .github/workflows/ci.yml
  - .github/actions/setup-workspace/action.yml
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/lib/build-artifact.mjs
  - scripts/lib/secret-scanner.mjs
test_refs:
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/security/sast-config.test.mjs
  - tests/security/secret-scanner.test.mjs
supersedes: null
---

# ADR-0003 — Trust boundary, gate e artifact della CI

## Stato

Accepted il 2026-07-13 durante `BL-002`.

## Contesto

La CI esegue codice proveniente da pull request e dipendenze esterne. Deve bloccare regressioni senza concedere credenziali inutili, permettere di rendere obbligatorio un check stabile e produrre un artifact verificabile. Next standalone generato con pnpm contiene inoltre junction interni che non possono essere caricati come link assoluti della macchina di build.

## Decisione

1. Il workflow usa `pull_request`, push su `main`, `merge_group` e dispatch manuale; `pull_request_target` è vietato.
2. Il token è read-only per l'intero workflow; ogni job eredita soltanto `contents: read`. Checkout usa `persist-credentials: false` e nessun secret applicativo entra nel workflow base.
3. Ogni action esterna è pin a SHA completo. Un contract test fallisce su tag mobili, permessi ampi, trigger privilegiati o interpolazione non affidabile nei comandi shell.
4. Quality, tests, security e build sono job separati. `CI / Merge gate` usa `always()` e fallisce se una dipendenza è failed, cancelled, skipped o missing. La Ruleset di `main` richiede soltanto questo nome stabile.
5. La cache contiene esclusivamente lo store pnpm lockfile-scoped. Non vengono memorizzati `.turbo`, `.next`, `node_modules`, env, log, report o artifact.
6. Il build precede l’artifact. Lo staging copia una allowlist di Next standalone/static e `dist`, rifiuta path sensibili e symlink esterni, scansiona credenziali e genera un manifest SHA-256. I junction pnpm di Next sono dereferenziati soltanto verso la copia traced interna.
7. SAST locale con `eslint-plugin-security@4.0.1`, secret scan versionato e `pnpm audit` compongono il gate security. Ogni warning SAST, finding high/critical o scan fallito blocca; i finding inferiori dell'audit sono comunque esaminati e mitigati o tracciati.
8. Nessun deploy è incluso in questa baseline. Quando arriverà il deploy cloud userà OIDC e environment protection, non chiavi cloud long-lived.

## Alternative considerate

### Un solo job sequenziale

Rifiutato: riduce leggibilità e parallelismo e rende instabile il nome del check richiesto. Il fan-in esplicito conserva un unico gate di merge.

### `pull_request_target` per usare cache o secret

Rifiutato: il codice della PR è non affidabile e non richiede privilegi. Il trigger ordinario `pull_request` è sufficiente.

### Cache di Turbo/Next e upload diretto dei glob di build

Rinviati: cache e glob ampi aumentano la superficie di poisoning/esfiltrazione. La baseline ricostruisce output e carica soltanto staging validato; remote cache potrà essere aggiunta con threat review e metriche.

### Scanner secret SaaS

Non adottato nella baseline: introduce configurazione/licenza e un nuovo confine dati. Lo scanner locale non sostituisce il futuro hardening, ma è deterministico, redatto e testabile.

### CodeQL come gate baseline

Non adottato nella baseline: al momento della decisione Code Scanning non era abilitato sul repository privato e l'API restituiva `403`, mentre attivare implicitamente un servizio potenzialmente a pagamento non era accettabile. Dopo la pubblicazione del repository l'entitlement può essere rivalutato, ma il SAST locale resta il gate deterministico e riproducibile deciso per `BL-002`; CodeQL potrà aggiungere difesa in profondità senza sostituirlo.

## Conseguenze e revisione

La pipeline è più esplicita e riproducibile, ma ripete install/build in job isolati e l’artifact Next richiede circa 49 MB nel primo scaffold. La Ruleset `main-required-ci` (`18877721`) applica la decisione senza bypass ordinario e vincola il gate all'app GitHub Actions. Rivalutare cache remota, CodeQL, SBOM/container e split artifact quando esistono deploy target, metriche CI o immagini container; ogni estensione deve mantenere il gate fail-closed e aggiornare policy, test e runbook.
