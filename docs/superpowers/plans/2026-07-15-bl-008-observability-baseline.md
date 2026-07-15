---
status: active
owner: engineering-and-security
last_reviewed: 2026-07-15
last_verified_commit: b9b707f3ee6bb812114b206cda03530c33e48edb
source_refs:
  - docs/superpowers/specs/2026-07-15-bl-008-observability-baseline-design.md
  - docs/adr/0007-observability-context-and-error-reporting.md
  - docs/MVP_SPEC.md#24-osservabilità
  - docs/MVP_SPEC.md#291-topologia-mvp
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
  - docs/TASKS.md#bl-008--otellogsentry-baseline
related_tasks:
  - BL-008
code_refs:
  - packages/observability
  - packages/config
  - apps/web
  - apps/api
  - apps/worker
test_refs:
  - tests/unit
  - tests/integration
  - tests/contracts
  - tests/security
supersedes: null
---

# BL-008 — Piano di implementazione della baseline osservabilità

> **Per gli agenti esecutori:** usare `superpowers:test-driven-development` per ogni batch, `vercel:observability` e documentazione primaria per le API correnti, `superpowers:requesting-code-review` prima del candidato e `superpowers:verification-before-completion` prima di ogni claim finale.

**Obiettivo:** implementare `observability-baseline-v1` con propagazione W3C web→API→worker fake, `requestId` server-owned, log Pino JSON redatti e Sentry error-only opzionale, senza rete nei test né risorse provider.

**Architettura:** `@dnd-ai/observability` espone un kernel platform-neutral e un subpath `/node`. Il kernel Node usa provider OTel espliciti e `AsyncLocalStorage`; API e worker possiedono il wiring dei rispettivi runtime, mentre Next inizializza OTel server-side e Sentry client/server senza performance tracing. Config e telemetry failure falliscono in modo sicuro senza alterare il percorso applicativo.

**Stack:** TypeScript strict, Node 24, OpenTelemetry API/SDK minimi, Pino, Sentry Node/Next, Fastify 5, Next 16 App Router, `node:test`, pnpm 11/Turborepo.

**Corsia:** `HIGH_RISK`; un solo full gate sul candidato, seguito da checkout pulito, una review indipendente e una sola PR. Nessuna azione Vercel, creazione account Sentry, exporter OTLP o chiamata provider reale.

## Stato di esecuzione

I Task 1–8 e i gate locali del Task 9 sono completati: unit `77 PASS/1 host skip`, integration `13 PASS`, database `13 PASS`, contract `36 PASS`, security `26 PASS/3 host skip`, `verify:affected` `33/33`, `verify:docs` su 27 documenti, review senza P0/P1, full `verify` verde e checkout pulito del candidato osservabilità. La PR #20 è aperta; la correzione audit pnpm 11 ha superato audit high, re-review e full gate finale in `85,1 s`. Restano clean verify del commit e nuovo merge gate remoto.

Il wiring Next carica Sentry client/server/edge soltanto dopo una DSN valida. Questa ottimizzazione mantiene l'SDK fuori dall'entry client iniziale quando disabilitato e accetta una breve finestra asincrona per gli errori di hydration più precoci.

## Vincoli di esecuzione

- Un solo agente modifica il change set per volta; discovery e review possono essere read-only e parallele.
- Scrivere e osservare rosso ogni test prima del codice corrispondente.
- Usare `apply_patch` per manifest, sorgenti, test e documenti; il lockfile viene rigenerato da pnpm.
- Non aggiungere auto-instrumentation, Replay, profiling, metric SDK, collector, route pubbliche di smoke o un secondo logger.
- Non registrare messaggi di errore, header completi, body, prompt, output AI, cookie, DSN o valori di carrier rifiutati.
- Non creare commit di solo stato o evidenza; il piano e l'implementazione formano un unico candidato funzionale successivo al commit di design.

## Task 1 — Bloccare manifest, export e dependency boundary

**File:**

- Creare: `tests/contracts/observability-contract.test.mjs`
- Modificare: `packages/observability/package.json`
- Modificare: `packages/observability/src/index.ts`
- Creare: `packages/observability/src/node.ts`
- Modificare: `apps/api/package.json`
- Modificare: `apps/worker/package.json`
- Modificare: `apps/web/package.json`
- Modificare: `package.json`
- Modificare: `pnpm-lock.yaml`

### Passo 1: scrivere il contract test rosso

Il test deve leggere i manifest e verificare:

- export `.` e `./node` da `@dnd-ai/observability`;
- `sideEffects: false` e nessuna dipendenza workspace del package;
- dipendenze exact-pinned minime: `@opentelemetry/api`, `@opentelemetry/context-async-hooks`, `@opentelemetry/core`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-trace-node`, `pino`, `@sentry/node`;
- `@dnd-ai/observability` presente in web/API/worker e `@sentry/nextjs` soltanto nel web;
- assenza di auto-instrumentation, Replay, profiling e exporter OTLP;
- gli script standalone unit/security costruiscono `@dnd-ai/observability` prima di importarne `dist`.

Eseguire:

```powershell
node --test tests/contracts/observability-contract.test.mjs
```

Atteso: `FAIL` per manifest/export mancanti.

### Passo 2: applicare il minimo change set dei manifest

Usare le versioni exact-pinned verificate nel registry e compatibili fra loro:

- `@opentelemetry/api@1.9.1`;
- package SDK OTel `2.9.0`;
- `pino@10.3.1`;
- `@sentry/node@10.65.0`;
- `@sentry/nextjs@10.65.0`.

Il root export deve restare browser-safe; `./node` punta a `dist/node.js`. Aggiornare i filtri di build di `test:unit` e `test:security`, poi rigenerare installazione e lockfile:

```powershell
corepack pnpm@11.13.0 install --no-frozen-lockfile
```

### Passo 3: verificare il contratto e le boundary

```powershell
node --test tests/contracts/observability-contract.test.mjs
corepack pnpm@11.13.0 boundaries:check
```

Atteso: entrambi `PASS`; nessun package di dominio/config acquisisce una dipendenza infrastrutturale.

## Task 2 — Estendere la config service-scoped per Sentry opzionale

**File:**

- Modificare: `tests/unit/runtime-config.test.mjs`
- Modificare: `tests/contracts/runtime-config-contract.test.mjs`
- Modificare: `packages/config/src/runtime-config.ts`
- Modificare: `packages/config/src/index.ts`
- Modificare: `apps/api/.env.example`
- Modificare: `apps/worker/.env.example`
- Creare: `apps/web/.env.example`

### Passo 1: scrivere i test rossi

Aggiungere casi che provano:

- `API_SENTRY_DSN` e `WORKER_SENTRY_DSN` assenti o vuoti vengono omessi dal config object congelato;
- una DSN HTTPS valida viene conservata soltanto nel profilo del servizio proprietario;
- schema, host o project path invalidi producono `RuntimeConfigurationError` con il solo nome della chiave;
- il valore DSN non compare nel messaggio, nella `cause` o nell'output CLI;
- i tre `.env.example` espongono soltanto le chiavi consentite e valori vuoti/sentinel non segreti;
- `NEXT_PUBLIC_SENTRY_DSN` compare soltanto nel template web e non rende `config` importabile dal browser.

Eseguire:

```powershell
corepack pnpm@11.13.0 --filter @dnd-ai/config build
node --test tests/unit/runtime-config.test.mjs tests/contracts/runtime-config-contract.test.mjs
```

Atteso: nuovi assert `FAIL`.

### Passo 2: implementare parsing opzionale e redatto

Estendere `ApiRuntimeConfig`/`WorkerRuntimeConfig` con `sentryDsn?`, usando `exactOptionalPropertyTypes`: la proprietà non deve esistere quando manca la chiave. Validare una DSN HTTPS con public key, host e project path, senza mai rifletterne il valore. Migration config resta invariata.

### Passo 3: verificare config e startup failure path

```powershell
corepack pnpm@11.13.0 --filter @dnd-ai/config build
node --test tests/unit/runtime-config.test.mjs tests/contracts/runtime-config-contract.test.mjs tests/integration/runtime-startup.test.mjs
```

Atteso: `PASS`; DSN malformata blocca API/worker prima di listener/initializer.

## Task 3 — Implementare kernel platform-neutral e redazione fail-closed

**File:**

- Creare: `tests/unit/observability-core.test.mjs`
- Creare: `tests/security/observability-security.test.mjs`
- Creare: `packages/observability/src/contracts.ts`
- Creare: `packages/observability/src/request-id.ts`
- Creare: `packages/observability/src/trace-context.ts`
- Creare: `packages/observability/src/redaction.ts`
- Creare: `packages/observability/src/error-reporting.ts`
- Modificare: `packages/observability/src/index.ts`

### Passo 1: scrivere i test rossi del kernel

Definire e testare le API pubbliche minime:

```ts
createRequestId(candidate?: string, generate?: () => string): string;
sanitizeTelemetryValue(value: unknown): unknown;
sanitizeSentryEvent(event: unknown, metadata: SafeErrorMetadata): unknown;
createNoopErrorReporter(): ErrorReporter;
```

I test coprono UUID v4 lowercase canonico, rigenerazione di valori assenti/non canonici, oggetti annidati, array, cicli, limiti di profondità/dimensione, chiavi case-insensitive e fixture con email/auth/cookie/password/token/DSN/prompt/output AI.

Eseguire:

```powershell
corepack pnpm@11.13.0 --filter @dnd-ai/observability build
node --test tests/unit/observability-core.test.mjs tests/security/observability-security.test.mjs
```

Atteso: `FAIL` per export/implementazioni mancanti.

### Passo 2: implementare allowlist e sanitizzazione bounded

Il sanitizer deve produrre un nuovo valore, non mutare l'input e non attraversare prototype/descriptor non posseduti. Gli errori espongono solo `errorCode`, nome allowlisted e frame normalizzati senza prima riga/messaggio. `ErrorReporter.capture` non deve mai propagare eccezioni.

### Passo 3: verificare kernel e leakage

```powershell
corepack pnpm@11.13.0 --filter @dnd-ai/observability build
node --test tests/unit/observability-core.test.mjs tests/security/observability-security.test.mjs
```

Atteso: `PASS`; nessun valore canary appare nell'output serializzato.

## Task 4 — Implementare runtime Node OTel, logger Pino e adapter Sentry

**File:**

- Creare: `tests/unit/observability-node.test.mjs`
- Creare: `packages/observability/src/tracing.ts`
- Creare: `packages/observability/src/logger.ts`
- Creare: `packages/observability/src/sentry.ts`
- Modificare: `packages/observability/src/node.ts`

### Passo 1: scrivere i test rossi del runtime Node

Definire `createNodeObservability` e `ObservedOperation` con:

- provider/tracer e context manager per istanza di processo;
- `startOperation`, `run`, `inject`, `end`, current context e `shutdown(timeoutMs)`;
- W3C `traceparent`/`tracestate`, nessun `baggage`;
- logger typed con campi allowlisted e contesto automatico;
- no-op reporter senza DSN e adapter Sentry con transport iniettato;
- init idempotente per config uguale e errore sicuro per config incompatibile.

Usare `InMemorySpanExporter` e una destination Pino in-memory. Eseguire:

```powershell
corepack pnpm@11.13.0 --filter @dnd-ai/observability build
node --test tests/unit/observability-node.test.mjs
```

Atteso: `FAIL` per runtime mancante.

### Passo 2: implementare OTel come unica autorità trace

Usare SDK trace minimi e `AsyncLocalStorageContextManager`, senza `@opentelemetry/sdk-node` né registrazioni Sentry del tracing. La configurazione Sentry Node deve includere `skipOpenTelemetrySetup: true`, `tracesSampleRate: 0`, `sendDefaultPii: false` e filtro finale redatto. Nessun init avviene senza DSN.

Il logger Pino deve omettere `pid`, `hostname` e oggetti raw; il messaggio coincide con `event`. Exporter/reporter/log destination failure viene contenuta e trasformata in esito locale, mai rilanciata nel callback applicativo.

### Passo 3: verificare tracing, logging e shutdown

```powershell
corepack pnpm@11.13.0 --filter @dnd-ai/observability build
node --test tests/unit/observability-node.test.mjs tests/security/observability-security.test.mjs
```

Atteso: `PASS`; span validi senza exporter remoto e flush bounded senza sleep.

## Task 5 — Integrare Fastify e worker, poi chiudere la trace E2E fake

**File:**

- Creare: `tests/integration/observability-flow.test.mjs`
- Creare: `apps/api/src/observability.ts`
- Modificare: `apps/api/src/app.ts`
- Modificare: `apps/api/src/runtime.ts`
- Modificare: `apps/api/src/index.ts`
- Creare: `apps/worker/src/observability.ts`
- Modificare: `apps/worker/src/runtime.ts`
- Modificare: `apps/worker/src/index.ts`

### Passo 1: scrivere il test di accettazione rosso

Il test deve costruire tre runtime in-memory (`web`, `api`, `worker`) e verificare:

1. root `web.request`;
2. injection HTTP verso `app.inject()`;
3. plugin Fastify con span `api.request` e header risposta `x-request-id`;
4. span `queue.enqueue` e carrier nel metadata della queue fake;
5. wrapper worker con consumer span `worker.process`;
6. stesso `traceId`/`requestId`, `spanId` distinti e parent chain esatta;
7. due flussi simultanei con insiemi completamente disgiunti.

Eseguire:

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/api --filter=@dnd-ai/worker --filter=@dnd-ai/observability
node --test tests/integration/observability-flow.test.mjs
```

Atteso: `FAIL` per plugin/wrapper mancanti.

### Passo 2: implementare plugin e wrapper minimi

Il plugin Fastify usa hook lifecycle e una `WeakMap` request→operation, imposta `x-request-id`, termina lo span una sola volta e cattura terminal failure senza body/header raw. Il wrapper worker accetta un envelope fake `{ observability, payload }`, estrae il carrier prima del processor e non introduce BullMQ.

I composition root accettano factory iniettabili per i test, inizializzano telemetry dopo config valida e prima di listener/processor, e tentano shutdown bounded su close/failure.

### Passo 3: verificare E2E, startup e concorrenza

```powershell
corepack pnpm@11.13.0 exec turbo run build --filter=@dnd-ai/api --filter=@dnd-ai/worker --filter=@dnd-ai/observability
node --test tests/integration/observability-flow.test.mjs tests/integration/runtime-startup.test.mjs
```

Atteso: `PASS`; nessun context bleed o regressione startup.

## Task 6 — Integrare Next/Sentry error-only e provare il bundle boundary

**File:**

- Creare: `apps/web/lib/server-observability.ts`
- Creare: `apps/web/lib/sentry-options.ts`
- Creare: `packages/observability/src/sentry-options.ts`
- Creare: `apps/web/instrumentation.ts`
- Creare: `apps/web/instrumentation-client.ts`
- Creare: `apps/web/sentry.server.config.ts`
- Creare: `apps/web/sentry.edge.config.ts`
- Modificare: `tests/contracts/observability-contract.test.mjs`
- Modificare: `tests/security/observability-security.test.mjs`

### Passo 1: estendere i test in rosso

Il contract test deve verificare:

- client entry importa soltanto root browser-safe e `@sentry/nextjs`;
- Node/Pino/Async Hooks/`@sentry/node` sono raggiungibili soltanto da `./node` e file server;
- server/edge/client usano `sendDefaultPii: false`, `tracesSampleRate: 0`, nessun Replay/log forwarding/source-map token;
- `instrumentation.ts` carica config per runtime senza creare route o mutare `next.config.ts` per upload;
- `beforeSend` usa il sanitizer condiviso;
- DSN assente evita init e il test con fake transport non apre rete.

Eseguire:

```powershell
node --test tests/contracts/observability-contract.test.mjs tests/security/observability-security.test.mjs
```

Atteso: nuovi assert `FAIL`.

### Passo 2: implementare il wiring Next minimo

Inizializzare il tracer server web una volta nel runtime Node; edge e browser usano soltanto Sentry error-only. Non aggiungere `withSentryConfig`, `SENTRY_AUTH_TOKEN`, upload source map, Replay o UI di errore. Il codice deve restare no-op con `NEXT_PUBLIC_SENTRY_DSN` vuota.

### Passo 3: verificare build e bundle

```powershell
corepack pnpm@11.13.0 --filter @dnd-ai/web typecheck
corepack pnpm@11.13.0 --filter @dnd-ai/web build
node --test tests/contracts/observability-contract.test.mjs tests/security/observability-security.test.mjs
```

Atteso: `PASS`; ricerca negli artifact client senza `node:async_hooks`, `pino` o `@sentry/node`.

## Task 7 — Chiudere failure path e gate mirati

**File:**

- Modificare: `tests/unit/observability-node.test.mjs`
- Modificare: `tests/integration/observability-flow.test.mjs`
- Modificare: `tests/security/observability-security.test.mjs`
- Modificare: `tests/contracts/observability-contract.test.mjs`

### Passo 1: aggiungere regressioni rosse

Copertura obbligatoria:

- W3C carrier invalido crea nuova trace e warning senza valore riflesso;
- request ID non canonico viene rigenerato;
- exporter, reporter e destination che falliscono non cambiano HTTP result o job result;
- duplicate end/flush/init non duplica span o error report;
- init incompatibile fallisce prima di listener/initializer;
- stack, DSN, auth, cookie, prompt e output AI canary sono assenti da log/eventi;
- nessuna rete e nessun timer/sleep non bounded.

### Passo 2: implementare soltanto i contenimenti necessari

Non introdurre retry automatici. Correggere il confine che lascia propagare l'errore; mantenere telemetry best-effort e business path deterministico.

### Passo 3: eseguire il gate mirato del batch

```powershell
corepack pnpm@11.13.0 test:unit
corepack pnpm@11.13.0 test:integration
corepack pnpm@11.13.0 test:contract
corepack pnpm@11.13.0 test:security
corepack pnpm@11.13.0 verify:affected
```

Atteso: tutti `PASS`; non eseguire ancora il full gate.

## Task 8 — Allineare ADR, living docs e stato candidato

**File:**

- Creare: `docs/adr/0007-observability-context-and-error-reporting.md`
- Modificare: `docs/superpowers/specs/2026-07-15-bl-008-observability-baseline-design.md`
- Modificare: `docs/superpowers/plans/2026-07-15-bl-008-observability-baseline.md`
- Modificare: `docs/architecture/SYSTEM_OVERVIEW.md`
- Modificare: `docs/operations/CONFIGURATION.md`
- Modificare: `docs/operations/CI_CD.md`
- Modificare: `docs/TRACEABILITY.md`
- Modificare: `docs/README.md`
- Modificare: `docs/CHANGELOG.md`
- Modificare: `docs/CONTEXT.md`
- Modificare: `docs/TASKS.md`

### Passo 1: aggiornare la documentazione dal codice reale

L'ADR accepted registra OTel come unica autorità trace, Pino come logger, Sentry error-only, browser/Node export boundary, alternative e condizione di revisione. Config documenta owner, ambiente, opzionalità e redazione delle tre DSN. Overview descrive wiring realmente implementato; TRACEABILITY collega BL-008 ai quattro livelli di test.

Rimuovere i claim correnti `BL-008 READY/in review` dai soli documenti living; conservare come storico le evidenze datate. Portare design e piano ad `active`, e la card a `IN_REVIEW/90%/PASSING` soltanto dopo i gate mirati.

### Passo 2: verificare document policy e task graph

```powershell
corepack pnpm@11.13.0 verify:docs
```

Atteso: `PASS` con front matter datato 2026-07-15, link/path validi e nessun secret.

## Task 9 — Candidato finale, clean checkout e delivery protetta

**File:** tutti i file del change set; nessun file di sola evidenza post-CI.

### Passo 1: review indipendente del diff

Usare `superpowers:requesting-code-review`. Correggere finding P0/P1; i P2 non bloccanti diventano task separati. Rieseguire soltanto i test mirati dalle correzioni.

### Passo 2: eseguire l'unico full gate locale

```powershell
$env:TURBO_FORCE = "true"
corepack pnpm@11.13.0 verify
```

Atteso: exit `0` per format, lint, typecheck, build, unit, integration, database, contract, security, boundary, docs, CI/deploy policy, secret scan e artifact.

### Passo 3: chiudere lo snapshot e verificare da checkout pulito

Registrare in `TASKS`/`CONTEXT` il full gate appena osservato, portare `BL-008` alla proposta branch-local `DONE/100%/PASSING`, rieseguire `verify:docs` e creare il commit candidato funzionale. Poi usare `superpowers:using-git-worktrees` per un worktree detached temporaneo del commit:

```powershell
corepack pnpm@11.13.0 install --frozen-lockfile
$env:TURBO_FORCE = "true"
corepack pnpm@11.13.0 verify
```

Atteso: exit `0`; nessun file generato o diff nel checkout pulito. Se il checkout pulito fallisce, correggere il candidato e ripetere soltanto questo gate; non dichiarare `DONE`. Rimuovere il worktree con il workflow sicuro dopo la verifica.

### Passo 4: chiudere stato e aprire una sola PR

Dopo full e clean verify, push della branch, una PR verso `main`, attesa di `CI / Merge gate` e merge senza bypass. La CI/PR è evidenza esterna derivata e non genera un commit post-run di sola evidenza. Non toccare progetto, deployment o impostazioni Vercel.
