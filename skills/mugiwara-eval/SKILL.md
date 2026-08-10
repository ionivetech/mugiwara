---
name: mugiwara-eval
description: Use when verifying that a mugiwara skill, agent, or the whole crew actually works - write a task suite, run it with a judge agent, rubric-compare, and report pass/fail per case.
---

# Eval (Self-Test)

Skills rot silently. A skill that was never tested is a claim, not a capability. This is the harness's own test harness: write a task suite, run each case, score with a fresh judge against a rubric, report pass/fail.

## Why

- Skill instructions drift from what agents actually do when followed.
- Untested means unverified: "it reads fine" is not "it works".
- The eval is the contract; the skill bends to it, never the reverse.

## Task suite format

One case per skill-behavior at `evals/cases/<skill>-<case>.json`:

```json
{
  "name": "rubric-threshold-honesty",
  "skill": "mugiwara-eval",
  "task": "The prompt to run through the skill's workflow.",
  "fixtures": ["evals/cases/fixtures/plan.md"],
  "rubric": ["a pass threshold is stated before scoring", "a pass needs explicit evidence"],
  "expected": "What pass looks like: all rubric items met, each with evidence."
}
```

- `name` unique per suite; `skill` matches the skill directory name.
- `task` is the prompt run as-is — no extra guidance bolted on.
- `rubric` = checked items; `expected` = the shape of a pass. `fixtures` optional, repo-relative paths.

## Judge-agent protocol

Rubric comparison, not gold-answer matching (SWE-bench-style suites + rubric judges):

1. Run the case: host executes `task` with the skill under test loaded.
2. Dispatch a FRESH judge — never the implementer. Counters self-preferential bias.
3. Judge scores each `rubric` item pass/fail with evidence; no absolute scores.
4. Compare against the rubric's explicit pass threshold (all items, or ≥ N with none critical).
5. Ranking or selection → pairwise/tournament judging (`mugiwara-dynamic-workflow`), not all-at-once.

## Loop

run → judge → fail → fix the SKILL (never the eval) → re-run.

1. Write cases before trusting a skill or changing it.
2. Run the suite; judge honestly.
3. A failing case means the skill's instructions are wrong or incomplete. Fix the skill.
4. A passing case gives no license to change the skill casually — re-run on change.
5. Never weaken the eval to clear a failure; that falsifies the test.

## Bound

- Run the suite per release and on every skill change.
- Report a pass/fail table to `.mugiwara/results/<mission>-eval.md`: case, judge, verdict, evidence, threshold.
- Failing cases → rows in `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md` (category `eval-fail`).
- Keep the suite in sync with the skill dirs: at minimum one case per skill.

## Scope

Test the SKILL, not the host agent. Host behavior is the host's problem. The eval checks that the skill's instructions, when followed, produce the intended workflow. Never assert on agent behavior, model quirks, or tooling the skill does not own.

## Common rationalizations

- "I wrote it, it must work." → Fresh judge, always.
- "The case passed last release." → Re-run; skills drift between runs.
- "The eval is too strict." → Tighten the skill, never the rubric.
- "It's an agent problem." → If following the skill causes it, it's the skill's.

## Red flags

- The implementer judging its own case's skill.
- A rubric with no pass threshold.
- A case whose `task` leaks the expected answer.
- Fixing the eval instead of the skill to clear a failure.
- A suite run with no pass/fail report written.
- A suite that no longer matches the skill's current behavior.

All mean: the run is not a valid check. Stop, re-run with a fresh judge, write the report.
