---
name: mugiwara-resume
description: Use when a mission is interrupted, context is lost or compacted, or a new session starts mid-mission - rebuild the full picture from .mugiwara/ state and continue from the exact point, never restart.
---

# Session Resume (Never Start Over)

The host AI can lose context — compaction, a new session, a crash. Disk state under `.mugiwara/` is the single source of truth. Rebuild the picture from disk, continue from the exact point, never restart.

## The state contract

What survives on disk and drives resume:

| File | Holds |
|------|-------|
| `.mugiwara/plans/YYYY-MM-DD-<mission>.md` | waves, tasks, acceptance criteria, decisions |
| `.mugiwara/results/<mission>-todos.md` | checkbox per task, checked = done with evidence |
| `.mugiwara/results/<mission>-trace.md` | every dispatch, outcome |
| `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md` | blocker rows with owners / heal state |
| `.mugiwara/logs/` | Luffy's decision log |

## Resume protocol

Read in this order, then act:

1. Plan doc → current wave, remaining tasks.
2. Todos → done/undone (unchecked box = not done, regardless of memory).
3. Trace → last completed step, last outcome.
4. Blocker ledger → open rows (they have owners / are mid-heal).
5. Re-derive position: wave N, tasks remaining, open blockers, heal counter.
6. State it in one line: "Resumed: Wave 5, tasks 5.3-5.7 pending, 1 blocker (env), heal counter 1." Then CONTINUE — do not re-verify completed waves unless the trace shows a failure.

## Rules

1. Never trust memory over disk — disk is truth.
2. Never re-run completed work — the trace proves it.
3. Never skip the resume read — guessing position = drift.
4. If disk state is missing/contradictory → escalate to Luffy to reconcile, do not invent state.

## Writing discipline

Update todos/trace AFTER every task, not at the end. Resume quality is proportional to log freshness. A stale log makes the next resume guess.

## Rationalizations + red flags

- "I remember where we were" → memory lies after compaction; disk is truth.
- "Re-running is safer" → wastes the mission; trust the trace.
- "I'll update todos later" → later never comes; resume breaks.
- Red flags: reading any file out of order, re-doing a wave the trace shows complete, skipping the blocker ledger, inventing state instead of escalating, a resume position stated without citing the files.
