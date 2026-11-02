# Cost

You approved a plan and wonder what the run will burn. You need the budget for your lane, the point where the crew warns you, and the point where it stops. This page gives those numbers and says plainly what they do and do not measure.

Example: a standard-lane mission carries a base load, plus the words of the playbooks it loads times 1.35, plus changed lines times 12. Mid-run the estimate passes 1.5 times the budget, so the mission state flips to warn and the crew tells you. At 3 times the budget it writes state and pauses for a human decision. The mission report shows the total, the lane and the difference from budget.

Rule: budgets bound the process cost, the part Mugiwara adds. They are an estimate, not the provider's bill. They never claim to measure model input and output, tool output or harness prompts. Where your harness exposes real usage, you can pass it in and the report carries a provider-backed number.

| Lane | Stages | Base | Budget | Warn | Stop |
|---|---|---|---|---|---|
| Direct | none | 0 | none | none | none |
| Lean | execute, quality | 7137 | 12000 | 18000 | 36000 |
| Standard | plan, execute, audit, review | 11732 | 30000 | 45000 | 90000 |
| Full | all stages | 20424 | 50000 | 75000 | 150000 |
| Spike | brainstorm, then re-size | 5311 | 9000 | 13500 | 27000 |

Bases come from `scripts/lane-base.ts`, which sums the playbooks each lane loads. CI fails when a constant drifts more than a fifth from the measured load, so growing the content moves the budgets. Warn is 1.5 times budget and stop is 3 times, both inclusive. State lands in `.mugiwara/missions/<mission>/` before any stop.

## Independent review

With `independent_review=on` (default), a full-lane or sensitive-path mission on Claude Code dispatches Robin and Jinbe as two fresh-context subagents. Measured in this repo: about 132k tokens per dispatch against about 5k for the same work inline (source: `mugiwara-orchestration` and `references/posture-routing.md`). Two dispatches therefore add on the order of a quarter million tokens, an expectation from that per-dispatch figure and not a separate measurement. The lane budget above counts the process load and does not include this. Set `independent_review=off` to keep review inline.

## The report's Cost section

On Claude Code the report prints two separate lines, for example `Process estimate: 20,855 of 50,000 tokens (42%).` and `Provider-reported: 2,111 input and output tokens, plus 252,276 cache reads and 37,420 cache writes.` The provider number is never divided by the budget: the budget bounds the process Mugiwara adds, and cache reads, which are most of the real volume, are priced differently from input and output.

One sample of independent review, not a benchmark: a mission on the full lane cost $0.70 (provider-reported by the CLI) with Robin and Jinbe as separate agents, against about $0.16 to $0.34 for the same task when the crew skipped the independent reviews.

## Real usage

To record real tokens, set `MUGIWARA_TOKENS` to a total, or write `input_tokens` and `output_tokens` JSON and pass the file with `--tokens-file` at savepoint. The state then reports the provider source and the report prints that total. Harnesses without a usage API keep the estimate, and the provider line stays absent. No number is invented to fill the gap.

## Reading the ledger

`mugiwara cost` prints the ledger for a mission: the cost envelope, work the crew avoided, efficiency, and the number of cost decisions in the trail. Wasted work (repeated reads, filler, a fix loop that goes nowhere) is counted as detected, stopped or compressed, and the closing report lists it as avoided work. The crew acts on these verdicts and records them. They never force the model. Only decision rows written by the cost checks count in the ledger. Hand-written decision rows stay in the report as the audit trail.

Measured: the skill and agent index holds 14 skills (**Current:** 3,960 chars). 300 pointers resolve, 0 broken. Retrieval probes: 268, with rank 1 at 96.7% on the positive cases.

## Habits from your host

Four writing habits can ride alongside the crew without shipping in this repo: terse output (native name anti-stuff), minimal diffs (just-enough), waste detection (anti-slop) and scannable reports with the verdict first (have-adhd). They come from your host setup and vary by host. The crew never depends on one being present, because every output shape it needs is defined in its own skills. When a reply surprises you, check these before blaming the crew.
