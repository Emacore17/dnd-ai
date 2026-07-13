---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: 1090a2a2498f69102c78e1e8d90722c239629d68
source_refs:
  - AGENTS.md
  - docs/TASKS.md#6-contesto-e-documentazione-living
related_tasks:
  - GOV-001
  - BL-001
  - BL-002
  - BL-003
  - BL-079
  - BL-080
code_refs: []
test_refs:
  - AGENTS_VALIDATION.txt
  - docs/testing/BL-003_VERIFICATION.md
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
| [`adr/0001-mobile-first-conversational-ui.md`](adr/0001-mobile-first-conversational-ui.md) | Decisione accepted su shell, stack visuale e guardrail |
| [`architecture/SYSTEM_OVERVIEW.md`](architecture/SYSTEM_OVERVIEW.md) | Monorepo implementato, direzioni di dipendenza e toolchain |
| [`adr/0002-monorepo-package-boundaries.md`](adr/0002-monorepo-package-boundaries.md) | Decisione accepted su workspace e boundary enforcement |
| [`testing/BL-001_VERIFICATION.md`](testing/BL-001_VERIFICATION.md) | Evidenza riproducibile della clean-worktree verification di BL-001 |
| [`adr/0003-ci-trust-boundary-and-artifacts.md`](adr/0003-ci-trust-boundary-and-artifacts.md) | Decisione accepted su trust boundary, cache, gate e artifact CI |
| [`operations/CI_CD.md`](operations/CI_CD.md) | Contratto operativo della pipeline e configurazione Ruleset |
| [`testing/BL-002_VERIFICATION.md`](testing/BL-002_VERIFICATION.md) | Evidenze locali e remote di BL-002 |
| [`adr/0004-runtime-configuration-and-secret-injection.md`](adr/0004-runtime-configuration-and-secret-injection.md) | Decisione accepted su config server-only, profili e secret injection |
| [`operations/CONFIGURATION.md`](operations/CONFIGURATION.md) | Matrice variabili, setup locale, redazione e ownership ambienti |
| [`testing/BL-003_VERIFICATION.md`](testing/BL-003_VERIFICATION.md) | Evidenze locali unit/integration/contract/security di BL-003; clean-checkout e CI ancora pendenti |

## Documenti pianificati

I path seguenti sono pianificati e non sono link finché non esistono:

- `docs/adr/README.md` — `GOV-002`;
- `docs/data/DATA_MODEL.md` — `DOC-ARCH-001`;
- `docs/testing/TEST_STRATEGY.md` — `QA-001`;
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
- `docs/api/` e `docs/events/EVENT_CATALOG.md` — task delle relative feature.

## Regole di manutenzione

- Non duplicare lo stato volatile fuori da `CONTEXT` e `TASKS`.
- Un path futuro resta in codice ed è marcato con task; non creare link rotti.
- Aggiornare front matter, tracciabilità e changelog nello stesso change set.
- Rieseguire il controllo documentale e la cold-start review prima di chiudere un task.
