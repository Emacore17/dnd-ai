---
status: draft
owner: engineering-and-operations
last_reviewed: 2026-07-14
last_verified_commit: 70f726d5a7fd9feed1a338d4c24bbedecc0bbe0b
source_refs:
  - docs/MVP_SPEC.md#293-ambienti
  - docs/MVP_SPEC.md#294-cicd
  - docs/adr/0005-vercel-web-preview-and-staging.md
related_tasks:
  - BL-003
  - BL-079
  - BL-080
  - BL-070
code_refs:
  - apps/web/vercel.json
  - apps/web/app/health/route.ts
  - infra/deployment/vercel-staging.json
  - .github/workflows/ci.yml
  - .github/workflows/deployment-smoke.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/deployment-smoke.mjs
  - scripts/smoke-web-deployment.mjs
test_refs:
  - tests/contracts/deployment-foundation.test.mjs
  - tests/integration/web-health.test.mjs
  - docs/testing/BL-080_VERIFICATION.md
supersedes: null
---

# Preview e staging web

## Scope e invarianti

Questo runbook copre soltanto la Preview/staging non-production di `apps/web`. API, worker, database, Redis, provider AI e dati reali sono fuori scope. Il desired state è `infra/deployment/vercel-staging.json`; `.vercel/` è locale e ignorata.

- Provider autorizzato: Vercel Hobby per uso personale/non commerciale; project `dnd-ai-web` (`prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`) nello scope `emacore17s-projects`; Root Directory `apps/web`.
- Compute: `fra1`; CDN/asset globali; data residency ancora aperta in `OD-08`.
- Vercel environment: `preview`; Git branch staging: `main`.
- Production Branch: `release/production`, riletta dal provider; la branch GitHub esiste ed è protetta.
- GitHub environment: `staging`, policy branch `main`, zero secret.
- Bypass amministratore dell'environment: disabilitato.
- Deployment Protection: livello `standard`, policy SSO predefinita `all_except_custom_domains`; il readback project-level è un gate pre-merge, mentre l'accesso OIDC all'origin branch esatta può essere provato soltanto dopo che il primo deploy materializza l'alias.
- Accesso automation: Trusted Source GitHub Actions configurata e riletta con OIDC breve, repository ID immutabile e claim repository/ref/environment esatti; non esiste alcun bypass secret.
- Web config: zero variabili applicative e zero secret; system environment variables ed emissione OIDC del progetto abilitate; system metadata Vercel soltanto nel Route Handler `/health`.
- Fase corrente: repository `Emacore17/dnd-ai` (ID `1299266814`) collegato, GitHub App installation ID `41079282` e binding atomici registrati nel change set `codex/bl-080-enable-preview`; `source.autoDeploy=true` coincide con `git.deploymentEnabled={"**": false, "main": true, "release/production": false}` e il Quality gate usa `deploy:check:linked`. La lista deployment è ancora vuota perché la PR non è stata pubblicata/mergiata. Il grant condiviso (`isAccessRestricted=false`, 8 repository) resta intenzionalmente invariato per non perdere accesso ad altri progetti ed è un rischio residuo accettato, non un blocker di `BL-080`.

## Preflight

```powershell
git status --short --branch
git rev-parse HEAD
corepack pnpm@10.34.5 deploy:check
corepack pnpm@10.34.5 deploy:check:linked
corepack pnpm dlx vercel@55.0.0 --version
corepack pnpm dlx vercel@55.0.0 whoami
```

Nel change set corrente `deploy:check` e `deploy:check:linked` passano: project ID, scope slug, origin branch e GitHub App installation ID sono registrati insieme. `whoami` deve essere eseguito soltanto in forma redatta; non passare token in command line, workflow o documenti. Il link CLI aveva creato un `.env.local` effimero ignorato, rimosso subito dopo il readback senza leggerne il contenuto; non conservarlo come configurazione del progetto.

## Attivazione provider

Il Product Owner ha autorizzato esclusivamente il piano Hobby per uso personale/non commerciale e l'identità Vercel indicata. La verifica dell'identità è stata redatta: l'indirizzo non viene registrato. Se compare una richiesta di upgrade, pagamento, uso commerciale incompatibile o accettazione contrattuale nuova, fermarsi.

La foundation, incluso questo runbook e `git.deploymentEnabled=false`, deve essere prima integrata nella default branch. Il workflow `repository_dispatch` viene infatti caricato da `main` e la configurazione statica disabilita ogni auto-deploy durante il collegamento.

Questo prerequisito è soddisfatto dalla [PR #7](https://github.com/Emacore17/dnd-ai/pull/7), merge commit `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578`; la [CI post-merge `29321531038`](https://github.com/Emacore17/dnd-ai/actions/runs/29321531038) ha chiuso 5/5 job con `SUCCESS`. Il progetto è collegato e non esiste ancora alcun deployment; la policy di attivazione resta confinata al branch corrente finché non supera PR e merge protetti.

### Checkpoint provider del 2026-07-14

| Controllo | Stato verificato |
|---|---|
| Account e piano | identità esclusiva autorizzata `PASS` in forma redatta; Hobby personale/non commerciale |
| Progetto | `dnd-ai-web`; ID `prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`; scope `emacore17s-projects` |
| Sorgente | `Emacore17/dnd-ai`, repository ID `1299266814`, collegato |
| Build | Root Directory `apps/web`; framework Next.js; regione `fra1` |
| Sicurezza/config | Fork Protection, system environment variables ed emissione OIDC abilitate; zero variabili applicative |
| Deployment Protection | Standard con SSO predefinito `all_except_custom_domains`; Trusted Source GitHub Actions exact-match configurata e riletta |
| Branch | `release/production` creata da `ef803add249d16ded6f94936c59531047c8a92fa` e protetta dalla Ruleset dedicata `18926413` senza bypass; Ruleset `main` `18877721` invariata; Production Branch Vercel riletta come `release/production` |
| GitHub App | installation ID condivisa `41079282`; `isAccessRestricted=false`; 8 repository accessibili: rischio residuo esplicitamente accettato, non blocker |
| Binding | project ID, scope, installation ID e alias `https://dnd-ai-web-git-main-emacore17s-projects.vercel.app` registrati atomicamente; `deploy:check:linked` PASS; materializzazione provider pending |
| Deploy | nessun deployment creato |

L'impostazione manuale della Production Branch è completata e il readback CLI mostra `release/production`. Non usare un account diverso, non indebolire la protezione e non effettuare push o deploy sulla branch riservata.

### Proseguimento sicuro

1. Non ricreare il progetto e non ripetere il Git connect: rileggere prima lo stato esistente e confermare che la lista deployment sia ancora vuota.
2. Non restringere l'installation GitHub App `41079282`: è condivisa e il Product Owner ha stabilito che una restrizione farebbe perdere accesso ad altri progetti. Rileggere invece l'esatto link project `dnd-ai-web`/repository `Emacore17/dnd-ai`/repository ID `1299266814` e trattare `isAccessRestricted=false` con 8 repository come baseline accettata; non ispezionare contenuti estranei al task.
3. Confermare che `release/production` punti a `ef803add249d16ded6f94936c59531047c8a92fa`, che la Ruleset dedicata `18926413` sia attiva e senza bypass, che la Ruleset `main-required-ci` `18877721` sia invariata e che Vercel continui a rileggere Production Branch=`release/production`; non effettuare push sulla branch riservata.
4. La Trusted Source è già presente: non crearne una seconda. Rileggere issuer `https://token.actions.githubusercontent.com`, audience `https://github.com/Emacore17`, repository `Emacore17/dnd-ai`, repository ID `1299266814`, ref `refs/heads/main`, environment Actions `staging` e target Vercel `preview`; non creare Protection Bypass for Automation.
5. Verificare installation ID e grant senza stampare token o dati account. Gli endpoint GitHub sotto richiedono un token compatibile; il token OAuth corrente di `gh` può rispondere `403`, quindi il readback canonico può essere eseguito anche con gli endpoint ufficiali Vercel `GET /v1/integrations/git-namespaces` e `GET /v1/integrations/search-repo` tramite un client autenticato che non persista né stampi il token:

   ```powershell
   gh api repos/Emacore17/dnd-ai --jq '{repository_id: .id, full_name: .full_name}'
   gh api user/installations --paginate `
     --jq '.installations[] | select(.app_slug == "vercel") | {id, app_slug, repository_selection}'
   gh api user/installations/<installation-id>/repositories --paginate `
     --jq '.repositories[].full_name'
   ```

   Il readback deve confermare installation ID `41079282`, baseline condivisa di 8 repository e presenza di `Emacore17/dnd-ai`; non richiede né autorizza la restrizione del grant o l'esplorazione degli altri repository. Una variazione del conteggio, del target project/repository o di `isAccessRestricted` è drift da registrare e valutare, non da correggere automaticamente. Non ampliare gli scope del token soltanto per il check.
6. Abilitare gli eventi `repository_dispatch` e mantenere commenti/bot opzionali. Non creare Deploy Hook o `VERCEL_TOKEN`.
7. Il secondo change set `codex/bl-080-enable-preview` registra atomicamente project ID, scope, installation ID e l'alias branch deterministico documentato `https://dnd-ai-web-git-main-emacore17s-projects.vercel.app`; imposta `source.autoDeploy=true`; configura `git.deploymentEnabled` come `{"**": false, "main": true, "release/production": false}`; sostituisce nel Quality gate `deploy:check` con `deploy:check:linked` e mantiene adattivi i test negativi. La formula usa esclusivamente project name, branch e scope già riletti e coincide con il contratto provider; non deriva dall'URL non affidabile di un evento. `**` è la deny-all ricorsiva necessaria per includere branch con `/`; `*` non è ammesso come fallback. La PR di attivazione deve restare senza deployment; il contract test confronta la config con `source.activationDeploymentPolicy` prima del merge.
8. Solo il merge protetto del change set di attivazione può produrre la prima Preview di `main`. Rileggere il deployment/provider e confermare che l'alias materializzato coincida esattamente con l'origin versionata; lo smoke continua a ignorare l'URL del dispatch. Se prima di quel merge compare un deployment, oppure il deployment è `production`, fermarsi e registrare il finding.

Il setup resta verificabile anche quando un'impostazione Vercel richiede dashboard: desired state, project ID e drift check sono versionati; la sequenza usa CLI pinned e ogni passaggio esterno viene registrato nel report. Gli errori storici dell'automazione UI non giustificano cambio account o riduzione dei controlli; il readback CLI, non l'esito del click, è l'evidenza canonica del Branch Tracking.

## GitHub environment

Configurazione idempotente iniziale:

```powershell
gh api --method PUT repos/Emacore17/dnd-ai/environments/staging `
  -F wait_timer=0 `
  -F can_admins_bypass=false `
  -F 'deployment_branch_policy[protected_branches]=false' `
  -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api --method POST `
  repos/Emacore17/dnd-ai/environments/staging/deployment-branch-policies `
  -f name=main -f type=branch
```

Non inviare `prevent_self_review` senza una lista `reviewers`: GitHub rifiuta correttamente la richiesta con `422`. Il `POST` restituisce inoltre `422` se la regola branch esiste già; in entrambi i casi leggere e confrontare lo stato, senza aggiungere reviewer o duplicati. Verifica:

```powershell
gh api repos/Emacore17/dnd-ai/environments/staging
gh api repos/Emacore17/dnd-ai/environments/staging/secrets
gh api repos/Emacore17/dnd-ai/environments/staging/variables
```

## Deploy e smoke

Dopo il change set di attivazione, la Git Integration crea una Preview per ogni push abilitato. Il workflow `Staging smoke` esiste sulla default branch e reagisce all'action `vercel.deployment.ready` soltanto per project `dnd-ai-web`, ref `main`, environment `preview` e `state.type=success`. Fa checkout del verifier trusted su `main`; non esegue codice del commit indicato dal payload. Il verifier lega l'evento all'installation ID della GitHub App, ignora l'URL del payload e invia il token OIDC soltanto all'origin branch esatta registrata. `/health` conferma project, deployment, SHA, ref, repository, environment e regione.

Smoke remoto manuale, usando soltanto metadata non sensibili; il token OIDC viene creato e mascherato dal workflow:

```powershell
gh workflow run deployment-smoke.yml --ref main `
  -f project_id='prj_<redacted>' `
  -f deployment_id='dpl_<redacted>' `
  -f commit_sha='<40-char-sha>' `
  -f environment='preview'
```

Il report stampa host e ID redatti. `deploy:smoke` resta disponibile per fixture/failure path locali, ma una Preview protetta richiede un OIDC valido e non va sbloccata copiando token nella shell. Lo smoke fallisce prima del fetch su token mancante/malformato, origin non collegata o evento non attribuibile alla GitHub App; rifiuta inoltre redirect, timeout, media type/cache directive non esatti, body non JSON o >8 KiB e mismatch di project/deployment/SHA/ref/repository/environment/regione.

## Failure, redeploy e recupero

- Config/provider metadata o OIDC mancante: nessun fetch; exit `1` redatto.
- Build Vercel fallita: nessun evento `ready` e nessuna promozione, perché `main` è Preview e la Production Branch è riservata.
- Prova negativa remota: dopo il primo Preview riuscito registrare timestamp UTC, ultimo deployment Vercel e ultimo run `Staging smoke` (ID, SHA e timestamp), quindi creare da `main` il branch effimero `codex/bl-080-failure-probe` senza PR. Nel solo commit di prova sostituire esattamente `git.deploymentEnabled` con `{ "**": false, "codex/bl-080-failure-probe": true, "main": false, "release/production": false }` e aggiungere il `buildCommand` top-level `node -e "process.exit(42)"`. Attendere lo stato terminale Vercel `ERROR` per lo SHA del probe; rispetto alla baseline e al timestamp registrati, verificare zero dispatch `vercel.deployment.ready`, zero nuovi run `Staging smoke` e zero deployment Production. Eliminare infine la branch remota e locale. Il commit non viene mergiato e nessun controllo di `main` viene indebolito.
- Smoke fallito: environment deployment GitHub rosso; non rendere `BL-079` READY.
- Provider indisponibile: retry bounded manuale; non cambiare regione o provider silenziosamente.
- Redeploy verificabile:

  ```powershell
  corepack pnpm dlx vercel@55.0.0 redeploy <deployment-id-or-url> --target preview --cwd apps/web --scope emacore17s-projects
  ```

  Il nuovo deployment ID deve riferire lo stesso commit e superare lo stesso smoke.
- Rollback staging: revert del commit noto tramite PR, merge protetto su `main`, nuova Preview e smoke. Non usare Instant Rollback come prova di Preview.

## Chiusura operativa

Registrare project/region/environment, SHA, deployment/run ID redatti, URL GitHub Actions, negative deploy e redeploy/revert in `docs/testing/BL-080_VERIFICATION.md`. Nessun valore production, token, cookie o screenshot con dati personali entra nel repository.

## Riferimenti ufficiali

- [Piano Hobby](https://vercel.com/docs/plans/hobby)
- [Git configuration e disattivazione deploy](https://vercel.com/docs/project-configuration/git-configuration)
- [List Git namespaces by provider](https://vercel.com/docs/rest-api/integrations/list-git-namespaces-by-provider)
- [List Git repositories linked to namespace](https://vercel.com/docs/rest-api/integrations/list-git-repositories-linked-to-namespace-by-provider)
- [Generated branch URLs](https://vercel.com/docs/deployments/generated-urls)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Trusted Sources per GitHub Actions](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/reference/security/oidc)
- [Evento `deployment.ready`](https://github.com/vercel/repository-dispatch/blob/main/examples/ci-example/.github/workflows/smoke.yaml) e [state payload](https://github.com/vercel/repository-dispatch/blob/main/packages/repository-dispatch/src/types.ts)
