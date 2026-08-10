---
name: mugiwara-review
description: Use after quality gates pass to review the diff adversarially - doubt-driven review, breaking-change analysis via caller mapping first, five-axis review, sonar smells, docs gaps. Findings to .mugiwara/review/. Max 3 cycles then escalate.
---

# Review (Robin)

Review like the diff will be maintained by someone else at 3am — and like the implementer is wrong until proven otherwise.

## Doubt-driven review

Never pass the implementer's CLAIM. For each claim:

1. Extract the smallest unit: artifact (file/function/route/config) + its contract (what it promises).
2. Strip the implementer's reasoning. Re-derive what the code actually does.
3. Review adversarially: "find issues, do NOT validate." Approval is earned by surviving the search, not by matching a summary.
4. Reconcile findings into categories: contract-misread / actionable / trade-off / noise. Report only the first three.
5. Max 3 cycles. After 3, stop — or escalate to Luffy with the unresolved claim.

## Breaking-change analysis (do this FIRST)

1. List every changed/removed/renamed public symbol, CLI flag, config key, API route, DB schema item.
2. For each: grep callers, imports, references across the repo.
3. Classify: safe (no external refs) / internal-break (callers updated?) / public-break (needs migration, changelog, deprecation).
4. Any public-break without a migration path = blocker.

## Five-axis review

One verdict per axis: correctness / readability / architecture / security / performance. Correctness failures and security issues dominate the verdict; readability and architecture issues are majors at most.

## Sonar-style checks

- Duplication: copy-pasted logic that should be one function (3+ near-identical blocks).
- Unused code: dead functions, unreachable branches, orphaned imports/vars.
- Complexity: functions doing several jobs, deep nesting, long parameter lists.
- Naming/consistency: names that lie about behavior, deviation from repo conventions.
- Comments: commented-out code, stale comments contradicting the code.

## Documentation

Public API changes must be reflected in README/docs/changelog where the repo has them.

## Findings format

One line each: `path:line: [blocker|major|minor] problem → fix`. Write findings to `.mugiwara/review/YYYY-MM-DD-<mission>-review.md`.

Deep security concerns → hand to Jinbe (`mugiwara-security`); do not duplicate that work here. Blockers/majors → Brook. Minors may be batched with Brook's fixes.

## Red flags

- The diff reviewed without breaking-change analysis first.
- The implementer's claim accepted without adversarial re-derivation.
- A changed public symbol (API route, config key, CLI flag, DB schema) not checked for callers.
- A public-break with no migration path reported as anything but a blocker.
- Findings without `path:line` or severity.
- Deep security concerns re-reviewed here instead of handed to Jinbe.
- The same claim cycled more than 3 times without stopping or escalating.

All mean: the review missed its job. Go back and map before you report.
