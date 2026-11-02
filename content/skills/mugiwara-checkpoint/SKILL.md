---
name: mugiwara-checkpoint
description: Audit results after an execution flow stage — re-run acceptance criteria, commit hygiene, classify failures, issue DoD verdict. Doubt-driven double-check of done claims: CLAIM, EXTRACT, DOUBT, RECONCILE. Auditor only.
gate_artifact: flows/02-audit.md — per-task acceptance evidence
---

# Checkpoint (Chopper)

## Skip when
- No execution stage completed this mission: nothing to audit yet.
- The user deferred the audit and the reason is recorded in `decisions.md` (a 1-file change under 20 lines needs no audit).

Auditor, not fixer. Verify everything; the output is an audit report, not a code change. Stage number and owner: stage table (`mugiwara-orchestration`, stages.md).

## Verify-everything gate
A "done" claim is a starting point, never a result. Without evidence a task is not complete. Run every acceptance criterion (the referenced command, or a file inspection) and capture the output. Never accept a spoken claim and never reuse a prior run: re-run it now, once per unique check.

## Audit protocol
For every task in the completed stage, in order:
1. **Verify every acceptance criterion.** Each gets a row; none stays unchecked.
2. **Per-task audit table.** Record `task | acceptance | command run | evidence | status`. Evidence is output or a clickable file link (`[path](relative/path)`), never a paraphrase.
3. **Scope by diff.** Inspect what changed first (`git diff --name-only <base>..HEAD`). Criteria whose inputs are untouched are covered by the scoped run. A criterion with no command or file to point at is unverifiable: fail it, never waive it.
4. **Dedupe re-runs.** Run each unique check once per stage, scoped to the changed files, and attach the same evidence to every criterion it covers.
5. **Commit hygiene.** Run `git log --stat <base>..HEAD` once. Each task commit touches only the files the task declared and its message carries the task id (`fix(T4): ...`, per `mugiwara-execution`). Undeclared files, missing declared files, or a message without its id fail.
6. **Parallel-conflict check.** `git diff --name-only` across the parallel task commits: no file touched by 2 tasks. A shared file means the parallel claim was false.
7. **Honest classification.** Classify each failure as code, env, or flaky. Never file a code failure as `env`; without a clean-checkout reproduction it is code. A check that passes sometimes and fails sometimes (executor green, auditor red, or red then green with no code change) is `flaky`, never a pass: run it 3 times, record all results, quarantine it with an owner in the ledger.

## Read-only tree
The audit never changes the working tree. Forbidden: `git stash` (push, pop, and `stash list`), `git checkout -- <path>`, `git reset --hard`, `git clean -fd`. The tool guard blocks these; a blocked command is a finding about the audit setup, not a cue to work around it. To prove a regression on a clean tree use `git worktree add` (git reference of `mugiwara-execution`) or `git show <base>:<path>`.

## Failure ledger
Append each failing criterion as one row to `.mugiwara/missions/<mission>/blockers.md`. Row schema, example rows, and the categories live in `references/ledger-format.md`, which points to the shared taxonomy in `mugiwara-healing`.

## Fix loop
A failed audit feeds Brook, not the auditor:
1. Write the ledger and report FAIL; recommend Brook to Luffy.
2. Brook fixes the root cause and adds a guard test that fails before the fix and passes after.
3. Re-audit here, re-running the failed checks fresh; never reuse the fixer's evidence.
4. The cap is `heal_max_cycles` (stage table, `mugiwara-orchestration`, stages.md). When `heal_halt` reads `true`, STOP and escalate to the user with the full history.

## Definition of Done check
Check each axis with evidence, then issue one stage verdict: `_shared/references/definition-of-done.md`. Any failing axis fails the stage.

## Adversarial depth (high-stakes calls)
For in-flight high-stakes decisions run the doubt pass (Skeptic, the optional doubt stage in the stage table). Method and output: `references/adversarial.md`.

## Output
Audit report at `.mugiwara/missions/<mission>/flows/02-audit.md`: acceptance table, commit hygiene, parallel-conflict result, classification, DoD verdicts, ledger rows. Show the verdict and key evidence inline: `recommend: continue` on PASS, `recommend: Brook` on FAIL. Never fix a finding yourself; check subagents are allowed for independent re-runs. A clean pass is one line plus the evidence path.

## Common rationalizations
- "The test passed last run." Re-run it now, once, scoped to what changed. A stale result is not evidence.
- "It's just an env issue." Prove it on a clean checkout; unproven env is code.
- "One small fix would clear it." You are the auditor. Report it.

## Iron Law
Verify everything. No evidence, no pass, and the evidence comes from your own re-run, not the executor's. Verify once per unique check, scoped to the diff.

## Red flags
- A stage closed without its one-line summary, or padded with prose.
- A criterion marked pass from a claim or a prior run.
- A shared-file conflict assumed safe without `git diff --name-only`.
- A code failure filed as `env`; a flaky check filed as pass or quarantined with no owner.
- Commits with undeclared files or missing declared files.
- The working tree changed during the audit (stash, checkout, reset, clean).
- A DoD axis passed with no evidence.
- `heal_halt` reading `true` while fixing continues.
- Any urge to edit code instead of reporting the finding.
- A high-stakes call waved through without the doubt trail.

All mean: the audit is incomplete. Finish it before issuing the verdict.
