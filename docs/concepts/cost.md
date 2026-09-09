# Cost

You approved a plan and now you wonder what the run will burn. You need the budget for your lane, the point where the crew warns, and the point where it stops. This page answers "what does it cost" with one example, then the lane table. Detail on contexts and ledgers lives in code comments, not here.

Example: a standard-lane mission carries a base load plus doc words times 1.35 plus changed lines times 12. Mid-run the estimate passes 1.5 times budget, so state flips to warn and the crew tells you. At 3 times budget it writes state and pauses for a human decision. The mission report shows total tokens, lane, and delta versus budget.

Rule: budgets bound process cost, the part mugiwara adds. They never claim to measure model I/O, tool output, or harness prompts. Where the harness exposes real usage, pipe it in and the report carries a provider-backed number.

| Lane | Flow stages | Base | Budget | Warn | Stop |
|---|---|---|---|---|---|
| Direct | none | 0 | none | none | none |
| Lean | execute, quality | 8000 | 12000 | 18000 | 36000 |
| Standard | plan, execute, audit, review | 13000 | 25000 | 37500 | 75000 |
| Full | all nine flow stages | 22000 | 50000 | 75000 | 150000 |
| Spike | brainstorm, re-triage | 1000 | 9000 | 13500 | 27000 |

Bases come from `scripts/lane-base.ts`, which sums the skill and agent bodies each lane loads. The gate fails when a constant drifts more than a fifth from measured load, so content growth moves the budgets. Warn fires at 1.5 times budget, stop at 3 times, both inclusive. State lands in `.mugiwara/missions/<mission>/[member].json` before any stop.

Measured: the catalog index holds 21 skills. Pointer checks cover 318 pointers with 0 broken. Retrieval probes count 216 with 95.9% rank 1.

Provider path: set `MUGIWARA_TOKENS` to a total, or write `input_tokens` plus `output_tokens` JSON and pass it with `--tokens-file` at savepoint. State flips to reported source and the report prints the provider-backed total. Tiers without a usage API keep the estimator. The rollup line stays absent there. No numbers are invented to fill the gap.

Governor phases (reserve, project, avoid, stop, plus scope, cognition, slop, budget, reporting, benchmark) produce verdicts the crew acts on. They record decisions to the trail. They never force the model. Read `src/cost.ts`, `src/work.ts`, `src/scope.ts`, `src/cognition.ts`, `src/slop.ts`, `src/reporting.ts` for the verdict shapes.
