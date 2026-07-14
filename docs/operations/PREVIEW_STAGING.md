---
status: draft
owner: engineering-and-operations
last_reviewed: 2026-07-14
last_verified_commit: aa9342daa63a93c6b8ff4d00963ed2ac6a6a9c9d
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
  - scripts/assert-vercel-preview-bootstrap-enabled.mjs
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
  - tests/unit/vercel-preview-bootstrap-policy.test.mjs
  - tests/security/vercel-preview-bootstrap-gate.test.mjs
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
- Fase corrente: freeze PR #16 integrato nel merge `aa9342daa63a93c6b8ff4d00963ed2ac6a6a9c9d`; CI PR `29343319207` e post-merge `29343526054` 5/5 verdi, zero deployment Vercel. Il dry-run resta valido, ma l'audit CLI `55.0.0` prova che `@vercel/client 17.6.4` elimina il target Preview prima della POST; il provider ha poi restituito Production. La regola first-deployment e `vercel/vercel#17069` sostengono l'ipotesi più forte, non una causa confermata. Non esiste ancora un fix/workaround maintainer. `source.manualDeployment.enabled=false` rende fail-closed il percorso approvato, ma non è enforcement provider contro un owner. Il grant condiviso resta invariato per decisione PO.

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

La foundation disabilitata della [PR #7](https://github.com/Emacore17/dnd-ai/pull/7) resta la baseline sicura. L'attivazione PR #12 ha prodotto un target Production poi eliminato. PR #13, #14 e #15 hanno integrato contenimento, guard e payload; [PR #16](https://github.com/Emacore17/dnd-ai/pull/16) ha integrato il freeze nel merge `aa9342d`, con run `29343319207`/`29343526054` 5/5 verdi e nessun deployment.

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
| Deploy | due record Production rimossi; PR #16 non ha creato deployment; readback project-scoped `dnd-ai-web` con zero deployment/alias |

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
6. Confermare che gli eventi `repository_dispatch` restino abilitati e mantenere commenti/bot opzionali. Non creare Deploy Hook o `VERCEL_TOKEN`.
7. Conservare il contenimento integrato: `git.deploymentEnabled=false`, `source.autoDeploy=false`, binding `null` e `deploy:check`. Il guard Preview-only è integrato con PR #14; rileggere `autoExposeSystemEnvs=true` e confermare nuovamente zero deployment/alias project-scoped per `dnd-ai-web`. Il provider build deve eseguire `node scripts/assert-vercel-preview-build.mjs` senza `--allow-local` prima del normale build.
8. Non ripetere le precedenti sequenze di attivazione. Il parser CLI conserva Preview, ma `@vercel/client` lo elimina dal body; sul progetto senza deployment il provider ha restituito Production. L'applicazione server del comportamento first-deployment è l'ipotesi più forte, non una causa confermata. Production Branch, policy Git e selector CLI non sono prove preventive del target.
9. La policy payload è integrata e il dry-run bounded è passato. Conservare la sola `.vercelignore` root, non creare `apps/web/.vercelignore`, non cambiare cwd e non aggirare i limiti con archivi o `--prebuilt`.
10. Il dry-run resta ammesso perché non carica sorgenti e non crea deployment. Deve usare Vercel `55.0.0`, root esatta, `--target=preview --dry --format=json` e `scripts/check-vercel-deploy-dry-run.mjs`; qualunque failure resta bloccante.
11. Ogni creazione manuale è vietata dal desired state `source.manualDeployment.enabled=false` e da `deploy:bootstrap:check`. La riapertura richiede un fix/workaround first-deployment Preview-only supportato dal provider e una PR separata che ripristini atomicamente i binding, mantenga `source.autoDeploy=false`, aggiunga containment testato e superi review/CI. Il gate non passa con soli `enabled=true` e binding `null`. Restano vietati `--prod`, `--prebuilt`, `promote`, `redeploy`, `--skip-domain`, custom target e override `--build-env`/`--env` dei metadata `VERCEL*`.

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

## Deploy e smoke — gate chiuso

Il secondo incidente ritira la procedura di deploy reale precedentemente documentata. Il comando pinned ha ricevuto `--target=preview`, ma il client lo ha omesso dalla POST e Vercel ha creato un record Production. Non eseguire un altro deploy reale, anche se dry-run, CI e readback risultano verdi; il solo `vercel deploy --dry` resta ammesso perché non crea record. Sono ammessi soltanto preflight, dry-run, readback e contenimento di un record già identificato.

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

corepack pnpm@10.34.5 deploy:bootstrap:check
if ($LASTEXITCODE -eq 0) {
  throw "preview-bootstrap: gate unexpectedly enabled; use a reviewed future runbook"
}
if ($LASTEXITCODE -ne 1) { throw "preview-bootstrap: invalid gate result" }
```

L'exit `1` con errore statico `vercel-preview-bootstrap: disabled` è l'esito atteso. Un exit `0` indica soltanto che qualcuno ha modificato il kill switch: non autorizza un deploy usando questa versione del runbook. Se un record compare per un trigger esterno, usare l'URL univoco già osservato per l'inspect, verificare project/ID/URL e rimuovere esclusivamente l'ID esatto:

```powershell
corepack pnpm dlx vercel@55.0.0 remove <dpl_exact_id> `
  --scope emacore17s-projects `
  --yes
```

Non passare mai il nome progetto a `vercel remove`: quel comando opera su tutti i deployment del progetto. Dopo il contenimento rileggere deployment/alias project-scoped e verificare l'origin `404`. Il secondo record è stato osservato `ERROR`, ma i build log non sono più disponibili dopo la rimozione: non attribuire l'errore al guard senza evidenza aggiuntiva.

Il workflow `Staging smoke` esiste sulla default branch e reagisce all'action `vercel.deployment.ready` soltanto per project `dnd-ai-web`, ref `main`, environment `preview` e `state.type=success`; il dispatch Production dell'incidente è stato rifiutato. Il verifier fa checkout trusted di `main`, lega l'evento all'installation ID, ignora l'URL del payload e usa esclusivamente l'origin versionata. `/health` confermerà project, deployment, SHA, ref, repository, environment e regione.

Smoke remoto manuale futuro, da non eseguire prima che siano soddisfatte entrambe le precondizioni: gate di creazione riaperto e Preview verificata; il token OIDC verrà creato e mascherato dal workflow:

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
- Payload CLI: se il dry-run fallisce, supera 15.000 entry/10 MiB totali/5 MiB per file, manca un input richiesto o include un path cache/generato/privato/non relativo, correggere la denylist root e ripetere soltanto il dry-run; non aggiungere un ignore annidato, non cambiare cwd e non usare archivi.
- Kill switch manuale: `source.manualDeployment.enabled=false` e `deploy:bootstrap:check` exit `1` sono obbligatori; qualunque divergenza blocca l'operazione e richiede review.
- Target diverso da Preview: rimuovere immediatamente la sola delivery per deployment ID esatto, verificare URL/alias `404`, mantenere il job smoke rifiutato e lo stato versionato fail-closed; non passare il project name a `vercel remove` e non tentare promote/redeploy.
- Prova negativa remota: sospesa finché non esiste prima una Preview riuscita e un percorso che richieda esplicitamente `target=preview` e lo confermi tramite inspect.
- Smoke fallito: environment deployment GitHub rosso; non rendere `BL-079` READY.
- Provider indisponibile o target mismatch: nessun retry manuale; non cambiare regione, provider o target silenziosamente. Monitorare `vercel/vercel#17069` e fonti ufficiali in sola lettura; mantenere il kill switch chiuso finché non esiste un workaround supportato.
- Redeploy: vietato finché il target mismatch non è risolto oppure non esiste una Preview valida.
- Rollback staging futuro: solo dopo riapertura del gate, revert del commit noto tramite PR, merge protetto su `main`, Preview verificata e smoke. Non usare Instant Rollback come prova di Preview.

## Chiusura operativa

Quando e solo quando una futura PR riaprirà esplicitamente il gate, registrare project/region/environment, SHA, deployment/run ID redatti, URL GitHub Actions, prova negativa e rollback/redeploy in `docs/testing/BL-080_VERIFICATION.md`. Con il gate corrente chiuso non eseguire tali prove remote. Nessun valore production, token, cookie o screenshot con dati personali entra nel repository.

## Riferimenti ufficiali

- [Piano Hobby](https://vercel.com/docs/plans/hobby)
- [Git configuration e disattivazione deploy](https://vercel.com/docs/project-configuration/git-configuration)
- [Build Command](https://vercel.com/docs/builds/configure-a-build)
- [System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [CLI deploy e selector `--target`](https://vercel.com/docs/cli/deploy)
- [Create Deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
- [Sorgente client: target Preview omesso prima della POST](https://github.com/vercel/vercel/blob/11f0cebacce81dfb713b3cb2d4622e49da0fb475/packages/client/src/deploy.ts#L36-L67)
- [Regola first-deployment Vercel](https://vercel.com/blog/default-production-domain)
- [Issue Vercel `#17069`](https://github.com/vercel/vercel/issues/17069)
- [CLI remove per deployment ID o URL](https://vercel.com/docs/cli/remove)
- [Monorepo e Root Directory](https://vercel.com/docs/monorepos)
- [List Git namespaces by provider](https://vercel.com/docs/rest-api/integrations/list-git-namespaces-by-provider)
- [List Git repositories linked to namespace](https://vercel.com/docs/rest-api/integrations/list-git-repositories-linked-to-namespace-by-provider)
- [Generated branch URLs](https://vercel.com/docs/deployments/generated-urls)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Trusted Sources per GitHub Actions](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/reference/security/oidc)
- [Evento `deployment.ready`](https://github.com/vercel/repository-dispatch/blob/main/examples/ci-example/.github/workflows/smoke.yaml) e [state payload](https://github.com/vercel/repository-dispatch/blob/main/packages/repository-dispatch/src/types.ts)
