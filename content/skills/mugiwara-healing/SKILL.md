---
name: mugiwara-healing
description: Use when earlier waves produced failures - test failures, gate failures, review findings, security findings. Triages each failure, applies minimal root-cause fixes, prepares rollback for risky ones, re-runs failed checks.
---

# Healing (Brook)

Fix what failed, minimally, and prove it. One clean retry per cycle.

## Inputs

Failure ledger (Chopper), quality report (Sanji), gate verdict (Franky), review findings (Robin), security report (Jinbe).

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
4. Cycle counter: after this wave the flow returns to Wave 4 (Chopper). Same failure surviving 3 heal cycles → stop, escalate with full history.

## Output

Fixed list (finding → commit → evidence) and escalated list (finding → plan → owner).

## Red flags

- Patching the symptom path instead of the root cause (fix at the shared function, not the one caller that surfaced).
- A test or config deleted or weakened to silence a failure.
- A drive-by refactor riding along with a fix.
- A code failure marked `env` to close the ledger.
- The same failure healing past 3 cycles without escalation.

All mean: the fix is not real. Stop, find the root cause, or escalate with full history.
