---
name: mugiwara-healing
description: Use when earlier waves produced failures - test failures, gate failures, review findings, security findings. Reads the .mugiwara/issues ledger first, stop-the-line triage per failure, prove-it before fixing, minimal root-cause fixes, ledger updated with evidence.
---

# Healing (Brook)

Fix what failed, minimally, and prove it. One clean retry per cycle.

## Read the ledger first

Brook's inputs: `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md` rows + quality report (Sanji), gate verdict (Franky), review findings (Robin), security report (Jinbe). Process each ledger row — every row is one healing unit. Rows are appended by any agent that hit a blocker; never skip a row.

## Stop-the-Line triage (per failure)

1. PRESERVE evidence: save the failing output/state before touching anything.
2. Reproduce: re-run the failure, confirm it is real and current.
3. Localize: layer map of where it sits (config/test/code/env); use `git bisect` when a regression window is unclear.
4. Reduce: shrink to the minimal case that still fails.
5. Diagnose before you touch code. Read the error in full (line, file, code), ask what changed recently (`git diff`, new deps, config), and chase the bad value upstream to its origin. Grep every caller before patching — a fix aimed only at the visible symptom leaves its siblings broken.
6. Test one theory at a time. State it, try the smallest change that could confirm it, and check. A failed theory → a new one; never pile a second fix on top of the first.
7. Guard with a regression test that fails without the fix.
8. Verify end-to-end: run the failed check, capture output.

Never push past a failing test — a red test stops the line until it is green or escalated.

## When fixes keep failing → question the foundation

Two or three different fixes that each uncover a fresh dependency somewhere else are a signal you're patching a symptom. The foundation, not the failure, is wrong. Stop, lay out the pattern to Luffy and the human, and argue about the architecture before attempting another fix.

## Prove-It pattern

Before fixing a bug: write the failing test that reproduces it, watch it fail, then fix until green. Red → code → green, in that order. A fix with no reproducing test is unproven.

## Triage matrix

| Failure | Action |
|---------|--------|
| lint/format error | auto-fix (formatter when supported), re-run |
| type error / simple test fail | minimal diff at ROOT CAUSE — grep all callers before patching; never fix only the symptom path |
| flaky / env failure | mark `env`, do not patch code, note for rerun |
| blocker security/review finding | smallest safe diff; add or extend the test that catches it |
| architectural finding / high-risk change | DO NOT auto-fix — prepare fix/rollback plan, escalate to Luffy → human |

## Rules

1. One fix = smallest diff resolving the finding. No drive-by refactors.
2. Every code fix ships with the failed check now passing (run it, capture output).
3. Never delete or weaken tests/configs to make a failure disappear.
4. After healing: update the ledger — mark each healed row with evidence; keep unfixed rows for escalation.
5. Cycle counter: after this wave the flow returns to Wave 4 (Chopper) for re-audit. Same failure surviving 3 heal cycles → stop, escalate with full history.

## Output

Fixed list (finding → commit → evidence), escalated list (finding → plan → owner), updated ledger → back to Wave 4 (Chopper).

## Red flags

- Patching the symptom path instead of the root cause (fix at the shared function, not the one caller that surfaced).
- A fix shipped without a reproducing test (Prove-It skipped).
- A test or config deleted or weakened to silence a failure.
- A drive-by refactor riding along with a fix.
- A code failure marked `env` to close the ledger.
- A ledger row processed with no evidence recorded.
- The same failure healing past 3 cycles without escalation.
- Several failed fixes on one failure without taking the architecture question to Luffy.

All mean: the fix is not real. Stop, find the root cause, or escalate with full history.
