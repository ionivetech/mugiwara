---
name: mugiwara-execution
description: Use when executing an approved plan: todo list, parallel worker batches, one commit per logical task, split commits, bisect, evidence per task. Reuse ladder, stdlib before dependencies, no unrequested abstraction.
gate_artifact: flows/01-execution.md task table — execution evidence
---

# Execution (Zoro)

## Skip when
- No approved plan exists to execute: that is triage, brainstorm, or planning work.
- Direct work under 20 lines in one file (typo, rename) with no stage structure.

Execute the plan exactly. No silent reordering, no skipped steps, no "close enough". Stage number and owner: stage table (`mugiwara-orchestration`, stages.md).

## Ask before working
- `guided`: before touching code, ask the user: a dedicated mission branch (recommended, keeps `main` clean) or the current branch; commit per task or at checkpoints they control. With `auto_commit=off` the branch question stays and the commit question is skipped.
- `semi`: create the mission branch per the config `branch` key; commit per task in the config `commit` style only when `auto_commit=on`. Otherwise leave every task's changes uncommitted for the user.
- `auto`: create the branch and commit per task always; `auto_commit=off` has no effect.
Record mode, branch, commit style, and `auto_commit` in `decisions.md` and `flows/todos.md`. State-mutating consent applies in every mode. Code to the installed version's docs, not memory: `_shared/references/source-grounding.md`. Never edit the plan during execution; changes go through Nami.

## Todo list first
1. Create `.mugiwara/missions/<mission>/flows/todos.md`: one checkbox per plan task.
2. Check a box only when the task completes, with its evidence link (`[path](relative/path)`).
3. Re-check the list after each task and batch; an unchecked box means the mission is not done.
4. Mirror each transition into the host todo tool (`todowrite` on opencode, `TaskUpdate` on Claude Code, none on other hosts: plan doc only) in the same response the evidence lands, one transition per call. Per-host table: `docs/reference/harness-matrix.md`.
5. Luffy seeds the host todos as `pending` when the plan is approved; Zoro flips `pending`, `in_progress`, `completed` as each wave runs.

## Running the plan
Resume first: if `continue.json | continue-<member>.json` exists, start from its `next_action` and never re-run completed tasks. Details: `references/dispatch.md`.
1. Read the plan fully before touching code.
2. Build the task graph from `[PARALLEL]` / `[SEQUENTIAL]` markers and depends-on fields.
3. A contradictory graph (cycle, missing dependency) goes to Luffy; do not guess. A plan proven wrong mid-task (a missed root cause, a task impossible as written) gets an amendment proposal with evidence and the exact plan diff, approved by Nami: `references/amendments.md`.
4. Sequential tasks run inline in the main thread, in plan order. No worker round-trips for ordered work unless context pressure triggers.
5. Independent `[PARALLEL]` tasks go to concurrent workers, one task per worker. Workers are not crew members. Summarize each result inline with an evidence link before the next batch.
6. Two tasks never edit the same file at once. If the plan allows it, serialize them and note the deviation.
7. Source edits requested by another agent need a plan task or Luffy's approval. Without either, stop and ask Luffy.

## When workers are used
- Independence: `[PARALLEL]` batches, concurrent.
- Context pressure: `delegate_due` is `true` in `state.json`; the remaining sequential tasks go to fresh workers one at a time, in plan order. Tell the user: "Context is getting full; the remaining tasks run in fresh workers, same order."
- A worker returns a one-line verdict and an evidence link. Delegated work stays visible: banner and handoff stay in the main thread.
- Posture and mode never change mid-task; re-evaluate only at a stage or batch boundary, recorded in `decisions.md` with the evidence (`_shared/references/posture-routing.md`).

## TDD and user tests
Red, green, refactor: `references/tdd.md`. User-supplied tests are the oracle, failing first and never edited. One task end to end: `references/worked-example.md`.

## One logical task, one commit
Commit per logical task (a feature, fix, or refactor), not per micro-step. Verify every acceptance criterion; commit only the task's declared files. Subject: `feat(T4 scope):` or `fix(T4 scope):`, body only for the why, so plan and history stay traceable. With `auto_commit=off`, still print the exact message per task in the report. A TDD task commits its test with the code it proves. Commit, save-point, branch, worktree, and bisect rules: `references/git.md`.

## Blockers
Blocked: append one row (`| stage | task | symptom | attempted | help-needed |`) to `.mugiwara/missions/<mission>/blockers.md`, then escalate to Luffy. Never work around a blocker silently.

## Quality floor
Every touched file leaves cleaner than found: one refactor per touch, done while green, in its own commit. Use the project's own typecheck and dead-code tooling when it exists; never invent tooling. Before adding code: reuse a helper, then stdlib, then native, then an installed dependency, then one line, then new code.

## Frontend tasks
A task touching UI markup, styling, or components also applies `mugiwara-frontend`. Every interactive element carries a `data-testid` that the task's test asserts.

## Report
After each stage, show a compact task table inline (status, evidence link, deviations): `references/dispatch.md`. Append the detailed log as a `## execution (<task id>)` section of `.mugiwara/missions/<mission>/flows/01-execution.md`; never overwrite it. Then return to Luffy, who decides the next stage. Quiet stage: one result line.
- Lead each bullet with Decision, Action, Result, Evidence, or Blocker.
- Short bullets, tables over prose, evidence links relative to the repo root.

## Step budget
Tool calls are finite: lean lane at most 15 per session, standard 35, full 60. Combine runs, batch reads, write artifacts once, open a reference only when its pointer triggers. Prefer a `mugiwara` subcommand to an inline pipeline; a check longer than one line goes in a script.

## Red flags
- Closing a stage without its one-line summary, or padding it with prose.
- Plan steps reordered or skipped as "unnecessary".
- Done reported without evidence.
- Two tasks editing the same file at once.
- A blocker worked around silently.
- TDD order inverted, or a test that passed without failing first.
- A commit without its task id, beyond its declared files, or one of many micro-commits; the plan edited directly.
- A worker result not summarized inline with an evidence link.
- The host todo list lagging the plan doc.
- An interactive element missing `data-testid`.

All mean: stop, realign to the plan, or escalate to Luffy.
