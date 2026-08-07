---
name: mugiwara-workflow
description: Use at the start of any non-trivial mission to run the Mugiwara crew pipeline - Luffy triage first, then brainstorm, planning, execution, checkpoint, quality, gates, review, healing, and closure waves.
---

# Mugiwara Workflow

The Straw Hat pipeline: Wave 0 triage + Waves 1-9. Waves are phases of the mission, not files — Nami writes them into the plan doc, Zoro executes them.

## Workspace layout

Every mission creates and works inside `.mugiwara/` at the repo root:

```
.mugiwara/
├── spec/          # brainstorm output (before planning)
├── plans/         # plan docs — single source of truth from Wave 2
├── results/       # wave results: audit reports, test output, gate verdicts
├── review/        # review + security findings, code review reports
└── ...            # any other mission artifacts
```

The owning agent creates the folder it needs on first write. No mission artifacts go outside `.mugiwara/`.

## Wave 0 — Luffy Triage (always first)

Dispatch `luffy-orchestrator`. NEVER start directly with brainstorming or planning.
Luffy routes: vague idea / unclear requirements → Wave 1 first. Clear requirements or small well-understood change → Wave 2 directly, skip reason recorded in the plan.

## Waves

| Wave | Owner | Skill | Output |
|------|-------|-------|--------|
| 0 Triage | Luffy | mugiwara-orchestration | route decision + reason |
| 1 Brainstorm | Usopp | mugiwara-brainstorm | refined direction, options, recommendation |
| 2 Planning | Nami | mugiwara-planning | plan doc: waves/tasks/criteria, parallel markers |
| 3 Execution | Zoro | mugiwara-execution | implemented tasks with evidence |
| 4 Checkpoint | Chopper | mugiwara-checkpoint | audit report + failure ledger |
| 5 Quality | Sanji | mugiwara-quality | formatter/linter/test results |
| 6 Gates | Franky | mugiwara-gates | coverage + build verdict |
| 7 Review | Robin ∥ Jinbe | mugiwara-review + mugiwara-security | severity-tagged findings |
| 8 Healing | Brook | mugiwara-healing | fixes, then loop back to Wave 4 |
| 9 Closure | Luffy | mugiwara-orchestration | closure report appended to plan |

## Rules

1. Evidence over claims: no wave passes on assertion. The owning agent runs the checks and shows output.
2. No wave skipped without the reason recorded in the plan doc.
3. Heal loop is bounded: Wave 8 → Wave 4, max 3 cycles. After that, escalate to the human with full history.
4. Any agent may consult Luffy mid-flight (re-dispatch `luffy-orchestrator`) for decisions and escalations.
5. Wave 7 runs Robin and Jinbe in parallel.
6. The plan doc (`.mugiwara/plans/YYYY-MM-DD-<mission>.md`) is the single source of truth from Wave 2 onward.
7. Frontend-touching tasks in Wave 3 must apply `mugiwara-frontend` in the same pass.
