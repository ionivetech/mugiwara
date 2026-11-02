---
name: mugiwara-ship
description: Use at mission end — pre-launch checklist, feature flags, staged rollout, mandatory rollback plan. A plain verdict: ready for review, needs fixes, or not enough evidence.
---

# Ship Gate (Luffy)

## Skip when

- Not releasing: 0 deploys, rollouts, feature-flag flips, or user-facing changes.
- Internal-only change with zero production exposure.

The last gate before anything reaches a user. One of three verdicts, each backed by evidence: **Ready for review**, **Needs fixes**, or **Not enough evidence**. The default is **Not enough evidence** until every item is proven. Trigger: close or archive intent, which is Flow 9 in the stage table (`mugiwara-orchestration`, stages.md). Luffy owns it. It is the mission-end release decision only, never the per-stage bar (`mugiwara-quality` gate verdicts live in `flows/04-gates.md`).

## Pre-launch checklist

Run every item and record evidence; a checkbox ticked without output is a failed checklist.

1. Build: production build (or typecheck) exits 0.
2. Tests: full suite passes; coverage meets the configured thresholds.
3. Docs: README, changelog, and user-facing docs updated for the change.
4. Changelog: a version entry present naming the actual changes.
5. Secrets scan: no keys, tokens, or credentials in the tree or in the diff.
6. Backup: release-relevant data and config are backed up or restorable.

## Feature flags

1. Risky or unproven features ship behind a flag, off by default.
2. The flag is real configuration an operator can flip without a deploy.
3. Flag removal is a tracked follow-up task in the plan, not an afterthought.

## Staged rollout

1. Ship in stages: internal/canary first, then a small subset, then general.
2. Each stage has a pass criterion and an owner who checks it before the next stage.
3. Never promote to the next stage without the previous stage's evidence.
4. After the final stage: smoke-verify in production — the owner runs the pass criterion once more against prod. A rollout without a prod check is a claim.

## Mandatory rollback plan

1. No "Ready for review" verdict without a written rollback plan: what is rolled back, how, in what order, and who executes it.
2. Rollback must be as fast as the deploy (flag off, or revert + redeploy).
3. Prove the rollback path exists — a rollback that exists only on paper is not a rollback.

## Never

The crew never creates a PR, merges, or deploys — in any mode. Refused
commands: `gh pr create|merge|ready`, `gh release create`, `git merge`,
pushes to `main|master|production|release`, `--force` pushes,
`npm|yarn|pnpm publish`, `kubectl apply|delete|rollout`,
`terraform apply|destroy`, `docker push`, mutating `aws` calls. Enforced by
the PreToolUse guard (`hooks/pretool-guard.ts`) on tier 1, prose elsewhere.
Reads (`gh pr view`, `terraform plan`, `kubectl get`) and feature-branch
pushes stay allowed. The human runs the terminal step from the handed-over
branch and verdict.

## The verdict

1. The verdict is one of: **Ready for review** (every item proven), **Needs fixes** (a check failed: say which, who owns it, and where it re-enters the pipeline), or **Not enough evidence** (a check did not run or left no output: say which). Follow the label with one sentence a reader can act on. No "almost", no "ready with caveats": list deferred findings next to a Ready verdict instead.
2. Every checklist item cites evidence as a clickable link: `[command output](path)`, `[file](path)`, or a commit hash.
3. A critical finding at any stage → Needs fixes. Non-critical findings → list them, decide ship-with-tracking or fix-first, and record which.
4. Write ONE verdict file, `.mugiwara/missions/<mission>/flows/07-pr-verdict.md`; it survives archive as `pr-verdict.md`. The closing summary goes to `flows/06-closure.md` and links to it. Prose follows `_shared/references/prose-style.md`.

## Cleanup (after the terminal step)

Full procedure: `references/cleanup.md` — KEEP the audit trail + PR material, ARCHIVE-then-remove flow-stage artifacts via `mugiwara archive <mission>` (dry-run first; without CLI or npx, fold the same files by hand per `cleanup.md` and say so). Never touch anything outside `.mugiwara/`; the trail must survive the merge.

## Iron Law

NOT READY UNTIL PROVEN. Missing evidence means Not enough evidence. A release that cannot be rolled back means Needs fixes. A mission that ships without cleanup leaves a rotting `.mugiwara/`.

## Red flags

- A ticked checklist with no attached evidence.
- A rollback plan that exists only on paper or lacks an owner.
- A risky feature shipped without a flag, or a flag no operator can flip.
- A stage promoted on a claim instead of its pass criterion.
- A critical finding waived to keep the schedule.

All mean: hold the release. Fix the gap or record an explicit user decision to proceed anyway.
