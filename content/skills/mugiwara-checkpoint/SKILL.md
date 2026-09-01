---
name: mugiwara-checkpoint
description: Use after an execution flow stage to audit results — re-run acceptance criteria, verify commit hygiene, classify failures honestly, issue DoD verdict. Auditor only.
gate_artifact: flows/02-audit.md — per-task acceptance evidence
---

# Checkpoint

**Language:** Conversational language may be any language, but all `.mugiwara/missions/<mission>/` artifacts (`plan.md`, `flows/*`, `report.md`, `spec.md`, `decisions.md`, `blockers.md`, `review.md`, `state.json` and `continue.json`) are always English, one language only. Chat responses follow the user's language.

## Skip when

- No execution flow stage completed this mission — nothing to audit yet.
- User explicitly deferred the audit and recorded the reason in the decision log.

Auditor, not fixer. Trust nothing; verify everything. Output is an audit report, not a code change.

## Verify-everything gate

Subagents lie. No evidence = not complete. A "done" claim is a starting point, never a result. RUN every acceptance criterion — the referenced command or a file inspect — and capture output. Never accept a spoken claim, and never reuse a prior run's result: re-run it now, once per unique check.

## Audit protocol

For every task in the completed flow stage, in order:

1. **Verify every `Acceptance`.** The plan lists acceptance criteria per task; every one gets a row. No acceptance left unchecked.
2. **Per-task audit table.** For each `Acceptance` record `task | acceptance | command run | evidence | status`. Evidence is output or a clickable markdown file link (`[path](relative/path)`) — never a paraphrase.
3. **Scope by diff.** Before re-running, inspect what changed (`git diff --name-only <flow-base>..HEAD`). Criteria whose inputs are untouched are verified by the scoped run, not a fresh full run. An `Acceptance` with NO command or file to point at is unverifiable — fail it, never waive it.
4. **Dedupe re-runs.** Several criteria share the same command. Run each UNIQUE check ONCE per flow stage, scope it to the files this flow stage changed, attach the same evidence row to every criterion it covers. Do not re-run the same suite N times for N tasks.
5. **Commit hygiene.** Run `git log --stat <flow-base>..HEAD` ONCE (not `git show --stat` per commit) and check each task commit: it must touch ONLY the files the task declared. Undeclared files added or declared files missing = fail.
6. **Parallel-conflict check.** Run `git diff --name-only` across parallel task commits: no file may be touched by 2 tasks. A shared file means the parallel claim was false.
7. **Honest classification.** Classify every failure truthfully as code or env. Never file a code failure as `env`. If you cannot prove it is env (reproduce on a clean checkout), it is code.

## Failure ledger

Row schema + worked rows: `references/ledger-format.md`.

Append each failing criterion as one row to `.mugiwara/missions/<mission>/blockers.md`:

`| flow stage | task | symptom | attempted | help-needed |`

Category goes in `symptom` or `help-needed` as context. Categories: `test-fail` (test/lint/build command fails), `missing-impl` (criterion unverifiable, artifact absent), `parallel-conflict` (concurrent tasks modified shared state), `env` (environment, proven), `regression` (previously passing check now fails). Reuse the existing blocker ledger; create it only if absent.

## Heal loop

A failed audit feeds the healer, not the auditor. Flow:

1. Auditor writes the failure ledger and reports FAIL.
2. Healer fixes the ROOT CAUSE, not the symptom, and adds a guard test that goes red before the fix and green after it (red→green proof).
3. Flow returns here for re-audit. Cycle counter is state: `.mugiwara/missions/<mission>/state.json` records `heal_cycle / heal_max_cycles` (default max 3). When `heal_halt` reads `true`, STOP and escalate to the user with full history — a halt, not a red flag. Never re-run past `heal_max_cycles`.
4. Every re-audit re-runs the failed checks fresh — never reuse the healer's evidence.

## Definition of Done check

Per axis — `correctness`, `quality`, `integration`, `docs`, `ship-readiness` — each with evidence, then one flow-stage verdict. Full definitions: `_shared/references/definition-of-done.md`. Any FAIL axis → flow-stage verdict FAIL.

## Auditor only

Never edit code. Findings only. Any urge to fix a finding means the audit has stopped being an audit.

## Output

Audit report to `.mugiwara/missions/<mission>/flows/02-audit.md` (the gate_artifact): per-task acceptance table, commit hygiene, parallel-conflict, honest classification, DoD verdicts, ledger rows. Show the verdict and the key evidence inline in the conversation — PASS → next flow stage. FAIL → report + ledger to the healer. You never fix a finding yourself; you may spawn check subagents for independent re-runs.

## Common rationalizations

- "The test passed last run." → Re-run it now — once, scoped to what changed this flow stage. A stale result is not evidence, and a flow stage of duplicate runs is waste.
- "It's just an env issue." → Prove it on a clean checkout; unproven env is code.
- "One small fix would clear it." → You are the auditor, not the healer. Report it.

## Iron Law

TRUST NOTHING; VERIFY EVERYTHING. No evidence, no pass — and the evidence must be produced by your own re-run, not borrowed from the executor. Verify once per unique check, scoped to the flow stage's diff — thorough, not wasteful.

## Red flags

- An `Acceptance` marked pass from a claim or a prior run, without re-running the check.
- Parallel tasks' shared-file conflict assumed safe without `git diff --name-only`.
- A code failure filed as `env` to soften the report.
- Commits containing undeclared files, or missing declared files.
- A DoD axis passed with no evidence.
- `heal_halt` reading `true` with healing still continuing.
- Any urge to edit code instead of reporting the finding.
- Echoing raw output when `verbosity=normal` — summarize and cite the evidence path.

All mean: the audit is incomplete. Finish it before issuing the verdict.
