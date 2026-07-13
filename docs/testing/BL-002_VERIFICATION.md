---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-13
last_verified_commit: f1be878b291a535ea6c8e0d995ee5e3c80ef164c
source_refs:
  - docs/MVP_SPEC.md#2612-ci-quality-gates
  - docs/MVP_SPEC.md#294-cicd
related_tasks:
  - BL-002
code_refs:
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/lib/build-artifact.mjs
test_refs:
  - tests/unit/ci-gate.test.mjs
  - tests/unit/build-artifact.test.mjs
  - tests/integration/ci-gate.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/security/sast-config.test.mjs
  - tests/security/secret-scanner.test.mjs
supersedes: null
---

# Evidenze BL-002

## Identità del run

| Campo | Valore |
|---|---|
| Data | 2026-07-13 |
| Environment locale | Windows, Node `24.11.0`, pnpm `10.34.5` |
| Branch | `codex/bl-002-ci-foundation` |
| Base | `6b9f5d281fb0185f5f6c98813e2ffcee6424e658` |
| Commit verificato | `7c6c7071d027c55aeffbc7279b8ca3765ea26c37` |
| Spec SHA-256 | `ed2c7882f94fa751e30dc6f1c73e279388891d7e0fcd686db30aad3b565096f6` |
| Migration/schema/prompt/eval | `N/A` — non modificati |

## Evidenze locali intermedie

| Comando | Esito |
|---|---|
| `pnpm format:check` | exit `0` |
| `pnpm lint` | exit `0`, 10/10 workspace |
| `pnpm typecheck` | exit `0`, 10/10 workspace |
| `pnpm test:unit` | exit `0`, 9 pass e 1 skip host Windows; i tre test junction parent/mirror reale passano |
| `pnpm test:integration` | exit `0`, 3/3; fixture intenzionale osservata con exit `1` |
| `pnpm test:contract` | exit `0`, 8/8 |
| `pnpm scan:sast` | exit `0`, nessun warning ammesso su source e script CI |
| `pnpm test:security` | exit `0`, 7/7 e repository secret scan PASS; fixture SAST negativa rilevata |
| `pnpm ci:workflow:check` | exit `0` |
| `pnpm build` | exit `0`, 10/10 workspace |
| `pnpm artifact:prepare && pnpm artifact:verify` | exit `0`, 3.184 file e 45,62 MiB, checksum/scan PASS |
| `pnpm audit --audit-level=moderate` | exit `0`, nessuna vulnerabilità nota dopo override `postcss@8.5.10` |
| `pnpm verify` sul contenuto documentato | exit `0` in 74,4 s; aggregazione completa locale PASS |
| clean worktree dell'head | frozen install exit `0`; `TURBO_FORCE=true pnpm verify` exit `0` in 66,0 s |
| working tree di chiusura | `TURBO_FORCE=true pnpm verify` exit `0` in 53,9 s; 10/10 lint/typecheck/build, 9+1 unit, 3 integration, 8 contract, 7 security e artifact verification PASS |

Il primo artifact smoke ha rifiutato i junction assoluti prodotti da Next/pnpm; il packager è stato corretto per usare soltanto la copia traced interna e continua a rifiutare link esterni. Un secondo failure ha individuato un esempio di private key nei docs del package Next non traced: la correzione del mirror evita di includere documentazione/dependency non necessarie.

Il primo run finale di `pnpm verify` ha fallito correttamente sul lint del nuovo test scanner (`Buffer` non dichiarato); l'import esplicito da `node:buffer` ha risolto la causa e il run completo successivo è passato. I test aggiunti provano inoltre che parent junction di source/output non possono deviare letture o cleanup fuori repository e che un mirror Next mancante fallisce chiuso.

## Action pin verificati da sorgenti ufficiali

| Action | Versione | Commit |
|---|---|---|
| `actions/checkout` | `v7.0.0` | `9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0` |
| `pnpm/action-setup` | `v6.0.9` | `0ebf47130e4866e96fce0953f49152a61190b271` |
| `actions/setup-node` | `v6.4.0` | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` |
| `actions/upload-artifact` | `v7.0.1` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |

I tag sono stati risolti il 2026-07-13 tramite release API e `git ls-remote` dei repository ufficiali; il workflow usa i commit dereferenziati, non i tag mobili.

## Decisione SAST

Al momento della decisione il repository GitHub era privato e Code Scanning non era abilitato: la relativa API aveva restituito `403`. Per non attivare implicitamente un servizio potenzialmente a pagamento, la pipeline ha adottato `eslint-plugin-security@4.0.1` (Apache-2.0) in configurazione flat `recommended`, con `--max-warnings 0`. Una security test dimostra che una chiamata `eval` non affidabile viene rilevata. Il repository è ora pubblico, ma il SAST locale resta il gate riproducibile della baseline; un futuro CodeQL sarebbe difesa aggiuntiva e non sostituirebbe questi controlli. Gli script CI escludono soltanto le regole generiche su path/key dinamici già coperte da boundary, artifact, policy e negative-path test dedicati.

## Iterazione CI remota

La prima run della PR #1, [`29253365500`](https://github.com/Emacore17/dnd-ai/actions/runs/29253365500), ha verificato il failure path: `Quality`, `Security` e `Tests` sono passati; `Build artifact` ha fallito su un symlink Linux di Next già risolto dentro `.next/standalone`; `CI / Merge gate` ha propagato il fallimento. La policy è stata corretta per accettare questo solo target interno confinato, continuando a rimappare gli eventuali link allo store esterno esclusivamente verso il mirror traced e a rifiutare ogni altro escape. Il nuovo caso è coperto dal test unitario del mirror Next.

La seconda run, [`29254060444`](https://github.com/Emacore17/dnd-ai/actions/runs/29254060444), ha reso eseguibile su Linux il test symlink prima saltato su Windows: ha mostrato che l'eccezione interna era troppo ampia per gli output non-Next. La correzione limita esplicitamente i link interni al solo source root Next dotato di mirror; `Tests` e `CI / Merge gate` sono falliti e `Build artifact` è stato saltato, confermando il fan-in fail-closed. Il working tree corretto ha quindi superato `TURBO_FORCE=true pnpm verify` in 60,9 s.

La terza run della PR #1, [`29254494868`](https://github.com/Emacore17/dnd-ai/actions/runs/29254494868), è `success`: `Quality`, `Tests`, `Security`, `Build artifact` e `CI / Merge gate` sono tutti passati. La scansione redatta dei log dei cinque job non ha rilevato pattern credenziale. L'artifact remoto `dnd-ai-build-9cdd85a329bd733bfd8a15efb61edb020d7a76c4` ha digest archivio `sha256:0d37c3c8fd42aecef0af3e0c749566d22090a98ba428fcf2b4c871f6ea932da9`; il manifest `build-artifact-v1` contiene 3.205 file/114.392.641 byte e ha superato nuovamente checksum e secret scan dopo il download.

La PR negativa #2, chiusa senza merge, ha prodotto la run [`29254866626`](https://github.com/Emacore17/dnd-ai/actions/runs/29254866626): `Tests=FAILURE`, `Build artifact=SKIPPED` e `CI / Merge gate=FAILURE`. GitHub ha tuttavia riportato la PR come `MERGEABLE/UNSTABLE`, prova che il gate applicativo funziona ma non è enforced senza Ruleset/branch protection.

Dopo la pubblicazione del repository, la run finale sul precedente head documentale della PR #1, [`29255261423`](https://github.com/Emacore17/dnd-ai/actions/runs/29255261423), ha confermato `Quality`, `Tests`, `Security`, `Build artifact` e `CI / Merge gate` tutti `SUCCESS` sul commit `f1be878b291a535ea6c8e0d995ee5e3c80ef164c`.

## Enforcement della Ruleset e prova negativa finale

La Ruleset [`main-required-ci` (`18877721`)](https://github.com/Emacore17/dnd-ai/rules/18877721) è stata creata il 2026-07-13 con enforcement `active`, target `~DEFAULT_BRANCH`, pull request obbligatoria, nessun bypass e policy strict. Richiede soltanto `CI / Merge gate`, vincolato all'app GitHub Actions tramite `integration_id=15368`; l'API delle regole applicabili a `main` restituisce la stessa configurazione.

La PR negativa [#3](https://github.com/Emacore17/dnd-ai/pull/3), chiusa senza merge e con branch rimossa, ha prodotto la run [`29256736728`](https://github.com/Emacore17/dnd-ai/actions/runs/29256736728): `Quality=SUCCESS`, `Security=SUCCESS`, `Tests=FAILURE`, `Build artifact=SKIPPED` e `CI / Merge gate=FAILURE`. GitHub ha riportato `mergeStateStatus=BLOCKED`; il campo separato `mergeable=MERGEABLE` indicava soltanto l'assenza di conflitti Git, non l'autorizzazione al merge. La Ruleset ha quindi soddisfatto il criterio di accettazione rendendo la PR non unibile per policy.

## Chiusura

Tutti i gate applicabili a `BL-002` dispongono ora di evidenza riproducibile locale e remota. Il task è `DONE/100%/PASSING`; i gate di database, schema, browser/accessibilità, eval, container/SBOM e deploy restano assegnati ai task proprietari già indicati nel runbook, senza placeholder verdi.
