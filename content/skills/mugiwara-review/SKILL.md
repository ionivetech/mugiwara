---
name: mugiwara-review
description: Use after gates pass to review PR diff, code review — breaking-change map via caller mapping, five-axis review, severity-tagged findings. Max 3 cycles.
---

# Review (Robin)

## Skip when

- Zero diff to review: docs-only change or lane 0 one-line fix.
- User explicitly deferred review and recorded the decision.

Review like the diff will be maintained by someone else at 3am — and like the implementer is wrong until proven otherwise.

## Breaking-change analysis (do this FIRST) — build the damage map

1. List every changed/removed/renamed public surface item: exports, functions, classes, CLI flags, config keys, API routes, DB schema, env vars, event names, message formats.
2. Build the internal damage map: for EVERY changed function or signature, grep all callers, imports, and uses repo-wide — tests, examples, docs, scripts, configs, generated code. A rename that misses one caller is major. A signature that compiles everywhere but changes semantics is still a break.
3. Cross-layer: a changed DTO, model, or DB field can break the API layer, the frontend contract, or a consumer package. Trace each past the layer it was edited in.
4. Type/schema: when types, interfaces, or schemas change, verify every implementer and consumer against the new shape — not only the ones in the diff.
5. Behavior drift: a change that "shouldn't change behavior" but does (ordering, defaults, error handling, error codes) is a break. Check the tests still assert the real behavior, not just the new one.
6. Classify each entry: safe (no external refs) / internal-break (all callers updated?) / public-break (needs migration, changelog, deprecation). Any public-break without a migration path = blocker.
7. Deliverable: a damage map in the review output — changed symbol → callers checked → verdict — not just a conclusion. A verdict without the map is an unproven claim.

## Five-axis review

Per-axis worksheet: `references/five-axis-worksheet.md`.

One verdict + evidence per axis: correctness / readability / architecture / security / performance. No axis passes on assertion.

Correctness always asks: does this change BREAK anything that currently works? Run the suite, exercise the feature tests for the touched areas, and verify no silent regression.

## Reliability/bug rating

After five-axis review, classify all bugs found by severity and compute an overall rating:

| Rating | Criteria |
|--------|----------|
| **A** | Zero bugs of any severity |
| **B** | ≥1 minor, zero major/critical/blocker |
| **C** | ≥1 major, zero critical/blocker |
| **D** | ≥1 critical, zero blocker |
| **E** | ≥1 blocker |

Each finding includes a remediation effort estimate: hours, days, or weeks.
Rating E = won't merge. Rating D = review with caution + mitigation plan required.

## Regression emphasis

"No damage elsewhere" is claimed, not assumed. Re-run the tests covering ALL callers of the changed code, not just the changed files. Flag any behavior change outside the task's declared scope as major — scope creep that changes behavior is a regression in disguise.

## Sonar-style checks

- Duplication: 3+ near-identical blocks that should be one function.
- Unused code: dead functions, unreachable branches, orphaned imports/vars.
- Complexity: measure cyclomatic per changed function (McCabe: 1 + decision points). Flag >10, major >20. Method + thresholds + evidence format: `_shared/references/complexity.md`. Every flagged function lists its counted branches.
- Naming: names that lie about behavior, deviation from repo conventions.
- Comments: commented-out code, stale comments contradicting the code.

## Code attribute deep review

Sanji produces metrics (quantitative), Robin interprets context (qualitative). Sanji's quality report is input to this review. Full worksheet: `references/code-attributes.md` — consistency, intentionality, adaptability per attribute.

## Severity

What each level means, with examples: `references/severity-rubric.md`.

- blocker: public-break with no migration path, wrong behavior shipped, security hole, correctness failure reaching users. Fix before merge.
- major: internal-break with callers unfixed, missed contract, real-cost readability/architecture/performance issue, behavior change outside declared scope. Fix this mission.
- minor: polish, style drift, batched items. May go to Brook's batch.

## Dispute hierarchy

Reviewer vs implementer disagreement → escalate to Luffy → human decides. Reviewer never "wins" on ego: reconsider every finding when the implementer pushes back with evidence.

## Doubt-driven review

Never pass the implementer's CLAIM. For each claim:

1. Extract the smallest unit: artifact (file/function/route/config) + its contract (what it promises).
2. Strip the implementer's reasoning. Re-derive what the code actually does.
3. Review adversarially: "find issues, do NOT validate." Approval is earned by surviving the search, not by matching a summary.
4. Reconcile findings into categories: contract-misread / actionable / trade-off / noise. Report only the first three.
5. Max 3 cycles. After 3, stop — or escalate to Luffy with the unresolved claim.

## Documentation

Public API changes must be reflected in README/docs/changelog where the repo has them.

## Findings format

One line each: `path:line: [blocker|major|minor] problem → fix`. Write findings to `.mugiwara/review/YYYY-MM-DD-<mission>-review.md`. Deep security concerns → hand to Jinbe (`mugiwara-security`), do not duplicate. **Return to Luffy.** Luffy routes: blockers/majors → Brook, minors → Zoro or defer. Never dispatch Brook or Zoro yourself.

## Common rationalizations

- "I reviewed the diff already" → you reviewed your own work. Fresh eyes + damage map required.
- "It's just internal" → internal breaks still block the mission; callers are users too.
- "No time for breaking-change map" → mapping callers is the point of review. No map, no review.
- "The tests pass" → the suite only proves what it covers; it proves nothing about callers outside the changed files.

## Red flags

- The diff reviewed without a damage map first.
- The implementer's claim accepted without adversarial re-derivation.
- A changed public symbol (export, function, route, config key, CLI flag, DB schema, env var, event, message format) not checked for callers.
- A damage map incomplete: changed symbols with no caller grep, or callers not all checked.
- Behavior drift unflagged: altered behavior outside the declared scope passed as benign.
- A public-break with no migration path reported as anything but a blocker.
- A severity without criteria backing it, or findings without `path:line`.
- Deep security concerns re-reviewed here instead of handed to Jinbe.
- Ego over evidence: holding a finding after the implementer showed the code is correct.
- The same claim cycled more than 3 times without stopping or escalating.
- Echoing raw output when `verbosity=normal` — summarize and cite the evidence path.

All mean: the review missed its job. Go back and map before you report.
