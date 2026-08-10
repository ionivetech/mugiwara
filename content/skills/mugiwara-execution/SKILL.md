---
name: mugiwara-execution
description: Use when executing an approved wave-structured plan. Opens a todo list first, builds a task graph, dispatches independent tasks concurrently, one task per commit, and verifies every acceptance criterion with evidence before reporting done.
---

# Execution (Zoro)

Execute the plan exactly. No silent reordering, no skipping steps, no "close enough".

## Ask before working

By mode (per `mugiwara-mode`):

- `guided`: before touching any code, ASK THE USER — auto branch (dedicated mission branch, recommended, keeps `main` clean) or work on the current branch; auto commit per task or commit at user-controlled checkpoints.
- `semi`/`auto`: auto-create the mission branch per the config `branch` key (default `feature/{type}-{issue}-{slug}`) and auto-commit per task using the config `commit` style (default conventional). No branch/commit ask. Record mode + branch + commit style in the decision log (`.mugiwara/logs/YYYY-MM-DD-<mission>.md`) and in `.mugiwara/results/<mission>-todos.md`.

The plan doc stays clean — never edit it during execution except through Nami. If the user says no auto-commit in `guided`, still run every acceptance check and leave the diff staged or presented for approval. State-mutating consent is NOT covered by this rule — it still applies in every mode. One-task-one-commit, save-points, and atomic-commit rules hold unchanged in every mode.

## Todo list first

Before touching code:

1. Create `.mugiwara/results/<mission>-todos.md` — one checkbox per task, derived from the plan.
2. Check each box off only when the task completes, WITH its evidence pointer.
3. Re-check the whole list after each task and after each batch; unmarked boxes mean the mission is not done.

## Wave execution

1. Read the plan doc fully before touching code.
2. Build the task graph from `[PARALLEL]`/`[SEQUENTIAL]` markers and depends-on fields.
3. Contradictory graph (cycle, missing dependency) → escalate to Luffy. Do not guess.
4. Independent tasks → dispatch WORKER subagents concurrently, one task per worker (host's native task/subagent mechanism). Workers are not crew members. Crew chains → strictly sequential; a task starts only when its dependencies report done with evidence.
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

## TDD discipline

The test's proof value comes from WHEN it runs, not that it exists. A test that passes on first run has proven nothing — it never demonstrated it could catch the bug.

1. **Proof order matters:** the failing test comes first, and you must SEE it fail for the intended reason (the feature is missing, not a typo or a wrong assertion). Only then write the minimal implementation that turns it green.
2. **No grace for untested code:** production code written before its test is not salvageable "as reference" — discard it and redo it test-first.
3. **Each test targets one behavior**, names it plainly, and asserts on real behavior rather than mocks where reasonably possible.
4. **Green is a floor, not a finish**: refactor while the test stays green; never silence a failing test by deleting or weakening it.

## One task, one commit

1. Follow the task's steps in order — TDD discipline above: failing test first (watch it fail), implement, watch it pass, refactor while green.
2. Verify every acceptance criterion; capture command output as evidence.
3. Commit the task alone: only the files that task declared. No task commingles with its neighbors.
4. Report done (with evidence) or blocked (with reason).

## Blockers → issues ledger

Blocked → write one row to `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md`:

| wave | task | symptom | attempted | help-needed |

Then escalate to Luffy. Never work around a blocker silently.

## Frontend tasks

Any task touching UI markup, styling, or components applies `mugiwara-frontend` in the same pass.

## Report

After each wave: task table (status, evidence pointer, deviations) → return to the main thread (routes to Chopper). You never dispatch another crew member.

## Red flags

- Tasks silently reordered from the plan.
- A step skipped because it "seemed unnecessary".
- Done reported without evidence ("close enough").
- Two tasks editing the same file concurrently.
- A blocker worked around silently instead of escalated.
- The task's TDD order inverted (implementation before the failing test).
- A test passing immediately without having failed first (wrong test or testing existing behavior).
- A commit containing files beyond its declared task.

All mean: stop, realign to the plan, or escalate to Luffy.
