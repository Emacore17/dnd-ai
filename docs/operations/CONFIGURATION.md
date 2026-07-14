---
status: active
owner: engineering-and-security
last_reviewed: 2026-07-14
last_verified_commit: 1cb655abee8a55b6974d90ae20b4244b12ba1192
source_refs:
  - docs/MVP_SPEC.md#5-assunzioni
  - docs/MVP_SPEC.md#2210-segreti-e-cifratura
  - docs/MVP_SPEC.md#293-ambienti
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
related_tasks:
  - BL-003
  - BL-004
  - BL-080
code_refs:
  - .vercelignore
  - packages/config/src/runtime-config.ts
  - packages/config/src/cli.ts
  - apps/api/src/runtime.ts
  - apps/api/src/start.ts
  - apps/worker/src/runtime.ts
  - apps/api/.env.example
  - apps/worker/.env.example
  - packages/persistence/.env.example
  - infra/deployment/vercel-staging.json
  - apps/web/package.json
  - apps/web/vercel.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - apps/web/app/health/route.ts
  - scripts/check-deployment-foundation.mjs
  - scripts/assert-vercel-preview-bootstrap-enabled.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - turbo.json
test_refs:
  - tests/unit/runtime-config.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/security/environment-file-policy.test.mjs
  - tests/security/secret-scanner.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-preview-bootstrap-policy.test.mjs
  - tests/security/vercel-preview-bootstrap-gate.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
supersedes: null
---

# Configurazione runtime e secret

## Contratto corrente

La versione implementata è `runtime-config-v1`. I parser vivono in `@dnd-ai/config`, ricevono una sorgente esplicita e producono oggetti readonly/frozen. `process.env` viene letto soltanto dai composition root o dalla CLI, mai dal parser puro.

`APP_ENV` ammette esclusivamente:

- `local`: sviluppo con dati sintetici e provider fake quando disponibile;
- `staging`: staging e preview isolate, con risorse e credenziali distinte;
- `production`: dati reali e change control.

Una preview non introduce il valore `preview`: usa lo schema `staging`, ma non ne condivide dati o secret.

## Matrice delle variabili

| Servizio | Variabile | Classe | Vincolo |
|---|---|---|---|
| API | `APP_ENV` | non secret | `local`, `staging` o `production` |
| API | `API_HOST` | non secret | `localhost`, IP o hostname DNS ASCII strutturale |
| API | `API_PORT` | non secret | intero `1..65535` |
| API | `API_DATABASE_URL` | secret-bearing | URL PostgreSQL con credenziale API; nei profili gestiti `sslmode=require|verify-ca|verify-full` |
| API | `API_REDIS_URL` | secret-bearing | URL Redis con credenziale API; nei profili gestiti protocollo `rediss:` |
| worker | `APP_ENV` | non secret | stesso discriminatore canonico |
| worker | `WORKER_DATABASE_URL` | secret-bearing | URL PostgreSQL con credenziale worker distinta e TLS nei profili gestiti |
| worker | `WORKER_REDIS_URL` | secret-bearing | URL Redis con credenziale worker distinta e `rediss:` nei profili gestiti |
| migration | `APP_ENV` | non secret | stesso discriminatore canonico |
| migration | `MIGRATION_DATABASE_URL` | secret-bearing | URL PostgreSQL con credenziale migration distinta e TLS nei profili gestiti |
| web | nessuna applicativa | `N/A` | la shell corrente non consuma config prodotto; il build guard e `/health` leggono soltanto system metadata Vercel server-side |

Non aggiungere chiavi AI, auth, telemetry, storage o flag finché il task proprietario non introduce un consumer e i relativi test. Il web non dipende da `@dnd-ai/config`; nessun valore di questa matrice usa il prefisso `NEXT_PUBLIC_`.

## Setup locale

Creare file ignorati partendo dai template:

```powershell
Copy-Item apps/api/.env.example apps/api/.env.local
Copy-Item apps/worker/.env.example apps/worker/.env.local
Copy-Item packages/persistence/.env.example packages/persistence/.env.local
```

Sostituire ogni `<set-in-local-env-file>` senza committare il risultato. I template non contengono password né URL funzionanti per scelta: `BL-004` definirà utenti e database locali reali.

Verificare i tre profili dopo il build del parser:

```powershell
corepack pnpm@10.34.5 config:check:api
corepack pnpm@10.34.5 config:check:worker
corepack pnpm@10.34.5 config:check:migration
```

Oppure eseguire `corepack pnpm@10.34.5 config:check`. Il comando stampa soltanto servizio e ambiente; non stampa URL o altri valori.

Per avviare l'API locale dopo il build:

```powershell
corepack pnpm@10.34.5 build
corepack pnpm@10.34.5 --filter @dnd-ai/api start:local
```

La configurazione è validata prima della creazione dell'app Fastify e del bind. Le URL vengono validate ma non connesse finché database e Redis non sono implementati dai task proprietari.

## Staging e production

Il secret manager della piattaforma inietta soltanto le chiavi del servizio avviato. Non usare file `.env` nell'artifact, variabili condivise fra tutti i runtime o secret di production in preview/staging. Staging e production richiedono password service-scoped e trasporto cifrato; il provider deve inoltre garantire TLS 1.2+ secondo la specifica. Il processo usa la stessa CLI senza `--env-file` come preflight dopo l'iniezione.

Il desired state di `BL-080` seleziona Vercel Environment Variables come confine futuro, ma dichiara correttamente `variables: []` e `secrets: []`: il web non ha un consumer applicativo. Il progetto reale `dnd-ai-web` conferma zero variabili applicative e system environment variables abilitate. `VERCEL_PROJECT_ID`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`, `VERCEL_GIT_REPO_ID` e `VERCEL_REGION` sono metadata di identità usati da `/health`; `VERCEL`, `VERCEL_ENV` e `VERCEL_TARGET_ENV` sono anche il confine build-time del guard Preview-only. Non sono configurazione di dominio e non vengono prefissati `NEXT_PUBLIC_`.

`apps/web/vercel.json` impone `node scripts/assert-vercel-preview-build.mjs && pnpm run build`: il controllo provider strict prosegue soltanto con `VERCEL=1`, `VERCEL_ENV=preview` e `VERCEL_TARGET_ENV=preview`. Il normale build locale usa l'entrypoint con `--allow-local` ed è ammesso esclusivamente quando tutti e tre i metadata sono assenti; metadata parziali, incoerenti o diversi da Preview falliscono senza stampare i valori. `turbo.json` include la tripla nella chiave cache. Il guard è integrato su `main` tramite PR #14/merge `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`, con CI PR `29335696502` e post-merge `29335856323` 5/5 verdi e zero deployment al readback. `APP_ENV=staging` resta il discriminatore applicativo futuro e non va confuso con questi metadata di piattaforma.

`VERCEL_TRUSTED_OIDC_TOKEN` è un valore effimero del solo step GitHub Actions: viene richiesto con `id-token: write`, mascherato immediatamente, passato al verifier tramite environment di processo e inviato esclusivamente nell'header Trusted Sources verso l'origin branch versionata. Non è un environment secret GitHub/Vercel, non viene persistito e non sostituisce le future credenziali applicative service-scoped. Emissione OIDC e Trusted Source sono controlli distinti; entrambi sono configurati e la seconda è stata riletta con audience, repository/repository ID, ref, environment e target `preview` esatti. Standard Protection usa oggi la policy SSO predefinita `all_except_custom_domains`; non creare `VERCEL_AUTOMATION_BYPASS_SECRET`.

La Git Integration effettiva collega esattamente il progetto al repository autorizzato senza access token Vercel nei workflow. L'installation condivisa resta invariata per decisione PO e compensata dai controlli project-level. Production Branch Vercel continua a risultare `release/production`, ma sia la prima attivazione di `main` sia il successivo comando CLI con selector Preview hanno prodotto record Production poi eliminati. Il manifest è unlinked con binding `null`, `source.autoDeploy=false`, `source.manualDeployment.enabled=false` e `git.deploymentEnabled=false`; lo stato remoto collegato resta distinto dal contratto versionato disabilitato. Project/deployment/run ID vengono redatti nei report; token, cookie e dati account non entrano nel repository.

Il flag CLI `--target=preview` non è più considerato una mitigazione sufficiente: il retry sul commit `1060228` è stato classificato Production dal provider, osservato `ERROR` e rimosso per ID esatto. La root `.vercelignore` resta il solo contratto di esclusione per la sorgente CLI; un `apps/web/.vercelignore` alternativo è vietato. Il dry-run `vercel@55.0.0 deploy . --target=preview --dry --format=json` può ancora essere validato con root/framework/input esatti, mode supportati, massimo 15.000 entry, 10 MiB complessivi, 5 MiB per file e nessun path generato, privato o non relativo, perché non carica sorgenti né crea deployment. Il runbook approvato invoca `deploy:bootstrap:check`, che nello stato vigente fallisce intenzionalmente con output statico; questo interlock versionato non impedisce a un owner di bypassare il runbook e invocare direttamente la CLI. Non usare `--cwd apps/web`, `--prebuilt`, archivi, `--prod`, `promote`, `redeploy`, `--skip-domain`, custom target o override manuali `VERCEL*`.

Per Next.js, le variabili `NEXT_PUBLIC_*` vengono incorporate nel bundle al build e restano congelate per quella build. Qualunque futura variabile pubblica richiede quindi review esplicita e non può contenere credenziali. Riferimento: [Next.js Environment Variables](https://nextjs.org/docs/app/guides/environment-variables).

## Failure e redazione

Su input mancante o malformato, `RuntimeConfigurationError` contiene soltanto il servizio e i nomi delle chiavi invalide. Non include valore, `ZodError`, input o cause. Errori inattesi allo startup API diventano il messaggio sicuro `API startup failed`.

Il repository ignora `.env` e `.env.*`, consentendo soltanto `.env.example`. Lo scanner rifiuta comunque un file privato forzato in Git per pathname, classifica credential file prima della lettura e integra l'indice Git con un traversal filesystem Git-ignore-aware per scoprire file untracked e speciali. Il traversal esclude `.git` e path ignorati, non segue symlink/junction e il controllo non apre file non regolari. Questo controllo è difesa in profondità: non sostituisce rotazione, scope minimo e audit del secret manager.

## Ownership successiva

- `BL-004`: migration executable e credenziali database locali/reali;
- `BL-008`: log/redaction/telemetry e nuovi endpoint osservabili;
- `BL-010`: configurazione dinamica auditata per flag e kill switch;
- `BL-080`: project/provider web, Production Branch e Trusted Source configurati senza secret applicativi; grant condiviso accettato; contenimento, guard e payload integrati, kill switch manuale chiuso dopo il secondo target mismatch, mentre Preview/smoke/failure/redeploy restano aperti;
- `BL-070`: hardening, load/chaos, backup restore e go/no-go.
