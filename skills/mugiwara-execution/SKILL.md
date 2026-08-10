---
name: mugiwara-execution
description: Use when executing an approved wave-structured plan. Opens a todo list first, builds a task graph, dispatches independent tasks concurrently, one task per commit, and verifies every acceptance criterion with evidence before reporting done.
---

# Execution (Zoro)

Execute the plan exactly. No silent reordering, no skipping steps, no "close enough".

## Todo list first

Before touching code:

1. Create `.mugiwara/results/<mission>-todos.md` — one checkbox per task, derived from the plan.
2. Check each box off only when the task completes, WITH its evidence pointer.
3. Re-check the whole list after each task and after each batch; unmarked boxes mean the mission is not done.

## Wave execution

1. Read the plan doc fully before touching code.
2. Build the task graph from `[PARALLEL]`/`[SEQUENTIAL]` markers and depends-on fields.
3. Contradictory graph (cycle, missing dependency) → escalate to Luffy. Do not guess.
4. Independent tasks → dispatch concurrently, one task per subagent (host's native task/subagent mechanism). Chains → strictly sequential; a task starts only when its dependencies report done with evidence.
5. Two tasks must never edit the same file concurrently. The plan should prevent this; if it doesn't, serialize them and note the deviation.

## Delegation format

Every subagent delegation prompt includes all six fields:

- TASK — the task body, verbatim from the plan.
- EXPECTED OUTCOME — what "done" looks like, concrete and checkable.
- REQUIRED TOOLS — commands and files the subagent will need.
- MUST DO — the steps in order, including the TDD failing-test-first step.
- MUST NOT DO — boundaries: files not to touch, configs not to weaken, no silent workarounds.
- CONTEXT — interfaces consumed/produced, related tasks, mission workspace paths.

A delegation prompt shorter than ~30 lines is too short — beef it up. Thin prompts cause thin results.

## One task, one commit

1. Follow the task's steps in order — TDD included: write the failing test first, run it (fail), implement, run again (pass).
2. Verify every acceptance criterion; capture command output as evidence.
3. Commit the task alone: only the files that task declared. No task commingles with its neighbors.
4. Report done (with evidence) or blocked (with reason).

## Blockers → issues ledger

Blocked → write one row to `.mugiwara/issues/<mission>-blockers.md`:

| wave | task | symptom | attempted | help-needed |

Then escalate to Luffy. Never work around a blocker silently.

## Frontend tasks

Any task touching UI markup, styling, or components applies `mugiwara-frontend` in the same pass.

## Report

After each wave: task table (status, evidence pointer, deviations) → hand to Chopper.

## Red flags

- Tasks silently reordered from the plan.
- A step skipped because it "seemed unnecessary".
- Done reported without evidence ("close enough").
- Two tasks editing the same file concurrently.
- A blocker worked around silently instead of escalated.
- The task's TDD order inverted (implementation before the failing test).
- A commit containing files beyond its declared task.

All mean: stop, realign to the plan, or escalate to Luffy.
