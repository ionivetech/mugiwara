# Sub-plan 02 — Execution isolation (Zoro)

**Parent:** `workflow-subplan` plan.md index row 2. File: `sub-plan/02-execution-isolation.md`.

**Scope:** Isolate Zoro execution per phase so `flows/02-execution.md` is not overwritten. Each phase writes to `flows/phase-NN/`.

## Key decisions

1. **Per-phase flows directory.** `flows/phase-01/` … `flows/phase-09/` each holds `02-execution.md`, `02-audit.md`, `03-quality.md`, `04-gates.md` for that phase. Master `flows/` holds only the current phase's pointer or is empty until merge.
2. **No flat overwrite.** `flows/02-execution.md` (flat) is deprecated for large campaigns; Zoro writes to `flows/phase-NN/02-execution.md` and updates `flows/todos.md` with `Phase NN` section.
3. **Parallel still sequential.** Each `flows/phase-NN/` is disjoint by construction — no cross-phase file overlap. T2 consumes T1's `sub-plan/01-*` surface, T3 consumes all — genuine sequentiality.
4. **Evidence stays per-phase.** `bun run gate` evidence per phase captured in `flows/phase-NN/02-execution.md`; final gate evidence merges at `sub-plan/03-*`.

## Architecture

```
sub-plan/01-phase01-*.md
      │
      ▼
Zoro Wave 1 → flows/phase-01/02-execution.md
Zoro Wave 2 → flows/phase-02/02-execution.md
...
Zoro Wave N → flows/phase-09/02-execution.md
      │
      └─→ sub-plan/03-archive-merge.md folds all into report.md
```

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Execution skill phase-isolated flows | T1 | `grep -c "flows/phase" content/skills/mugiwara-execution/SKILL.md` ≥1 |

## Task index

| # | Task | Files | Size | Depends | Acceptance |
|---|------|-------|------|---------|------------|
| T1 | Document phase-isolated flows in execution skill | `content/skills/mugiwara-execution/SKILL.md`, `references/execution-phase-flows.md` (if >120) | S | sub-plan/01 | skill grep ≥1, body ≤120, `validate-content` 0 |

## Detail tasks

**T1: execution phase-isolated flows**

- In `mugiwara-execution/SKILL.md`: add `## Large campaign → phase-isolated flows` rule: `flows/phase-NN/02-execution.md` per phase, `flows/todos.md` with `## Phase NN` sections, master `flows/` not overwritten.
- If body >120, move to `references/execution-phase-flows.md` with pointer.
- Commit `docs(execution): phase-isolated flows for large campaigns`.

## DoD

- Phase-isolated flows documented; `validate-content` green; body ≤120.
