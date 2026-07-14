---
status: draft
owner: engineering-and-operations
last_reviewed: 2026-07-14
last_verified_commit: 52bf58d9f9cb9cab6ad0cc1b1602d7556067b578
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

- Provider proposto: Vercel; project `dnd-ai-web`; Root Directory `apps/web`.
- Compute: `fra1`; CDN/asset globali; data residency ancora aperta in `OD-08`.
- Vercel environment: `preview`; Git branch staging: `main`.
- Production Branch riservata: `release/production`, non creata né usata.
- GitHub environment: `staging`, policy branch `main`, zero secret.
- Bypass amministratore dell'environment: disabilitato.
- Deployment Protection: scope `standard`, metodo Vercel Authentication; nessuna Preview pubblica.
- Accesso automation: Trusted Source GitHub Actions con OIDC breve, repository ID immutabile e claim repository/ref/environment esatti; nessun bypass secret.
- Web config: zero variabili applicative e zero secret; system metadata Vercel soltanto nel Route Handler `/health`.
- Fase corrente: `git.deploymentEnabled=false` e `source.autoDeploy=false`; il Git connect non deve produrre deploy.

## Preflight

```powershell
git status --short --branch
git rev-parse HEAD
corepack pnpm@10.34.5 deploy:check
corepack pnpm@10.34.5 deploy:check:linked
corepack pnpm dlx vercel@55.0.0 --version
corepack pnpm dlx vercel@55.0.0 whoami
```

Prima del link, `deploy:check` deve passare e `deploy:check:linked` deve fallire soltanto sui quattro binding ancora `null`: project ID, scope slug, origin branch e GitHub App installation ID. `whoami` senza sessione deve fallire senza mostrare token. Non passare token in command line, workflow o documenti.

## Attivazione provider

Questa sezione richiede autorizzazione esplicita del Product Owner per piano/termini e permessi GitHub App. Se compare una richiesta di upgrade, pagamento, uso commerciale incompatibile o accettazione contrattuale nuova, fermarsi.

La foundation, incluso questo runbook e `git.deploymentEnabled=false`, deve essere prima integrata nella default branch. Il workflow `repository_dispatch` viene infatti caricato da `main` e la configurazione statica disabilita ogni auto-deploy durante il collegamento.

Questo prerequisito è soddisfatto dalla [PR #7](https://github.com/Emacore17/dnd-ai/pull/7), merge commit `52bf58d9f9cb9cab6ad0cc1b1602d7556067b578`; la [CI post-merge `29321531038`](https://github.com/Emacore17/dnd-ai/actions/runs/29321531038) ha chiuso 5/5 job con `SUCCESS`. Il provider resta non collegato e l'auto-deploy resta spento.

1. Eseguire il login interattivo soltanto nell'account dedicato al progetto.
2. Verificare scope e piano con `vercel whoami`, `vercel teams list` e `vercel project list`; non registrare email, token o dati personali.
3. Creare il progetto scollegato dal Git e collegare localmente `apps/web`:

   ```powershell
   corepack pnpm dlx vercel@55.0.0 project add dnd-ai-web
   corepack pnpm dlx vercel@55.0.0 link --yes --project dnd-ai-web --cwd apps/web
   ```

4. Impostare Root Directory `apps/web`, framework Next.js, regione `fra1`, Fork Protection attiva, system environment variables abilitate e Deployment Protection `Standard` con metodo Vercel Authentication. Verificare il risultato prima del Git connect.
5. Confermare che `apps/web/vercel.json` su `main` contenga ancora `git.deploymentEnabled=false`, poi collegare `https://github.com/Emacore17/dnd-ai.git` con la GitHub App limitata a questo repository. Rileggere subito la lista deployment: deve restare vuota. Registrare nel manifest project ID, scope slug e installation ID non sensibili; non committare `.vercel/project.json`. Dopo l'installazione, verificare ID e grant senza stampare token o dati account:

   ```powershell
   gh api repos/Emacore17/dnd-ai --jq '{repository_id: .id, full_name: .full_name}'
   gh api user/installations --paginate `
     --jq '.installations[] | select(.app_slug == "vercel") | {id, app_slug, repository_selection}'
   gh api user/installations/<installation-id>/repositories --paginate `
     --jq '.repositories[].full_name'
   ```

   Il grant deve elencare `Emacore17/dnd-ai` e nessun repository non autorizzato. Se il token GitHub corrente non espone gli endpoint installation, rileggere gli stessi dati dalla pagina GitHub App e registrarli nel report; non ampliare gli scope del token soltanto per il check.
6. Con auto-deploy ancora disabilitato, impostare la Production Branch a `release/production` nella pagina Environment/Branch Tracking e rileggere l'impostazione. Se il provider richiede che la branch esista, crearla e proteggerla soltanto in questa fase disabilitata; non effettuare push dopo la selezione.
7. In Deployment Protection > Trusted Sources aggiungere GitHub Actions: issuer `https://token.actions.githubusercontent.com`, audience predefinita `https://github.com/Emacore17`, repository `Emacore17/dnd-ai`, repository ID `1299266814`, branch `main`, environment Actions `staging`, target Vercel `preview`. Rileggere tutti i claim; non creare Protection Bypass for Automation.
8. Abilitare gli eventi `repository_dispatch` e mantenere commenti/bot opzionali. Non creare Deploy Hook o `VERCEL_TOKEN`.
9. Aprire un secondo change set di attivazione che registra l'origin esatta e stabile `https://<project>-git-main-<scope>.vercel.app`, imposta `source.autoDeploy=true`, configura `git.deploymentEnabled` come `{"*": false, "main": true}`, sostituisce nel Quality gate `deploy:check` con `deploy:check:linked` e aggiorna i test adattivi. La PR di attivazione deve restare senza deployment; il contract test confronta la config con `source.activationDeploymentPolicy` prima del merge.
10. Solo il merge protetto del change set di attivazione può produrre la prima Preview di `main`. Se prima di quel merge compare un deployment, oppure il deployment è `production`, fermarsi e registrare il finding.

Il setup resta verificabile anche quando un'impostazione Vercel richiede dashboard: desired state, project ID e drift check sono versionati; la sequenza usa CLI pinned e ogni passaggio esterno viene registrato nel report.

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

- [Git configuration e disattivazione deploy](https://vercel.com/docs/project-configuration/git-configuration)
- [Generated branch URLs](https://vercel.com/docs/deployments/generated-urls)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Trusted Sources per GitHub Actions](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/reference/security/oidc)
- [Evento `deployment.ready`](https://github.com/vercel/repository-dispatch/blob/main/examples/ci-example/.github/workflows/smoke.yaml) e [state payload](https://github.com/vercel/repository-dispatch/blob/main/packages/repository-dispatch/src/types.ts)
