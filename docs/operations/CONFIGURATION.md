---
status: active
owner: engineering-and-security
last_reviewed: 2026-07-16
last_verified_commit: e173fd9424ad77330ae8302f68affd4832d66798
source_refs:
  - docs/MVP_SPEC.md#5-assunzioni
  - docs/MVP_SPEC.md#2210-segreti-e-cifratura
  - docs/MVP_SPEC.md#293-ambienti
  - docs/MVP_SPEC.md#298-disaster-recovery-e-operazioni
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
  - docs/adr/0007-observability-context-and-error-reporting.md
  - docs/superpowers/specs/2026-07-16-bl-006-session-access-design.md
related_tasks:
  - BL-003
  - BL-004
  - BL-005
  - BL-006
  - BL-008
  - BL-010
  - BL-080
code_refs:
  - .vercelignore
  - packages/config/src/runtime-config.ts
  - packages/config/src/cli.ts
  - apps/api/src/runtime.ts
  - apps/api/src/start.ts
  - apps/worker/src/runtime.ts
  - apps/api/src/observability.ts
  - apps/worker/src/observability.ts
  - apps/web/.env.example
  - apps/web/lib/sentry-options.ts
  - apps/web/lib/server-observability.ts
  - apps/web/instrumentation-client.ts
  - apps/api/.env.example
  - apps/worker/.env.example
  - packages/persistence/.env.example
  - packages/persistence/src/migration-runner.ts
  - packages/persistence/src/feature-flags.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - packages/persistence/src/migrations/000003_identity_signup.ts
  - packages/persistence/src/identity-store.ts
  - apps/api/src/identity
  - apps/worker/src/identity
  - apps/web/lib/server/identity-bff.ts
  - scripts/run-database-migrations.mjs
  - scripts/manage-feature-flag.mjs
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
  - tests/database/feature-flags.test.mjs
  - tests/security/database-migration-security.test.mjs
  - tests/security/feature-flags-security.test.mjs
  - tests/unit/identity-runtime-config.test.mjs
  - tests/integration/identity-signup-flow.test.mjs
  - tests/unit/observability-core.test.mjs
  - tests/unit/observability-node.test.mjs
  - tests/integration/observability-flow.test.mjs
  - tests/contracts/observability-contract.test.mjs
  - tests/security/observability-security.test.mjs
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
| API | `API_PUBLIC_ORIGIN` | non secret | origin browser HTTPS nei profili gestiti, senza credentials/query/hash; è l'unico Origin accettato dalle route identity |
| API | `API_AUTH_PASSWORD_PEPPER_BASE64` + `API_AUTH_PASSWORD_PEPPER_VERSION` | secret + metadata | Base64 decodificato di almeno 32 byte e versione positiva per il prehash Argon2id |
| API | `API_AUTH_CHALLENGE_HMAC_KEY_BASE64` + `API_AUTH_CHALLENGE_KEY_VERSION` | secret + metadata | chiave/versione per codice e digest challenge; distinta logicamente dalle altre chiavi |
| API | `API_AUTH_SESSION_HMAC_KEY_BASE64` + `API_AUTH_SESSION_KEY_VERSION` | secret + metadata | chiave/versione per derivare token sessione replayable senza conservarlo raw |
| API | `API_AUTH_SUBJECT_HASH_KEY_BASE64` | secret | HMAC per subject rate-limit, idempotency key e fingerprint; non condivisa con challenge/sessione |
| API | `API_AUTH_BFF_ASSERTION_KEY_BASE64` | secret | stessa chiave server-only del web per verificare il subject client pseudonimo; distinta da pepper, challenge, sessione e subject hash |
| API | `API_SENTRY_DSN` | identificatore provider pubblico, redatto | opzionale; DSN HTTPS con host strutturale e project ID numerico |
| worker | `APP_ENV` | non secret | stesso discriminatore canonico |
| worker | `WORKER_DATABASE_URL` | secret-bearing | URL PostgreSQL con credenziale worker distinta e TLS nei profili gestiti |
| worker | `WORKER_REDIS_URL` | secret-bearing | URL Redis con credenziale worker distinta e `rediss:` nei profili gestiti |
| worker | `WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64` + `WORKER_AUTH_CHALLENGE_KEY_VERSION` | secret + metadata | stessa versione/materiale challenge dell'API per derivare il codice in memoria; mai esposto al browser |
| worker | `WORKER_EMAIL_DELIVERY_MODE` | non secret | `fake` soltanto in `local`; `smtp` obbligatorio nei profili gestiti |
| worker | `WORKER_SMTP_HOST`, `WORKER_SMTP_PORT`, `WORKER_SMTP_SECURE`, `WORKER_SMTP_FROM` | configurazione delivery | host/porta/from strutturali; TLS verificato, nessun fallback permissivo |
| worker | `WORKER_SMTP_USERNAME`, `WORKER_SMTP_PASSWORD` | secret-bearing | credenziali SMTP obbligatorie con mode `smtp`, service-scoped e mai loggate |
| worker | `WORKER_SENTRY_DSN` | identificatore provider pubblico, redatto | opzionale; stesso vincolo DSN, service-scoped |
| migration | `APP_ENV` | non secret | stesso discriminatore canonico |
| migration | `MIGRATION_DATABASE_URL` | secret-bearing | URL PostgreSQL con credenziale migration distinta e TLS nei profili gestiti |
| web | `NEXT_PUBLIC_SENTRY_DSN` | identificatore provider pubblico, redatto | opzionale; DSN HTTPS valida, incorporata nel build client quando configurata |
| web | `APP_ENV`, `WEB_API_INTERNAL_ORIGIN` | server-only | profilo e origin interno HTTP(S) dell'API; vietati credentials/query/hash e qualunque prefisso `NEXT_PUBLIC_` |
| web | `WEB_AUTH_BFF_ASSERTION_KEY_BASE64` | secret server-only | stesso materiale di `API_AUTH_BFF_ASSERTION_KEY_BASE64`; firma per 30 secondi il subject HMAC dell'IP trusted senza inoltrare l'IP raw |
| web | `APP_ENV`, `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV` | system metadata | risoluzione dell'environment telemetry; non sono config di dominio né secret |

Non aggiungere chiavi AI, storage o altri provider finché il task proprietario non introduce un consumer e i relativi test. `apps/web` non dipende da `@dnd-ai/config`: il BFF valida fail-closed la propria superficie minima server-only, mentre il parser/CLI centrale mantiene il controllo operativo degli stessi nomi. Nei profili gestiti il client IP deriva soltanto da `x-vercel-forwarded-for`, header sovrascritto dalla piattaforma come [documentato da Vercel](https://vercel.com/docs/headers/request-headers); in locale usa `x-forwarded-for` con fallback loopback. Il BFF non inoltra mai l'IP raw. Nessuna DSN è una credenziale, ma viene comunque redatta da log, errori e documenti operativi.

## Feature flag e kill switch server-side

`BL-010` introduce uno store PostgreSQL condiviso e auditato, non una variabile client. I flag catalogati sono `campaign.start`, `turn.new` e `model.route.premium`; il default sicuro e `enabled=false` per tutti. Un flag sconosciuto, store non raggiungibile o riga malformata fallisce chiuso.

Il comando operatore usa la stessa configurazione `APP_ENV` + `MIGRATION_DATABASE_URL` del composition root migration, perche non esiste ancora un endpoint admin autenticato. Non stampa URL, password, SQL o payload arbitrari.

```powershell
corepack pnpm@11.13.0 flags:status -- turn.new
corepack pnpm@11.13.0 flags:set -- turn.new --enable --actor operator:alice --reason maintenance --idempotency-key idem-feature-cli-0001 --correlation-id corr-feature-cli-0001 --expected-version 0
```

Il cambio e atomico: aggiorna `app.feature_flags` e inserisce `app.feature_flag_events` nella stessa transazione. Se l'audit non viene scritto, lo stato viene annullato. Una retry con la stessa idempotency key e lo stesso payload restituisce lo stesso evento; la stessa key con payload diverso fallisce come conflitto.

## Setup locale

Creare file ignorati partendo dai template:

```powershell
Copy-Item apps/api/.env.example apps/api/.env.local
Copy-Item apps/worker/.env.example apps/worker/.env.local
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item packages/persistence/.env.example packages/persistence/.env.local
```

Sostituire i placeholder dei template API e worker senza committare il risultato. Le tre chiavi Sentry possono restare vuote: in tal caso l'adapter remoto è disabilitato. Il template persistence è un'eccezione deliberata: contiene soltanto la URL funzionante del Compose locale, con credenziali sintetiche note `dnd_migration_local` e database `dnd_ai_local` su `127.0.0.1:55432`. Non è un secret e non deve essere riutilizzata o resa raggiungibile fuori dall'host locale.

Verificare i quattro profili dopo il build del parser:

```powershell
corepack pnpm@11.13.0 config:check:api
corepack pnpm@11.13.0 config:check:worker
corepack pnpm@11.13.0 config:check:web
corepack pnpm@11.13.0 config:check:migration
```

Oppure eseguire `corepack pnpm@11.13.0 config:check`. Il comando stampa soltanto servizio e ambiente; non stampa URL o altri valori.

Per avviare l'API locale dopo il build:

```powershell
corepack pnpm@11.13.0 build
corepack pnpm@11.13.0 --filter @dnd-ai/api start:local
```

La configurazione API è validata prima della creazione dell'app Fastify e del bind; il composition root apre il repository identity PostgreSQL solo dopo il parse e registra shutdown idempotente. Il worker apre PostgreSQL e costruisce il sender fake/SMTP solo dopo la validazione; non crea socket SMTP all'import. Redis resta configurato per la foundation ma non viene ancora aperto dai due runtime. Il composition root migration usa `MIGRATION_DATABASE_URL` per status e DDL dopo la validazione, senza stamparla o passarla come argomento CLI.

Per il database locale e le migration:

```powershell
corepack pnpm@11.13.0 db:local:up
corepack pnpm@11.13.0 db:migrate:status:local
corepack pnpm@11.13.0 db:migrate:local
corepack pnpm@11.13.0 db:rollback:local
corepack pnpm@11.13.0 db:local:down
corepack pnpm@11.13.0 db:migrate:test
```

Il percorso completo, inclusi lock, checksum, rollback e failure path, è in [`DATABASE_MIGRATIONS.md`](DATABASE_MIGRATIONS.md). In staging/production la URL migration è sempre secret-bearing, service-scoped e iniettata; il valore sintetico locale non costituisce un fallback.

## Staging e production

Il secret manager della piattaforma inietta soltanto le chiavi del servizio avviato. Non usare file `.env` nell'artifact, variabili condivise fra tutti i runtime o secret di production in preview/staging. Staging e production richiedono password service-scoped e trasporto cifrato; il provider deve inoltre garantire TLS 1.2+ secondo la specifica. Il processo usa la stessa CLI senza `--env-file` come preflight dopo l'iniezione.

Il desired state di `BL-080` seleziona Vercel Environment Variables come confine futuro, ma mantiene intenzionalmente `variables: []` e `secrets: []`: `BL-008` introduce un consumer opzionale, non autorizza account, progetto o provisioning Sentry. Il progetto reale `dnd-ai-web` resta quindi senza variabili applicative. `VERCEL_PROJECT_ID`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`, `VERCEL_GIT_REPO_ID` e `VERCEL_REGION` sono metadata di identità usati da `/health`; `VERCEL`, `VERCEL_ENV` e `VERCEL_TARGET_ENV` sono anche il confine build-time del guard Preview-only. Non sono configurazione di dominio. `NEXT_PUBLIC_VERCEL_ENV` è letto soltanto se fornito dal runtime per classificare gli eventi client.

`apps/web/vercel.json` impone `node scripts/assert-vercel-preview-build.mjs && pnpm run build`: il controllo provider strict prosegue soltanto con `VERCEL=1`, `VERCEL_ENV=preview` e `VERCEL_TARGET_ENV=preview`. Il normale build locale usa l'entrypoint con `--allow-local` ed è ammesso esclusivamente quando tutti e tre i metadata sono assenti; metadata parziali, incoerenti o diversi da Preview falliscono senza stampare i valori. `turbo.json` include la tripla nella chiave cache. Il guard è integrato su `main` tramite PR #14/merge `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`, con CI PR `29335696502` e post-merge `29335856323` 5/5 verdi e zero deployment al readback. `APP_ENV=staging` resta il discriminatore applicativo futuro e non va confuso con questi metadata di piattaforma.

`VERCEL_TRUSTED_OIDC_TOKEN` è un valore effimero del solo step GitHub Actions: viene richiesto con `id-token: write`, mascherato immediatamente, passato al verifier tramite environment di processo e inviato esclusivamente nell'header Trusted Sources verso l'origin branch versionata. Non è un environment secret GitHub/Vercel, non viene persistito e non sostituisce le future credenziali applicative service-scoped. Emissione OIDC e Trusted Source sono controlli distinti; entrambi sono configurati e la seconda è stata riletta con audience, repository/repository ID, ref, environment e target `preview` esatti. Standard Protection usa oggi la policy SSO predefinita `all_except_custom_domains`; non creare `VERCEL_AUTOMATION_BYPASS_SECRET`.

La Git Integration effettiva collega esattamente il progetto al repository autorizzato senza access token Vercel nei workflow. L'installation condivisa resta invariata per decisione PO e compensata dai controlli project-level. Production Branch Vercel continua a risultare `release/production`, ma sia la prima attivazione di `main` sia il successivo comando CLI con selector Preview hanno prodotto record Production poi eliminati. Il freeze è integrato tramite PR #16/merge `aa9342d`, con CI PR/post-merge 5/5 e zero deployment. Il manifest è unlinked con binding `null`, `source.autoDeploy=false`, `source.manualDeployment.enabled=false` e `git.deploymentEnabled=false`; lo stato remoto collegato resta distinto dal contratto versionato disabilitato. Project/deployment/run ID vengono redatti nei report; token, cookie e dati account non entrano nel repository.

Il flag CLI `--target=preview` non è una mitigazione: in Vercel CLI `55.0.0`, `@vercel/client 17.6.4` lo rimuove prima di serializzare la POST, dopodiché il provider ha restituito Production sul progetto senza deployment. L'applicazione server del comportamento first-deployment, coerente con la fonte storica e con l'issue aperta `vercel/vercel#17069`, è l'ipotesi più forte ma non è confermata; manca un fix/workaround supportato. La root `.vercelignore` resta il solo contratto di esclusione. Il dry-run `vercel@55.0.0 deploy . --target=preview --dry --format=json` può ancora essere validato perché non carica sorgenti né crea deployment. Il runbook invoca `deploy:bootstrap:check`, che fallisce intenzionalmente; l'interlock non impedisce a un owner di bypassare il runbook. Non usare `--cwd apps/web`, `--prebuilt`, archivi, `--prod`, `promote`, `redeploy`, `--skip-domain`, custom target o override manuali `VERCEL*`.

Per Next.js, le variabili `NEXT_PUBLIC_*` vengono incorporate nel bundle al build e restano congelate per quella build. `NEXT_PUBLIC_SENTRY_DSN` e `NEXT_PUBLIC_VERCEL_ENV` sono quindi esclusivamente metadata pubblici e non possono contenere credenziali. Nessun `SENTRY_AUTH_TOKEN`, organization/project slug, endpoint/header OTLP o source-map upload è previsto. Riferimento: [Next.js Environment Variables](https://nextjs.org/docs/app/guides/environment-variables).

## Failure e redazione

Su input mancante o malformato, `RuntimeConfigurationError` contiene soltanto il servizio e i nomi delle chiavi invalide. Non include valore, `ZodError`, input o cause. Errori inattesi allo startup API diventano il messaggio sicuro `API startup failed`.

Una `API_SENTRY_DSN` o `WORKER_SENTRY_DSN` presente ma malformata blocca il composition root prima del listener o dell'initializer, senza riflettere il valore. Una `NEXT_PUBLIC_SENTRY_DSN` assente o malformata disabilita invece Sentry client/server/edge e non interrompe UI o richieste. Errori di exporter, destination o transport vengono contenuti dal runtime osservabilità e non cambiano l'esito applicativo.

Il repository ignora `.env` e `.env.*`, consentendo soltanto `.env.example`. Lo scanner rifiuta comunque un file privato forzato in Git per pathname, classifica credential file prima della lettura e integra l'indice Git con un traversal filesystem Git-ignore-aware per scoprire file untracked e speciali. Il traversal esclude `.git` e path ignorati, non segue symlink/junction e il controllo non apre file non regolari. Questo controllo è difesa in profondità: non sostituisce rotazione, scope minimo e audit del secret manager.

## Ownership successiva

- `BL-004`: migration executable, Compose e credenziali esclusivamente sintetiche locali implementati; le credenziali reali/gestite restano al provisioning dell'ambiente proprietario;
- `BL-008`: baseline OTel/Pino/Sentry, redazione e propagazione implementate sul branch; nessun endpoint pubblico, account o backend remoto introdotto;
- `BL-010`: configurazione dinamica auditata per flag e kill switch;
- `BL-005`: chiavi identity versionate, origin pubblico/interno e delivery email server-only implementati; nessun secret reale o SMTP remoto verificato;
- `BL-006`: design approvato per una chiave HMAC reset dedicata e durate sessione tipizzate; variabili e parser non sono ancora implementati e verranno aggiunti soltanto con test fail-fast/redaction;
- `BL-080`: project/provider web, Production Branch e Trusted Source configurati senza secret applicativi; freeze integrato; task bloccato finché il provider non offre un first-deployment Preview-only supportato;
- `BL-070`: hardening, load/chaos, backup restore e go/no-go.
