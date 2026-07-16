---
status: active
owner: engineering
last_reviewed: 2026-07-16
last_verified_commit: dac74168f56a422ca36aad1a8297f447ee174c9b
source_refs:
  - AGENTS.md
  - docs/TASKS.md#6-contesto-e-documentazione-living
  - docs/adr/0008-zod-first-contract-generation.md
  - docs/adr/0009-mvp-runtime-data-and-workflow-architecture.md
  - docs/adr/README.md
  - docs/superpowers/specs/2026-07-16-doc-arch-001-design.md
  - docs/superpowers/specs/2026-07-16-qa-001-test-foundation-design.md
  - docs/superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md
  - docs/superpowers/plans/2026-07-16-bl-079-design-system-core.md
related_tasks:
  - GOV-001
  - GOV-004
  - BL-001
  - BL-002
  - BL-003
  - BL-004
  - BL-008
  - BL-009
  - BL-079
  - BL-080
  - BL-081
  - QA-001
  - QA-002
  - DOC-ARCH-001
code_refs:
  - apps/web/components.json
  - apps/web/components/static-game-shell.tsx
  - apps/web/components/ui
  - packages/testing
  - scripts/run-tests.mjs
  - scripts/lib/test-report-policy.mjs
  - packages/observability
  - apps/api/src/observability.ts
  - apps/worker/src/observability.ts
  - apps/web/instrumentation.ts
  - apps/web/instrumentation-client.ts
  - packages/persistence
  - packages/contracts/src
  - packages/contracts/generated/v1
  - scripts/generate-contracts.mjs
  - scripts/lib/contract-compatibility-policy.mjs
  - scripts/lib/owned-path-policy.mjs
  - scripts/run-database-migrations.mjs
  - infra/local/postgres.compose.yml
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/web-design-system.test.mjs
  - tests/integration/web-game-shell.test.mjs
  - docs/testing/BL-003_VERIFICATION.md
  - docs/testing/BL-080_VERIFICATION.md
  - tests/database/database-migrations.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/database/database-migration-failure.test.mjs
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
  - tests/unit/testing-primitives.test.mjs
  - tests/integration/testing-containers.test.mjs
  - tests/security/test-report-security.test.mjs
  - tests/contracts/architecture-documentation.test.mjs
supersedes: null
---

# Documentazione del progetto

## Ordine di lettura per una cold start

1. [`AGENTS.md`](../AGENTS.md) — regole stabili, invarianti e workflow.
2. [`docs/CONTEXT.md`](CONTEXT.md) — snapshot operativo verificato.
3. [`docs/TASKS.md`](TASKS.md) — task, dipendenze, quality gate ed evidenze.
4. Sezioni della [`docs/MVP_SPEC.md`](MVP_SPEC.md) indicate dal task.
5. ADR e documenti living collegati dal task.

## Documenti attivi

| Documento | Autorità |
|---|---|
| [`MVP_SPEC.md`](MVP_SPEC.md) | Scope, requisiti e architettura normativa |
| [`TASKS.md`](TASKS.md) | Backlog, ordine, dipendenze, stato ed evidenze |
| [`CONTEXT.md`](CONTEXT.md) | Milestone, task corrente/READY, versioni, decisioni e rischi |
| [`TRACEABILITY.md`](TRACEABILITY.md) | Requisito → task → test → evidenza |
| [`CHANGELOG.md`](CHANGELOG.md) | Modifiche documentali e contrattuali significative |
| [`product/UX_UI_DESIGN.md`](product/UX_UI_DESIGN.md) | Contratto UX/UI mobile-first, design system e motion |
| [`adr/README.md`](adr/README.md) | Registro completo e validato delle decisioni architetturali |
| [`adr/0001-mobile-first-conversational-ui.md`](adr/0001-mobile-first-conversational-ui.md) | Decisione accepted su shell, stack visuale e guardrail |
| [`architecture/SYSTEM_OVERVIEW.md`](architecture/SYSTEM_OVERVIEW.md) | Inventario e dipendenze implementate, topologia target e capability non disponibili |
| [`adr/0002-monorepo-package-boundaries.md`](adr/0002-monorepo-package-boundaries.md) | Decisione accepted su workspace e boundary enforcement |
| [`testing/BL-001_VERIFICATION.md`](testing/BL-001_VERIFICATION.md) | Evidenza riproducibile della clean-worktree verification di BL-001 |
| [`adr/0003-ci-trust-boundary-and-artifacts.md`](adr/0003-ci-trust-boundary-and-artifacts.md) | Decisione accepted su trust boundary, cache, gate e artifact CI |
| [`operations/CI_CD.md`](operations/CI_CD.md) | Contratto operativo della pipeline e configurazione Ruleset |
| [`testing/BL-002_VERIFICATION.md`](testing/BL-002_VERIFICATION.md) | Evidenze locali e remote di BL-002 |
| [`adr/0004-runtime-configuration-and-secret-injection.md`](adr/0004-runtime-configuration-and-secret-injection.md) | Decisione accepted su config server-only, profili e secret injection |
| [`operations/CONFIGURATION.md`](operations/CONFIGURATION.md) | Matrice variabili, setup locale, redazione e ownership ambienti |
| [`testing/BL-003_VERIFICATION.md`](testing/BL-003_VERIFICATION.md) | Evidenze locali, clean-worktree e CI Linux di BL-003 |
| [`adr/0005-vercel-web-preview-and-staging.md`](adr/0005-vercel-web-preview-and-staging.md) | Decisione proposed su provider, trust boundary e staging web |
| [`operations/PREVIEW_STAGING.md`](operations/PREVIEW_STAGING.md) | Desired state, setup sicuro, smoke e recupero preview/staging |
| [`testing/BL-080_VERIFICATION.md`](testing/BL-080_VERIFICATION.md) | Evidenze parziali e gate remoti ancora aperti di BL-080 |
| [`adr/0006-postgresql-migration-foundation.md`](adr/0006-postgresql-migration-foundation.md) | Decisione accepted su tool, baseline, checksum, lock e rollback database |
| [`operations/DATABASE_MIGRATIONS.md`](operations/DATABASE_MIGRATIONS.md) | Runbook locale/CI per PostgreSQL e migrazioni forward-only |
| [`testing/BL-004_VERIFICATION.md`](testing/BL-004_VERIFICATION.md) | Evidenze riproducibili e gate di chiusura della fondazione migration BL-004 |
| [`adr/0007-observability-context-and-error-reporting.md`](adr/0007-observability-context-and-error-reporting.md) | Decisione accepted su OTel, request context, logging redatto e Sentry error-only |
| [`superpowers/specs/2026-07-15-bl-008-observability-baseline-design.md`](superpowers/specs/2026-07-15-bl-008-observability-baseline-design.md) | Design attivo del contratto `observability-baseline-v1` |
| [`superpowers/plans/2026-07-15-bl-008-observability-baseline.md`](superpowers/plans/2026-07-15-bl-008-observability-baseline.md) | Piano TDD e gate HIGH_RISK di BL-008 |
| [`adr/0008-zod-first-contract-generation.md`](adr/0008-zod-first-contract-generation.md) | Decisione accepted su fonte Zod, versioning, OpenAPI components-only e generated drift |
| [`adr/0009-mvp-runtime-data-and-workflow-architecture.md`](adr/0009-mvp-runtime-data-and-workflow-architecture.md) | Decisione accepted su runtime, trasporti, stato autorevole e workflow MVP |
| [`api/README.md`](api/README.md) | Catalogo `api-contract-v1`, uso runtime, artefatti e politica di versione |
| [`superpowers/specs/2026-07-15-bl-009-contract-generation-design.md`](superpowers/specs/2026-07-15-bl-009-contract-generation-design.md) | Design della vertical slice contrattuale BL-009 |
| [`superpowers/plans/2026-07-15-bl-009-contract-generation.md`](superpowers/plans/2026-07-15-bl-009-contract-generation.md) | Piano TDD e gate HIGH_RISK di BL-009 |
| [`superpowers/specs/2026-07-16-qa-001-test-foundation-design.md`](superpowers/specs/2026-07-16-qa-001-test-foundation-design.md) | Design approvato di `testing-foundation-v1` e decomposizione QA-001/QA-002 |
| [`superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md`](superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md) | Decisione local-first che separa BL-079, BL-081, QA-002 e smoke remoto |
| [`superpowers/plans/2026-07-16-gov-004-unblock-ui-dependencies.md`](superpowers/plans/2026-07-16-gov-004-unblock-ui-dependencies.md) | Piano esecutivo e gate FAST di GOV-004 |
| [`superpowers/plans/2026-07-16-bl-079-design-system-core.md`](superpowers/plans/2026-07-16-bl-079-design-system-core.md) | Piano TDD e gate HIGH_RISK della foundation shadcn/Tailwind e shell statica BL-079 |
| [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md) | Contratto operativo di runner, fixture, container, coverage e report non-browser |
| [`data/DATA_MODEL.md`](data/DATA_MODEL.md) | Schema fisico implementato e modello logico pianificato |
| [`operations/LOCAL_DEVELOPMENT.md`](operations/LOCAL_DEVELOPMENT.md) | Cold start, readiness e cleanup dello sviluppo locale |

## Documenti pianificati

I path seguenti sono pianificati e non sono link finché non esistono:

- `docs/testing/AI_EVALS.md` — `DOC-TEST-001`;
- `docs/testing/RELEASE_EVIDENCE.md` — `DOC-TEST-001`;
- `docs/features/CHARACTER_CREATION.md` — `DOC-CHAR-001`;
- `docs/features/CAMPAIGN_GENERATION.md` — `DOC-CAMP-001`;
- `docs/features/TURN_LOOP.md` — `DOC-TURN-001`;
- `docs/features/RULES_ENGINE.md` — `DOC-RULES-001`;
- `docs/features/MEMORY_NPC.md` — `DOC-MEM-001`;
- `docs/features/PROGRESSION_ENDINGS.md` — `DOC-END-001`;
- `docs/security/THREAT_MODEL.md` e `docs/security/MODERATION_POLICY.md` — `DOC-SEC-001`;
- `docs/operations/RUNBOOK.md` — `DOC-OPS-001`;
- `docs/events/EVENT_CATALOG.md` — task delle relative feature.

## Regole di manutenzione

- Non duplicare lo stato volatile fuori da `CONTEXT` e `TASKS`.
- Un path futuro resta in codice ed è marcato con task; non creare link rotti.
- Aggiornare front matter, tracciabilità e changelog nello stesso change set.
- Rieseguire il controllo documentale e la cold-start review prima di chiudere un task.
