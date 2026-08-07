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
