# Root Cause Process

A failure is a stopping event, not a speed bump. Do not guess, do not patch.
Walk the four phases in order; each gates the next.

## Phase 1 — Reproduce

1. See it fail for the intended reason. Run the failing case as-is, capture the exact error, exit code, and input.
2. No repro = no debugging. If it will not reproduce, record the conditions, mark `unreproducible`, and move on — never fix a ghost.
3. Prove the failure is current: re-run on clean state, not a warm cache or half-applied change.
4. Stop-the-line: a red test or crash halts new work until it is green or escalated.

## Phase 2 — Localize

1. Bisect to the minimal surface. Narrow by time (`git bisect`), by layer (config/test/code/env), or by input (binary search over the failing data).
2. Read the full error before touching anything — line, file, and surrounding code.
3. Grep every caller of the suspect function. A symptom on one path may be a shared root.
4. Ask what changed recently: diff, new deps, config drift.
5. Name the layer and the likely function; say it out loud. If you cannot state a hypothesis, keep bisecting.

## Phase 3 — Reduce

1. Strip to the failing core. Delete branches, comments, unrelated code until the smallest case that still fails remains.
2. Preserve the repro, do not preserve the noise. If the reduced case passes, you over-deleted or misdiagnosed — restore and re-cut.
3. A reduced case makes the root cause visible and doubles as the seed for the regression test.

## Phase 4 — Fix + guard

1. Prove-it before fixing: write the failing test that reproduces the failure, watch it fail (red), then fix until green. Red → code → green, in that order.
2. Fix at the root cause, not the symptom. One minimal change where all callers route through; never a patch on the one caller that surfaced.
3. Risky fix → rollback prep first: snapshot the state, note the revert point, and record how to undo before you change anything.
4. Guard: add or extend the regression test that fails without the fix. A fix with no guard is unproven.
5. Re-run the failed check end-to-end and capture the output as evidence.

Escalate with full repro when a phase cannot complete — guesswork is not an outcome.
