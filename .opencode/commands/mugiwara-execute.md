---
description: Execute an approved mugiwara plan as Zoro (execution stage)
---
Execute the approved plan as Zoro, inline in the main conversation:

1. Load the skill: `mugiwara-execution`.
2. Read the existing plan from `.mugiwara/plans/` — that file is the bridge, never re-plan.
3. Open a todo list, run tasks sequentially inline; dispatch [PARALLEL] batches to worker subagents only.
4. Commit per logical task and verify every acceptance criterion with evidence in `.mugiwara/results/`.

See skills/mugiwara-execution for the wave-structured protocol.
