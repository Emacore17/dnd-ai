---
status: active
owner: engineering
last_reviewed: 2026-07-16
last_verified_commit: a9a2e4ba3f53db1d3b9a1d1011f745f7ba50fdf2
source_refs:
  - AGENTS.md#3-gerarchia-delle-fonti-della-verità
  - docs/TASKS.md#gov-002--validazione-automatica-della-documentazione-e-tracciabilità
  - docs/adr/0009-mvp-runtime-data-and-workflow-architecture.md
  - docs/adr/0010-internal-provider-neutral-identity.md
related_tasks:
  - GOV-002
  - DOC-ARCH-001
  - BL-005
  - BL-006
code_refs:
  - scripts/lib/document-integrity-policy.mjs
test_refs:
  - tests/contracts/document-integrity.test.mjs
supersedes: null
---

# Registro delle decisioni architetturali

Il registro elenca ogni ADR numerato una sola volta. Stato e target sono verificati automaticamente da `pnpm docs:check` rispetto al front matter e ai file presenti.

| ADR | Titolo | Stato |
|---|---|---|
| [ADR-0001](0001-mobile-first-conversational-ui.md) | UI conversazionale mobile-first e stack visuale | `accepted` |
| [ADR-0002](0002-monorepo-package-boundaries.md) | Monorepo e package boundaries verificabili | `accepted` |
| [ADR-0003](0003-ci-trust-boundary-and-artifacts.md) | Trust boundary, gate e artifact della CI | `accepted` |
| [ADR-0004](0004-runtime-configuration-and-secret-injection.md) | Configurazione runtime e iniezione dei secret | `accepted` |
| [ADR-0005](0005-vercel-web-preview-and-staging.md) | Preview e staging web su Vercel | `proposed` |
| [ADR-0006](0006-postgresql-migration-foundation.md) | Fondazione PostgreSQL e contratto delle migrazioni | `accepted` |
| [ADR-0007](0007-observability-context-and-error-reporting.md) | Contesto osservabile ed error reporting | `accepted` |
| [ADR-0008](0008-zod-first-contract-generation.md) | Contratti Zod-first e artefatti generati | `accepted` |
| [ADR-0009](0009-mvp-runtime-data-and-workflow-architecture.md) | Architettura runtime, dati e workflow dell'MVP | `accepted` |
| [ADR-0010](0010-internal-provider-neutral-identity.md) | Identità interna provider-neutral | `accepted` |
