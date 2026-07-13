---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-13
last_verified_commit: 1090a2a2498f69102c78e1e8d90722c239629d68
source_refs:
  - docs/MVP_SPEC.md#5-assunzioni
  - docs/MVP_SPEC.md#2210-segreti-e-cifratura
  - docs/MVP_SPEC.md#293-ambienti
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
related_tasks:
  - BL-003
  - BL-004
  - BL-080
code_refs:
  - packages/config
  - apps/api/src/runtime.ts
  - apps/api/src/start.ts
  - apps/worker/src/runtime.ts
  - scripts/lib/build-artifact.mjs
  - scripts/lib/secret-scanner.mjs
test_refs:
  - tests/unit/build-artifact.test.mjs
  - tests/unit/runtime-config.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/security/environment-file-policy.test.mjs
  - tests/security/secret-scanner.test.mjs
supersedes: null
---

# Evidenze BL-003

## Identità del run

| Campo | Valore |
|---|---|
| Data | 2026-07-13 |
| Ambiente locale | Windows; Node `24.11.0`; pnpm `10.34.5` |
| Branch di lavoro | `codex/bl-003-runtime-config` |
| Baseline | `d530f3a0bab8cc20b8eee9f63ef222e6c4bb19f8` (`origin/main`) |
| Commit verificato | `1090a2a2498f69102c78e1e8d90722c239629d68` |
| Spec SHA-256 | `7441fdb71426deb22e3106e5e03fe0b364a711bcc3f5ff776fb74f3ad544f43f` |
| Config contract | `runtime-config-v1` |
| Migration/schema/event/prompt/eval | `N/A` — non modificati |

## Failure path osservato

I test sono stati introdotti prima del package. Il primo run di `node --test tests/unit/runtime-config.test.mjs` è fallito con `ERR_MODULE_NOT_FOUND` su `packages/config/dist/index.js`, confermando il rosso iniziale. Dopo l'implementazione, i parser e i process smoke sono passati.

Il primo build ha inoltre fallito su tipi Node non dichiarati; il package e l'API ora dichiarano esplicitamente `@types/node` e `types: ["node"]`. Il primo SAST ha rifiutato la regex hostname; la validazione è stata riscritta senza regex ambigua. Una regressione successiva ha dimostrato che gli hostname interni alle URL non erano ancora verificati: il parser ora applica la stessa policy strutturale anche a PostgreSQL/Redis. Questi failure non sono stati aggirati o silenziati.

## Evidenze preliminari del change set sorgente

| Comando | Esito |
|---|---|
| `pnpm --filter @dnd-ai/config build` | exit `0` |
| `node --test tests/unit/runtime-config.test.mjs` | exit `0`; 7/7 |
| `node --test tests/integration/runtime-startup.test.mjs` | exit `0`; 5/5 |
| `node --test tests/contracts/runtime-config-contract.test.mjs` | exit `0`; 5/5 |
| `node --test tests/security/environment-file-policy.test.mjs tests/security/secret-scanner.test.mjs` | exit `0`; 8 pass, 3 skip motivati su Windows (symlink/FIFO); copertura POSIX attesa in CI |
| `pnpm boundaries:check` | exit `0`; 11 package policy |
| `pnpm tasks:check` | exit `0` |
| `pnpm scan:sast` | exit `0`; zero warning |
| `pnpm audit --audit-level high` | exit `0`; nessuna vulnerabilità nota |
| `TURBO_FORCE=true pnpm verify` isolato | exit `0` in `54,9 s`; unit 17 pass/1 skip host, integration 8/8, contract 13/13, security 9 pass/3 skip host, artifact 3.191 file |
| clean-checkout `0d3af18c9d38887441dd9be3deb2d98084a44071` | install frozen exit `0`; `TURBO_FORCE=true pnpm verify` exit `0` in `59,6 s`; 0 cache hit; artifact 3.212 file |
| CI remota | pending |

## Copertura del contratto

- parse valido `local`, `staging` e `production` per API, worker e migration;
- chiavi mancanti, vuote, ambiente sconosciuto, porte fuori range e URL/protocolli malformati;
- host API e URL strutturali, database nominato e username PostgreSQL;
- TLS e password obbligatori per PostgreSQL/Redis in staging/production;
- nessun fallback da staging verso valori local/production;
- chiavi ambientali estranee rimosse e output frozen;
- errore contenente solo servizio e nomi chiave, senza valori/cause;
- API valida prima di factory/bind e apre/chiude un listener reale con fixture valida;
- worker valida prima dell'inizializzatore iniettato;
- CLI local/staging stampa solo servizio e ambiente; missing config produce exit `1`;
- web privo di dipendenza config e di chiavi `NEXT_PUBLIC_*` nel contratto;
- `.env` privato force-tracked rifiutato per pathname; `.env.example` consentito; symlink e file non regolari mai aperti;
- config compilata inclusa nell'allowlist artifact e boundary workspace fail-closed.

## Secret, dipendenze e ambiente

Non sono stati creati o letti secret reali. I tre `.env.example` usano sentinel non funzionanti e i test process usano URL sintetici. `zod@4.4.3` è una dipendenza diretta MIT senza install lifecycle; nessun SDK cloud o loader `.env` è stato aggiunto.

Il web resta `N/A` perché non ha un consumer runtime reale. Il primo secret manager, packaging deployabile e smoke preview/staging appartengono a `BL-080`; `BL-003` prova soltanto il profilo staging in processi locali isolati. Questo è coerente con la precisazione della DoD per i prerequisiti del primo ambiente.

## Gate ancora necessari alla chiusura

1. CI remota e secret/artifact evidence sul commit candidato.
