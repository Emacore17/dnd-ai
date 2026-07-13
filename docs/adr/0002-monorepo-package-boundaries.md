---
status: accepted
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: 1090a2a2498f69102c78e1e8d90722c239629d68
source_refs:
  - docs/MVP_SPEC.md#112-forma-del-sistema
  - docs/MVP_SPEC.md#113-moduli-applicativi
  - AGENTS.md#9-confini-architetturali-e-struttura-target
related_tasks:
  - BL-001
  - BL-003
code_refs:
  - pnpm-workspace.yaml
  - packages/config
  - turbo.json
  - scripts/lib/workspace-boundaries.mjs
test_refs:
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
supersedes: null
---

# ADR-0002 — Monorepo e package boundaries verificabili

## Stato

Accepted il 2026-07-13 durante `BL-001`.

## Contesto

L’MVP richiede un modular monolith TypeScript con tre runtime, moduli di dominio puri e adapter infrastrutturali separati. Il repository era documentale e non disponeva di package manager, task graph o controllo automatico delle direzioni di import.

## Decisione

1. Il workspace usa `pnpm@10.34.5` e Turborepo `2.10.4`, entrambi pinning nel repository.
2. I runtime sono `apps/web`, `apps/api` e `apps/worker`; i moduli condivisi sono `config`, `contracts`, `domain`, `rules`, `ai`, `persistence`, `observability` e `testing`.
3. Il package `ai` resta unico fino a quando porte e adapter reali rendono utile una separazione; nessun SDK provider può entrare in `domain` o `rules`.
4. La policy allowlist è codice versionato. Un checker analizza manifest, import statici/dinamici, import relativi cross-package e cicli.
5. Ogni nuova relazione workspace deve modificare consapevolmente policy, documentazione e test; un import non autorizzato fallisce chiuso.
6. Lo scaffold non aggiunge servizi, database o astrazioni di dominio vuote. I package espongono entry point minimi e ricevono contenuto nei task proprietari.
7. `config` è un leaf package server-only senza dipendenze workspace. Può essere importato dai composition root API/worker, non dal web o dai package di dominio; il futuro migration executable comporrà `config` e `persistence` senza rendere quest'ultimo dipendente dalla configurazione ambientale.

## Alternative considerate

### Repository singolo senza workspace

Rifiutato: non rende esplicite le direzioni di dipendenza e complica build/test isolati dei tre runtime.

### Nx o regole ESLint soltanto

Non selezionati: Turborepo è sufficiente per il task graph iniziale; il checker locale copre manifest e import senza introdurre un secondo orchestratore. ESLint resta un gate complementare, non la fonte della policy architetturale.

### Package AI separati fin dal bootstrap

Rinviato: `ai-core`/`ai-adapters` senza porte o adapter concreti produrrebbero struttura speculativa. `BL-021` può dividerli con test e motivazione reali.

## Conseguenze

- build, lint e typecheck sono eseguibili per ogni workspace;
- dominio e regole restano indipendenti dall’infrastruttura per costruzione;
- configurazione ambientale e secret non attraversano il boundary browser/domain;
- aggiungere una relazione richiede un change esplicito alla allowlist;
- il checker custom va mantenuto e sarà integrato nella CI da `BL-002`;
- la policy dovrà evolvere quando nascono application service o adapter concreti, senza indebolire gli invarianti di `AGENTS.md`.
