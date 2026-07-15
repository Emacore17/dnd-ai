---
status: accepted
owner: engineering-and-security
last_reviewed: 2026-07-15
last_verified_commit: 3d278655bf3ccec5d7dd3b142aea209cab307dca
source_refs:
  - docs/MVP_SPEC.md#24-osservabilita
  - docs/MVP_SPEC.md#291-topologia-mvp
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
  - docs/superpowers/specs/2026-07-15-bl-008-observability-baseline-design.md
  - docs/adr/0002-monorepo-package-boundaries.md
  - docs/adr/0004-runtime-configuration-and-secret-injection.md
related_tasks:
  - BL-008
  - BL-010
  - BL-066
code_refs:
  - packages/observability/src/index.ts
  - packages/observability/src/node.ts
  - packages/observability/src/tracing.ts
  - packages/observability/src/logger.ts
  - packages/observability/src/redaction.ts
  - packages/observability/src/sentry-options.ts
  - packages/observability/src/sentry.ts
  - apps/api/src/observability.ts
  - apps/worker/src/observability.ts
  - apps/web/instrumentation.ts
  - apps/web/instrumentation-client.ts
test_refs:
  - tests/unit/observability-core.test.mjs
  - tests/unit/observability-node.test.mjs
  - tests/integration/observability-flow.test.mjs
  - tests/contracts/observability-contract.test.mjs
  - tests/security/observability-security.test.mjs
supersedes: null
---

# ADR-0007 — Contesto osservabile ed error reporting

## Stato

Accepted il 2026-07-15 durante `BL-008`.

## Contesto

Web, API e worker devono propagare una correlazione coerente senza trasformare trace e request ID in credenziali. La baseline deve inoltre evitare leakage di PII, secret, prompt e output AI, preservare il percorso applicativo quando la telemetry fallisce e impedire che dipendenze Node entrino nel bundle browser.

Non esistono ancora un backend OTLP, un account/progetto Sentry approvato o un ambiente staging. La decisione deve quindi essere verificabile senza rete e non deve introdurre risorse provider, token, source map upload o un secondo sistema di tracing.

## Decisione

1. OpenTelemetry è l'unica autorità del trace context. `@dnd-ai/observability/node` usa provider trace espliciti, `AsyncLocalStorageContextManager` e W3C Trace Context; non abilita auto-instrumentation, `baggage` o un SDK metrics.
2. `@dnd-ai/observability` espone soltanto contratti e sanitizzazione platform-neutral. Tracing Node, Pino e Sentry Node sono raggiungibili esclusivamente dal subpath `/node`; i composition root di web, API e worker possiedono l'inizializzazione.
3. Il primo confine server posseduto genera un `requestId` UUID v4 canonico. Carrier W3C o request ID invalidi vengono sostituiti e producono soltanto gli eventi sicuri `trace_context.rejected` o `request_id.rejected`; il valore ricevuto non viene riflesso e non concede autorizzazione.
4. Pino è il logger JSON server-side. Il vocabolario è allowlisted e il sanitizer bounded elimina o redige credenziali, PII, header/body raw, prompt, narrazione, output AI e messaggi di errore non affidabili prima della serializzazione.
5. Sentry è un adapter error-only opzionale, non un'autorità trace. Node imposta `skipOpenTelemetrySetup: true`; ogni runtime usa `sendDefaultPii: false`, `tracesSampleRate: 0` e nessun Replay, profiling, log forwarding, tunnel o source-map upload.
6. `API_SENTRY_DSN` e `WORKER_SENTRY_DSN` sono config server service-scoped: se presenti ma malformate bloccano lo startup prima di listener o processor, senza riflettere il valore. `NEXT_PUBLIC_SENTRY_DSN` è un identificatore pubblico opzionale: se assente o malformato il web non inizializza Sentry e continua a servire UI e richieste.
7. Il web carica gli adapter Sentry server, edge e browser in modo lazy soltanto dopo una DSN valida. Il tracer server Node viene inizializzato indipendentemente; il browser non avvia un provider OTel completo.
8. Telemetry ed error reporting sono best-effort: exporter, transport e destination non possono cambiare la risposta HTTP o l'esito del job. `end`, init e shutdown sono idempotenti; flush e shutdown sono bounded e non introducono retry automatici.
9. I test usano exporter e transport in-memory/fake. Nessun account Sentry, exporter OTLP, secret, workflow, deployment o configurazione Vercel appartiene a `BL-008`.

## Alternative considerate

### Sentry come autorità tracing

Rifiutata: duplicherebbe provider e context manager e renderebbe ambiguo il parentage fra web, API e worker.

### Auto-instrumentation OpenTelemetry completa

Rifiutata per la baseline: aggiungerebbe loader globali e dipendenze non necessarie prima che esistano workload e backend telemetry reali.

### Logger JSON e propagazione custom

Rifiutati: reimplementerebbero W3C Trace Context, lifecycle e redazione senza usare primitive mantenute e testabili.

### Provisioning Sentry o OTLP durante BL-008

Rinviato: mancano provider/account approvati e staging; introdurrebbe costi, secret e side effect esterni senza essere necessario per provare il contratto locale.

## Conseguenze e revisione

La baseline produce correlazione locale deterministica e log/errori redatti anche senza backend remoto. Il caricamento lazy del client Sentry evita di includere il relativo chunk nell'entry iniziale quando la DSN manca, con il trade-off accettato di una breve finestra asincrona per gli errori di hydration più precoci.

Rivedere questa decisione quando esisteranno staging e un backend OTLP/Sentry approvati, oppure quando `BL-066` introdurrà la trace normativa `turn.process` e metriche di fase. Ogni revisione deve conservare OTel come autorità unica o sostituirla tramite ADR, provare isolamento concorrente e redazione, e definire budget, retention, regione e data processing prima di abilitare traffico remoto.
