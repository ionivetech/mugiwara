---
name: mugiwara-ship
description: Use at mission end or before any release to run the ship gate - pre-launch checklist, feature flags, staged rollout, mandatory rollback plan. Binary GO/NO-GO verdict with evidence.
---

# Ship Gate (Luffy, Franky)

## Skip when

- Not releasing: no deploy, rollout, feature-flag flip, or user-facing change.
- Internal-only change with zero production exposure.

The last gate before anything reaches a user. Binary GO or NO-GO, each backed by evidence. Default is NO-GO until every item is proven.

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

## Mandatory rollback plan

1. No GO without a written rollback plan: what is rolled back, how, in what order, and who executes it.
2. Rollback must be as fast as the deploy (flag off, or revert + redeploy).
3. Prove the rollback path exists — a rollback that exists only on paper is not a rollback.

## Binary verdict

1. Verdict is GO or NO-GO. No "GO with caveats", no "almost".
2. Every checklist item cites evidence: command output, file, or commit.
3. A critical finding at any stage → NO-GO. Non-critical findings → list them, decide ship-with-tracking or fix-first, and record which.
4. Write the verdict and evidence to `.mugiwara/results/`.

## Cleanup (after the terminal step)

Once the branch is pushed and the PR material is written, clean `.mugiwara/` of
consumed intermediates. Never touch anything outside `.mugiwara/`.

**KEEP** (they are the audit trail and PR material):

- `config`
- `plans/YYYY-MM-DD-<mission>.md` — the clean plan doc
- `results/YYYY-MM-DD-<mission>-closure.md` — closure report
- `results/YYYY-MM-DD-<mission>-pr-verdict.md` — PR material
- `logs/lessons.md` and any cross-mission state (`backup/`, `manifest.json`)

**DELETE** (consumed or superseded):

- `spec/YYYY-MM-DD-<mission>.md` — consumed by planning
- `results/` wave reports — todos, audits, quality/gate/healing reports
- `review/` and `issues/` per-mission findings
- `logs/YYYY-MM-DD-<mission>.md` and mode-flip logs

Procedure: list the candidates first (dry-run), delete them, then report what
was removed and what stays. A mission is only closed after cleanup runs.

## Iron Law

NO-GO UNTIL PROVEN. Missing evidence is a NO-GO. A release that cannot be rolled back is a NO-GO. A mission that ships without cleanup leaves a rotting `.mugiwara/`.

## Red flags

- A ticked checklist with no attached evidence.
- A rollback plan that exists only on paper or lacks an owner.
- A risky feature shipped without a flag, or a flag no operator can flip.
- A stage promoted on a claim instead of its pass criterion.
- A critical finding waived to keep the schedule.

All mean: hold the release. Fix the gap or record an explicit user decision to proceed anyway.
