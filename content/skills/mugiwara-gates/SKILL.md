---
name: mugiwara-gates
description: Use after quality checks — sonar-style gate, coverage thresholds, build exit 0, Definition of Done. Binary verdicts with evidence, no negotiation.
---

# Gates (Franky)

## Skip when

- No code changed: docs-only or README-only diff with zero production surface.
- Repo has no coverage tooling AND no test suite detected — record the skip, don't fake a verdict.

Gates are binary: pass or fail, with evidence. No negotiation, no "almost passes".

## Coverage gate

1. Measure coverage with the project's existing tooling.
2. Read thresholds from `.mugiwara/config` then `~/.mugiwara/config` for `coverage_new` and `coverage_modified`. Defaults: new ≥ 90%, modified ≥ 80%. Missing key or 0 = no threshold. Identify new/modified via git diff.
3. No coverage tooling → report the gap, propose minimal tooling, ask user to add or waive.
4. User-AC declared (per `mugiwara-testcases`): config thresholds apply to unit-level code only; user-AC verdict governs ship-readiness.

## Sonar-style quality gate

Franky reads evidence from prior wave reports (never re-runs
checks): Jinbe (`.mugiwara/review/<mission>-security.md`),
Robin (`.mugiwara/review/<mission>-review.md`), Sanji
(`.mugiwara/results/<mission>/03-quality.md`).
Evaluated: Vulnerabilities=0, Bugs=0, Code smells≤project
threshold, Coverage(new code)≥config threshold,
Duplications(new code)<3%, Security hotspots reviewed≥80%.
PASS when ALL pass — list each with actual + threshold.
Missing data → CANNOT pass: report gap, do not fake.

## Build gate

Run the project's build (or typecheck for interpreted stacks). Must exit 0. Capture the tail of output.

## Optional e2e gate (per `mugiwara-quality`)

Runs only when quality wave triggered it (repo e2e setup + changed-file e2e patterns, user consent). Skipped/unrun is logged, never blocks PASS. Final verdict: coverage + sonar + build + DoD.

## Definition of Done standing gate

A fixed cross-project bar. Full definitions: `_shared/references/definition-of-done.md`. PASS only when all hold:
- Correctness — work does what plan specifies.
- Quality — lint/format/unit clean, configs unweakened.
- Integration — fits existing system (build/typecheck green).
- Docs — user-facing and internal docs updated where change requires.
- Ship-readiness — no blocker rows in issues ledger.

## Verdict

PASS only when coverage AND sonar AND build AND DoD all pass with evidence. Write verdict to `.mugiwara/results/<mission>/04-gates.md`.
PASS → return to Luffy (routes to Robin/Jinbe). FAIL → list files under threshold + by how much → return to Luffy (routes to Brook). Never dispatch next wave yourself.

## Red flags

- Missing coverage tooling → silent pass.
- PASS verdict with no evidence.
- Coverage measured against wrong base.
- FAIL negotiated to pass.
- Gate waived without explicit user decision.
- PASS on coverage/build while DoD fails.
- Sonar PASS with unverified or faked data.
All mean: the gate has not actually run. Report the gap or the fail, honestly.
