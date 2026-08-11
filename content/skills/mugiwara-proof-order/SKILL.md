---
name: mugiwara-proof-order
description: Use when writing code — RED-GREEN-REFACTOR. Proof value from WHEN the test runs, not that it exists. One test = one behavior.
---

# Test-Driven Development

## Skip when

- No production code written: docs, config, or pure dependency bump.
- Refactor already fully covered by existing passing tests (record the reason).

A test proves nothing by existing. It proves nothing by passing. Its entire value lives in WHEN it runs and HOW it fails. TDD is the discipline that makes that proof real.

## When to use

Every task that writes production code — feature, bug fix, refactor, new function. The moment code leaves your keyboard, its test must already have failed first.

## Process

RED:

1. Write exactly one failing test for the next behavior. Name it plainly: `shouldRejectOrderWhenStockIsZero`, not `test2`.
2. Run it. WATCH it fail — for the intended reason (feature missing), not a typo, not a wrong assertion, not a broken harness.
3. A test that fails for the wrong reason proves nothing. If it red-screens on an import error, the proof is that you can't import, not that the feature is missing. Fix the harness, re-watch it fail correctly.
4. If the test passes on first run, it tests something that already exists. You wrote it after the code, or you tested the wrong thing. Stop, revert, redo.

GREEN:

5. Write the minimal implementation that makes the test pass. No extras, no "while I'm here", no unrequested polish.
6. Run again — green. Watch it go green; do not assume.
7. If you caught yourself writing implementation before its test, discard it and redo it test-first. "It's basically right" is not salvageable.

REFACTOR:

8. Now, and only now, improve structure. The test stays green the whole time — it is your safety net.
9. Each refactor step: change, run, green. Small steps, never a long unreachable stretch.

Green is a floor, not a finish. A green pass on a messy implementation is not done; it is the starting line for refactor. Never silence a failing test by deleting it or weakening its assertion — that converts the proof into a lie.

## Test pyramid

- ~80% unit tests — one behavior, in-memory, milliseconds, run constantly.
- ~15% integration tests — real boundaries (DB, filesystem, service) in isolated harnesses.
- ~5% end-to-end — the whole stack, sparse and precious.

Build bottom-up: the pyramid's point is that the slow, fragile, expensive layers carry as little as possible. If you write a test and it lands high in the pyramid, ask if a unit test can carry the same proof first. Flat is a defect: all-unit is fine, all-E2E is a treadmill, all-mocks is a hallucination.

## One test, one behavior

- Each test asserts one behavior and one reason for it. Split a two-assertion test that fails for two possible reasons — a failure should point at exactly one broken decision.
- Assert on real behavior: actual return values, real state, real side effects — not on that a mock was called.
- Mocks are for the edges — faking the slow or nondeterministic neighbor (clock, network, random). A mock that asserts internal call order instead of observable outcome is asserting the implementation, and locks your code into its own structure.

## Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll write the test after, then run it" | That run can only pass — it can never prove it catches the bug. You bought confidence, not proof. |
| "The test passed first try, that's fine" | It tested code that already existed. The RED step is the whole point; skipping it skips the proof. |
| "I'm sure this is broken, I'll just fix it" | No failing test first means no regression net, and you'll never know if you fixed the symptom or the cause. |
| "The failing test was a typo, let's just move on" | A red for the wrong reason is not red at all. Fix the harness, re-watch it fail for the intended reason. |
| "Mock it, faster than a real boundary" | A mock asserting your own call order verifies your imagination, not the software. |
| "Just weaken this assertion to pass CI" | You converted the proof into a lie and shipped it. Never. |
| "It's only one function, test is overkill" | The one function you skip is the one that breaks the deploy. |

## Red flags

- A test that passes without having failed first.
- A red that is a typo, import error, or wrong assertion — you never saw the intended failure.
- Implementation present before its test, "reused as reference".
- One test with a pile of unrelated assertions.
- Mocks verifying internal call sequences instead of outcomes.
- A failing test deleted or weakened to go green.
- A refactor run that never re-runs the suite, or a suite that fails and is refactored anyway.
- An 80/15/5 pyramid that is actually 5/15/80.

All mean: stop, go back to the last green, redo the step honestly.

## Verification

The evidence of a TDD task is the sequence, not the endpoint:

- the red run output (captured), showing the intended failure reason,
- the green run output (captured), after the minimal implementation,
- the refactor pass output, still green,
- the test file committed alongside the code it proves, never orphaned.

A report that shows only the final green run is an incomplete report. The checkpoint audits the sequence.
