---
status: draft
owner: engineering-and-operations
last_reviewed: 2026-07-14
last_verified_commit: 13032743552654f9f68d87050eb11cabbdd92325
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
  - .vercelignore
  - apps/web/vercel.json
  - apps/web/package.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - apps/web/app/health/route.ts
  - infra/deployment/vercel-staging.json
  - .github/workflows/ci.yml
  - .github/workflows/deployment-smoke.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-smoke.mjs
  - scripts/smoke-web-deployment.mjs
  - turbo.json
test_refs:
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
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
- Fase corrente: repository collegato e Production Branch riletta `release/production`, ma il primo merge con policy solo-`main` ha creato un deployment `production`, poi eliminato. Il contenimento PR #13 e il guard Preview-only PR #14 sono integrati; merge guard `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`, run PR `29335696502` e post-merge `29335856323` sono 5/5 verdi e il readback conferma zero deployment. Il primo CLI Preview esplicito si è fermato prima del deployment su un payload locale da 773,1 MiB con un file `.turbo` da 156,5 MB, oltre il limite Hobby di 100 MB per file. Il change set corrente introduce la denylist root e il gate dry-run prima di ritentare, senza riattivare Git. Il grant condiviso resta invariato per decisione PO.

## Preflight

```powershell
git status --short --branch
git rev-parse HEAD
corepack pnpm@10.34.5 deploy:check
corepack pnpm@10.34.5 deploy:check:linked
corepack pnpm dlx vercel@55.0.0 --version
corepack pnpm dlx vercel@55.0.0 whoami
```

Nel contenimento integrato `deploy:check` passa e `deploy:check:linked` fallisce come atteso con exit `1` sui quattro binding versionati `null`: il provider remoto resta collegato, ma il repository non dichiara attiva una delivery non verificata. `whoami` deve essere eseguito soltanto in forma redatta; non passare token in command line, workflow o documenti.

## Attivazione provider

Il Product Owner ha autorizzato esclusivamente il piano Hobby per uso personale/non commerciale e l'identità Vercel indicata. La verifica dell'identità è stata redatta: l'indirizzo non viene registrato. Se compare una richiesta di upgrade, pagamento, uso commerciale incompatibile o accettazione contrattuale nuova, fermarsi.

La foundation, incluso questo runbook e `git.deploymentEnabled=false`, deve essere prima integrata nella default branch. Il workflow `repository_dispatch` viene infatti caricato da `main` e la configurazione statica disabilita ogni auto-deploy durante il collegamento.

La foundation disabilitata della [PR #7](https://github.com/Emacore17/dnd-ai/pull/7) resta la baseline sicura. L'attivazione PR #12 ha superato CI e zero-deploy sulla PR, ma il merge ha prodotto un target Production; la relativa delivery è stata eliminata. La [PR #13](https://github.com/Emacore17/dnd-ai/pull/13) ha integrato il contenimento nel merge `61e5cbd2c3c1c258769fef6b3ad89853d7b7ca61` senza nuovi deployment. La [PR #14](https://github.com/Emacore17/dnd-ai/pull/14) ha integrato il guard nel merge `ee5f12916998cce6847fcc509d8f5e1fa05b1b9f`; le run `29335696502` e `29335856323` sono 5/5 verdi e non hanno prodotto deploy.

### Checkpoint provider del 2026-07-14

| Controllo | Stato verificato |
|---|---|
| Account e piano | identità esclusiva autorizzata `PASS` in forma redatta; Hobby personale/non commerciale |
| Progetto | `dnd-ai-web`; ID `prj_lR2dL0wwAvLmDzjvbpDkhS3V7xoQ`; scope `emacore17s-projects` |
| Sorgente | `Emacore17/dnd-ai`, repository ID `1299266814`, collegato |
| Build | Root Directory `apps/web`; framework Next.js; regione `fra1`; `buildCommand` Preview-only integrato con PR #14, ancora da verificare in una build remota Preview |
| Sicurezza/config | Fork Protection, system environment variables ed emissione OIDC abilitate; zero variabili applicative |
| Deployment Protection | Standard con SSO predefinito `all_except_custom_domains`; Trusted Source GitHub Actions exact-match configurata e riletta |
| Branch | `release/production` creata da `ef803add249d16ded6f94936c59531047c8a92fa` e protetta dalla Ruleset dedicata `18926413` senza bypass; Ruleset `main` `18877721` invariata; Production Branch Vercel riletta come `release/production` |
| GitHub App | installation ID condivisa `41079282`; `isAccessRestricted=false`; 8 repository accessibili: rischio residuo esplicitamente accettato, non blocker |
| Binding | provider remoto collegato; manifest unlinked/fail-closed integrato su `main` |
| Deploy | storico Production incidentale rimosso; guard PR #14 integrato senza deploy; primo CLI esplicito terminato sul limite file prima del record; corrente zero deployment e zero alias del progetto |

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
7. Conservare il contenimento integrato: `git.deploymentEnabled=false`, `source.autoDeploy=false`, binding `null` e `deploy:check`. Il guard Preview-only è integrato con PR #14; rileggere `autoExposeSystemEnvs=true` e confermare nuovamente zero deployment/alias. Il provider build deve eseguire `node scripts/assert-vercel-preview-build.mjs` senza `--allow-local` prima del normale build.
8. Non ripetere la precedente sequenza di attivazione. Un readback `productionBranch=release/production` e la policy `{"**": false, "main": true, "release/production": false}` non sono prove sufficienti: l'incidente PR #12 ha prodotto `target=production`. Il selector CLI `--target=preview` e il guard sono controlli distinti: il primo richiede Preview, il secondo rifiuta il completamento del build se i metadata effettivi non sono la tripla esatta `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`.
9. Il primo bootstrap CLI ha dimostrato un failure path precedente alla creazione della delivery: 773,1 MiB di sorgenti e un file `.turbo` da 156,5 MB hanno superato il limite Hobby di 100 MB per file; il comando è terminato sul limite file e la lista deployment è rimasta vuota. Integrare una sola `.vercelignore` nella root con denylist di cache/output locali. Non creare `apps/web/.vercelignore`, non spostare il cwd in `apps/web` e non aggirare i limiti con archivi o `--prebuilt`.
10. Prima del deploy reale, eseguire dalla root il comando Vercel `55.0.0` con `--target=preview --dry --format=json`, catturare il JSON e passarlo a `scripts/check-vercel-deploy-dry-run.mjs`. Il manifest deve riferire la root esatta e framework `nextjs`, includere gli input richiesti come file regolari con hash valido, usare soltanto mode file o directory zero-byte, restare entro 15.000 entry, 10 MiB complessivi e 5 MiB per file e non contenere discendenti cache, generati, privati o non relativi. Il dry-run non carica sorgenti e non crea deployment; qualunque failure blocca il bootstrap reale.
11. Il guard non impedisce al provider di creare inizialmente un deployment record con target errato. Dopo il dry-run valido, il bootstrap CLI resta diagnostico one-shot: usare `--no-wait`, inspect immediato e rimozione per deployment ID esatto su mismatch. Non usare `--skip-domain`, che Vercel ammette soltanto insieme a `--prod`; restano vietati anche `--prod`, `--prebuilt`, `promote`, custom target e `--build-env`/`--env` per sovrascrivere i metadata `VERCEL*`. Soltanto una Preview verificata consente di versionare nuovamente i binding e progettare la riattivazione automatica Git in una PR separata.

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

Soltanto dopo merge del contratto payload, CI verde, readback `autoExposeSystemEnvs=true` e conferma zero deployment, eseguire dalla root del monorepo il dry-run e poi il bootstrap diagnostico esplicito. Non usare `--cwd apps/web`: la Root Directory `apps/web` è già configurata sul progetto. Non usare `--prebuilt` o un archivio: il guard deve essere eseguito nel build remoto con i metadata di sistema effettivi e il payload sorgente deve restare ispezionabile.

```powershell
git fetch --prune origin
if ($LASTEXITCODE -ne 0) { throw "preview-bootstrap: git fetch failed" }

$currentBranch = git branch --show-current
if ($LASTEXITCODE -ne 0 -or $currentBranch -ne "main") { throw "preview-bootstrap: main branch required" }

$workingTree = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw "preview-bootstrap: git status failed" }
if ($workingTree.Count -ne 0) { throw "preview-bootstrap: clean working tree required" }

$localHead = git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw "preview-bootstrap: cannot resolve HEAD" }
$remoteHead = git rev-parse origin/main
if ($LASTEXITCODE -ne 0) { throw "preview-bootstrap: cannot resolve origin/main" }
if ($localHead -ne $remoteHead) { throw "preview-bootstrap: HEAD must equal origin/main" }

if (Test-Path apps/web/.vercelignore) { throw "preview-bootstrap: nested .vercelignore forbidden" }

$dryRun = corepack pnpm dlx vercel@55.0.0 deploy . `
  --project dnd-ai-web `
  --scope emacore17s-projects `
  --target=preview `
  --dry `
  --format=json `
  --yes
if ($LASTEXITCODE -ne 0) { throw "preview-bootstrap: Vercel dry-run failed" }

$dryRun | node scripts/check-vercel-deploy-dry-run.mjs
if ($LASTEXITCODE -ne 0) { throw "preview-bootstrap: source manifest rejected" }

function Remove-ExactDiagnosticDeployment {
  param([Parameter(Mandatory = $true)][string]$DeploymentIdentifier)

  corepack pnpm dlx vercel@55.0.0 remove $DeploymentIdentifier `
    --scope emacore17s-projects `
    --yes
  if ($LASTEXITCODE -ne 0) { throw "preview-bootstrap: exact containment removal failed" }
}

$deploymentUrlOutput = @(corepack pnpm dlx vercel@55.0.0 deploy . `
  --project dnd-ai-web `
  --scope emacore17s-projects `
  --target=preview `
  --no-wait `
  --yes)
if ($LASTEXITCODE -ne 0) { throw "preview-bootstrap: Preview deploy command failed" }
if ($deploymentUrlOutput.Count -ne 1) { throw "preview-bootstrap: expected one deployment URL" }

$deploymentUrl = ([string]$deploymentUrlOutput[0]).Trim()
if ($deploymentUrl -notmatch '^https://[a-z0-9-]+\.vercel\.app/?$') {
  throw "preview-bootstrap: invalid deployment URL output"
}
$deploymentHost = ([Uri]$deploymentUrl).Host

$inspectJson = corepack pnpm dlx vercel@55.0.0 inspect $deploymentUrl `
  --scope emacore17s-projects `
  --format=json
$inspectExitCode = $LASTEXITCODE

try {
  $deployment = $inspectJson | ConvertFrom-Json -ErrorAction Stop
} catch {
  Remove-ExactDiagnosticDeployment -DeploymentIdentifier $deploymentUrl
  throw "preview-bootstrap: invalid inspect JSON; exact URL removed"
}

if (
  $null -eq $deployment -or
  $deployment -is [System.Array] -or
  $deployment.id -isnot [string] -or
  $deployment.id -notmatch '^dpl_[A-Za-z0-9]+$'
) {
  Remove-ExactDiagnosticDeployment -DeploymentIdentifier $deploymentUrl
  throw "preview-bootstrap: invalid deployment ID; exact URL removed"
}
if ($deployment.url -ne $deploymentHost) {
  Remove-ExactDiagnosticDeployment -DeploymentIdentifier $deploymentUrl
  throw "preview-bootstrap: deployment identity mismatch; exact URL removed"
}
if ($deployment.target -ne 'preview') {
  Remove-ExactDiagnosticDeployment -DeploymentIdentifier $deployment.id
  throw "preview-bootstrap: target mismatch; exact ID removed"
}
if ($inspectExitCode -ne 0) {
  Remove-ExactDiagnosticDeployment -DeploymentIdentifier $deployment.id
  throw "preview-bootstrap: Preview reached a terminal failure; exact ID removed"
}

$finalInspectJson = corepack pnpm dlx vercel@55.0.0 inspect $deployment.id `
  --scope emacore17s-projects `
  --wait `
  --timeout=3m `
  --format=json
$finalInspectExitCode = $LASTEXITCODE

try {
  $finalDeployment = $finalInspectJson | ConvertFrom-Json -ErrorAction Stop
} catch {
  Remove-ExactDiagnosticDeployment -DeploymentIdentifier $deployment.id
  throw "preview-bootstrap: invalid final inspect JSON; exact ID removed"
}

if (
  $null -eq $finalDeployment -or
  $finalDeployment -is [System.Array] -or
  $finalDeployment.id -ne $deployment.id -or
  $finalDeployment.url -ne $deploymentHost -or
  $finalDeployment.target -ne 'preview'
) {
  Remove-ExactDiagnosticDeployment -DeploymentIdentifier $deployment.id
  throw "preview-bootstrap: final deployment identity mismatch; exact ID removed"
}
if ($finalInspectExitCode -ne 0 -or $finalDeployment.readyState -ne 'READY') {
  Remove-ExactDiagnosticDeployment -DeploymentIdentifier $deployment.id
  throw "preview-bootstrap: Preview not READY after bounded wait; exact ID removed"
}
```

Le tre asserzioni Git, l'assenza di un override annidato e il checker del manifest devono passare prima di caricare sorgenti o creare qualunque record provider. Il comando `--dry` usa lo stesso selector Preview ma non effettua upload né crea deployment; il checker fallisce chiuso su root/framework/input inattesi, budget superati o path non sicuri. Il bootstrap reale usa esattamente la `main` remota integrata, senza file locali o SHA divergenti. Per contratto CLI lo stdout del deploy contiene soltanto l'URL univoco: la procedura lo valida, esegue subito inspect JSON e lega URL, deployment ID e target. JSON, ID o identità non validi rimuovono l'URL originale esatto; soltanto dopo il match URL, target o stato non validi rimuovono il deployment ID esatto. Solo `target=preview` può entrare nell'attesa bounded; il JSON finale deve mantenere ID/URL/target e dichiarare esplicitamente `readyState=READY`, perché il timeout CLI può terminare con exit `0` mentre il deployment è ancora in coda o in build. Ogni altro stato viene rimosso per ID esatto. In caso di contenimento manuale, usare esclusivamente l'ID già verificato:

```powershell
corepack pnpm dlx vercel@55.0.0 remove <dpl_exact_id> `
  --scope emacore17s-projects `
  --yes
```

Non passare mai il nome progetto a `vercel remove`: quel comando opera su tutti i deployment del progetto. Se il target è Preview, attendere con inspect bounded e raccogliere i build log redatti: la build deve dimostrare il passaggio del guard prima di Next. Questo bootstrap non soddisfa da solo il requisito di deploy automatico e non sostituisce la Git Integration.

Il workflow `Staging smoke` esiste sulla default branch e reagisce all'action `vercel.deployment.ready` soltanto per project `dnd-ai-web`, ref `main`, environment `preview` e `state.type=success`; il dispatch Production dell'incidente è stato rifiutato. Il verifier fa checkout trusted di `main`, lega l'evento all'installation ID, ignora l'URL del payload e usa esclusivamente l'origin versionata. `/health` confermerà project, deployment, SHA, ref, repository, environment e regione.

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
- Guard build: local consente soltanto l'assenza completa dei tre metadata; il percorso provider strict rifiuta metadata mancanti/incoerenti e qualunque target diverso dalla tripla Preview esatta con exit `1` statico prima di Next.
- Payload CLI: se il dry-run fallisce, supera 15.000 entry/10 MiB totali/5 MiB per file, manca un input richiesto o include un path cache/generato/privato/non relativo, non eseguire il deploy reale. Correggere la denylist root e ripetere il dry-run; non aggiungere un ignore annidato, non cambiare cwd e non usare archivi.
- Target diverso da Preview: rimuovere immediatamente la sola delivery per deployment ID esatto, verificare URL/alias `404`, mantenere il job smoke rifiutato e lo stato versionato fail-closed; non passare il project name a `vercel remove` e non tentare promote/redeploy.
- Prova negativa remota: sospesa finché non esiste prima una Preview riuscita e un percorso che richieda esplicitamente `target=preview` e lo confermi tramite inspect.
- Smoke fallito: environment deployment GitHub rosso; non rendere `BL-079` READY.
- Provider indisponibile: retry bounded manuale; non cambiare regione o provider silenziosamente.
- Redeploy verificabile, da usare soltanto dopo la chiusura del target mismatch:

  ```powershell
  corepack pnpm dlx vercel@55.0.0 redeploy <deployment-id-or-url> --target preview --scope emacore17s-projects
  ```

  Il nuovo deployment ID deve riferire lo stesso commit e superare lo stesso smoke.
- Rollback staging: revert del commit noto tramite PR, merge protetto su `main`, nuova Preview e smoke. Non usare Instant Rollback come prova di Preview.

## Chiusura operativa

Registrare project/region/environment, SHA, deployment/run ID redatti, URL GitHub Actions, negative deploy e redeploy/revert in `docs/testing/BL-080_VERIFICATION.md`. Nessun valore production, token, cookie o screenshot con dati personali entra nel repository.

## Riferimenti ufficiali

- [Piano Hobby](https://vercel.com/docs/plans/hobby)
- [Git configuration e disattivazione deploy](https://vercel.com/docs/project-configuration/git-configuration)
- [Build Command](https://vercel.com/docs/builds/configure-a-build)
- [System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [CLI deploy e selector `--target`](https://vercel.com/docs/cli/deploy)
- [CLI remove per deployment ID o URL](https://vercel.com/docs/cli/remove)
- [Monorepo e Root Directory](https://vercel.com/docs/monorepos)
- [List Git namespaces by provider](https://vercel.com/docs/rest-api/integrations/list-git-namespaces-by-provider)
- [List Git repositories linked to namespace](https://vercel.com/docs/rest-api/integrations/list-git-repositories-linked-to-namespace-by-provider)
- [Generated branch URLs](https://vercel.com/docs/deployments/generated-urls)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Trusted Sources per GitHub Actions](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/reference/security/oidc)
- [Evento `deployment.ready`](https://github.com/vercel/repository-dispatch/blob/main/examples/ci-example/.github/workflows/smoke.yaml) e [state payload](https://github.com/vercel/repository-dispatch/blob/main/packages/repository-dispatch/src/types.ts)
