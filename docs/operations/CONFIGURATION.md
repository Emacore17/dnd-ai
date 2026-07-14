---
status: active
owner: engineering-and-security
last_reviewed: 2026-07-14
last_verified_commit: 70f726d5a7fd9feed1a338d4c24bbedecc0bbe0b
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
  - packages/config/src/runtime-config.ts
  - packages/config/src/cli.ts
  - apps/api/src/runtime.ts
  - apps/api/src/start.ts
  - apps/worker/src/runtime.ts
  - apps/api/.env.example
  - apps/worker/.env.example
  - packages/persistence/.env.example
  - infra/deployment/vercel-staging.json
  - apps/web/vercel.json
  - apps/web/app/health/route.ts
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
test_refs:
  - tests/unit/runtime-config.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/security/environment-file-policy.test.mjs
  - tests/security/secret-scanner.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/integration/web-health.test.mjs
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
| web | nessuna applicativa | `N/A` | la shell corrente non consuma config prodotto; `/health` legge soltanto system metadata Vercel server-side |

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

Il desired state di `BL-080` seleziona Vercel Environment Variables come confine futuro, ma dichiara correttamente `variables: []` e `secrets: []`: il web non ha un consumer applicativo. Il progetto reale `dnd-ai-web` conferma zero variabili applicative e system environment variables abilitate. `VERCEL_PROJECT_ID`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`, `VERCEL_GIT_REPO_ID`, `VERCEL_ENV` e `VERCEL_REGION` sono metadata di sistema server-side usati esclusivamente da `/health`; non sono configurazione di dominio né vengono prefissati `NEXT_PUBLIC_`.

`VERCEL_TRUSTED_OIDC_TOKEN` è un valore effimero del solo step GitHub Actions: viene richiesto con `id-token: write`, mascherato immediatamente, passato al verifier tramite environment di processo e inviato esclusivamente nell'header Trusted Sources verso l'origin branch versionata. Non è un environment secret GitHub/Vercel, non viene persistito e non sostituisce le future credenziali applicative service-scoped. Emissione OIDC e Trusted Source sono controlli distinti; entrambi sono configurati e la seconda è stata riletta con audience, repository/repository ID, ref, environment e target `preview` esatti. Standard Protection usa oggi la policy SSO predefinita `all_except_custom_domains`; non creare `VERCEL_AUTOMATION_BYPASS_SECRET`.

La Git Integration effettiva collega esattamente `dnd-ai-web` al repository autorizzato `Emacore17/dnd-ai` (repository ID `1299266814`) senza access token Vercel nei workflow. L'installation `41079282` resta condivisa (`isAccessRestricted=false`, 8 repository) per decisione esplicita del Product Owner: restringerla farebbe perdere accesso ad altri progetti. È un rischio residuo accettato e compensato da link esatti, Trusted Source exact-match, Fork/Standard Protection, policy Git branch-closed, environment `staging` limitato a `main`, smoke fail-closed e readback di drift. Production Branch Vercel è `release/production`; il change set registra project ID, scope, origin e installation ID insieme e abilita esclusivamente `main` tramite `{"**": false, "main": true, "release/production": false}`. Non esiste ancora alcun deployment: la PR deve restare senza deploy e l'origin viene materializzata soltanto dopo il merge protetto. Project ID, scope slug, installation/deployment ID, regione, environment e run ID sono non sensibili ma vengono comunque redatti nei report automatici. Il token OIDC non viene mai stampato. I valori production, token, cookie e dati account non entrano in documenti, chat, log, screenshot o artifact.

Per Next.js, le variabili `NEXT_PUBLIC_*` vengono incorporate nel bundle al build e restano congelate per quella build. Qualunque futura variabile pubblica richiede quindi review esplicita e non può contenere credenziali. Riferimento: [Next.js Environment Variables](https://nextjs.org/docs/app/guides/environment-variables).

## Failure e redazione

Su input mancante o malformato, `RuntimeConfigurationError` contiene soltanto il servizio e i nomi delle chiavi invalide. Non include valore, `ZodError`, input o cause. Errori inattesi allo startup API diventano il messaggio sicuro `API startup failed`.

Il repository ignora `.env` e `.env.*`, consentendo soltanto `.env.example`. Lo scanner rifiuta comunque un file privato forzato in Git per pathname, classifica credential file prima della lettura e integra l'indice Git con un traversal filesystem Git-ignore-aware per scoprire file untracked e speciali. Il traversal esclude `.git` e path ignorati, non segue symlink/junction e il controllo non apre file non regolari. Questo controllo è difesa in profondità: non sostituisce rotazione, scope minimo e audit del secret manager.

## Ownership successiva

- `BL-004`: migration executable e credenziali database locali/reali;
- `BL-008`: log/redaction/telemetry e nuovi endpoint osservabili;
- `BL-010`: configurazione dinamica auditata per flag e kill switch;
- `BL-080`: project/provider web, Production Branch Vercel e branch GitHub `release/production` protetta, binding completi, environment e Trusted Source exact-match configurati senza secret applicativi; grant GitHub App condiviso accettato, mentre PR/merge, deploy e primo smoke preview/staging restano aperti;
- `BL-070`: hardening, load/chaos, backup restore e go/no-go.
