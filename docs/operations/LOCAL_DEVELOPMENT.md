---
status: active
owner: engineering
last_reviewed: 2026-07-16
last_verified_commit: 3fa72610fcb7a874d368a12682d3c8d0e48e89a1
source_refs:
  - AGENTS.md#6-ciclo-operativo-standard
  - docs/MVP_SPEC.md#291-topologia-mvp
  - docs/MVP_SPEC.md#293-ambienti
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
  - docs/adr/0006-postgresql-migration-foundation.md
  - docs/adr/0009-mvp-runtime-data-and-workflow-architecture.md
  - docs/operations/CONFIGURATION.md
  - docs/operations/DATABASE_MIGRATIONS.md
related_tasks:
  - DOC-ARCH-001
  - BL-001
  - BL-003
  - BL-004
  - BL-079
  - BL-080
  - QA-001
code_refs:
  - package.json
  - pnpm-lock.yaml
  - apps/api/.env.example
  - apps/worker/.env.example
  - packages/persistence/.env.example
  - apps/web/app/health/route.ts
  - apps/web/package.json
  - infra/local/postgres.compose.yml
  - scripts/run-database-migrations.mjs
  - scripts/run-tests.mjs
test_refs:
  - tests/contracts/architecture-documentation.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/database/database-migrations.test.mjs
  - tests/integration/testing-containers.test.mjs
supersedes: null
---

# Sviluppo locale

## Stato delle capability

- **Implementato**: installazione frozen, build, validazione config, PostgreSQL/pgvector locale, migration, health HTTP del web e startup integration test.
- **Pianificato**: Redis locale applicativo, BullMQ, API di dominio, SSE e daemon worker.

Questa guida verifica la fondazione corrente da checkout pulito. Non simula come disponibili i servizi posseduti dai task futuri.

## Prerequisiti

| Strumento | Requisito |
|---|---|
| Git | clone e worktree locali |
| Node.js | `>=22.13.0`; la toolchain del repository usa `24.11.0` |
| Corepack | disponibile con Node e usato per il pin `pnpm@11.13.0` |
| Docker Engine + Compose | necessari per PostgreSQL/pgvector locale |

Non serve un client `psql`: migration, status e test usano i client Node del repository. Il container espone PostgreSQL soltanto su `127.0.0.1:55432` con credenziali sintetiche note e volume locale disposable.

## Checkout pulito

```powershell
git clone https://github.com/Emacore17/dnd-ai.git
Set-Location dnd-ai
corepack enable
corepack pnpm@11.13.0 install --frozen-lockfile
```

Se l'install frozen segnala drift, non rigenerare il lockfile come workaround: verificare versione Node/pnpm e riallineare branch e `pnpm-lock.yaml` nel task che possiede la dipendenza.

## Configurazione locale

Copiare i template non tracciati; non modificare i file `.env.example`.

```powershell
Copy-Item packages/persistence/.env.example packages/persistence/.env.local
Copy-Item apps/api/.env.example apps/api/.env.local
Copy-Item apps/worker/.env.example apps/worker/.env.local
```

Il template persistence contiene già la URL sintetica del Compose locale. I template API/worker mantengono sentinelle intenzionali: per i soli check della fondazione impostare valori loopback nel processo corrente, senza committarli.

```powershell
$env:API_DATABASE_URL = "postgresql://dnd_migration_local:dnd_migration_local@127.0.0.1:55432/dnd_ai_local"
$env:API_REDIS_URL = "redis://127.0.0.1:6379"
$env:WORKER_DATABASE_URL = "postgresql://dnd_migration_local:dnd_migration_local@127.0.0.1:55432/dnd_ai_local"
$env:WORKER_REDIS_URL = "redis://127.0.0.1:6379"
```

Le URL Redis provano soltanto la validazione sintattica: questa baseline non avvia Redis e non deve essere interpretata come readiness del servizio. Le DSN Sentry possono restare vuote.

## Database locale

Eseguire nell'ordine:

```powershell
corepack pnpm@11.13.0 db:local:up
corepack pnpm@11.13.0 config:check:migration
corepack pnpm@11.13.0 db:migrate:local
corepack pnpm@11.13.0 db:migrate:status:local
```

Lo status terminale deve indicare head `000002_feature_flags`, contract `database-feature-flags-v1` e nessuna migration pending. La struttura fisica risultante è descritta in [`DATA_MODEL.md`](../data/DATA_MODEL.md).

## Build e readiness

Costruire tutti i workspace e verificare API/worker tramite test di integrazione isolati:

```powershell
corepack pnpm@11.13.0 build
corepack pnpm@11.13.0 test:integration
```

Il web costruito espone l'unico health endpoint applicativo reale. Questo esempio avvia il processo esatto su loopback, attende in modo bounded e valida il contratto `web-health-v1`.

```powershell
$node = (Get-Command node).Source
$web = Start-Process -FilePath $node -ArgumentList @(
  "apps/web/node_modules/next/dist/bin/next",
  "start",
  "--hostname",
  "127.0.0.1",
  "--port",
  "3100"
) -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru

$health = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:3100/health" -TimeoutSec 2
    break
  } catch {
    Start-Sleep -Milliseconds 500
  }
}
if ($null -eq $health -or $health.contract -ne "web-health-v1" -or $health.status -ne "ok") {
  throw "web health contract failed"
}
```

API non espone ancora un endpoint health. Il worker non è ancora un daemon BullMQ. `test:integration` verifica i composition root e i failure path senza sostenere il contrario.

## Arresto e cleanup

Conservare il process object restituito da `Start-Process` e fermare soltanto quel PID. Database e volume locale vanno rimossi in `finally`, anche dopo un errore:

```powershell
try {
  # build, test e health check
} finally {
  if ($null -ne $web -and -not $web.HasExited) {
    Stop-Process -Id $web.Id -Force
  }
  corepack pnpm@11.13.0 db:local:down
  Remove-Item Env:API_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:API_REDIS_URL -ErrorAction SilentlyContinue
  Remove-Item Env:WORKER_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:WORKER_REDIS_URL -ErrorAction SilentlyContinue
}
```

Non usare kill per nome processo e non rimuovere container/volumi di altri progetti. Prima di un cold check automatizzato, se `docker compose -f infra/local/postgres.compose.yml ps --status running` mostra risorse già in uso, fermarsi e preservarle.

## Failure e recupero

| Failure | Segnale | Recupero sicuro |
|---|---|---|
| Node/pnpm non compatibile | engine o package-manager error | Installare una versione ammessa; non modificare gli engine. |
| Docker non disponibile | `db:local:up` non raggiunge health | Avviare Docker Engine e rieseguire; nessun test viene marcato passing. |
| Porta `55432` occupata | bind error Compose | Identificare il proprietario; non terminare processi estranei e non cambiare la porta senza task. |
| Template/env mancante | config check fail-fast con nome chiave | Ricopiare il template e impostare soltanto valori loopback sintetici. |
| Migration drift | errore `STATE_DRIFT` o head inatteso | Non modificare ledger/tabelle a mano; confrontare manifest, migration e database disposable. |
| Startup integration fallisce | exit non-zero del runner | Conservare l'errore redatto, correggere la causa e rieseguire la suite mirata. |
| Health non pronta | timeout bounded o contratto diverso | Fermare il PID esatto, verificare build e porta, poi riavviare una volta. |
| Cleanup fallisce | container/volume del progetto ancora presenti | Usare soltanto `corepack pnpm@11.13.0 db:local:down` dalla root corretta e verificare lo scope Compose. |

## Ambienti remoti

Lo staging non è disponibile. Nessun comando Vercel, deploy, release o Production appartiene al percorso locale; lo stato fail-closed e il blocco `BL-080` restano descritti in [`PREVIEW_STAGING.md`](PREVIEW_STAGING.md).
