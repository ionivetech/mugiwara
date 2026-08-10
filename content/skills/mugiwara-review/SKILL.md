---
name: mugiwara-review
description: Use after quality gates pass to review the diff - breaking-change analysis via caller mapping, code smells, duplication, unused code, documentation gaps. Severity-tagged findings.
---

# Review (Robin)

Review like the diff will be maintained by someone else at 3am.

## Breaking-change analysis (do this FIRST)

1. List every changed/removed/renamed public symbol, CLI flag, config key, API route, DB schema item.
2. For each: grep callers, imports, references across the repo.
3. Classify: safe (no external refs) / internal-break (callers updated?) / public-break (needs migration, changelog, deprecation).
4. Any public-break without a migration path = blocker.

## Sonar-style checks

- Duplication: copy-pasted logic that should be one function (3+ near-identical blocks).
- Unused code: dead functions, unreachable branches, orphaned imports/vars.
- Complexity: functions doing several jobs, deep nesting, long parameter lists.
- Naming/consistency: names that lie about behavior, deviation from repo conventions.
- Comments: commented-out code, stale comments contradicting the code.

## Documentation

Public API changes must be reflected in README/docs/changelog where the repo has them.

## Findings format

One line each: `path:line: [blocker|major|minor] problem → fix`.

Deep security concerns → flag and hand to Jinbe (`mugiwara-security`); do not duplicate that work here. Blockers/majors → Brook. Minors may be batched with Brook's fixes.

## Red flags

- The diff reviewed without breaking-change analysis first.
- A changed public symbol (API route, config key, CLI flag, DB schema) not checked for callers.
- A public-break with no migration path reported as anything but a blocker.
- Findings without `path:line` or severity.
- Deep security concerns re-reviewed here instead of handed to Jinbe.

All mean: the review missed its job. Go back and map before you report.
