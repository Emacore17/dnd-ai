---
status: proposed
owner: engineering-and-operations
last_reviewed: 2026-07-14
last_verified_commit: 1766406b9bd701a9880705b371fdc0b05a73abe1
source_refs:
  - docs/MVP_SPEC.md#293-ambienti
  - docs/MVP_SPEC.md#294-cicd
  - docs/MVP_SPEC.md#30-piano-di-implementazione-macro
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
related_tasks:
  - BL-003
  - BL-079
  - BL-080
  - BL-070
code_refs:
  - apps/web/vercel.json
  - apps/web/app/health/route.ts
  - infra/deployment/vercel-staging.json
  - .github/workflows/deployment-smoke.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/deployment-smoke.mjs
test_refs:
  - tests/unit/deployment-smoke.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
supersedes: null
---

# ADR-0005 — Preview e staging web su Vercel

## Stato

Proposed il 2026-07-14 durante `BL-080`. Il Product Owner ha autorizzato esclusivamente il piano Hobby per uso personale/non commerciale e l'identità Vercel indicata; l'identità è stata verificata in modo redatto e non viene versionata. Il progetto reale è stato creato e collegato al repository autorizzato senza produrre deployment. La decisione diventerà `accepted` soltanto dopo la chiusura dei binding e delle protezioni mancanti, il primo smoke remoto e le prove di failure/redeploy.

## Contesto

Il solo runtime oggi deployabile è `apps/web`: Next.js produce un server standalone, mentre API e worker non hanno ancora container, daemon e dipendenze gestite. Il web non consuma variabili applicative o secret. Anticipare database, Redis o credenziali fittizie allargherebbe lo scope e contraddirebbe ADR-0004.

MVP e ADR-0003 vietano credenziali cloud persistenti nei workflow PR. Vercel supporta il monorepo tramite Root Directory, crea Preview per i branch e invia eventi `repository_dispatch` tramite la Git Integration. L'autorizzazione corrente copre soltanto il piano Hobby personale/non commerciale: upgrade, acquisti, uso commerciale o nuove condizioni richiedono una nuova decisione esplicita.

## Decisione proposta

1. Vercel ospita soltanto `apps/web`; `apps/api` e `apps/worker` restano `planned` finché i task proprietari non forniscono packaging operativo.
2. Il progetto desiderato è `dnd-ai-web`, Root Directory `apps/web`, framework Next.js e singola regione compute `fra1`. Asset e CDN restano globali: questa scelta non equivale a data residency UE e non chiude `OD-08` per dati e telemetry.
3. Il deploy automatico usa la Vercel GitHub App con Fork Protection, non un `VERCEL_TOKEN` in Actions. L'attivazione è in due fasi: la foundation entra prima in `main` con `git.deploymentEnabled=false`; solo dopo il Git connect e la verifica della Production Branch `release/production`, un secondo change set registra project ID, scope slug, origin esatta del branch `main` e installation ID non sensibili e applica `{"**": false, "main": true, "release/production": false}`. Il glob ricorsivo `**` è obbligatorio per negare anche branch con `/`; `*` non costituisce una deny-all affidabile e la branch Production riservata resta negata esplicitamente. La PR di attivazione resta quindi disabilitata e soltanto il merge su `main` rende il branch una Preview staging, senza creare implicitamente un deploy Production.
4. GitHub possiede un environment `staging`, senza secret, con deployment branch policy limitata a `main`. Il workflow non esegue il commit deployato: checkout di `main` e verifier Node versionato restano trusted. I soli permessi sono `contents: read` e `id-token: write`; una sequenza chiusa di action pin produce un token OIDC breve e lo passa unicamente al verifier.
5. La Preview mantiene Vercel Standard Protection. Il progetto espone attualmente la policy predefinita SSO `all_except_custom_domains`; prima dell'attivazione deve essere verificata la copertura dell'origin staging. Trusted Sources accetta GitHub Actions soltanto con issuer `https://token.actions.githubusercontent.com`, audience `https://github.com/Emacore17`, claim repository + repository ID immutabile/ref/environment esatti e target `preview`; la configurazione è stata riletta e nessun bypass secret persistente è stato creato.
6. Vercel invia l'action `vercel.deployment.ready` per una Preview costruita ma non promossa, con `client_payload.state.type=success`. Lo smoke lega il dispatch all'installation ID della GitHub App e ignora l'URL non affidabile dell'evento: il token viene inviato soltanto all'origin branch esatta `<project>-git-main-<scope>.vercel.app` registrata nel manifest. Project ID, deployment ID, SHA, ref, repository, environment e regione vengono poi confrontati con `/health`; redirect, body oltre 8 KiB e output inatteso falliscono con report redatto.
7. Vercel Environment Variables è il confine scelto per future config server-only, ma la superficie web corrente contiene zero variabili e zero secret, confermati anche dal provider. Le system environment variables e l'emissione OIDC del progetto sono abilitate; non sono config applicativa e non dimostrano che Trusted Sources sia configurata. Nessuna chiave `NEXT_PUBLIC_*` viene inventata.
8. Per Preview/staging il recupero standard è un redeploy dello stesso SHA seguito dallo stesso smoke oppure un revert via PR. Instant Rollback non viene dichiarato, perché è legato a deployment/domain Production.

## Alternative considerate

### Vercel CLI in GitHub Actions con access token

Rifiutata: richiederebbe un secret cloud persistente nel workflow e amplierebbe il trust boundary del codice PR. L'integrazione Git nativa produce il deploy; Trusted Sources usa invece OIDC breve esclusivamente per leggere la Preview protetta.

### GitHub Pages

Rinviata: richiederebbe un export statico e una configurazione `basePath` specifica, eliminando il Route Handler server-side usato dal health contract e limitando l'evoluzione Next/BFF. Resta un fallback se Vercel non viene autorizzato.

### Vercel Custom Environments

Non necessaria per M0 e disponibile soltanto su piani superiori. Il default Preview più `main` come staging soddisfa la slice senza acquisti o upgrade.

## Conseguenze e gate di accettazione

Il repository acquisisce una configurazione provider minimale, un desired state verificabile e uno smoke senza credenziali applicative o cloud persistenti. L'identità del deploy deriva da system metadata Vercel e non dall'artifact CI `build-artifact-v1`: la Git Integration ricostruisce lo stesso commit, quindi deployment ID + SHA + health contract costituiscono l'identità immutabile della delivery.

Al checkpoint del 2026-07-14 esistono il progetto `dnd-ai-web` (`prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`) nello scope `emacore17s-projects` e il collegamento al repository autorizzato `Emacore17/dnd-ai` (repository ID `1299266814`). Root Directory `apps/web`, framework Next.js, regione `fra1`, Fork Protection, system environment variables, emissione OIDC e Trusted Source exact-match risultano configurati; le variabili applicative restano zero e non esiste alcun deployment. L'installation ID è `41079282`, ma il grant vede 8 repository (`isAccessRestricted=false`); la Production Branch è ancora `main` e l'origin staging non esiste. L'automazione UI locale non ha consentito di chiudere i due passaggi dashboard e non è stata aggirata.

Prima dell'acceptance occorrono ancora: ridurre e rileggere il grant GitHub App al solo repository autorizzato senza interrompere risorse estranee; impostare e rileggere la Production Branch riservata mentre l'auto-deploy è spento; acquisire l'origin staging; registrare tutti i binding reali nel manifest; verificare che la policy usi la deny-all ricorsiva `**` e non `*`; attivare il gate `deploy:check:linked`; ottenere una Preview riuscita; provare negative deploy senza promozione e redeploy/revert. Se l'attivazione crea un deployment Production o richiede un upgrade/nuovi termini non autorizzati, fermarsi senza proseguire.

## Riferimenti provider verificati

- [Piano Hobby](https://vercel.com/docs/plans/hobby)
- [Git configuration e `git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration)
- [Git integration e Production Branch](https://vercel.com/docs/git)
- [Git namespaces e installation ID](https://vercel.com/docs/rest-api/integrations/list-git-namespaces-by-provider)
- [Repository accessibili dall'installazione](https://vercel.com/docs/rest-api/integrations/list-git-repositories-linked-to-namespace-by-provider)
- [Generated branch URLs](https://vercel.com/docs/deployments/generated-urls)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Trusted Sources OIDC](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
- [Repository dispatch: esempio `deployment.ready`](https://github.com/vercel/repository-dispatch/blob/main/examples/ci-example/.github/workflows/smoke.yaml) e [tipi dello state payload](https://github.com/vercel/repository-dispatch/blob/main/packages/repository-dispatch/src/types.ts)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/reference/security/oidc)
