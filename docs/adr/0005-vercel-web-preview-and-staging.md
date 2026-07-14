---
status: proposed
owner: engineering-and-operations
last_reviewed: 2026-07-14
last_verified_commit: 519052649c88d84c45da92c3b35131819291a73a
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
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
supersedes: null
---

# ADR-0005 — Preview e staging web su Vercel

## Stato

Proposed il 2026-07-14 durante `BL-080`. Il Product Owner ha autorizzato esclusivamente il piano Hobby per uso personale/non commerciale e l'identità Vercel indicata; l'identità è stata verificata in modo redatto e non viene versionata. Il Product Owner ha inoltre accettato esplicitamente il rischio residuo dell'installazione GitHub App condivisa, che non deve essere ristretta. La strategia di attivazione Git è sospesa: PR #12 ha prodotto un deployment Production da `main` nonostante Production Branch=`release/production`. La delivery è stata eliminata; il contenimento commit `4d3d4ba`/PR #13 è integrato nel merge `61e5cbd`. Il guard Preview-only della PR #14 è integrato nel merge `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`: le run PR `29335696502` e post-merge `29335856323` sono 5/5 verdi e il readback conferma ancora zero deployment. Il primo comando CLI esplicito non ha creato alcun deployment: la preparazione del payload si è fermata su 773,1 MiB di sorgenti e un file `.turbo` da 156,5 MB, oltre il limite Hobby di 100 MB per file. L'ADR non può diventare `accepted` finché la discrepanza non è spiegata o isolata da una mitigazione verificata e una Preview reale non supera smoke/failure/redeploy.

## Contesto

Il solo runtime oggi deployabile è `apps/web`: Next.js produce un server standalone, mentre API e worker non hanno ancora container, daemon e dipendenze gestite. Il web non consuma variabili applicative o secret. Anticipare database, Redis o credenziali fittizie allargherebbe lo scope e contraddirebbe ADR-0004.

MVP e ADR-0003 vietano credenziali cloud persistenti nei workflow PR. Vercel supporta il monorepo tramite Root Directory, crea Preview per i branch e invia eventi `repository_dispatch` tramite la Git Integration. L'autorizzazione corrente copre soltanto il piano Hobby personale/non commerciale: upgrade, acquisti, uso commerciale o nuove condizioni richiedono una nuova decisione esplicita.

## Decisione proposta

1. Vercel ospita soltanto `apps/web`; `apps/api` e `apps/worker` restano `planned` finché i task proprietari non forniscono packaging operativo.
2. Il progetto desiderato è `dnd-ai-web`, Root Directory `apps/web`, framework Next.js e singola regione compute `fra1`. Asset e CDN restano globali: questa scelta non equivale a data residency UE e non chiude `OD-08` per dati e telemetry.
3. Il deploy automatico finale usa la Vercel GitHub App con Fork Protection, non un `VERCEL_TOKEN` in Actions. La foundation resta in `main` con `git.deploymentEnabled=false` e `source.autoDeploy=false`. La precedente seconda fase con `{"**": false, "main": true, "release/production": false}` è controprovata dall'incidente PR #12: ha consentito il deploy atteso, ma il provider lo ha classificato Production. Non può essere riapplicata finché Preview, smoke e failure path non sono dimostrati.
4. La build provider deve attraversare `node scripts/assert-vercel-preview-build.mjs && pnpm run build`, imposto dal `buildCommand` di `apps/web/vercel.json`. Il primo guard strict accetta soltanto la tripla esatta `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`; il build locale ordinario è ammesso solo quando tutti e tre i metadata sono assenti. Metadata incompleti, incoerenti o non Preview falliscono con output statico redatto, e i tre valori partecipano alla chiave cache Turbo. Questo controllo non sceglie il target e non impedisce al provider di creare inizialmente un record deployment: blocca soltanto il completamento della build.
5. Il payload CLI parte sempre dalla root del monorepo. La sola policy di esclusione Vercel è la denylist root `.vercelignore`; un override `apps/web/.vercelignore` è vietato perché renderebbe ambiguo il confine delle sorgenti. Prima di qualunque deploy reale, la CLI Vercel `55.0.0` deve eseguire `deploy . --project dnd-ai-web --scope emacore17s-projects --target=preview --dry --format=json --yes` e il JSON deve superare `scripts/check-vercel-deploy-dry-run.mjs`. Il checker richiede root esatta, framework `nextjs`, input indispensabili come file regolari con hash valido, soli mode file/directory zero-byte supportati, massimo 15.000 entry, massimo 10 MiB complessivi, massimo 5 MiB per file e nessun discendente cache, generato, privato o non relativo. Il dry-run non carica sorgenti e non crea un deployment.
6. Soltanto dopo il dry-run valido è ammessa una singola diagnostica da checkout pulito di `main` con CLI pinned e selector `vercel deploy --target=preview`. Non usa `--cwd apps/web`, `--prebuilt`, archivi, `--prod`, `promote`, `--skip-domain`, custom target o override manuali `VERCEL*`. La diagnostica non abilita Git auto-deploy, non sostituisce il deploy automatico di accettazione e viene interrotta/rimossa se l'ispezione non conferma Preview.
7. L'installation ID `41079282` resta intenzionalmente condivisa (`isAccessRestricted=false`, 8 repository). Restringerla non è un gate di `BL-080`: il Product Owner lo ha vietato perché interromperebbe l'accesso necessario ad altri progetti. Il rischio di una superficie installation-wide più ampia è accettato e compensato a livello progetto da link esatti, Trusted Source OIDC exact-match, Fork e Standard Protection, environment GitHub `staging` limitato a `main`, smoke fail-closed e readback di drift. La policy Git è deny-all (`git.deploymentEnabled=false`); nessun branch è abilitato. L'eccezione va riesaminata se diventa possibile dedicare o restringere l'installazione senza perdita di accesso.
8. GitHub possiede un environment `staging`, senza secret, con deployment branch policy limitata a `main`. Il workflow non esegue il commit deployato: checkout di `main` e verifier Node versionato restano trusted. I soli permessi sono `contents: read` e `id-token: write`; una sequenza chiusa di action pin produce un token OIDC breve e lo passa unicamente al verifier.
9. La Preview mantiene Vercel Standard Protection. Il progetto espone la policy predefinita SSO `all_except_custom_domains`, riletta a livello project prima del merge. Trusted Sources accetta GitHub Actions soltanto con issuer `https://token.actions.githubusercontent.com`, audience `https://github.com/Emacore17`, claim repository + repository ID immutabile/ref/environment esatti e target `preview`; la configurazione è stata riletta e nessun bypass secret persistente è stato creato. La copertura e l'accesso OIDC dell'origin branch esatta vengono provati dallo smoke soltanto dopo che una prima Preview valida materializza l'alias.
10. Vercel invia l'action `vercel.deployment.ready` per una Preview costruita ma non promossa, con `client_payload.state.type=success`. Lo smoke lega il dispatch all'installation ID della GitHub App e ignora l'URL non affidabile dell'evento: il token viene inviato soltanto all'origin branch esatta `<project>-git-main-<scope>.vercel.app` registrata nel manifest. Project ID, deployment ID, SHA, ref, repository, environment e regione vengono poi confrontati con `/health`; redirect, body oltre 8 KiB e output inatteso falliscono con report redatto.
11. Vercel Environment Variables è il confine scelto per future config server-only, ma la superficie web corrente contiene zero variabili e zero secret, confermati anche dal provider. Le system environment variables e l'emissione OIDC del progetto sono abilitate; non sono config applicativa e non dimostrano che Trusted Sources sia configurata. `VERCEL`, `VERCEL_ENV` e `VERCEL_TARGET_ENV` sono metadata provider usati soltanto dal guard build; nessuna chiave `NEXT_PUBLIC_*` viene inventata.
12. Per Preview/staging il recupero standard è un redeploy dello stesso SHA seguito dallo stesso smoke oppure un revert via PR. Instant Rollback non viene dichiarato, perché è legato a deployment/domain Production.

## Alternative considerate

### Vercel CLI in GitHub Actions con access token

Rifiutata: richiederebbe un secret cloud persistente nel workflow e amplierebbe il trust boundary del codice PR. L'integrazione Git nativa resta il percorso automatico finale; Trusted Sources usa invece OIDC breve esclusivamente per leggere la Preview protetta. La diagnostica CLI locale one-shot descritta sopra usa soltanto la sessione già autenticata e non introduce token nel workflow.

### GitHub Pages

Rinviata: richiederebbe un export statico e una configurazione `basePath` specifica, eliminando il Route Handler server-side usato dal health contract e limitando l'evoluzione Next/BFF. Resta un fallback se Vercel non viene autorizzato.

### Vercel Custom Environments

Non autorizzata per M0 perché richiede un piano superiore. Il default Preview resta l'opzione proposta compatibile con Hobby, ma non è considerato valido finché il target mismatch non è risolto e provato con una Preview reale, senza acquisti o upgrade.

### Installazione GitHub App repository-only

Non applicata nel checkpoint corrente. L'installation `41079282` è condivisa da altri progetti Vercel e restringerla al solo `Emacore17/dnd-ai` ne interromperebbe l'accesso. Il Product Owner ha scelto di mantenere il grant ampio e accettare il rischio residuo; i controlli project-level definiti sopra restano obbligatori e qualsiasi drift del link, dei claim, delle protezioni o del numero di repository richiede una nuova verifica.

## Conseguenze e gate di accettazione

Il repository acquisisce una configurazione provider minimale, un desired state verificabile e uno smoke senza credenziali applicative o cloud persistenti. L'identità del deploy deriva da system metadata Vercel e non dall'artifact CI `build-artifact-v1`: la Git Integration ricostruisce lo stesso commit, quindi deployment ID + SHA + health contract costituiscono l'identità immutabile della delivery.

Al checkpoint del 2026-07-14 esistono il progetto `dnd-ai-web` e il collegamento al repository autorizzato, con Root Directory `apps/web`, Next.js, `fra1`, protezioni e Trusted Source exact-match. Production Branch Vercel continua a risultare `release/production`. PR #12/merge `c64d095` ha tuttavia creato `dpl_Cag…` con `target=production`; GitHub Deployment API lo registra `Production/success` prima della rimozione. Il dispatch `ready` è stato rifiutato dal job smoke, poi deployment e alias sono tornati a zero/`404`. Il contenimento PR #13 e il guard Preview-only PR #14 sono integrati; le run PR/post-merge del guard (`29335696502`, `29335856323`) sono 5/5 verdi e il readback conferma zero nuovi deployment. Il primo tentativo CLI non ha raggiunto il provider: il payload locale includeva 773,1 MiB e un file cache `.turbo` da 156,5 MB, quindi la CLI si è fermata sul limite Hobby per file e la lista deployment è rimasta vuota. Binding versionati `null`, `autoDeploy=false`, config Git disabilitata e gate non-linked restano vigenti; la slice corrente introduce il contratto root `.vercelignore` + dry-run fail-closed prima di ritentare. L'installation condivisa resta il rischio accettato già descritto, ma non è indicata come causa dell'incidente.

Prima dell'acceptance occorrono ancora: integrare e verificare il contratto payload, ottenere un manifest dry-run Vercel `55.0.0` valido e soltanto allora isolare la discrepanza con la diagnostica CLI Preview esplicita; ottenere Preview e smoke; provare un deploy Preview fallito e redeploy senza Production; infine dimostrare il percorso automatico Git con target Preview. Il precedente gate “fermarsi su Production” ha funzionato come contenimento, non come prevenzione: il guard limita il completamento della build, ma soltanto il selector `--target=preview` sceglie l'environment della diagnostica.

## Riferimenti provider verificati

- [Piano Hobby](https://vercel.com/docs/plans/hobby)
- [Git configuration e `git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration)
- [Git integration e Production Branch](https://vercel.com/docs/git)
- [CLI `deploy` e selector `--target`](https://vercel.com/docs/cli/deploy)
- [System environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Git namespaces e installation ID](https://vercel.com/docs/rest-api/integrations/list-git-namespaces-by-provider)
- [Repository accessibili dall'installazione](https://vercel.com/docs/rest-api/integrations/list-git-repositories-linked-to-namespace-by-provider)
- [Generated branch URLs](https://vercel.com/docs/deployments/generated-urls)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Trusted Sources OIDC](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
- [Repository dispatch: esempio `deployment.ready`](https://github.com/vercel/repository-dispatch/blob/main/examples/ci-example/.github/workflows/smoke.yaml) e [tipi dello state payload](https://github.com/vercel/repository-dispatch/blob/main/packages/repository-dispatch/src/types.ts)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/reference/security/oidc)
