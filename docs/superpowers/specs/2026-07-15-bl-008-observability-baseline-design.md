---
status: draft
owner: engineering-and-security
last_reviewed: 2026-07-15
last_verified_commit: 99a4f3f5441fd5a64657d2ad54fd7342e3fefef2
source_refs:
  - docs/MVP_SPEC.md#24-osservabilita
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

# BL-008 — Design della baseline OTel, log e Sentry

## Stato e decisione

Il Product Owner ha approvato il design il 2026-07-15. Il documento resta `draft` fino alla review del testo versionato richiesta prima del piano di implementazione.

La baseline adotta un kernel condiviso e provider-agnostic in `@dnd-ai/observability`, OpenTelemetry come unica autorità del tracing, Pino per i log strutturati server-side e Sentry come adapter error-only opzionale. In assenza di DSN o exporter esterno il sistema resta operativo, non effettua chiamate di rete e mantiene comunque propagazione e test deterministici.

## Obiettivi

La slice deve:

1. propagare un `requestId` e un contesto W3C Trace Context dal web all’API e dall’API a un worker fake;
2. produrre span con un solo `traceId`, parent chain verificabile e `spanId` distinti;
3. produrre log JSON con il vocabolario sicuro definito dalla specifica;
4. redigere PII, credenziali, prompt e contenuto AI prima della serializzazione;
5. catturare errori tramite un adapter Sentry reale ma disattivato quando manca la DSN;
6. impedire che errori di telemetry cambino l’esito di richieste, job o futuri comandi di gioco;
7. mantenere separati bundle browser e dipendenze Node;
8. soddisfare i test di accettazione senza rete, provider o account reali.

Il contratto implementativo prende il nome `observability-baseline-v1`.

## Approcci valutati

### Kernel condiviso con adapter opzionali — scelto

Il package condiviso possiede contratti, propagazione, redazione e factory Node. Le app possiedono il wiring del proprio runtime. Exporter e client Sentry sono iniettati; fake e exporter in-memory coprono i test.

Questo approccio conserva i package boundary, rende espliciti gli effetti e consente di aggiungere un backend OTLP senza modificare dominio, Rules Engine o contratti di gioco.

### Auto-instrumentation completa — rifiutato per la baseline

Il metapackage OTel automatico e il wizard Sentry ridurrebbero il wiring iniziale, ma introdurrebbero più dipendenze, loader globali e instrumentazioni non richieste nello scaffold corrente. La sovrapposizione fra tracing Sentry e provider OTel renderebbe inoltre meno chiara l’autorità del contesto.

### ID e logger custom senza SDK — rifiutato

Una soluzione basata soltanto su `crypto.randomUUID()` e JSON manuale sarebbe piccola, ma reimplementerebbe W3C Trace Context e non fornirebbe una baseline OTel/Sentry reale.

## Confini e componenti

### Package condiviso

`packages/observability` resta senza dipendenze da altri workspace e pubblica due superfici:

- `@dnd-ai/observability`: tipi, carrier, sanitizzazione ed error-reporting port compatibili con server e browser;
- `@dnd-ai/observability/node`: context manager Node, tracer provider, logger Pino e adapter Sentry Node.

I moduli previsti nel package, marcati `planned` fino all’implementazione, hanno responsabilità singole:

- `src/trace-context.ts`: validazione del `requestId`, estrazione/iniezione W3C e accesso al contesto corrente;
- `src/tracing.ts`: lifecycle del tracer provider e wrapper per operazioni osservate;
- `src/redaction.ts`: sanitizzazione ricorsiva e bounded dei valori non affidabili;
- `src/logger.ts`: eventi JSON tipizzati e correlazione automatica;
- `src/error-reporting.ts`: porta `ErrorReporter`, no-op e contesto sicuro;
- `src/sentry.ts`: configurazione error-only e filtro finale degli eventi;
- `src/node.ts`: export Node espliciti;
- `src/index.ts`: export platform-neutral.

La parte Next-specific resta in `apps/web`; `@dnd-ai/observability` non importa Next.js. API e worker importano la superficie Node. Dominio, Rules Engine, AI e persistence non dipendono dall’osservabilità.

### Runtime web

Il web crea la root span per le operazioni server-side dirette all’API e inietta il carrier nelle richieste interne. L’inizializzazione Sentry client/server usa `@sentry/nextjs` in modalità error-only:

- `tracesSampleRate` pari a `0`;
- Replay e log forwarding non configurati;
- `sendDefaultPii` pari a `false`;
- nessun source-map upload o token di release in questa slice;
- assenza di DSN uguale a SDK disabilitato.

Il browser non avvia un provider OTel completo. Gli errori JS, hydration e navigation appartengono a Sentry; la trace applicativa nasce nel server web/BFF.

### Runtime API

Un plugin Fastify, pianificato in `apps/api`, avvolge gli handler registrati, estrae il carrier, crea la server span, imposta `x-request-id` nella risposta e registra lifecycle/error event senza payload applicativi. Il plugin non autorizza richieste e non usa il trace context come identità.

### Runtime worker

Un wrapper pianificato in `apps/worker` riceve il metadata del job, estrae il carrier e crea una consumer span prima di invocare il processor. BullMQ e il contratto di job reale restano fuori scope; il test usa un envelope fake che contiene soltanto metadata di osservabilità e payload sintetico non sensibile.

## Contratti logici

Le forme seguenti descrivono il contratto, non un DTO pubblico di gioco:

```ts
type ObservabilityService = "web" | "api" | "worker";

interface TraceCarrier {
  readonly requestId: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
}

interface ObservabilityContext {
  readonly service: ObservabilityService;
  readonly environment: "local" | "staging" | "production";
  readonly requestId: string;
  readonly traceId: string;
  readonly spanId: string;
}

interface SafeLogEvent {
  readonly event: string;
  readonly durationMs?: number;
  readonly errorCode?: string;
  readonly turnId?: string;
  readonly campaignHash?: string;
}

interface SafeErrorMetadata {
  readonly event: string;
  readonly errorCode: string;
}

interface ErrorReporter {
  capture(
    error: unknown,
    context: ObservabilityContext,
    metadata: SafeErrorMetadata,
  ): void;
  flush(timeoutMs: number): Promise<boolean>;
}
```

`requestId` è un UUID v4 canonico lowercase generato dal primo confine server posseduto. I confini downstream conservano soltanto un UUID v4 canonico; un valore assente, non canonico o invalido viene sostituito con un nuovo UUID senza riflettere il valore ricevuto. Il valore non concede privilegi e non sostituisce actor context, sessione o idempotency key.

`traceparent` e `tracestate` vengono validati dal propagator OpenTelemetry. Il sistema non accetta né propaga `baggage` nella baseline.

## Flusso end-to-end

1. Il server web genera `requestId` e root span `web.request`.
2. Il client interno web→API inietta `traceparent`, `tracestate` se valida e `x-request-id`.
3. Fastify estrae il contesto e crea `api.request` come span figlia.
4. L’API inietta il contesto attivo nel metadata della queue fake e crea `queue.enqueue`.
5. Il worker estrae il metadata e crea `worker.process` come consumer span.
6. Log ed error report leggono `requestId`, `traceId` e `spanId` dal contesto attivo; i chiamanti non li ricopiano manualmente.

Il test di accettazione verifica stessa trace, parent chain e continuità del `requestId`. Due flussi simultanei devono produrre insiemi disgiunti, provando l’isolamento di `AsyncLocalStorage`.

I nomi `web.request`, `api.request` e `worker.process` appartengono allo smoke della fondazione e non dichiarano implementata la trace di un turno. Quando esisterà il Turn Orchestrator, i task proprietari del loop introdurranno la root normativa `turn.process` e gli span di fase elencati in `docs/MVP_SPEC.md` §24.1 usando questo stesso contratto di propagazione.

## Trust boundary e failure path

Trace e request ID sono metadata non affidabili, non credenziali. Carrier malformati non causano `4xx` o `5xx`: un W3C context invalido produce una nuova trace, mentre un request ID invalido produce un nuovo UUID; il confine registra soltanto `trace_context.rejected` o `request_id.rejected`, senza conservare il valore ricevuto.

Il lifecycle segue queste regole:

- una sola inizializzazione del provider e del context manager per processo;
- inizializzazioni ripetute con la stessa configurazione sono idempotenti;
- una seconda inizializzazione incompatibile fallisce prima di aprire listener o avviare processor;
- exporter e Sentry non possono propagare eccezioni al percorso applicativo;
- `flush(timeoutMs)` è bounded e restituisce esito, senza sleep arbitrari;
- shutdown incompleto produce un evento locale redatto, non un retry del comando di gioco;
- nessun fallback invia dati a un provider alternativo.

In assenza di exporter, il tracer provider continua a generare contesti validi ma non invia span. Il backend OTLP sarà fornito tramite adapter/iniezione quando esisterà un ambiente e un provider approvati.

## Log strutturati e redazione

I log server-side sono JSON e includono soltanto:

- `timestamp`, `level`, `service`, `environment`, `event`;
- `requestId`, `traceId`, `spanId` quando disponibili;
- `turnId`, `campaignHash`, `durationMs`, `errorCode` quando pertinenti.

Il messaggio Pino coincide con il codice evento; non accetta testo utente libero. La sanitizzazione avviene prima della serializzazione e Pino applica una seconda redaction per path sensibili.

Sono sempre eliminati o sostituiti con `[REDACTED]`:

- authorization, cookie, set-cookie, password, token, API key e DSN;
- email e URL contenenti userinfo;
- request/response body non allowlisted;
- prompt, narration, output AI, tool raw payload e chain-of-thought;
- oggetti `user`, header completi e campi extra non riconosciuti.

La sanitizzazione è case-insensitive, gestisce strutture annidate, array, riferimenti ciclici e limiti di profondità/dimensione. Gli errori nei log espongono soltanto `errorCode`, nome della classe allowlisted e frame server-side normalizzati: la prima riga e il messaggio originale vengono eliminati. I log browser non contengono stack.

## Sentry error-only

Sentry è un adapter di error reporting, non il provider delle trace. La configurazione Node disabilita il setup OTel del SDK e il performance tracing; quella browser imposta sampling trace a zero. Gli eventi includono `environment`, release quando fornita dal runtime e i soli `requestId`/`traceId` come contesto diagnostico.

Il filtro finale:

- rimuove `user`, request body, header, cookie e URL sensibili;
- conserva tipo allowlisted e frame dello stack, sostituendo il valore dell’eccezione con `errorCode` e senza conservare il messaggio originale;
- elimina `extra` e `contexts` non allowlisted;
- conserva breadcrumb solo per codici fase/evento noti, senza testo libero;
- non include attachment, Replay, log o session content.

Una DSN assente produce `NoopErrorReporter`. Una DSN presente ma malformata fallisce nella configurazione del composition root senza riflettere il valore. I test usano un transport in-memory/fake e impediscono qualunque rete.

## Configurazione

Le nuove chiavi applicative sono opzionali perché non esiste ancora un account Sentry:

- `API_SENTRY_DSN` per API;
- `WORKER_SENTRY_DSN` per worker;
- `NEXT_PUBLIC_SENTRY_DSN` per client e server web, classificata come identificatore pubblico ma comunque redatta da log ed errori.

Non vengono introdotti `SENTRY_AUTH_TOKEN`, organization/project slug, endpoint OTLP o header exporter. La configurazione del backend telemetry verrà aggiunta soltanto insieme al relativo consumer remoto e alla separazione per ambiente.

## Dipendenze e bundle boundary

L’implementazione usa dipendenze exact-pinned e aggiorna il lockfile nello stesso change set. Sono ammesse soltanto:

- API, propagator, context manager e trace SDK OpenTelemetry minimi;
- Pino per il logging Node;
- `@sentry/node` per API/worker;
- `@sentry/nextjs` per il web.

I metapackage auto-instrumentation, Replay, profiling e un secondo logger sono esclusi. Gli export conditional/subpath e il build Next devono provare che Pino, Async Hooks e Sentry Node non entrano nel bundle client.

Poiché cambiano dependency graph, config e privacy boundary, `BL-008` usa la corsia `HIGH_RISK` e richiede install frozen/clean-checkout verification sul candidato.

## Strategia di test

### Unit

- request ID UUID v4 canonico, assente, non canonico e sintatticamente invalido;
- inject/extract W3C e carrier invalido;
- redazione di chiavi case-insensitive, valori annidati, array, cicli e stringhe sensibili;
- logger con schema allowlisted e contesto automatico;
- no-op reporter, DSN invalida e filtro Sentry.

### Integration

- exporter OTel in-memory;
- web helper → Fastify via `app.inject()` → queue fake → worker wrapper;
- unico `traceId`, parent chain attesa, `spanId` distinti e stesso `requestId`;
- risposta API con `x-request-id`;
- due flussi concorrenti senza context bleed;
- exporter/Sentry failure senza modifica della risposta o duplicazione del job fake.

### Security e contract

- fixture sintetica con email, cookie, authorization, password, DSN, prompt e output raw assente da log ed evento Sentry;
- carrier invalido non riflesso;
- nessuna rete durante i test;
- export Node/browser, manifest, dependency direction e config runtime verificati;
- build web senza dipendenze Node nel client artifact.

I test vengono scritti e osservati rossi prima del codice corrispondente. Sul candidato finale si esegue un solo full `verify`, seguito da install/verify in checkout pulito e una review indipendente; la CI della PR resta il merge gate remoto.

## Documentazione e tracciabilità

L’implementazione aggiornerà:

- `docs/TASKS.md`, `docs/CONTEXT.md` e `docs/TRACEABILITY.md`;
- `docs/architecture/SYSTEM_OVERVIEW.md`;
- `docs/operations/CONFIGURATION.md`;
- un ADR accepted dedicato alla baseline osservabilità;
- `docs/README.md` e `docs/CHANGELOG.md` per il nuovo documento/contratto.

`docs/MVP_SPEC.md` non cambia: il design implementa decisioni già normative.

## Fuori scope

- creazione di account/progetti Sentry o accettazione di termini esterni;
- configurazione Vercel, deploy, Drains o upgrade dal piano Hobby;
- OTLP collector/backend remoto e relativi secret;
- source-map upload, release automation, dashboard e alert;
- catalogo completo delle metriche;
- BullMQ reale e span specifici del turn orchestrator;
- modifiche UX/UI o alla shell di gioco.

## Condizioni di successo

`BL-008` può essere proposto `DONE/100%/PASSING` soltanto quando:

1. il trace fake web→API→worker e la concorrenza passano;
2. log e Sentry non contengono alcun valore sensibile della fixture;
3. config assente/invalida segue i failure path descritti;
4. lint, typecheck, build, unit, integration, contract e security applicabili passano;
5. dependency e bundle boundary sono verdi;
6. documentazione e tracciabilità rappresentano il codice;
7. full gate, clean checkout e review indipendente sono completati;
8. una sola PR supera `CI / Merge gate` senza azioni Vercel.
