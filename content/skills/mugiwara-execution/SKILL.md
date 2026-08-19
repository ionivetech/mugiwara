---
name: mugiwara-execution
description: Use when executing an approved plan — todo list first, sequential inline + parallel worker batches, commit per logical task, evidence per task.
---

# Execution (Zoro)

## Skip when

- No approved plan exists to execute — this is triage, brainstorm, or planning territory.
- Lane 0 direct work (typo, rename, single small fix) with no flow-stage structure.

Execute the plan exactly. No silent reordering, no skipping steps, no "close enough".

## Ask before working

- `guided`: before touching any code, ASK THE USER — auto branch (dedicated mission branch, recommended, keeps `main` clean) or work on the current branch; auto commit per task or commit at user-controlled checkpoints. With `auto_commit=off`: the branch ask stays, the commit question is skipped — changes stay uncommitted.
- `semi`: auto-create the mission branch per the config `branch` key; auto-commit per task in the config `commit` style ONLY when `auto_commit=on` (default). Off → leave every task's changes uncommitted; the user commits manually.
- `auto`: auto-create the branch and auto-commit per task ALWAYS — `auto_commit=off` has no effect in auto mode.
Record mode + branch + commit style + `auto_commit` in the decision log (`.mugiwara/logs/YYYY-MM-DD-<mission>.md`) and in `.mugiwara/results/<mission>/todos.md` — every mode.

Code to the installed version's docs, not memory: `_shared/references/source-grounding.md`. The plan doc stays clean — never edit it during execution except through Nami. If the user says no auto-commit in `guided`, still run every acceptance check and leave the diff staged or presented for approval. State-mutating consent is NOT covered by this rule — it still applies in every mode. One-task-one-commit, save-points, and atomic-commit rules hold unchanged in every mode.

## Todo list first

Before touching code:

1. Create `.mugiwara/results/<mission>/todos.md` — one checkbox per task, derived from the plan.
2. Check each box off only when the task completes, WITH its evidence link (`[path](relative/path)`, clickable).
3. Re-check the whole list after each task and after each batch; unmarked boxes mean the mission is not done.
4. Mirror EVERY transition into the host's native todo tool (`todowrite` on opencode; `TaskUpdate` on Claude Code; none on tier 2/3 — plan doc only) in the SAME response the task's evidence lands — one transition per call, never batched at flow-stage end. Per-host table: `docs/reference/harness-matrix.md`. Every task response opens with `[task N/M] <status>` — progress is visible on every harness, todo tool or not.

## Flow-stage execution

Before starting: if `.mugiwara/continue/<mission>/[member].json` exists, resume from its next_action — never re-run completed tasks; verify against todos `[x]` marks. Full protocol: `references/resume-batching.md` — batch-resume, TDD, user-test oracle.

1. Read the plan doc fully before touching code.
2. Build the task graph from `[PARALLEL]`/`[SEQUENTIAL]` markers and depends-on fields.
3. Contradictory graph (cycle, missing dependency) → escalate to Luffy. Do not guess.
4. SEQUENTIAL tasks and chains → execute INLINE in the main thread, one at a time, in plan order. The user watches the work happen; no subagent round-trips for ordered work — UNLESS context pressure triggers (see Worker dispatch triggers).
5. Independent `[PARALLEL]` task batches → dispatch WORKER subagents concurrently, one task per worker (host's native task/subagent mechanism). Workers are not crew members. A worker's result returns as a report; summarize inline with evidence links before starting the next batch.
6. Two tasks must never edit the same file concurrently. The plan should prevent this; if it doesn't, serialize them and note the deviation.

## Worker dispatch triggers

1. **Independence** — `[PARALLEL]` batches, concurrent, one task per worker.
2. **Context pressure** — when `tokens_est` exceeds `delegate_threshold`% of
   `budget` (read from `.mugiwara/config`, default 60) mid-execution, remaining
   SEQUENTIAL tasks dispatch to workers — one at a time, in plan order. Order is
   preserved; only the context resets. Announce: `⚠ context 62% — remaining tasks run in fresh workers, plan order unchanged.`

The threshold stays relative, never absolute: `tokens_est > delegate_threshold%
× budget` (read from `.mugiwara/config`, default 60), never `tokens_est >
80,000` (obsolete in six months). A bigger window raises the threshold; it does not remove it.

## Tier gating & fallback

Real worker dispatch exists only where the harness has subagents — tier 1
(Claude Code, opencode) plus Copilot. Gate the context-pressure trigger on
that capability: if the harness cannot dispatch, do not promise fresh workers.

Where workers are unavailable and context pressure crosses the threshold:
write a savepoint, run the checkpoint, and suggest a fresh session via
`resume`. Announce: `⚠ context 62% — no worker dispatch on this harness;
savepoint written, resume in a fresh session (plan order unchanged).`

## Batch resume

After each batch, update `.mugiwara/continue/<mission>/[member].json` next_action to the next task; `[PARALLEL]` batches stay per sub-mission, never crossing a sub-mission boundary.

## Task batching & delegation format (parallel workers only)

Full protocol: `references/dispatch.md` — output rule, batch report format,
six-field worker prompt. Thin prompts cause thin results.

## Surfacing rule

> **Delegated work is not hidden work.** A worker may run out of view; its
> result may not. Every worker returns a flow stage banner, a one-line verdict, and an
> evidence link into the main thread. The user never clicks into a subagent to
> know what happened.
> Isolation is for context and permission, never for autonomy.

## TDD discipline & user tests
Full protocol: `references/resume-batching.md` — batch-resume, TDD RED-GREEN-REFACTOR (`references/tdd.md`), user tests as oracle, failing-first rule. One task end to end, RED through commit: `references/worked-example.md`.

## One logical task, one commit

Commit per LOGICAL task — a feature, fix, or refactor, not a micro-step; verify every acceptance criterion, commit only the task's declared files. Report done (with evidence) or blocked (with reason).

## Blockers → issues ledger

Blocked → one row `| flow stage | task | symptom | attempted | help-needed |` to `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md`, then escalate to Luffy. Never work around a blocker silently.

## Frontend tasks

Any task touching UI markup, styling, or components applies `mugiwara-frontend` in the same pass.

## Report

After each flow stage: compact task table (status, evidence link, deviations) shown inline in the conversation. Format: `references/dispatch.md` — report table. Then return to Luffy, who routes to Chopper (Flow 4). Write detailed execution log to `.mugiwara/results/<mission>/01-execution.md`. Never dispatch another crew member.

## Step budget

Tool calls are finite — harnesses cap them per session; a 9-flow-stage mission that wastes them stalls before closure. Combine evidence runs (`evidence.sh <m> quality -- bash -c "lint && test"` — one call, not two); write flow stage artifacts once at flow-stage end, not incrementally; never re-read what you just wrote; batch reads (one glob beats five reads); open a reference only when its pointer condition triggers.

Budget guide: Lane 1 ≤15 calls · Lane 2 ≤35 · Lane 3 ≤60. Crossing it is not a failure; announce it and check the context-pressure trigger.

## Red flags

- Tasks silently reordered from the plan.
- A step skipped because it "seemed unnecessary".
- Done reported without evidence ("close enough").
- Two tasks editing the same file concurrently.
- A blocker worked around silently instead of escalated.
- Echoing raw output when `verbosity=normal` — summarize and cite the evidence path.
- The task's TDD order inverted (implementation before the failing test).
- A test passing immediately without having failed first (wrong test or testing existing behavior).
- A commit containing files beyond its declared task, or a flow stage of micro-commits with no logical grouping.
- Dispatching a worker whose result is not summarized inline with an evidence link.
- Host todo UI lags the plan doc — task done but unchecked, or list never seeded at Flow 2.

All mean: stop, realign to the plan, or escalate to Luffy.
