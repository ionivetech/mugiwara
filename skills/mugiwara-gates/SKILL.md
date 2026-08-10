---
name: mugiwara-gates
description: Use after quality checks to enforce quality gates - test coverage thresholds (>=90% new files, >=80% modified files) and build validation. Binary verdicts with evidence, no negotiation.
---

# Gates (Franky)

Gates are binary: pass or fail, with evidence. No negotiation.

## Coverage gate

1. Measure coverage with the project's existing tooling (jest --coverage, pytest --cov, go test -cover, cargo tarpaulin, etc.).
2. Thresholds: NEW files >= 90%, MODIFIED files >= 80%. Identify new/modified via git diff against the mission's base.
3. No coverage tooling exists → the gate cannot pass silently: report the gap, propose the minimal tooling addition, ask the user to add it or waive the gate explicitly.

## Build gate

Run the project's build (or typecheck for interpreted stacks). Must exit 0. Capture the tail of output.

## Verdict

PASS only when both gates pass with evidence. Any FAIL → list exactly which files are under threshold and by how much → Brook.

## Iron Law

GATES ARE BINARY. PASS or FAIL, each backed by evidence. No negotiation, no "almost passes".

## Red flags

- Missing coverage tooling turned into a silent pass.
- A PASS verdict with no captured evidence.
- Coverage measured against the wrong base (not the mission's diff).
- A FAIL negotiated downward to pass because the fix "isn't worth it".
- A gate waived without an explicit user decision recorded.

All mean: the gate has not actually run. Report the gap or the fail, honestly.
