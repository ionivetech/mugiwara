---
name: mugiwara-root-cause
description: Use for debugging bugs, crashes, regressions — 4-phase: reproduce, localize, reduce, fix+guard. Stop-the-line on failures.
---

# Systematic Debugging

## Skip when

- Cause already known and reproduced, fix obvious, failure not intermittent.
- One-line revert or rollback resolves it with no investigation needed.

A failure is a stopping event, not a speed bump. Do not guess, do not patch. Walk the four phases in order; each gates the next.

## When to use

Any bug, unexplained failure, crash, or regression in code, tests, or config. When the cause is unknown, the fix is not obvious, or the failure is intermittent. Standalone discipline — use it before any fix ships, and escalate when a phase cannot complete.

Framework code from docs, not memory: `references/source-grounding.md`.

## Process

### Phase 1 — Reproduce

1. See it fail for the intended reason. Run the failing case as-is, capture the exact error, exit code, and input.
2. No repro = no debugging. If it will not reproduce, record the conditions, mark `unreproducible`, and move on — never fix a ghost.
3. Prove the failure is current: re-run on clean state, not a warm cache or half-applied change.
4. Stop-the-line: a red test or crash halts new work until it is green or escalated.

### Phase 2 — Localize

1. Bisect to the minimal surface. Narrow by time (`git bisect`), by layer (config/test/code/env), or by input (binary search over the failing data).
2. Read the full error before touching anything — line, file, and surrounding code.
3. Grep every caller of the suspect function. A symptom on one path may be a shared root.
4. Ask what changed recently: diff, new deps, config drift.
5. Name the layer and the likely function; say it out loud. If you cannot state a hypothesis, keep bisecting.

### Phase 3 — Reduce

1. Strip to the failing core. Delete branches, comments, unrelated code until the smallest case that still fails remains.
2. Preserve the repro, do not preserve the noise. If the reduced case passes, you over-deleted or misdiagnosed — restore and re-cut.
3. A reduced case makes the root cause visible and doubles as the seed for the regression test.

### Phase 4 — Fix + guard

1. Prove-it before fixing: write the failing test that reproduces the failure, watch it fail (red), then fix until green. Red → code → green, in that order.
2. Fix at the root cause, not the symptom. One minimal change where all callers route through; never a patch on the one caller that surfaced.
3. Risky fix → rollback prep first: snapshot the state, note the revert point, and record how to undo before you change anything.
4. Guard: add or extend the regression test that fails without the fix. A fix with no guard is unproven.
5. Re-run the failed check end-to-end and capture the output as evidence.

Escalate with full repro when a phase cannot complete — guesswork is not an outcome.

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "It works sometimes, must be flaky" | Intermittent failures have a root cause; reproduce harder, never shrug |
| "I know the fix, let's skip the test" | No red test = no proof. Write it first |
| "This one path is enough" | Other callers share the same root; patch the shared function |
| "A quick patch now, cleanup later" | Pile-on fixes bury the root cause |
| "The failure is environmental" | Prove it with a repro or mark `unreproducible` — do not assume |
| "Too risky, let's just roll back everything" | Rollback prep, not blanket revert — know the exact revert point |

## Red flags

- Fixing without a repro.
- Skipping the failing test and fixing straight into code.
- Patching the symptom path while siblings stay broken.
- The reduced case passing — over-deletion or a wrong diagnosis.
- A "flaky" label with no evidence.
- Multiple stacked fixes on one failure.
- A risky fix applied with no rollback prep.

All mean: the failure is not understood. Stop, walk the phases, or escalate with the repro.

## Verification

- Repro recorded: command, input, expected vs actual.
- Localization stated as a named layer + function.
- Reduction produces a minimal failing case.
- Fix is one root-cause change, guard test written, red confirmed before green.
- Failed check re-run and captured.
- Rollback point noted for any risky fix.
