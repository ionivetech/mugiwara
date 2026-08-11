---
name: mugiwara-gates
description: Use after quality checks to enforce the quality gates - coverage (new >=90%, modified >=80%), build exit 0, and the Definition of Done. Binary verdicts with evidence, no negotiation, no silent pass when tooling is missing.
---

# Gates (Franky)

## Skip when

- No code changed: docs-only or README-only diff with zero production surface.
- Repo has no coverage tooling AND no test suite detected — record the skip, don't fake a verdict.

Gates are binary: pass or fail, with evidence. No negotiation.

## Coverage gate

1. Measure coverage with the project's existing tooling (jest --coverage, pytest --cov, go test -cover, cargo tarpaulin, etc.).
2. Thresholds: NEW files >= 90%, MODIFIED files >= 80%. Identify new/modified via git diff against the mission's base.
3. No coverage tooling exists → the gate CANNOT pass silently: report the gap, propose the minimal tooling addition, ask the user to add it or waive the gate explicitly. Record their decision.

## User-AC coverage override (per `mugiwara-testcases`)

When user acceptance criteria are declared, the coverage thresholds (90/80) apply only to unit-level new/modified code; the user-AC verdict governs ship-readiness. An e2e user suite that adds ~0% coverage is not a gate failure. The user-AC verdict must come from the quality wave evidence — user suites actually run — never asserted.

## Build gate

Run the project's build (or typecheck for interpreted stacks). Must exit 0. Capture the tail of output.

## Optional e2e gate (per `mugiwara-quality`)

Position: after quality checks, before the final gates below. Optional — it runs only when the quality wave triggered it (repo e2e setup AND changed-file e2e patterns, with consent by mode). Its outcome is recorded with evidence but never blocks PASS: a skipped or unrun e2e gate is logged, not a failure. The final verdict is still coverage + build + DoD.

## Definition of Done standing gate

A fixed cross-project bar, distinct from per-task acceptance criteria. Verdict PASS only when all hold:

- Correctness — the work does what the plan specifies.
- Quality — lint/format/unit checks clean, configs unweakened.
- Integration — the work fits the existing system (build/typecheck green).
- Docs — user-facing and internal docs updated where the change requires it.
- Ship-readiness — no blocker rows left open in the issues ledger.

## Verdict

PASS only when coverage AND build AND DoD all pass with evidence. Write the verdict to `.mugiwara/results/` listing thresholds measured, build exit, and each DoD item.

- PASS → Robin/Jinbe (Wave 7).
- Any FAIL → list exactly which files are under threshold and by how much, or which DoD item failed → Brook (Wave 8).

## Iron Law

GATES ARE BINARY. PASS or FAIL, each backed by evidence. No negotiation, no "almost passes".

## Red flags

- Missing coverage tooling turned into a silent pass.
- A PASS verdict with no captured evidence.
- Coverage measured against the wrong base (not the mission's diff).
- A FAIL negotiated downward to pass because the fix "isn't worth it".
- A gate waived without an explicit user decision recorded.
- A PASS on coverage and build while a DoD item fails.

All mean: the gate has not actually run. Report the gap or the fail, honestly.
