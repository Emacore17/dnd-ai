---
status: active
owner: engineering-and-security
last_reviewed: 2026-07-14
last_verified_commit: b84f4eb79000ab78b524d463582eb28013c9da2c
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
  - packages/persistence/src/migration-runner.ts
  - scripts/run-database-migrations.mjs
  - scripts/lib/database-migration-policy.mjs
  - infra/local/postgres.compose.yml
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
  - tests/unit/database-migration-policy.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/security/database-migration-security.test.mjs
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

Sostituire i placeholder dei template API e worker senza committare il risultato. Il template persistence è un'eccezione deliberata: contiene soltanto la URL funzionante del Compose locale, con credenziali sintetiche note `dnd_migration_local` e database `dnd_ai_local` su `127.0.0.1:55432`. Non è un secret e non deve essere riutilizzata o resa raggiungibile fuori dall'host locale.

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

La configurazione API è validata prima della creazione dell'app Fastify e del bind; API e worker non aprono ancora database/Redis. Il composition root migration, invece, usa già `MIGRATION_DATABASE_URL` per status e DDL dopo la validazione, senza stamparla o passarla come argomento CLI.

Per il database locale e le migration:

```powershell
corepack pnpm@10.34.5 db:local:up
corepack pnpm@10.34.5 db:migrate:status:local
corepack pnpm@10.34.5 db:migrate:local
corepack pnpm@10.34.5 db:rollback:local
corepack pnpm@10.34.5 db:local:down
corepack pnpm@10.34.5 db:migrate:test
```

Il percorso completo, inclusi lock, checksum, rollback e failure path, è in [`DATABASE_MIGRATIONS.md`](DATABASE_MIGRATIONS.md). In staging/production la URL migration è sempre secret-bearing, service-scoped e iniettata; il valore sintetico locale non costituisce un fallback.

## Staging e production

Il secret manager della piattaforma inietta soltanto le chiavi del servizio avviato. Non usare file `.env` nell'artifact, variabili condivise fra tutti i runtime o secret di production in preview/staging. Staging e production richiedono password service-scoped e trasporto cifrato; il provider deve inoltre garantire TLS 1.2+ secondo la specifica. Il processo usa la stessa CLI senza `--env-file` come preflight dopo l'iniezione.

Il desired state di `BL-080` seleziona Vercel Environment Variables come confine futuro, ma dichiara correttamente `variables: []` e `secrets: []`: il web non ha un consumer applicativo. Il progetto reale `dnd-ai-web` conferma zero variabili applicative e system environment variables abilitate. `VERCEL_PROJECT_ID`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`, `VERCEL_GIT_REPO_ID` e `VERCEL_REGION` sono metadata di identità usati da `/health`; `VERCEL`, `VERCEL_ENV` e `VERCEL_TARGET_ENV` sono anche il confine build-time del guard Preview-only. Non sono configurazione di dominio e non vengono prefissati `NEXT_PUBLIC_`.

`apps/web/vercel.json` impone `node scripts/assert-vercel-preview-build.mjs && pnpm run build`: il controllo provider strict prosegue soltanto con `VERCEL=1`, `VERCEL_ENV=preview` e `VERCEL_TARGET_ENV=preview`. Il normale build locale usa l'entrypoint con `--allow-local` ed è ammesso esclusivamente quando tutti e tre i metadata sono assenti; metadata parziali, incoerenti o diversi da Preview falliscono senza stampare i valori. `turbo.json` include la tripla nella chiave cache. Il guard è integrato su `main` tramite PR #14/merge `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`, con CI PR `29335696502` e post-merge `29335856323` 5/5 verdi e zero deployment al readback. `APP_ENV=staging` resta il discriminatore applicativo futuro e non va confuso con questi metadata di piattaforma.

`VERCEL_TRUSTED_OIDC_TOKEN` è un valore effimero del solo step GitHub Actions: viene richiesto con `id-token: write`, mascherato immediatamente, passato al verifier tramite environment di processo e inviato esclusivamente nell'header Trusted Sources verso l'origin branch versionata. Non è un environment secret GitHub/Vercel, non viene persistito e non sostituisce le future credenziali applicative service-scoped. Emissione OIDC e Trusted Source sono controlli distinti; entrambi sono configurati e la seconda è stata riletta con audience, repository/repository ID, ref, environment e target `preview` esatti. Standard Protection usa oggi la policy SSO predefinita `all_except_custom_domains`; non creare `VERCEL_AUTOMATION_BYPASS_SECRET`.

La Git Integration effettiva collega esattamente il progetto al repository autorizzato senza access token Vercel nei workflow. L'installation condivisa resta invariata per decisione PO e compensata dai controlli project-level. Production Branch Vercel continua a risultare `release/production`, ma sia la prima attivazione di `main` sia il successivo comando CLI con selector Preview hanno prodotto record Production poi eliminati. Il freeze è integrato tramite PR #16/merge `aa9342d`, con CI PR/post-merge 5/5 e zero deployment. Il manifest è unlinked con binding `null`, `source.autoDeploy=false`, `source.manualDeployment.enabled=false` e `git.deploymentEnabled=false`; lo stato remoto collegato resta distinto dal contratto versionato disabilitato. Project/deployment/run ID vengono redatti nei report; token, cookie e dati account non entrano nel repository.

Il flag CLI `--target=preview` non è una mitigazione: in Vercel CLI `55.0.0`, `@vercel/client 17.6.4` lo rimuove prima di serializzare la POST, dopodiché il provider ha restituito Production sul progetto senza deployment. L'applicazione server del comportamento first-deployment, coerente con la fonte storica e con l'issue aperta `vercel/vercel#17069`, è l'ipotesi più forte ma non è confermata; manca un fix/workaround supportato. La root `.vercelignore` resta il solo contratto di esclusione. Il dry-run `vercel@55.0.0 deploy . --target=preview --dry --format=json` può ancora essere validato perché non carica sorgenti né crea deployment. Il runbook invoca `deploy:bootstrap:check`, che fallisce intenzionalmente; l'interlock non impedisce a un owner di bypassare il runbook. Non usare `--cwd apps/web`, `--prebuilt`, archivi, `--prod`, `promote`, `redeploy`, `--skip-domain`, custom target o override manuali `VERCEL*`.

Per Next.js, le variabili `NEXT_PUBLIC_*` vengono incorporate nel bundle al build e restano congelate per quella build. Qualunque futura variabile pubblica richiede quindi review esplicita e non può contenere credenziali. Riferimento: [Next.js Environment Variables](https://nextjs.org/docs/app/guides/environment-variables).

## Failure e redazione

Su input mancante o malformato, `RuntimeConfigurationError` contiene soltanto il servizio e i nomi delle chiavi invalide. Non include valore, `ZodError`, input o cause. Errori inattesi allo startup API diventano il messaggio sicuro `API startup failed`.

Il repository ignora `.env` e `.env.*`, consentendo soltanto `.env.example`. Lo scanner rifiuta comunque un file privato forzato in Git per pathname, classifica credential file prima della lettura e integra l'indice Git con un traversal filesystem Git-ignore-aware per scoprire file untracked e speciali. Il traversal esclude `.git` e path ignorati, non segue symlink/junction e il controllo non apre file non regolari. Questo controllo è difesa in profondità: non sostituisce rotazione, scope minimo e audit del secret manager.

## Ownership successiva

- `BL-004`: migration executable, Compose e credenziali esclusivamente sintetiche locali implementati; le credenziali reali/gestite restano al provisioning dell'ambiente proprietario;
- `BL-008`: log/redaction/telemetry e nuovi endpoint osservabili;
- `BL-010`: configurazione dinamica auditata per flag e kill switch;
- `BL-080`: project/provider web, Production Branch e Trusted Source configurati senza secret applicativi; freeze integrato; task bloccato finché il provider non offre un first-deployment Preview-only supportato;
- `BL-070`: hardening, load/chaos, backup restore e go/no-go.
