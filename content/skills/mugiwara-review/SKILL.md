---
name: mugiwara-review
description: Use after gates pass to review a PR diff or do a code review: breaking-change map via caller mapping, five-axis review, severity-tagged findings.
gate_artifact: flows/review — .mugiwara/missions/<mission>/review.md: severity-tagged path:line findings
---

# Review

## Skip when

- 0 code files in the diff (docs-only), or a one-line direct fix.
- User explicitly deferred review and recorded the decision.

Review as if someone else will maintain this diff, and treat the implementer's claims as unproven until verified.

## Scope gate: small CLs

- Flag any CL >400 LOC (non-generated) for split before deep review. One purpose per CL; two purposes = two CLs.
- Review pace: 60-90s per 100 LOC. Above 400 LOC, pause and request a smaller CL unless the user approves a large review.

## Breaking-change analysis (do this FIRST) — build the damage map

1. List every changed/removed/renamed public surface item: exports, functions, classes, CLI flags, config keys, API routes, DB schema, env vars, event names, message formats.
2. Build the internal damage map: for EVERY changed function or signature, grep all callers, imports, and uses repo-wide — tests, examples, docs, scripts, configs, generated code. A rename that misses one caller is major. A signature that compiles everywhere but changes semantics is still a break.
3. Cross-layer: a changed DTO, model, or DB field can break the API layer, the frontend contract, or a consumer package. Trace each past the layer it was edited in.
4. Type/schema: when types, interfaces, or schemas change, verify every implementer and consumer against the new shape — not only the ones in the diff.
5. Behavior drift: a change that "shouldn't change behavior" but does (ordering, defaults, error handling, error codes) is a break. Check the tests still assert the real behavior, not just the new one.
6. Classify each entry: safe (no external refs) / internal-break (all callers updated?) / public-break (needs migration, changelog, deprecation). Any public-break without a migration path = blocker.
7. Deliverable: a damage map in the review output — changed symbol → callers checked → verdict — not just a conclusion. A verdict without the map is an unproven claim.

## Five-axis review

Per-axis worksheet: `references/five-axis-worksheet.md`. One verdict + evidence per axis: correctness / readability / architecture / security / performance. No axis passes on assertion. FAIL on any axis → overall FAIL.

Correctness always asks: does this change BREAK anything that currently works? Use the test evidence from the quality stage, and name any touched area with no test.

## Reliability rating

After the five axes, rate the diff from the findings (blocker/major/minor, defined once in `references/severity-rubric.md`). Thresholds are unverified defaults; project policy overrides.

| Rating | Criteria |
|--------|----------|
| A | no findings |
| B | minor only |
| C | 1-2 major, no blocker |
| D | 3+ major, no blocker |
| E | 1+ blocker |

Each finding carries an effort estimate (hours, days, weeks). E means do not merge. D needs a mitigation plan.

## Regression emphasis

"No damage elsewhere" must be shown, not assumed. Check the test evidence covers ALL callers of the changed code, and ask Chopper or Luffy for a re-run when it does not (Robin has no shell). Flag any behavior change outside the task's declared scope as major — scope creep that changes behavior is a regression in disguise.

## Sonar-style checks

- Duplication: 3+ near-identical blocks that should be one function.
- Unused code: dead functions, unreachable branches, orphaned imports/vars.
- Complexity: Robin has no shell and does not measure it. Read the cyclomatic and cognitive numbers from Sanji's quality report (method in `_shared/references/complexity.md`); without a report, flag only visible deep nesting by line.
- Naming: names that lie about behavior, deviation from repo conventions.
- Comments: commented-out code, stale comments contradicting the code.

## Code attribute deep review

The quality analyzer produces metrics (quantitative); the reviewer interprets context (qualitative). The quality report is input to this review. Full worksheet: `references/code-attributes.md` — consistency, intentionality, adaptability per attribute.

## Severity

One scale, blocker / major / minor, defined once with examples in `references/severity-rubric.md`. Security findings use Critical/High/Medium/Low from `mugiwara-security`; the same file maps them onto this scale.

## Dispute hierarchy

Reviewer vs implementer disagreement → escalate to the orchestrator → human decides. Reviewer never "wins" on ego: reconsider every finding when the implementer pushes back with evidence.

## Doubt-driven review

Never pass the implementer's CLAIM. For each claim:

1. Extract the smallest unit: artifact (file/function/route/config) + its contract (what it promises).
2. Strip the implementer's reasoning. Re-derive what the code actually does.
3. Review adversarially: "find issues, do NOT validate." Approval is earned by surviving the search, not by matching a summary.
4. Reconcile findings into categories: contract-misread / actionable / trade-off / noise. Report only the first three.
5. Cap at `heal_max_cycles` cycles, then stop or escalate to Luffy with the unresolved claim.

## Re-review scope

The next cycle re-reviews only the fixed findings plus their callers, not the full diff. A fix that touches new callers extends the scope to those callers and nothing else.

## Documentation

Public API changes must be reflected in README/docs/changelog where the repo has them.

## Findings format

One line each: `path:line: [blocker|major|minor] problem → fix`. Write them to `.mugiwara/missions/<mission>/review.md`; shape and a short example: `references/review-template.md`. Deep security concerns go to `mugiwara-security`, not duplicated here. The change owner acknowledges every blocker and major (approve, fix, or dispute with evidence) before merge. Return the findings to Luffy and `recommend: Brook` for blockers and majors, `recommend: defer or batch` for minors. Luffy decides; never dispatch a follow-up yourself. When dispatched as a subagent you start with no memory: read the diff, plan, spec and flow files Luffy names, write only `review.md`, and do not state whether the check was independent or inline (archive adds it).

## Common rationalizations

- "I reviewed the diff already" → that was your own work. Fresh eyes and a damage map are required.
- "It's just internal" → internal breaks still block the mission; callers are users too.
- "The tests pass" → the suite proves only what it covers, not callers outside the changed files.

## Red flags

Full list: `references/red-flags-review.md`, 12 checks; any hit means the review missed its job.
