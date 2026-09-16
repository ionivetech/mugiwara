---
name: mugiwara-gates
description: Use after quality checks — sonar-style gate, coverage thresholds, build exit 0, Definition of Done. Binary verdicts with evidence, no negotiation.
gate_artifact: flows/04-gates.md verdict — coverage + build + DoD evidence
---

# Gates (Franky)

**Language:** Conversational language may be any language, but all `.mugiwara/missions/<mission>/plan.md` artifacts (`plan.md`, `flows/*`, `report.md`, `spec.md`, `decisions.md`, `blockers.md`, `review.md`, `state.json` and `continue.json`) are always English, one language only. Chat responses follow the user's language.

## Skip when

- No code changed: docs-only or README-only diff with zero production surface.
- Repo has no coverage tooling AND no test suite detected — record the skip, don't fake a verdict.

Gates are binary: pass or fail, with evidence. No negotiation, no "almost passes".

## Coverage gate

1. Measure coverage with the project's existing tooling.
2. Read thresholds from `.mugiwara/config` then `~/.mugiwara/config` for `coverage_new` and `coverage_modified`. Defaults: new ≥ 85%, modified ≥ 90%. Policy may raise, never lower. Missing key or 0 = no threshold. Identify new/modified via git diff.
3. No coverage tooling or no test suite → record a SKIP with its reason. Never a fake pass; propose minimal tooling, ask user to add or waive.
4. In this repo the gate is executable: `bun run coverage-gate` (`scripts/coverage-gate.ts`) does all three against the mission's `base_sha`, and runs as the last step of `bun run gate`. Never lower a threshold or exclude a file to make it green — add the missing tests.
5. User-AC declared (per `mugiwara-testcases`): config thresholds apply to unit-level code only; user-AC verdict governs ship-readiness.

## Sonar-style quality gate (verdict after Flow 7)

Flow 6 does not judge sonar here — no Flow-6 section names `review.md` or `security.md` as prior. Franky reads Flow-5 evidence only (Sanji, `.mugiwara/missions/<mission>/flows/03-quality.md`) for coverage/build context. The sonar verdict — vulnerabilities, bugs, smells, hotspots, duplication — runs after Flow 7 per `## Post-review sonar verdict (after Flow 7)` below, which names the Flow 7 artifacts as prior.

## Build gate

Run the project's build (or typecheck for interpreted stacks). Must exit 0. Capture the tail of output. Skip when `flows/03-quality.md` already recorded an exit-0 build on an unchanged diff.

## Diff size gate (reviewability)

The change diff against `base_sha` must be ≤ 400 LOC (via `git diff --numstat`). Larger → FAIL with the count; split into smaller changes before re-checking. An oversized diff is not reviewable regardless of other green gates.

## Optional e2e gate (per `mugiwara-quality`)

Runs only when quality flow stage triggered it (repo e2e setup + changed-file e2e patterns, user consent). Skipped/unrun is logged, never blocks PASS. Flow-6 verdict: coverage + build + DoD (sonar verdict lands after Flow 7).

## Definition of Done standing gate

A fixed cross-project bar. Full definitions: `_shared/references/definition-of-done.md`. PASS only when all five axes hold with evidence.

Gates judges the per-flow-stage bar only — the mission-end release decision belongs to `mugiwara-ship` (Flow 8, close/archive intent). Distinct triggers, distinct files (`flows/04-gates.md` vs `flows/06-closure.md`).

## Post-review sonar verdict (after Flow 7)

Franky reads evidence from prior flow-stage reports (never re-runs checks): Jinbe (`.mugiwara/missions/<mission>/security.md`), Robin (`.mugiwara/missions/<mission>/review.md`), Sanji (`.mugiwara/missions/<mission>/flows/03-quality.md`).

Grounding (quality gate = conditions measured against new code during analysis): https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates.md — Sonar way: no new issues, all new hotspots reviewed, coverage ≥ 80%, duplication ≤ 3%. Agentic-AI variant thresholds: https://docs.sonarsource.com/sonarqube-cloud/standards/ai-code-assurance/quality-gate-for-agentic-ai.md

Evaluated against these fixed numbers (policy may raise, never lower):
- Vulnerabilities (new) = 0
- Bugs (new) = 0
- Code smells (new) ≤ project threshold
- Coverage (new code) ≥ config threshold (default 90%)
- Duplications (new code) < 3%
- Security hotspots reviewed ≥ 80%

PASS only when ALL pass — list each with actual + threshold. Missing data → CANNOT pass: report the gap, do not fake. Append the verdict to `.mugiwara/missions/<mission>/flows/04-gates.md` under a post-review heading; it never rewrites the Flow-6 verdict.

## Waiver record

Waivers happen; unformatted waivers rot into fake passes. A waived gate
leaves one record in the verdict file — no record, no waiver:

`| gate | waived by | reason | scope (files/tasks) | expires (mission/date) |`

Scope is minimal (the gate, not the mission); expiry is mandatory — an
unexpired waiver blocks the NEXT mission's gate until re-decided. A waiver
without an explicit user decision is a fail wearing a costume.

## Lane-aware gates

Lane step chains live in code, not here. Source of truth: `src/policy.ts:gatesForLane` — `gate` counts steps by lane. Conformance 12-platform goldens unchanged — full still passes; direct skips heavy gates.

## Verdict

Flow-6 PASS only when coverage AND build AND diff-size AND DoD all pass with evidence. Write verdict to `.mugiwara/missions/<mission>/flows/04-gates.md` — each criterion with actual + threshold (see `gate_artifact`). The sonar verdict follows after Flow 7 per the post-review section above and never blocks the Flow-6 verdict. PASS → return to Luffy (routes to Robin/Jinbe). FAIL → list files under threshold + by how much → return to Luffy (routes to Brook). Never dispatch the next flow stage yourself.

## Red flags

- Closing a flow stage without its one-line summary, or padding it with prose at `verbosity=normal`.
- Missing coverage tooling → silent pass.
- PASS verdict with no evidence.
- Coverage measured against wrong base.
- FAIL negotiated to pass.
- Gate waived without explicit user decision and a waiver record.
- PASS on coverage/build while DoD fails.
- Sonar PASS with unverified or faked data.
- Diff > 400 LOC passed without split.
- Echoing raw output when `verbosity=normal` — summarize and cite the evidence path.
All mean: the gate has not actually run. Report the gap or the fail, honestly.
