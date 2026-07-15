---
status: active
owner: engineering-and-platform
last_reviewed: 2026-07-15
last_verified_commit: 8e6e0d3d46daa057ba80999c58c83ad1c92471b1
source_refs:
  - docs/superpowers/specs/2026-07-15-bl-010-feature-flags-design.md
  - docs/MVP_SPEC.md#298-disaster-recovery-e-operazioni
  - docs/TASKS.md#bl-010--flag-storeconfig-auditato
related_tasks:
  - BL-010
code_refs:
  - packages/persistence/src/feature-flags.ts
  - packages/persistence/src/migration-manifest.ts
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - scripts/manage-feature-flag.mjs
test_refs:
  - tests/unit/feature-flags.test.mjs
  - tests/database/feature-flags.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/security/feature-flags-security.test.mjs
supersedes: null
---

# BL-010 Feature Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PostgreSQL-backed, server-side feature flag and kill switch store with safe defaults, atomic audit and a redacted CLI.

**Architecture:** `@dnd-ai/persistence` owns the catalog, repository and database schema. The CLI is a server-side composition root that reuses `runtime-config-v1` and never exposes a public admin API. Consumers are future tasks; BL-010 proves the gates through repository and harness tests.

**Tech Stack:** TypeScript strict, PostgreSQL 17, pg 8.22.0, node-pg-migrate 8.0.4, Node `node:test`, pnpm 11/Turborepo.

## Global Constraints

- Lane `HIGH_RISK`: migration/schema, operational kill switch and security audit path.
- Use RED -> GREEN for behavior batches before production code.
- Safe default is disabled for every flag.
- Unknown flag, unavailable store, malformed row or stale state fails closed.
- No client flag, public admin endpoint, Vercel action, deploy or provider account change.
- Audit data is structured and redacted; no free-text reason or secret reflection.

---

### Task 1: Documentation and task alignment

**Files:**
- Modify: `docs/MVP_SPEC.md`
- Modify: `docs/TASKS.md`
- Create: `docs/superpowers/specs/2026-07-15-bl-010-feature-flags-design.md`
- Create: `docs/superpowers/plans/2026-07-15-bl-010-feature-flags.md`

**Interfaces:**
- Consumes: approved design.
- Produces: BL-010 aligned with BL-004 dependency and HIGH_RISK scope, then branch-local `DONE/100%/PASSING` once the gate passes.

- [x] Update the spec backlog dependency from `BL-003, BL-008` to `BL-003, BL-004, BL-008`.
- [x] Update the task card with baseline, branch, refs, estimate and design links.
- [x] Save this design and plan for review.
- [x] Run `corepack pnpm@11.13.0 tasks:check`; expect PASS after the spec/task dependency pair matches.

### Task 2: Catalog and fail-closed evaluator

**Files:**
- Create: `packages/persistence/src/feature-flags.ts`
- Modify: `packages/persistence/src/index.ts`
- Create: `tests/unit/feature-flags.test.mjs`

**Interfaces:**
- Produces: `FEATURE_FLAG_CATALOG`, `isFeatureFlagKey`, `evaluateFeatureGate`, `FeatureFlagError`.

- [x] Write tests for the three catalog keys, frozen state, unknown-key denial and store-unavailable denial.
- [x] Run the focused unit test before implementation; expect missing export failure.
- [x] Implement only the catalog, validators, redacted errors and `evaluateFeatureGate`.
- [x] Re-run the focused unit test; expect PASS.

### Task 3: Migration 000002 and manifest compatibility

**Files:**
- Create: `packages/persistence/src/migrations/000002_feature_flags.ts`
- Modify: `packages/persistence/src/migration-manifest.ts`
- Modify: `tests/contracts/database-migration-contract.test.mjs`
- Modify: `tests/database/database-migrations.test.mjs`
- Modify: `tests/database/database-migration-cli.test.mjs`

**Interfaces:**
- Produces: database head `000002_feature_flags`, contract `database-feature-flags-v1`.

- [x] Write failing database/contract expectations for `000002`, previous-to-head, rollback one migration, seeded flags and source SHA.
- [x] Run `corepack pnpm@11.13.0 db:migrate:test`; expect failures on missing migration and old head.
- [x] Implement SQL constants, migration, manifest entry and adjusted migration tests.
- [x] Re-run `corepack pnpm@11.13.0 db:migrate:test`; expect PASS.

### Task 4: PostgreSQL store, audit, CAS and idempotency

**Files:**
- Modify: `packages/persistence/src/feature-flags.ts`
- Create: `tests/database/feature-flags.test.mjs`

**Interfaces:**
- Produces: `createPostgresFeatureFlagStore`, `readFeatureFlag`, `changeFeatureFlag`, `close`.

- [x] Write failing tests for status reads, enable/disable without deploy, audit row, CAS conflict, idempotent replay, idempotency mismatch and audit rollback.
- [x] Run the feature flag database test; expect missing store behavior.
- [x] Implement the repository with one transaction per change and redacted errors.
- [x] Re-run unit and database feature flag tests; expect PASS.

### Task 5: Server-side CLI and security tests

**Files:**
- Create: `scripts/manage-feature-flag.mjs`
- Modify: `package.json`
- Create: `tests/security/feature-flags-security.test.mjs`
- Modify: `tests/contracts/database-migration-contract.test.mjs`

**Interfaces:**
- Produces: `flags:status` and `flags:set` root scripts.

- [x] Write failing security tests for missing config, unknown input, missing actor/reason/idempotency, secret redaction and no URL reflection.
- [x] Run `node --test tests/security/feature-flags-security.test.mjs`; expect missing CLI failure.
- [x] Implement CLI parsing, safe output and root scripts.
- [x] Re-run security and contract tests; expect PASS.

### Task 6: Living docs and final verification

**Files:**
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/architecture/SYSTEM_OVERVIEW.md`
- Modify: `docs/operations/CONFIGURATION.md`
- Modify: `docs/operations/DATABASE_MIGRATIONS.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/TASKS.md`

**Interfaces:**
- Produces: proposed branch-local `DONE/100%/PASSING` with reproducible evidence.

- [x] Update docs with migration head, flag contract, CLI usage and future consumer boundaries.
- [x] Run targeted tests and `corepack pnpm@11.13.0 verify:docs`.
- [x] Run final `TURBO_FORCE=true corepack pnpm@11.13.0 verify`.
- [x] Review the diff for secrets, generated noise and task/doc consistency.
