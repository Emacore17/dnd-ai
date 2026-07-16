---
status: active
owner: engineering
last_reviewed: 2026-07-16
last_verified_commit: 84357e83dbc173e9a3445b7df24a3b7e7157fbaa
source_refs:
  - docs/superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md
  - docs/TASKS.md
  - docs/CONTEXT.md
related_tasks:
  - GOV-004
  - BL-005
  - BL-079
  - BL-080
  - BL-081
  - QA-002
  - GATE-M0
code_refs:
  - scripts/lib/task-graph.mjs
test_refs:
  - tests/contracts/task-graph.test.mjs
  - tests/contracts/document-policy.test.mjs
  - tests/contracts/document-integrity.test.mjs
supersedes: null
---

# GOV-004 UI Dependency Unblocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riallineare specifica e backlog affinché `BL-079` diventi il solo P0 `READY`, separando la shell conversazionale in `BL-081` senza indebolire il blocco Vercel.

**Architecture:** Il change set è esclusivamente documentale e usa il task graph esistente come contratto strutturale. `BL-079` possiede fondazione visuale e shell statica; `BL-081` possiede la shell interattiva; `QA-002` consolida il browser harness; `BL-080` e `GATE-M0` conservano ogni evidenza remota.

**Tech Stack:** Markdown living docs, front matter YAML, Mermaid, task graph/document policy Node, pnpm `11.13.0`, GitHub PR protetta.

## Global Constraints

- Corsia `FAST`: nessun runtime, workflow, dipendenza, lockfile, contratto generato o configurazione cambia.
- Eseguire un solo gate finale `corepack pnpm@11.13.0 verify:docs`.
- Non modificare file sotto `apps/web`, `.github`, `infra/deployment` o configurazioni Vercel.
- Non creare deployment, release, Production, binding provider o readback Vercel.
- Conservare `BL-080` in `BLOCKED/50%/PARTIAL` e `GATE-M0` non eseguibile.
- Rendere `READY` soltanto `BL-079`; `BL-005`, `BL-081` e `QA-002` restano `BACKLOG` finché le dipendenze non sono `DONE`.
- Ogni consumer UI conserva il riferimento diretto a `BL-079`, allo studio UX/UI e ad ADR-0001.
- Stato e documentazione terminali appartengono allo stesso candidato; nessun commit di sola evidenza.

## File map

| File | Responsabilità nel change set |
|---|---|
| `docs/MVP_SPEC.md` | Backlog normativo BL-079/BL-081 e dipendenze canoniche |
| `docs/TASKS.md` | Card GOV-004, BL-079, BL-081, consumer, dashboard e registro attivo |
| `docs/adr/0001-mobile-first-conversational-ui.md` | Decisione accepted sulla separazione local/remote |
| `docs/product/UX_UI_DESIGN.md` | Ownership dei due slice UI e del browser harness |
| `docs/CONTEXT.md` | Baseline post PR #25, stato corrente, rischi e prossima azione |
| `docs/TRACEABILITY.md` | Requisiti UX mappati a BL-079/BL-081/QA-002 |
| `docs/CHANGELOG.md` | Decisione e sblocco corrente |
| `docs/README.md` | Indice della nuova design spec e del piano |
| `docs/superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md` | Design approvato, invariato salvo metadata realmente necessari |
| `docs/superpowers/plans/2026-07-16-gov-004-unblock-ui-dependencies.md` | Piano esecutivo e checklist |

---

### Task 1: Registrare GOV-004 come lavoro attivo

**Files:**
- Modify: `docs/TASKS.md`
- Modify: `docs/CONTEXT.md`

**Interfaces:**
- Consumes: branch `codex/gov-004-unblock-ui`, base `9132cbd24ee6a0f8b1cc6c875114d86dc70804b5`, design `84357e83dbc173e9a3445b7df24a3b7e7157fbaa`.
- Produces: card `GOV-004` e registro attivo `IN_PROGRESS/25%/PARTIAL` prima delle modifiche normative.

- [ ] **Step 1: aggiungere la card GOV-004**

Inserire dopo `GOV-003`:

```markdown
### GOV-004 — Sblocco local-first della fondazione UX/UI

- **Stato:** `IN_PROGRESS`
- **Progresso:** `25%`
- **Esito test:** `PARTIAL`
- **Contesto verificato:** `YES` — commit/SHA: `84357e83dbc173e9a3445b7df24a3b7e7157fbaa`; data: `2026-07-16`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** GOV-001, GOV-002, GOV-003, DOC-ARCH-001
- **Riferimenti obbligatori:** design GOV-004 approvato; `docs/MVP_SPEC.md` §31; `docs/product/UX_UI_DESIGN.md` §14; ADR-0001
- **Obiettivo:** Separare fondazione visuale, shell conversazionale e smoke remoto per sbloccare lo sviluppo locale senza aggirare BL-080.
- **Deliverable:** Specifica, backlog, ADR, studio UX, contesto e tracciabilità concordano su BL-079/BL-081/QA-002 e sul gate remoto BL-080/GATE-M0.
- **Criterio di accettazione:** `BL-079` è il solo P0 READY; il grafo è aciclico; nessun criterio locale richiede staging; BL-080 resta bloccato.
- **Test obbligatori prima di `DONE`:**
  - [ ] `pnpm verify:docs` passa con task graph, Mermaid, metadata, link e secret scan.
  - [ ] Spec, task, ADR-0001 e studio UX descrivono la stessa matrice dei consumer.
  - [ ] Il diff non contiene file Vercel, workflow, runtime o lockfile.
- **Documentazione e contesto:** design/piano GOV-004; MVP spec; TASKS; CONTEXT; TRACEABILITY; CHANGELOG; UX/UI; ADR-0001.
- **Evidenze di chiusura:** candidate/PR `PENDING`; `verify:docs` `NOT_RUN`; migration/eval/trace ID `N/A`.
- **Note, rischi o bloccanti:** Nessuna azione provider. BL-080 e GATE-M0 restano invariati nel loro stato remoto.
```

- [ ] **Step 2: sostituire il registro attivo**

Usare:

```yaml
active_task: GOV-004
last_completed_task: DOC-ARCH-001
next_ready_task: none
status: IN_PROGRESS
progress: 25
started_at: 2026-07-16T14:15:52+02:00
candidate_at: null
cycle_target_minutes: 15
cycle_actual_minutes: null
updated_at: 2026-07-16T14:15:52+02:00
agent: Codex development agent
git_branch: codex/gov-004-unblock-ui
base_commit: 9132cbd24ee6a0f8b1cc6c875114d86dc70804b5
candidate_head: null
spec_sha256: d07620bb477a50bf8309c6c24729baaaa45a4a29499e624741a5fcdaa514a329
context_verified: true
test_status: PARTIAL
```

Nel diario registrare il design approvato, la corsia FAST, l'assenza di azioni esterne e il prossimo passo “riallineare spec/ADR/UX”.

- [ ] **Step 3: controllare che la branch contenga soltanto design, piano e metadata attivi**

```powershell
git status --short
git diff --check
```

Expected: solo documenti GOV-004; exit `0`.

---

### Task 2: Aggiornare le fonti normative di prodotto e design

**Files:**
- Modify: `docs/MVP_SPEC.md`
- Modify: `docs/adr/0001-mobile-first-conversational-ui.md`
- Modify: `docs/product/UX_UI_DESIGN.md`

**Interfaces:**
- Consumes: decisione approvata in `docs/superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md`.
- Produces: definizioni normative univoche di `BL-079`, `BL-081`, `QA-002` e smoke remoto.

- [ ] **Step 1: sostituire la riga BL-079 e aggiungere BL-081 nella spec**

Usare queste righe in §31:

```markdown
| BL-079 | Frontend UX | Come giocatore voglio una fondazione visuale mobile semplice e premium fin dal primo slice. | Design system core, token, primitive accessibili e shell statica. | P0 | BL-001, BL-002, QA-001 | shadcn/Radix `new-york`, token, Geist/Lucide, target touch e shell 320–430 px/desktop adattiva passano build e verifica locale senza dipendere da staging. | S |
| BL-080 | Platform | Come team voglio una preview/staging M0 isolata e riproducibile. | Provider/secret manager, provisioning, deploy automatico e smoke iniziale dei runtime deployabili. | P0 | BL-002, BL-003 | Preview/staging usa config e secret separati, non contiene dati production, pubblica URL/evidenza redatti e supera lo smoke dei runtime disponibili con rollback documentato. | M |
| BL-081 | Frontend UX | Come giocatore voglio una shell conversazionale interattiva e affidabile. | Wrapper conversazionali, drawer, stati fixture e motion layer. | P0 | BL-079, QA-001 | AI Elements selettivi non sostituiscono TurnView/REST+SSE; shell 320–430 px e desktop, focus, reduced motion, overflow e bundle senza Rive iniziale superano smoke locale. | M |
```

Aggiungere `BL-081` a `related_tasks` e aggiornare `last_reviewed`/`last_verified_commit` al design head `84357e83dbc173e9a3445b7df24a3b7e7157fbaa`.

- [ ] **Step 2: estendere ADR-0001 senza cambiare la decisione visuale**

Aggiungere alla sezione Decisione:

```markdown
8. La fondazione visuale e la shell conversazionale sono verificabili in locale e CI e non dipendono dalla disponibilità di preview/staging. `BL-080` possiede provisioning e smoke remoto; `GATE-M0` ricompone entrambe le evidenze prima dell'uscita da M0.
```

Aggiornare `related_tasks` con `GOV-004`, `BL-081`, `QA-002`; sostituire i test ref planned con ownership coerente, senza dichiarare file già implementati.

- [ ] **Step 3: dividere §14 dello studio UX/UI**

Sostituire il piano monolitico con:

```markdown
`BL-079` produce nell'ordine:

1. `components.json`, Tailwind/PostCSS e token semantici;
2. font, icon policy, radius, spacing, focus e touch-target contract;
3. primitive form/feedback minime e shell statica mobile-first con dati fixture;
4. build, contract e verifica visuale locale dei breakpoint essenziali.

`BL-081` produce nell'ordine:

1. wrapper `GameConversation`, `NarrativeTurn`, `FreeActionComposer` e `GameDrawer`;
2. primitive AI Elements selettive senza `useChat` o trasporto parallelo;
3. stati idle/submitting/progress/completed/reconnect/error con fake deterministico;
4. Motion lazy/reduced e progressive enhancement desktop;
5. smoke locale per focus, touch target, overflow e contenuto equivalente senza motion;
6. decisione Rive: assente dal bundle iniziale salvo benchmark successivo.

`QA-002` consolida Playwright, accessibility, visual regression, device matrix e failure path dopo `BL-081`.
```

In §14.1 dichiarare che tutti i task UI dipendono direttamente da `BL-079`; soltanto `BL-027`, `BL-039`, `BL-040`, `BL-071`, `BL-072` e `QA-002` consumano anche `BL-081`. Spostare Motion/Rive da BL-079 a BL-081 nei paragrafi di ownership senza cambiare i requisiti visuali globali.

- [ ] **Step 4: verificare coerenza testuale mirata**

```powershell
rg -n "BL-079|BL-080|BL-081|QA-002|staging|Motion|Rive" docs/MVP_SPEC.md docs/adr/0001-mobile-first-conversational-ui.md docs/product/UX_UI_DESIGN.md
git diff --check
```

Expected: nessuna dipendenza BL-079→BL-080; BL-081 possiede shell/Motion; exit `0`.

---

### Task 3: Riallineare il grafo operativo

**Files:**
- Modify: `docs/TASKS.md`

**Interfaces:**
- Consumes: righe normative BL-079/BL-081 della spec.
- Produces: task graph aciclico con solo `BL-079` READY.

- [ ] **Step 1: ridurre la card BL-079**

Impostare:

```markdown
### BL-079 — Design system core e shell statica mobile-first

- **Stato:** `READY`
- **Progresso:** `0%`
- **Esito test:** `NOT_RUN`
- **Contesto verificato:** `NO` — commit/SHA: `—`; data: `—`
- **Priorità / stima:** `P0` / `S`
- **Dipendenze:** BL-001, BL-002, QA-001
```

Deliverable e test coincidono con la spec: shadcn/Radix, token, font/icon/touch contract, primitive minime, shell statica, build/contract/verifica locale. Eliminare AI Elements, Motion, Rive, drawer interattivi, state fixture e smoke staging dalla card.

- [ ] **Step 2: aggiungere BL-081 dopo BL-080**

Creare card `BACKLOG/0%/NOT_RUN`, P0/M, dipendenze `BL-079, QA-001`, con deliverable e criteri della spec. Citare `MVP_SPEC` §§8, 11.4, 21, 23.1, 26.8, 31; studio UX; ADR-0001; design GOV-004. Dichiarare Vercel, REST/SSE reali, auth e provider fuori scope.

- [ ] **Step 3: aggiornare i consumer**

Applicare questa matrice:

```text
BL-027: conserva dipendenze esistenti e aggiunge BL-081
BL-039: conserva dipendenze esistenti e aggiunge BL-081
BL-040: conserva dipendenze esistenti e aggiunge BL-081
BL-071: conserva dipendenze esistenti e aggiunge BL-081
BL-072: conserva dipendenze esistenti e aggiunge BL-081
QA-002: dipendenze QA-001, BL-081
GATE-M0: aggiunge BL-081 alle dipendenze esplicite
```

Non aggiungere BL-081 a identity/builder/form che consumano soltanto BL-079.

- [ ] **Step 4: aggiornare dashboard e navigazione**

Impostare il riepilogo:

```markdown
> **Task attivo:** `GOV-004 — Sblocco local-first della fondazione UX/UI`
> **Prossimo task READY:** `BL-079 — Design system core e shell statica mobile-first`
```

M0 passa da 19 a 21 task; con GOV-004 proposto DONE il progresso resta `57%` arrotondato. Aggiornare ogni conteggio totale derivato che il task graph segnala come stale.

- [ ] **Step 5: eseguire il task graph**

```powershell
corepack pnpm@11.13.0 tasks:check
```

Expected: `task-graph: PASS`; nessun ciclo, ID orfano, status non valido o mismatch spec/task.

---

### Task 4: Chiudere contesto e tracciabilità

**Files:**
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/README.md`
- Modify: `docs/TASKS.md`

**Interfaces:**
- Consumes: task graph valido e SHA-256 aggiornato di `docs/MVP_SPEC.md`.
- Produces: candidato GOV-004 `DONE/100%/PASSING`, delivery PENDING e BL-079 READY.

- [ ] **Step 1: calcolare fingerprint e timestamp**

```powershell
$specSha = (Get-FileHash docs/MVP_SPEC.md -Algorithm SHA256).Hash.ToLowerInvariant()
$candidateAt = Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"
$candidateAt
$specSha
```

Registrare valori reali, non esempi.

- [ ] **Step 2: aggiornare CONTEXT**

Registrare:

- DOC-ARCH-001 integrato tramite PR #25, merge `9132cbd24ee6a0f8b1cc6c875114d86dc70804b5`, CI `29496032461` 5/5;
- GOV-004 proposta branch-local terminale, BL-079 solo READY;
- BL-080 ancora BLOCKED e GATE-M0 non eseguibile;
- CTX-R04 mitigato dalla decomposizione local-first;
- CTX-R05 con Motion/Rive posseduti da BL-081 e QA-002;
- CTX-R11 limitato al gate remoto e non più bloccante per BL-079;
- prossima azione: integrare GOV-004, poi selezionare BL-079 e usare skill shadcn/Next.js/React per il piano funzionale.

- [ ] **Step 3: aggiornare TRACEABILITY**

Modificare le righe UX:

```text
UX-P0-01/04/07/08 -> BL-079 per foundation e shell statica; QA-002 per gate completo
UX-P0-02/03/05/06 -> BL-081 per conversazione, drawer, AI Elements e Motion
Browser harness -> BL-081, QA-002; QA-002 dipende QA-001/BL-081
Preview/staging -> BL-080/GATE-M0; non dichiarare più BL-079 BACKLOG
```

Aggiungere una riga governance che collega GOV-004, design/piano e `verify:docs` alla matrice di dipendenze.

- [ ] **Step 4: aggiornare CHANGELOG e README**

Nel changelog corrente registrare design approvato, separazione BL-079/BL-081, QA-002 e permanenza del freeze. Nell'indice collegare design e piano GOV-004 nella sezione documenti di processo, senza duplicare la specifica.

- [ ] **Step 5: portare GOV-004 allo stato terminale**

Nella card impostare `DONE/100%/PASSING`. Nel registro mantenere `active_task: GOV-004`, impostare `last_completed_task: GOV-004`, `next_ready_task: BL-079`, `status: DONE`, `progress: 100`, `candidate_head: 84357e83dbc173e9a3445b7df24a3b7e7157fbaa` e `test_status: PASSING`. Assegnare a `candidate_at` l'output letterale già acquisito in `$candidateAt`, a `cycle_actual_minutes` la differenza intera fra `started_at` e `$candidateAt`, a `updated_at` lo stesso `$candidateAt` e a `spec_sha256` il valore letterale di `$specSha`.

Nella card: `DONE/100%/PASSING`, evidenze `verify:docs` ancora descritte solo dopo l'esecuzione reale; delivery `PENDING` fino alla PR protetta. Non rendere READY altri task.

---

### Task 5: Verificare e committare il candidato FAST

**Files:**
- Verify: all changed Markdown files
- Commit: one coherent GOV-004 candidate

**Interfaces:**
- Consumes: metadata terminali e spec fingerprint reale.
- Produces: branch pulita pronta per una sola PR.

- [ ] **Step 1: eseguire il gate FAST**

```powershell
corepack pnpm@11.13.0 verify:docs
```

Expected: generated contract drift, metadata/freshness, link/path/anchor/section refs, ADR registry, Mermaid, task graph e secret scan tutti `PASS`; exit `0`.

- [ ] **Step 2: registrare soltanto evidenze appena osservate**

Aggiornare card GOV-004, diario, changelog e chiusura con `verify:docs exit 0`, numero documenti/modificati emesso dal comando, task graph/secret scan PASS e migration/eval/trace `N/A`. Poiché cambia solo evidenza testuale, rieseguire:

```powershell
corepack pnpm@11.13.0 verify:docs
```

Expected: exit `0` sul contenuto finale.

- [ ] **Step 3: self-review P0/P1**

```powershell
git diff --check
git diff --stat origin/main
git diff --name-only origin/main
git diff origin/main -- docs/MVP_SPEC.md docs/TASKS.md docs/CONTEXT.md docs/TRACEABILITY.md docs/product/UX_UI_DESIGN.md docs/adr/0001-mobile-first-conversational-ui.md
```

Controllare: nessun file Vercel/runtime/workflow/lockfile; un solo READY; nessun ciclo; BL-080 invariato come BLOCKED; nessun campo incompleto, secret o PII; zero finding P0/P1.

- [ ] **Step 4: committare il candidato**

```powershell
git add docs
git diff --cached --check
git commit -m "docs: unblock local-first UI foundation"
git status --short --branch
```

Expected: commit creato e working tree pulito.

---

### Task 6: Integrare tramite PR protetta

**Files:**
- No repository changes after the candidate unless CI finds a real P0/P1.

**Interfaces:**
- Consumes: branch pulita e identità GitHub `Emacore17`.
- Produces: GOV-004 raggiungibile da `origin/main`; BL-079 canonico READY.

- [ ] **Step 1: verificare identità e PR duplicate**

```powershell
if ((gh api user --jq .login) -cne "Emacore17") { throw "GitHub identity mismatch" }
gh pr list --head codex/gov-004-unblock-ui --state all --json number,state,url
```

Expected: identità esatta; nessuna PR o una sola riutilizzabile.

- [ ] **Step 2: push senza force e PR pronta**

```powershell
git push -u origin codex/gov-004-unblock-ui
gh pr create --base main --head codex/gov-004-unblock-ui --title "docs: unblock local-first UI foundation" --body "GOV-004 splits design-system core, conversational shell, browser harness, and remote smoke. BL-079 becomes the only READY P0 task. BL-080 remains blocked and no Vercel action is included."
```

- [ ] **Step 3: attendere e integrare senza bypass**

```powershell
gh pr checks --watch --interval 15
gh pr merge --merge
```

Expected: Quality, Tests, Security, Build artifact e `CI / Merge gate` success; nessun `--admin`.

- [ ] **Step 4: verificare la delivery derivata**

```powershell
$candidate = (git rev-parse HEAD).Trim()
git fetch origin main
git merge-base --is-ancestor $candidate origin/main
if ($LASTEXITCODE -ne 0) { throw "candidate not reachable from main" }
gh pr view --json state,mergeCommit,statusCheckRollup,url
```

Expected: PR MERGED, candidato antenato di `origin/main`, gate verde. Non creare commit post-merge di evidenza.

---

## Plan self-review checklist

- [x] Ogni requisito della design spec è assegnato a un task numerato.
- [x] La matrice consumer distingue foundation, conversazione, browser harness e remoto.
- [x] `BL-080` e `GATE-M0` conservano il blocco remoto.
- [x] Soltanto `BL-079` diventa READY.
- [x] Nessun file runtime/provider è previsto.
- [x] Il gate è proporzionato alla corsia FAST.
- [x] Timestamp, SHA spec, conteggi documentali e PR non sono inventati: vengono acquisiti durante l'esecuzione.
- [x] Non sono presenti campi incompleti, firme o riferimenti a implementazioni inesistenti.
