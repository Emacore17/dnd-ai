---
status: proposed
owner: engineering-and-operations
last_reviewed: 2026-07-14
last_verified_commit: aa9342daa63a93c6b8ff4d00963ed2ac6a6a9c9d
source_refs:
  - docs/MVP_SPEC.md#293-ambienti
  - docs/MVP_SPEC.md#294-cicd
  - docs/MVP_SPEC.md#30-roadmap
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
related_tasks:
  - BL-003
  - BL-079
  - BL-080
  - BL-070
code_refs:
  - .vercelignore
  - apps/web/package.json
  - apps/web/vercel.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - apps/web/app/health/route.ts
  - infra/deployment/vercel-staging.json
  - .github/workflows/deployment-smoke.yml
  - .github/workflows/ci.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/assert-vercel-preview-bootstrap-enabled.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-smoke.mjs
  - turbo.json
test_refs:
  - tests/unit/deployment-smoke.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-preview-bootstrap-policy.test.mjs
  - tests/security/vercel-preview-bootstrap-gate.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
supersedes: null
---

# ADR-0005 — Preview e staging web su Vercel

## Stato

Proposed il 2026-07-14 durante `BL-080`. Il Product Owner ha autorizzato esclusivamente il piano Hobby per uso personale/non commerciale e l'identità Vercel indicata; l'identità è stata verificata in modo redatto e non viene versionata. Il Product Owner ha inoltre accettato esplicitamente il rischio residuo dell'installazione GitHub App condivisa, che non deve essere ristretta. La strategia di attivazione Git è sospesa: PR #12 ha prodotto un deployment Production da `main` nonostante Production Branch=`release/production`; il successivo CLI `--target=preview` ha prodotto un secondo record Production. Entrambi sono stati rimossi. La PR #16 ha integrato l'interlock nel merge `aa9342daa63a93c6b8ff4d00963ed2ac6a6a9c9d`; CI PR `29343319207` e post-merge `29343526054` sono 5/5 verdi, senza deployment Vercel. L'audit del tag CLI `55.0.0`, risolto al commit immutabile `11f0cebacce81dfb713b3cb2d4622e49da0fb475`, dimostra che il parser e `CreateOptions` conservano `preview`, ma `@vercel/client 17.6.4` imposta il target a `undefined` prima di serializzare la POST. Questo è coerente con la regola Vercel documentata sul primo deployment e con l'issue aperta `vercel/vercel#17069`; tuttavia la documentazione REST corrente dichiara Preview come default e nessun maintainer ha ancora confermato la causa server, la precedenza, un fix o un workaround. `BL-080` è quindi `BLOCKED/50%/PARTIAL`; l'ADR non può diventare `accepted` finché un percorso first-deployment Preview-only supportato non supera smoke/failure/redeploy.

## Contesto

Il solo runtime oggi deployabile è `apps/web`: Next.js produce un server standalone, mentre API e worker non hanno ancora container, daemon e dipendenze gestite. Il web non consuma variabili applicative o secret. Anticipare database, Redis o credenziali fittizie allargherebbe lo scope e contraddirebbe ADR-0004.

MVP e ADR-0003 vietano credenziali cloud persistenti nei workflow PR. Vercel supporta il monorepo tramite Root Directory e invia eventi `repository_dispatch` tramite la Git Integration. La documentazione CLI/REST descrive Preview come default senza target Production, ma il codice client omette intenzionalmente l'esplicito `preview` e la piattaforma ha storicamente documentato la promozione automatica del primo deployment: la precedenza fra le due regole non è chiarita dalla documentazione corrente. L'autorizzazione copre soltanto il piano Hobby personale/non commerciale: upgrade, acquisti, uso commerciale o nuove condizioni richiedono una nuova decisione esplicita.

## Decisione proposta

1. Vercel ospita soltanto `apps/web`; `apps/api` e `apps/worker` restano `planned` finché i task proprietari non forniscono packaging operativo.
2. Il progetto desiderato è `dnd-ai-web`, Root Directory `apps/web`, framework Next.js e singola regione compute `fra1`. Asset e CDN restano globali: questa scelta non equivale a data residency UE e non chiude `OD-08` per dati e telemetry.
3. Il deploy automatico finale usa la Vercel GitHub App con Fork Protection, non un `VERCEL_TOKEN` in Actions. La foundation resta in `main` con `git.deploymentEnabled=false` e `source.autoDeploy=false`. La precedente seconda fase con `{"**": false, "main": true, "release/production": false}` è controprovata dall'incidente PR #12: ha consentito il deploy atteso, ma il provider lo ha classificato Production. Non può essere riapplicata finché Preview, smoke e failure path non sono dimostrati.
4. La build provider deve attraversare `node scripts/assert-vercel-preview-build.mjs && pnpm run build`, imposto dal `buildCommand` di `apps/web/vercel.json`. Il primo guard strict accetta soltanto la tripla esatta `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`; il build locale ordinario è ammesso solo quando tutti e tre i metadata sono assenti. Metadata incompleti, incoerenti o non Preview falliscono con output statico redatto, e i tre valori partecipano alla chiave cache Turbo. Questo controllo non sceglie il target e non impedisce al provider di creare inizialmente un record deployment: blocca soltanto il completamento della build.
5. Il payload CLI parte sempre dalla root del monorepo. La sola policy di esclusione Vercel è la denylist root `.vercelignore`; un override `apps/web/.vercelignore` è vietato perché renderebbe ambiguo il confine delle sorgenti. Il dry-run Vercel `55.0.0` usa `deploy . --project dnd-ai-web --scope emacore17s-projects --target=preview --dry --format=json --yes` e il JSON deve superare `scripts/check-vercel-deploy-dry-run.mjs`. Il checker richiede root esatta, framework `nextjs`, input indispensabili come file regolari con hash valido, soli mode file/directory zero-byte supportati, massimo 15.000 entry, massimo 10 MiB complessivi, massimo 5 MiB per file e nessun discendente cache, generato, privato o non relativo. Il dry-run non carica sorgenti e non crea un deployment.
6. Il secondo incidente controprova anche la diagnostica CLI one-shot: `--target=preview` viene conservato dal parser ma rimosso da `@vercel/client` prima della POST, quindi non trasmette al provider l'intento Preview esplicito; il provider ha restituito Production e la causa server resta non confermata. Il desired state mantiene `source.manualDeployment.enabled=false` e `deploy:bootstrap:check` fallisce chiuso. Questo è un interlock procedurale del percorso approvato, non un enforcement Vercel contro un owner. Un'eventuale riapertura richiede una PR separata con fix/workaround Preview-only supportato dal provider, procedura di cattura/contenimento testata e nuovo runbook. Restano vietati `--cwd apps/web`, `--prebuilt`, archivi, `--prod`, `promote`, `redeploy`, `--skip-domain`, custom target e override manuali `VERCEL*`.
7. L'installation ID `41079282` resta intenzionalmente condivisa (`isAccessRestricted=false`, 8 repository). Restringerla non è un gate di `BL-080`: il Product Owner lo ha vietato perché interromperebbe l'accesso necessario ad altri progetti. Il rischio di una superficie installation-wide più ampia è accettato e compensato a livello progetto da link esatti, Trusted Source OIDC exact-match, Fork e Standard Protection, environment GitHub `staging` limitato a `main`, smoke fail-closed e readback di drift. La policy Git è deny-all (`git.deploymentEnabled=false`); nessun branch è abilitato. L'eccezione va riesaminata se diventa possibile dedicare o restringere l'installazione senza perdita di accesso.
8. GitHub possiede un environment `staging`, senza secret, con deployment branch policy limitata a `main`. Il workflow non esegue il commit deployato: checkout di `main` e verifier Node versionato restano trusted. I soli permessi sono `contents: read` e `id-token: write`; una sequenza chiusa di action pin produce un token OIDC breve e lo passa unicamente al verifier.
9. La Preview mantiene Vercel Standard Protection. Il progetto espone la policy predefinita SSO `all_except_custom_domains`, riletta a livello project prima del merge. Trusted Sources accetta GitHub Actions soltanto con issuer `https://token.actions.githubusercontent.com`, audience `https://github.com/Emacore17`, claim repository + repository ID immutabile/ref/environment esatti e target `preview`; la configurazione è stata riletta e nessun bypass secret persistente è stato creato. La copertura e l'accesso OIDC dell'origin branch esatta vengono provati dallo smoke soltanto dopo che una prima Preview valida materializza l'alias.
10. Vercel invia l'action `vercel.deployment.ready` per una Preview costruita ma non promossa, con `client_payload.state.type=success`. Lo smoke lega il dispatch all'installation ID della GitHub App e ignora l'URL non affidabile dell'evento: il token viene inviato soltanto all'origin branch esatta `<project>-git-main-<scope>.vercel.app` registrata nel manifest. Project ID, deployment ID, SHA, ref, repository, environment e regione vengono poi confrontati con `/health`; redirect, body oltre 8 KiB e output inatteso falliscono con report redatto.
11. Vercel Environment Variables è il confine scelto per future config server-only, ma la superficie web corrente contiene zero variabili e zero secret, confermati anche dal provider. Le system environment variables e l'emissione OIDC del progetto sono abilitate; non sono config applicativa e non dimostrano che Trusted Sources sia configurata. `VERCEL`, `VERCEL_ENV` e `VERCEL_TARGET_ENV` sono metadata provider usati soltanto dal guard build; nessuna chiave `NEXT_PUBLIC_*` viene inventata.
12. Redeploy e rollback staging restano criteri futuri: non sono eseguibili finché non esiste una Preview valida e il gate manuale non viene riaperto tramite decisione verificata. Instant Rollback non viene dichiarato, perché è legato a deployment/domain Production.

## Alternative considerate

### Vercel CLI in GitHub Actions con access token

Rifiutata: richiederebbe un secret cloud persistente nel workflow e amplierebbe il trust boundary del codice PR. L'integrazione Git nativa resta il percorso automatico finale; Trusted Sources usa invece OIDC breve esclusivamente per leggere una futura Preview protetta. Anche la diagnostica CLI locale one-shot è ora ritirata dopo il secondo target mismatch.

### GitHub Pages

Rinviata: richiederebbe un export statico e una configurazione `basePath` specifica, eliminando il Route Handler server-side usato dal health contract e limitando l'evoluzione Next/BFF. Resta un fallback se Vercel non viene autorizzato.

### Vercel Custom Environments

Non autorizzata per M0 perché richiede un piano superiore. Il default Preview resta l'opzione proposta compatibile con Hobby, ma il client CLI non trasmette l'esplicito target e il provider non offre ancora un workaround first-deployment verificato; nessun acquisto o upgrade è consentito.

### Installazione GitHub App repository-only

Non applicata nel checkpoint corrente. L'installation `41079282` è condivisa da altri progetti Vercel e restringerla al solo `Emacore17/dnd-ai` ne interromperebbe l'accesso. Il Product Owner ha scelto di mantenere il grant ampio e accettare il rischio residuo; i controlli project-level definiti sopra restano obbligatori e qualsiasi drift del link, dei claim, delle protezioni o del numero di repository richiede una nuova verifica.

## Conseguenze e gate di accettazione

Il repository acquisisce una configurazione provider minimale, un desired state verificabile e uno smoke senza credenziali applicative o cloud persistenti. L'identità del deploy deriva da system metadata Vercel e non dall'artifact CI `build-artifact-v1`: la Git Integration ricostruisce lo stesso commit, quindi deployment ID + SHA + health contract costituiscono l'identità immutabile della delivery.

Al checkpoint del 2026-07-14 esistono il progetto `dnd-ai-web` e il collegamento al repository autorizzato, con Root Directory `apps/web`, Next.js, `fra1`, protezioni e Trusted Source exact-match. Production Branch Vercel continua a risultare `release/production`. PR #12/merge `c64d095` ha creato `dpl_Cag…` con `target=production`; GitHub Deployment API lo registra `Production/success` prima della rimozione. Dopo PR #13/#14/#15, il successivo CLI `--target=preview` ha creato `dpl_4yG…` con `target=production`, osservato `ERROR` e rimosso per ID esatto. PR #16/merge `aa9342d` ha poi integrato il freeze con CI PR/post-merge 5/5 e zero nuovi deployment. Il readback project-scoped mostra zero deployment/alias. L'audit del sorgente Vercel `11f0cebacce81dfb713b3cb2d4622e49da0fb475` prova l'omissione client del target Preview; regola first-deployment e issue `#17069` rendono questa la spiegazione più forte, non ancora una conferma di maintainer. Binding `null`, `autoDeploy=false`, `manualDeployment.enabled=false`, config Git disabilitata e gate non-linked restano vigenti. L'installation condivisa resta un rischio accettato, non una causa dell'incidente.

Prima dell'acceptance occorrono ancora: ottenere un fix/workaround first-deployment Preview-only supportato dal provider senza acquisti, cambio account o Production; riaprire il percorso con PR separata e containment testato; ottenere una Preview e smoke; provare un deploy Preview fallito e redeploy senza Production; infine dimostrare il percorso automatico Git con target Preview. Production Branch, policy Git, guard e selector CLI hanno funzionato come controlli di contenimento o intent, non come prevenzione sufficiente del target Production.

## Riferimenti provider verificati

- [Piano Hobby](https://vercel.com/docs/plans/hobby)
- [Git configuration e `git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration)
- [Git integration e Production Branch](https://vercel.com/docs/git)
- [CLI `deploy` e selector `--target`](https://vercel.com/docs/cli/deploy)
- [Create Deployment REST API e default `target`](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
- [Sorgente `@vercel/client 17.6.4`: Preview omesso prima della POST](https://github.com/vercel/vercel/blob/11f0cebacce81dfb713b3cb2d4622e49da0fb475/packages/client/src/deploy.ts#L36-L67)
- [Parser CLI `--target` al tag `vercel@55.0.0`](https://github.com/vercel/vercel/blob/11f0cebacce81dfb713b3cb2d4622e49da0fb475/packages/cli/src/util/parse-target.ts#L11-L35)
- [Regola Vercel del primo deployment](https://vercel.com/blog/default-production-domain)
- [Issue Vercel CLI `#17069`](https://github.com/vercel/vercel/issues/17069)
- [System environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Git namespaces e installation ID](https://vercel.com/docs/rest-api/integrations/list-git-namespaces-by-provider)
- [Repository accessibili dall'installazione](https://vercel.com/docs/rest-api/integrations/list-git-repositories-linked-to-namespace-by-provider)
- [Generated branch URLs](https://vercel.com/docs/deployments/generated-urls)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Trusted Sources OIDC](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
- [Repository dispatch: esempio `deployment.ready`](https://github.com/vercel/repository-dispatch/blob/main/examples/ci-example/.github/workflows/smoke.yaml) e [tipi dello state payload](https://github.com/vercel/repository-dispatch/blob/main/packages/repository-dispatch/src/types.ts)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/reference/security/oidc)
