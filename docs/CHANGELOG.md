---
status: active
owner: engineering
last_reviewed: 2026-07-13
last_verified_commit: 6cda07a60022665f321b48dd82fbeb1d9bef586f
source_refs:
  - docs/MVP_SPEC.md
  - docs/TASKS.md
related_tasks:
  - GOV-001
  - BL-001
  - BL-079
code_refs: []
test_refs:
  - AGENTS_VALIDATION.txt
supersedes: null
---

# Changelog documentale e contrattuale

## 2026-07-13

### Added

- Creati `docs/README.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md` e questo changelog per completare il bootstrap documentale di `GOV-001`.
- Creato `docs/product/UX_UI_DESIGN.md` con studio, gerarchia, wireframe, component mapping, motion system, criteri mobile/accessibilità/performance e piano di implementazione.
- Accettato ADR-0001 per shell conversazionale mobile-first, shadcn/ui su Radix, AI Elements selettivo, Motion e Rive gated.
- Aggiunto `BL-079` come task P0 di fondazione UX/UI prima delle feature giocatore.
- Creato il monorepo pnpm/Turborepo con `apps/web`, `apps/api`, `apps/worker` e sette package modulari per `BL-001`.
- Aggiunti checker e contract test per package boundaries e task graph, inclusi casi vietati che falliscono chiuso.
- Creati `docs/architecture/SYSTEM_OVERVIEW.md` e ADR-0002 sui confini del monorepo.

### Changed

- Corretti i link fra `AGENTS.md`, `docs/MVP_SPEC.md` e `docs/TASKS.md`; il path canonico del backlog è `docs/TASKS.md`.
- Allineata la specifica da desktop-first a mobile-first: 320 px minimo funzionale, 360–430 px baseline primaria, desktop come progressive enhancement.
- Resi normativi feed conversazionale, composer sticky, HUD on demand, target touch, safe area, tastiera virtuale, reduced-motion e stile contemporaneo non pseudo-medievale.
- Selezionati shadcn/ui `new-york` con Radix, AI Elements come presentational layer e Motion come motion layer; Rive resta opzionale e subordinato a performance gate.
- Estesi backlog, test UI e gate M0 per includere mobile matrix, accessibility, visual regression e performance trace.
- Resi espliciti `BL-079` e i riferimenti UX/ADR in ogni task che modifica UI; sostituite le dipendenze differite testuali con task/gate verificabili.
- Chiarita l’ownership: `BL-079` crea il browser harness minimo di feature, `QA-001` lo consolida senza blocco circolare.

### Verification

- Repository: Git `main`; implementation commit BL-001 `6cda07a60022665f321b48dd82fbeb1d9bef586f`.
- Spec baseline corrente: SHA `ed2c7882f94fa751e30dc6f1c73e279388891d7e0fcd686db30aad3b565096f6`; il run sul commit di implementazione usava `5bdf152a6c535470d239ad72772603d17d53cc82cc3c02f09bf44cbe1ef47e90` prima del solo aggiornamento front matter.
- Evidenze: `AGENTS_VALIDATION.txt`; `docs/testing/BL-001_VERIFICATION.md`.
