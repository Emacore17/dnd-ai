---
status: active
owner: engineering-and-api
last_reviewed: 2026-07-15
last_verified_commit: ccecd683c12ebfe29f4cc6be78c950ebb01ca288
source_refs:
  - docs/superpowers/specs/2026-07-15-bl-009-contract-generation-design.md
  - docs/MVP_SPEC.md#115-event-sourcing-pragmatico
  - docs/MVP_SPEC.md#126-schema-del-turno
  - docs/MVP_SPEC.md#128-schemi-separati
  - docs/MVP_SPEC.md#20-api
  - docs/MVP_SPEC.md#294-cicd
  - docs/TASKS.md#bl-009--zod-json-schema-openapi-generation
related_tasks:
  - BL-009
code_refs:
  - packages/contracts/src
  - packages/contracts/generated/v1
  - scripts/generate-contracts.mjs
  - scripts/lib/contract-artifact-policy.mjs
  - scripts/lib/contract-compatibility-policy.mjs
  - scripts/lib/owned-path-policy.mjs
test_refs:
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/contracts-runtime.test.mjs
  - tests/contracts/contracts-artifacts.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/unit/owned-path-policy.test.mjs
supersedes: null
---

# BL-009 Contract Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `api-contract-v1`, a Zod-first runtime contract package with deterministic JSON Schema Draft 2020-12 and OpenAPI 3.1.1 artifacts checked for drift in CI.

**Architecture:** `@dnd-ai/contracts` remains a browser-compatible leaf package. Strict Zod schemas and inferred TypeScript types are the source; a pure artifact builder creates JSON values, while a Node CLI owns canonical serialization and the generated directory. OpenAPI exposes component schemas with `paths: {}` until an owning API task implements each operation.

**Tech Stack:** TypeScript strict, Zod 4.4.3, JSON Schema Draft 2020-12, OpenAPI 3.1.1, Ajv 8.20.0 for conformance tests, Node `node:test`, pnpm 11/Turborepo.

## Global Constraints

- Lane `HIGH_RISK`: dependency graph, generated public contracts and CI workflow change.
- Use one RED → GREEN cycle per behavior batch; never write production behavior before observing its test fail for the intended reason.
- Keep `packages/contracts` free from workspace dependencies and Node filesystem imports.
- Generated files under `packages/contracts/generated/v1/` are written only by `scripts/generate-contracts.mjs --write`.
- No Fastify route, AI schema family, database, UI, provider, deployment or Vercel change belongs to BL-009.
- Run targeted tests during development, one final `pnpm verify`, clean-checkout verification, one independent review and one protected PR.

---

### Task 1: Lock package and CI contracts

**Files:**
- Modify: `packages/contracts/package.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/lib/ci-workflow-policy.mjs`
- Create: `tests/contracts/contracts-foundation.test.mjs`
- Modify: `tests/contracts/ci-workflow.test.mjs`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: existing workspace boundary and pinned-toolchain policies.
- Produces: direct `zod@4.4.3`, root test-only `ajv@8.20.0` and `ajv-formats@3.0.1`, `contracts:generate`, `contracts:check`, and a required Quality step with depth-2 Git baseline `HEAD^1`.

- [x] Write a failing manifest/CI contract test that requires exact dependencies, a build-before-contract-test script, the two generator commands, and exact `pnpm contracts:check` presence in Quality.
- [x] Run `node --test tests/contracts/contracts-foundation.test.mjs tests/contracts/ci-workflow.test.mjs`; expect failure for the empty contracts package and missing CI command.
- [x] Apply the minimum manifest/workflow/policy changes and run `corepack pnpm@11.13.0 install --lockfile-only`.
- [x] Re-run the two tests; expect PASS without weakening existing CI checks.

### Task 2: Define strict runtime DTOs

**Files:**
- Create: `packages/contracts/src/version.ts`
- Create: `packages/contracts/src/identifiers.ts`
- Create: `packages/contracts/src/api.ts`
- Create: `packages/contracts/src/events.ts`
- Create: `packages/contracts/src/game-event.ts`
- Create: `packages/contracts/src/ai-turn.ts`
- Create: `packages/contracts/src/tool-envelope.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `tests/contracts/contracts-runtime.test.mjs`

**Interfaces:**
- Consumes: `zod` only.
- Produces: `CONTRACT_VERSION`, `CONTRACT_SCHEMA_VERSION`, API/SSE schemas, `GameEventSchema`, `DungeonMasterTurnResultSchema`, allowlisted tool-envelope factories and inferred DTO types.

- [x] Write runtime fixtures for each valid request mode, accepted/error responses, `GameEvent`, `DungeonMasterTurnResult`, four lifecycle events and one allowlisted tool; add invalid cases for unknown fields, prohibited `damage`/`roll`/arbitrary tool name, wrong discriminants, invalid version and out-of-bound values.
- [x] Run `corepack pnpm@11.13.0 --filter @dnd-ai/contracts build && node --test tests/contracts/contracts-runtime.test.mjs`; expect import/export failure.
- [x] Implement minimal strict schemas with JSON-representable checks and inferred types; `GameEvent.payload` uses JSON values and tool factories require caller-supplied allowlists. Do not add transforms or application semantics.
- [x] Re-run the focused test; expect every valid fixture to roundtrip and every invalid fixture to fail.

### Task 3: Generate versioned JSON Schema and OpenAPI values

**Files:**
- Create: `packages/contracts/src/catalog.ts`
- Create: `packages/contracts/src/artifacts.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `tests/contracts/contracts-artifacts.test.mjs`

**Interfaces:**
- Consumes: runtime schemas and version constants from Task 2.
- Produces: immutable `CONTRACT_CATALOG` and `createContractArtifacts(): Readonly<Record<string, unknown>>`.

- [x] Write failing tests for stable catalog names/kinds, Draft 2020-12 `$id`, manifest version, OpenAPI 3.1.1 component refs and an empty `paths` object.
- [x] Compile and run the test; expect missing catalog/artifact exports.
- [x] Implement native `z.toJSONSchema(..., { target: "draft-2020-12", unrepresentable: "throw", cycles: "ref" })`, OpenAPI component composition and manifest generation from the same catalog.
- [x] Re-run runtime and artifact tests; expect PASS and no mutable shared object leakage.

### Task 4: Prove Zod and JSON Schema conformance

**Files:**
- Modify: `tests/contracts/contracts-artifacts.test.mjs`

**Interfaces:**
- Consumes: `createContractArtifacts`, Ajv 2020 and ajv-formats.
- Produces: executable parity evidence for request, response and event artifacts.

- [x] Extend the test so Ajv compiles every generated schema and evaluates the same accepted/rejected fixture matrix used by Zod.
- [x] Run the test before wiring all schemas; expect failure on missing or non-compilable schema.
- [x] Make only the schema/catalog corrections required for parity; do not relax strictness.
- [x] Re-run all BL-009 contract tests; expect Zod/Ajv agreement.

### Task 5: Add fail-closed artifact synchronization

**Files:**
- Create: `scripts/lib/contract-artifact-policy.mjs`
- Create: `scripts/lib/contract-compatibility-policy.mjs`
- Create: `scripts/lib/owned-path-policy.mjs`
- Create: `scripts/generate-contracts.mjs`
- Create: `tests/unit/contract-artifact-policy.test.mjs`
- Create: `tests/unit/owned-path-policy.test.mjs`
- Create: `tests/contracts/contracts-compatibility.test.mjs`
- Create: `packages/contracts/generated/v1/manifest.json`
- Create: `packages/contracts/generated/v1/openapi.json`
- Create: `packages/contracts/generated/v1/schemas/*.schema.json`

**Interfaces:**
- Consumes: `createContractArtifacts()` from compiled package.
- Produces: canonical JSON renderer, drift diagnostics, immutable published-major comparison against Git, owned-path guard and CLI modes `--write|--check`.

- [x] Write failing tests for recursive key ordering, missing/stale/unexpected/path escape, canonical UUID/version mismatch, breaking v1 regeneration and generated-root symlink/junction rejection.
- [x] Run `node --test tests/unit/contract-artifact-policy.test.mjs`; expect missing module failure.
- [x] Implement drift and compatibility policies plus the CLI with an exact generated root; compare published majors against `origin/main`/`HEAD^1` without fetch and reject linked ancestors before read/write.
- [x] Run `corepack pnpm@11.13.0 contracts:generate`, then `corepack pnpm@11.13.0 contracts:check`; expect generated files followed by a read-only PASS.
- [x] Use temporary repositories/directories to prove breaking v1, unavailable history and root junctions fail while unchanged v1 plus parallel v2 passes; never mutate the real generated root manually.

### Task 6: Align documentation and close the candidate

**Files:**
- Create: `docs/adr/0008-zod-first-contract-generation.md`
- Create: `docs/api/README.md`
- Modify: `docs/TASKS.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/README.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/architecture/SYSTEM_OVERVIEW.md`
- Modify: `docs/operations/CI_CD.md`

**Interfaces:**
- Consumes: verified code, generated paths and real test evidence.
- Produces: accepted decision, living contract guide, branch-local terminal task proposal and next-task graph.

- [x] Update only documents semantically affected; state clearly that OpenAPI has components only until BL-028 and Vercel remains frozen.
- [x] Run focused tests, `corepack pnpm@11.13.0 verify:docs`, then one final `TURBO_FORCE=true corepack pnpm@11.13.0 verify`.
- [ ] Commit the coherent candidate, verify it from a clean checkout because install/CI/generated artifacts changed, and request one independent review.
- [ ] Correct only P0/P1 findings, open one protected PR, wait for `CI / Merge gate`, merge without bypass and verify post-merge `main` CI.
