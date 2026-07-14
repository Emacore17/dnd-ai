---
status: accepted
owner: engineering-and-security
last_reviewed: 2026-07-13
last_verified_commit: f57141341efe5df0707c77ff8ccef4f6fa15f675
source_refs:
  - docs/MVP_SPEC.md#5-assunzioni
  - docs/MVP_SPEC.md#2210-segreti-e-cifratura
  - docs/MVP_SPEC.md#293-ambienti
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
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

# ADR-0004 — Configurazione runtime e iniezione dei secret

## Stato

Accepted il 2026-07-13 durante `BL-003`.

## Contesto

API, worker e future migration richiedono credenziali diverse e devono fallire prima di iniziare effetti o aprire listener quando la configurazione è incompleta. Un unico schema ambientale globale esporrebbe chiavi non necessarie ai processi, mentre parsing duplicato produrrebbe default e messaggi d'errore divergenti. La shell web corrente è statica e non ha ancora un consumer reale di configurazione runtime.

Preview/staging deve inoltre restare separato da production. La scelta del provider e la creazione del secret manager non appartengono a questo task: `BL-003` deve definire il contratto portabile che `BL-080` inietterà.

## Decisione

1. `@dnd-ai/config` è un leaf package server-only basato su Zod 4. Accetta una sorgente esplicita `Record<string, string | undefined>`; il parser puro non legge direttamente `process.env`.
2. `APP_ENV` è il discriminatore canonico e ammette soltanto `local`, `staging` e `production`. Una preview usa il profilo di sicurezza `staging`, ma risorse, dati e secret restano isolati. `NODE_ENV` non determina l'ambiente applicativo.
3. La superficie è service-scoped:
   - API: `API_HOST`, `API_PORT`, `API_DATABASE_URL`, `API_REDIS_URL`;
   - worker: `WORKER_DATABASE_URL`, `WORKER_REDIS_URL`;
   - migration: `MIGRATION_DATABASE_URL`;
   - web: nessuna chiave obbligatoria finché non esiste un consumer server-side reale.
4. I parser rimuovono chiavi ambientali estranee, restituiscono oggetti frozen e accettano solo host, porte e URL strutturalmente validi. `staging`/`production` richiedono password service-scoped, PostgreSQL con `sslmode=require|verify-ca|verify-full` e Redis `rediss:`; alternative IAM/mTLS richiedono un'estensione tipizzata del contratto.
5. `RuntimeConfigurationError` espone soltanto servizio e nomi delle chiavi invalide. Non conserva `ZodError`, input, cause o valori che potrebbero contenere password.
6. L'API valida prima della factory Fastify e del bind. Il worker valida prima dell'inizializzatore iniettato; non viene creato un daemon fittizio. Il profilo migration è verificabile dalla CLI e sarà consumato dall'entry point posseduto da `BL-004`.
7. In locale si usano `.env.local` ignorati e template distinti con sentinel non sensibili. Staging e production usano gli stessi nomi e lo stesso schema di variabili, ma valori, risorse e credenziali distinti iniettati dal secret manager per singolo servizio. Nessun SDK del provider entra nel package.
8. Ogni `.env` o `.env.*` tracciato, salvo `.env.example`, fallisce il secret scan per pathname anche quando il contenuto non coincide con un pattern credenziale noto. Lo scanner classifica path ambientali e credenziali prima di leggere e integra l'indice Git con una discovery filesystem Git-ignore-aware: `.git` e path ignorati sono esclusi, symlink/junction non vengono seguiti e i file non regolari sono rifiutati senza apertura.
9. Nuove variabili vengono aggiunte soltanto insieme a un consumer reale, classificazione public/secret, test, template e aggiornamento di `docs/operations/CONFIGURATION.md`.

## Alternative considerate

### Un unico schema globale

Rifiutato: renderebbe disponibili al web o all'API credenziali del worker/migration e indebolirebbe least privilege.

### Parser duplicati nelle app

Rifiutato: errori, default e vincoli evolverebbero in modo divergente. Il leaf package conserva una sola policy senza importare dominio o infrastruttura.

### `dotenv`, `envalid` o SDK del secret manager

Non necessari: Node supporta `--env-file` per il solo sviluppo locale e le piattaforme iniettano variabili nel processo. Un SDK introdurrebbe ora un provider senza decisione di deployment.

### Config obbligatoria nel web senza consumer

Rinviata: un `APP_ENV` inventato soltanto per far fallire `next build` aumenterebbe il coupling build/runtime. Le variabili `NEXT_PUBLIC_*` sono incorporate nel bundle client e non possono contenere secret; verranno introdotte solo dal task che possiede un consumer reale.

## Conseguenze e revisione

Il workspace passa a undici package/applicazioni verificati e l'artifact include il codice config compilato. I processi devono preparare i propri valori prima dello startup, ma ricevono una failure deterministica e redatta. Il minimo Node sale a una linea LTS supportata (`>=22.12.0`), mentre il workspace resta pin a `24.11.0`.

`BL-004` dipende ora da `BL-003` e costruirà il migration executable senza rendere `persistence` dipendente da `config`. `BL-080` sceglierà provider, regione, secret manager, packaging avviabile e primo smoke remoto. Rivedere questa decisione soltanto se un nuovo runtime richiede una sorgente diversa dalle variabili di processo o se metriche operative dimostrano la necessità di config dinamica; feature flag mutabili restano responsabilità di `BL-010`.
