---
name: mugiwara-root-cause
description: Use for debugging bugs — debug, bug, crash, error, recurring, intermittent, track it down. 4-phase: reproduce, localize, reduce, fix+guard. Root cause hunt.
---

# Systematic Debugging

## Skip when

- Cause already known and reproduced, fix obvious, failure not intermittent.
- One-line revert or rollback resolves it with no investigation needed.

A failure is a stopping event, not a speed bump. Do not guess, do not patch. Walk the four phases in order; each gates the next.

## When to use

Any bug, unexplained failure, crash, or regression in code, tests, or config. When the cause is unknown, the fix is not obvious, or the failure is intermittent. Standalone discipline — use it before any fix ships, and escalate when a phase cannot complete.

Framework code from docs, not memory: `_shared/references/source-grounding.md`.

## Process

Full 4-phase walkthrough: `references/process.md` — reproduce, localize, reduce, fix+guard, escalation. 33 lines of detail; no step is optional.

A failure is a stopping event, not a speed bump. Do not guess, do not patch. Walk the four phases in order; each gates the next.

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
