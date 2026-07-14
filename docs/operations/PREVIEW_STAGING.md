---
status: draft
owner: engineering-and-operations
last_reviewed: 2026-07-14
last_verified_commit: 1766406b9bd701a9880705b371fdc0b05a73abe1
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
  - infra/deployment/vercel-staging.json
  - .github/workflows/deployment-smoke.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/lib/deployment-foundation.mjs
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
- Production Branch desiderata: `release/production`; lo stato provider è ancora `main`, quindi l'attivazione è bloccata.
- GitHub environment: `staging`, policy branch `main`, zero secret.
- Bypass amministratore dell'environment: disabilitato.
- Deployment Protection: livello `standard`, policy SSO predefinita `all_except_custom_domains`; la copertura dell'origin staging deve essere riletta prima dell'attivazione.
- Accesso automation: Trusted Source GitHub Actions configurata e riletta con OIDC breve, repository ID immutabile e claim repository/ref/environment esatti; non esiste alcun bypass secret.
- Web config: zero variabili applicative e zero secret; system environment variables ed emissione OIDC del progetto abilitate; system metadata Vercel soltanto nel Route Handler `/health`.
- Fase corrente: repository `Emacore17/dnd-ai` (ID `1299266814`) collegato, GitHub App installation ID `41079282`, `git.deploymentEnabled=false` e `source.autoDeploy=false`; la lista deployment è vuota. Il grant dell'App è però ampio (`isAccessRestricted=false`, 8 repository) e deve essere ridotto prima dell'attivazione.

## Preflight

```powershell
git status --short --branch
git rev-parse HEAD
corepack pnpm@10.34.5 deploy:check
corepack pnpm@10.34.5 deploy:check:linked
corepack pnpm dlx vercel@55.0.0 --version
corepack pnpm dlx vercel@55.0.0 whoami
```

Nel checkpoint corrente `deploy:check` passa e `deploy:check:linked` fallisce ancora sui quattro binding versionati `null`: project ID, scope slug, origin branch e GitHub App installation ID. Project ID, scope e installation ID `41079282` sono già noti esternamente, ma non vanno registrati separatamente finché l'origin non consente un change set linked atomico e il grant App non è repository-only. `whoami` deve essere eseguito soltanto in forma redatta; non passare token in command line, workflow o documenti. Il link CLI ha creato un `.env.local` effimero ignorato, rimosso subito dopo il readback senza leggerne il contenuto; non conservarlo come configurazione del progetto.

## Attivazione provider

Il Product Owner ha autorizzato esclusivamente il piano Hobby per uso personale/non commerciale e l'identità Vercel indicata. La verifica dell'identità è stata redatta: l'indirizzo non viene registrato. Se compare una richiesta di upgrade, pagamento, uso commerciale incompatibile o accettazione contrattuale nuova, fermarsi.

La foundation, incluso questo runbook e `git.deploymentEnabled=false`, deve essere prima integrata nella default branch. Il workflow `repository_dispatch` viene infatti caricato da `main` e la configurazione statica disabilita ogni auto-deploy durante il collegamento.

Questo prerequisito è soddisfatto dalla [PR #7](https://github.com/Emacore17/dnd-ai/pull/7), merge commit `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578`; la [CI post-merge `29321531038`](https://github.com/Emacore17/dnd-ai/actions/runs/29321531038) ha chiuso 5/5 job con `SUCCESS`. Il progetto è ora collegato, ma auto-deploy resta spento e non esiste alcun deployment.

### Checkpoint provider del 2026-07-14

| Controllo | Stato verificato |
|---|---|
| Account e piano | identità esclusiva autorizzata `PASS` in forma redatta; Hobby personale/non commerciale |
| Progetto | `dnd-ai-web`; ID `prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`; scope `emacore17s-projects` |
| Sorgente | `Emacore17/dnd-ai`, repository ID `1299266814`, collegato |
| Build | Root Directory `apps/web`; framework Next.js; regione `fra1` |
| Sicurezza/config | Fork Protection, system environment variables ed emissione OIDC abilitate; zero variabili applicative |
| Deployment Protection | Standard con SSO predefinito `all_except_custom_domains`; Trusted Source GitHub Actions exact-match configurata e riletta |
| Branch | Production Branch ancora `main`: hard blocker; target desiderato `release/production` |
| GitHub App | installation ID `41079282`; `isAccessRestricted=false`; 8 repository accessibili: hard blocker least-privilege |
| Binding | project ID, scope e installation ID noti; origin staging non acquisita; manifest ancora atomicamente non linked |
| Deploy | nessun deployment creato |

L'automazione UI locale non ha consentito di completare i controlli che richiedono dashboard. Non usare un account diverso, non indebolire la protezione e non simulare i binding mancanti per aggirare il blocco.

### Proseguimento sicuro

1. Non ricreare il progetto e non ripetere il Git connect: rileggere prima lo stato esistente e confermare che la lista deployment sia ancora vuota.
2. In GitHub > Settings > Applications > Installed GitHub Apps > Vercel, ridurre l'accesso a **Only select repositories** includendo `Emacore17/dnd-ai`. Il checkpoint corrente vede 8 repository: prima di salvare, verificare l'impatto sugli altri progetti Vercel dell'account e non interrompere risorse estranee senza istruzione specifica. Rileggere poi `isAccessRestricted=true` e l'elenco con il solo repository target.
3. Con auto-deploy ancora disabilitato, impostare la Production Branch a `release/production` nella pagina Settings > Environments > Production > Branch Tracking e rileggere l'impostazione. Se il provider richiede che la branch esista, crearla e proteggerla soltanto in questa fase disabilitata; non effettuare push dopo la selezione.
4. La Trusted Source è già presente: non crearne una seconda. Rileggere issuer `https://token.actions.githubusercontent.com`, audience `https://github.com/Emacore17`, repository `Emacore17/dnd-ai`, repository ID `1299266814`, ref `refs/heads/main`, environment Actions `staging` e target Vercel `preview`; non creare Protection Bypass for Automation.
5. Verificare installation ID e grant senza stampare token o dati account. Gli endpoint GitHub sotto richiedono un token compatibile; il token OAuth corrente di `gh` può rispondere `403`, quindi il readback canonico può essere eseguito anche con gli endpoint ufficiali Vercel `GET /v1/integrations/git-namespaces` e `GET /v1/integrations/search-repo` tramite un client autenticato che non persista né stampi il token:

   ```powershell
   gh api repos/Emacore17/dnd-ai --jq '{repository_id: .id, full_name: .full_name}'
   gh api user/installations --paginate `
     --jq '.installations[] | select(.app_slug == "vercel") | {id, app_slug, repository_selection}'
   gh api user/installations/<installation-id>/repositories --paginate `
     --jq '.repositories[].full_name'
   ```

   Il grant deve elencare `Emacore17/dnd-ai` e nessun repository non autorizzato. Non ampliare gli scope del token soltanto per il check.
6. Abilitare gli eventi `repository_dispatch` e mantenere commenti/bot opzionali. Non creare Deploy Hook o `VERCEL_TOKEN`.
7. Aprire un secondo change set di attivazione che registra tutti i binding reali, imposta `source.autoDeploy=true`, configura `git.deploymentEnabled` come `{"**": false, "main": true, "release/production": false}`, sostituisce nel Quality gate `deploy:check` con `deploy:check:linked` e aggiorna i test adattivi. `**` è la deny-all ricorsiva necessaria per includere branch con `/`; `*` non è ammesso come fallback. La PR di attivazione deve restare senza deployment; il contract test confronta la config con `source.activationDeploymentPolicy` prima del merge.
8. Solo il merge protetto del change set di attivazione può produrre la prima Preview di `main`. Acquisire l'origin branch effettiva dal deployment/provider, senza dedurla da un template. Se prima di quel merge compare un deployment, oppure il deployment è `production`, fermarsi e registrare il finding.

Il setup resta verificabile anche quando un'impostazione Vercel richiede dashboard: desired state, project ID e drift check sono versionati; la sequenza usa CLI pinned e ogni passaggio esterno viene registrato nel report. Un blocco dell'automazione UI resta un blocker esplicito, non un'autorizzazione a cambiare account o ridurre i controlli.

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
- Smoke fallito: environment deployment GitHub rosso; non rendere `BL-079` READY.
- Provider indisponibile: retry bounded manuale; non cambiare regione o provider silenziosamente.
- Redeploy verificabile:

  ```powershell
  corepack pnpm dlx vercel@55.0.0 redeploy <deployment-id-or-url> --target preview
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
