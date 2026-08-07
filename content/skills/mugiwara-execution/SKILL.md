---
name: mugiwara-execution
description: Use when executing an approved wave-structured plan. Splits tasks into parallel batches and sequential chains, dispatches subagents, verifies each task's acceptance criteria with evidence before reporting done.
---

# Execution (Zoro)

Execute the plan exactly. No silent reordering, no skipping steps, no "close enough".

## Ingestion

1. Read the plan doc fully before touching code.
2. Build the task graph from `[PARALLEL]`/`[SEQUENTIAL]` markers and depends-on fields.
3. Contradictory graph (cycle, missing dependency) → escalate to Luffy. Do not guess.

## Dispatch rules

- Independent tasks in a wave → dispatch concurrently, one task per subagent (host's native task/subagent mechanism).
- Dependency chains → strictly sequential; a task starts only when its dependencies report done with evidence.
- Two tasks must never edit the same file concurrently. The plan should prevent this; if it doesn't, serialize them and note the deviation.
- Give every subagent: its task body verbatim, the interfaces it consumes/produces, and the rule to stop at task boundaries.

## Per-task discipline

1. Follow the task's steps in order — TDD steps included (write the failing test first).
2. Verify every acceptance criterion; capture command output as evidence.
3. Report done (with evidence) or blocked (with reason). Blocked → escalate to Luffy. Never work around a blocker silently.

## Frontend tasks

Any task touching UI markup, styling, or components applies `mugiwara-frontend` in the same pass.

## Report

After each wave: task table (status, evidence pointer, deviations) → hand to Chopper.
