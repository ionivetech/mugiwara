---
name: mugiwara-execution
description: Use when executing an approved wave-structured plan. Opens a todo list first, runs sequential tasks inline in the main thread, dispatches independent [PARALLEL] batches to worker subagents, commits per logical task, and verifies every acceptance criterion with evidence before reporting done.
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
4. SEQUENTIAL tasks and chains → execute INLINE in the main thread, one at a time, in plan order. The user watches the work happen; no subagent round-trips for ordered work.
5. Independent `[PARALLEL]` task batches → dispatch WORKER subagents concurrently, one task per worker (host's native task/subagent mechanism). Workers are not crew members. A worker's result returns as a report; summarize inline with evidence pointers before starting the next batch.
6. Two tasks must never edit the same file concurrently. The plan should prevent this; if it doesn't, serialize them and note the deviation.

## Delegation format (parallel workers only)

Sequential work runs inline — no delegation. For every `[PARALLEL]` worker you dispatch, the prompt includes all six fields:

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

## User tests as the oracle (per `mugiwara-testcases`)

1. User-supplied executable tests are the oracle: run them failing first, green at the end. Never edit or skip them — immutable gold; a change requires user consent + a ledger row.
2. Declarative user AC → write the project test file first, watch it fail for the intended reason, implement, re-run green. These tests are model-written, so the checkpoint re-runs them and they get extra scrutiny — they can encode the bug.

## One logical task, one commit

1. Follow the task's steps in order — TDD discipline above: failing test first (watch it fail), implement, watch it pass, refactor while green.
2. Verify every acceptance criterion; capture command output as evidence.
3. Commit per LOGICAL task: a task is a meaningful unit of work (a feature, a fix, a refactor) — not a micro-step. Adjacent trivial changes (typo, formatting, a one-line tweak) fold into the neighboring logical task's commit; never one commit per keystroke. If the plan slices tasks finer than a logical change, group adjacent tasks into one commit and note the grouping in the execution report.
4. Commit only the files that task declared. No task commingles with its neighbors.
5. Report done (with evidence) or blocked (with reason).

## Blockers → issues ledger

Blocked → write one row to `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md`:

| wave | task | symptom | attempted | help-needed |

Then escalate to Luffy. Never work around a blocker silently.

## Frontend tasks

Any task touching UI markup, styling, or components applies `mugiwara-frontend` in the same pass.

## Report

After each wave: task table (status, evidence pointer, deviations) shown inline in the conversation → the main thread hands off to Chopper (Wave 4). You never dispatch another crew member.

## Red flags

- Tasks silently reordered from the plan.
- A step skipped because it "seemed unnecessary".
- Done reported without evidence ("close enough").
- Two tasks editing the same file concurrently.
- A blocker worked around silently instead of escalated.
- The task's TDD order inverted (implementation before the failing test).
- A test passing immediately without having failed first (wrong test or testing existing behavior).
- A commit containing files beyond its declared task, or a wave of micro-commits with no logical grouping.

All mean: stop, realign to the plan, or escalate to Luffy.
