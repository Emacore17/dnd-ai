---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-13
last_verified_commit: 6cda07a60022665f321b48dd82fbeb1d9bef586f
source_refs:
  - docs/MVP_SPEC.md#112-forma-del-sistema
  - docs/TASKS.md#bl-001--configurare-workspace-app-e-package-boundaries
related_tasks:
  - BL-001
code_refs:
  - apps
  - packages
  - scripts/lib/workspace-boundaries.mjs
  - scripts/lib/task-graph.mjs
test_refs:
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
supersedes: null
---

# Evidenza di verifica BL-001

## Identità della verifica

| Campo | Valore |
|---|---|
| Data | `2026-07-13` |
| Commit verificato | `6cda07a60022665f321b48dd82fbeb1d9bef586f` |
| Git | worktree detached pulito; `git status --short` senza output |
| Sistema | Windows, PowerShell, Node `24.11.0` |
| Package manager | `corepack pnpm@10.34.5` |
| Spec SHA-256 | `5bdf152a6c535470d239ad72772603d17d53cc82cc3c02f09bf44cbe1ef47e90` |
| Cache | `TURBO_FORCE=true`; 0 task cached |

## Comandi ed esiti

| Comando | Exit code | Esito |
|---|---:|---|
| `corepack pnpm@10.34.5 install --frozen-lockfile` | 0 | lockfile invariato; 11 workspace installati; `sharp` e `unrs-resolver` unici install script allowlisted |
| `$env:TURBO_FORCE='true'; corepack pnpm@10.34.5 verify` | 0 | gate completo BL-001 |
| `git status --short --branch` | 0 | worktree detached pulito sul commit target |

## Risultati

- lint: `10/10` workspace;
- typecheck: `10/10` workspace, incluso `next typegen` da checkout pulito;
- build: `10/10` workspace; Next.js `16.2.10` ha prodotto `/` e `/_not-found` statici;
- contract test: `6/6` pass;
- fixture negativa: `@dnd-ai/domain -> @dnd-ai/persistence` restituisce exit code `1`;
- boundary checker reale: `PASS (10 packages)`;
- task graph: `PASS` su 101 card e parity delle 79 righe BL con la specifica;
- secret scan staged e `git diff --check`: `PASS` prima del commit.

## Failure path corretto

Il primo aggregatore `verify` richiamava il pnpm globale `10.21.0` e falliva con `ERR_PNPM_UNSUPPORTED_ENGINE`. Lo script è stato corretto per invocare direttamente ESLint, Turbo e Node; l’avvio esterno usa sempre il pin `corepack pnpm@10.34.5`.

## Scope residuo

Il report prova soltanto `BL-001`. CI remota, suite complete, database, config ambiente e browser harness comune appartengono rispettivamente a `BL-002`, `QA-001`, `BL-004`, `BL-003` e `QA-001`. shadcn/ui, AI Elements e Motion appartengono a `BL-079`.

Dopo il run, la chiusura documentale ha aggiornato soltanto il front matter `last_verified_commit` della specifica: il corpo normativo non è cambiato e la baseline corrente è `ed2c7882f94fa751e30dc6f1c73e279388891d7e0fcd686db30aad3b565096f6`.
