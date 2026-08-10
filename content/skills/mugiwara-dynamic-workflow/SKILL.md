---
name: mugiwara-dynamic-workflow
description: Use when a mission or subproblem has many independent subtasks, needs comparison, or risks agent bias - pick the right dynamic workflow pattern - fan-out-and-synthesize, tournament, loop-until-done, classify-and-act, generate-and-filter.
---

# Dynamic Workflow Patterns (Luffy)

Six primitives for missions too big or too biased for one linear pass. Choose the pattern BEFORE executing; record the choice in the plan doc. A mission may chain patterns (e.g. classify, then fan out, then tournament the outputs).

## Classify-and-act

1. Sort inputs into intent categories first, THEN route each category to its handler.
2. Never act before classifying — Luffy's Wave 0 triage is this pattern applied to the mission.
3. Unknown category → hold for judgment; never guess-assign.

## Fan-out-and-synthesize

1. Split work into independent tasks; run each in a parallel subagent.
2. Prove disjointness first: each task touches distinct files or interfaces. No shared writes, no shared state.
3. A synthesizer merges results into ONE output with source attribution per part.
4. Conflicts resolve by evidence (re-run, inspect), never by vote count.

## Tournament / pairwise judgment

1. Ranking or selecting (options, designs, PRs) → compare in PAIRS, not all-at-once.
2. Fresh judge per match; match verdict only, no absolute scoring.
3. Winner advances; keep runner-up reasoning in the report.
4. Counters self-preferential bias: no judge argues for its own entry.

## Loop-until-done

1. Repeat one unit until a stopping criterion with evidence: test pass, threshold reached, user sign-off.
2. Bound the loop: max N (default 3). Exceeding N → escalate, never loop forever.
3. Record every iteration's evidence in `.mugiwara/results/`.

## Generate-and-filter

1. Produce many candidates first — no filtering during generation.
2. Filter against HARD constraints, then rank survivors.
3. Never filter before generating; never rank on soft preference before hard constraints.

## Adversarial verification

1. Every output gets a skeptic pass (dispatch `skeptic-verifier`): find what is wrong, do NOT validate.
2. Counters agentic laziness, self-preferential bias, goal drift.
3. Findings classified; loop bounded at 3 cycles.

## Selection guide

- One route, unknown intent → classify-and-act
- Many independent tasks, merge later → fan-out-and-synthesize
- Rank or select among peers → tournament
- Repetition with a stopping rule → loop-until-done
- Many candidates, hard bar → generate-and-filter
- Any high-stakes output about to ship → adversarial verification

## Failure modes fixed

- Agentic laziness: generate-and-filter + adversarial verification
- Self-preferential bias: tournament + adversarial verification
- Goal drift: loop bounds + adversarial verification
- Conflated judgments / order effects: tournament pairs
- Premature filtering / culled solutions: generate-and-filter

## Pattern table

| Pattern | Use when | Output |
|---------|----------|--------|
| classify-and-act | intent unknown, routes diverse | category → handler map + actions |
| fan-out-and-synthesize | independent subtasks | one merged output, source-attributed |
| tournament | rank / select peers | champion + runner-up reasoning |
| loop-until-done | repeat until criterion | iterations + final evidence |
| generate-and-filter | candidates + hard bar | ranked survivors |
| adversarial verification | output / verdict ships | findings report, bounded |

## Red flags

- Fan-out without a disjointness proof.
- A synthesizer merging by vote instead of evidence.
- A judge scoring absolutely instead of pairwise.
- An unbounded loop.
- Filtering before generating.
- A skeptic pass that "validates" instead of doubting.

All mean: stop, re-pick the pattern, record the change in the plan doc.
