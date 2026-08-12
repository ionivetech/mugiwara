---
description: Execute an approved mugiwara plan as Zoro (execution stage)
---
Execute the approved plan as Zoro, inline in the main conversation:

1. **Entry protocol first** — read `.mugiwara/state.json`. No active mission → run Wave 0 triage before anything else. Foreign mission → stop, report owner. Base drift → stop, ask. Non-git → degrade to standard, say so once.
2. Load the skill: `mugiwara-execution`.
3. Read the existing plan from `.mugiwara/plans/` — that file is the bridge, never re-plan.
4. Open a todo list, run tasks sequentially inline; dispatch [PARALLEL] batches to worker subagents only.
5. Commit per logical task and verify every acceptance criterion with evidence in `.mugiwara/results/`.
6. **Return the result to Luffy — do not choose the next wave.**

See skills/mugiwara-execution for the wave-structured protocol.
