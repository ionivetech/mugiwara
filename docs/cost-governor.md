# Cost Governor — Hub (§50)

The Native Cost Governor (Phases 1–9) makes cost visible, measurable, and auditable — it never forces the model at runtime (measures, not enforces).

The Cost Governor is one of **three independent decisions** per mission, alongside
**control mode** and **execution posture** — it supplies reserve / project /
avoid / stop verdicts, and never implies a mode change or a crew-role change.
See [execution-model.md](concepts/execution-model.md).

## What it does
- **Budgets** — lane budgets (lean 12k / standard 25k / full 50k) + warn at 1.5× + stop at 3× (`src/cost.ts`, `scripts/lib/lane-base.sh` source of truth)
- **Context** — chars + est tokens + budget gate (`src/context.ts` / `src/evidence.ts` / `src/investigation.ts`)
- **Work** — required/conditional/optional stages, skip/avoid/delegate/complete verdicts (`src/work.ts`)
- **Scope & Code** — drift, reuse, abstraction/dependency justification, waste, surface (`src/scope.ts`)
- **Cognition & Output** — focused reasoning, bounded alternatives, compressed deduped output (`src/cognition.ts`)
- **Stop-Slop** — taxonomy/signals, progress/anomaly, intervention + six detectors (`src/slop.ts`)
- **Adaptive Budget & Breaker** — reservation/projection/expansion/thresholds/breaker/anomaly (`src/adaptive-budget.ts`)
- **Reporting & CLI** — ledger view + `mugiwara cost [--json]` + report Cost section (`src/reporting.ts`)

## How decisions are made
Every governor is a pure verdict engine over explicit inputs; each verdict is recorded via `recordOptDecision` → `decisions.md` `## Cost governor decisions` trail (`cost-governor`/`work-governor`/… actors). The LLM crew (workflow skill rules 2a–2g) is the only thing that acts on the signals.

## How Stop-Slop works
Taxonomy 8 kinds (§21), signals §22, progress §23, anomaly §24, intervention `tolerate/stop/compress/escalate` §20, detectors for retry/healing/scope/context/investigation/code. See `docs/concepts/cost.md` `## Stop-Slop Governor` and `content/skills/mugiwara-workflow/references/stop-slop-governor.md`.

## How budgets are calculated
`laneBaseForLane` + `budgetForLane` + `costEnvelope` + `warnAt`/`stopAt` (1.5×/3×) + `delegateAt` + `reserveBudget`/`projectBudget`/`evaluateExpansion`/`checkProgressiveThreshold`/`checkCircuitBreaker`. See `docs/concepts/cost.md` `Cost per lane` + `## Cost Governor module` + `## Adaptive Budget & Circuit Breaker`.

## How to override / inspect / debug
- **Inspect:** `mugiwara cost --json` (ledger = envelope + events + registry + trail), `mugiwara cost --help`, `report.md` `## Cost` section at archive
- **Override:** decisions are verdicts, not gates — the crew follows them; to expand scope, set acceptance expansion and record the reason; to expand budget, provide evidence + valid reason (`scope/security/test/arch/healing`)
- **Debug a decision:** read `decisions.md` trail bullets (`ts — actor: decision — reason: … — evidence: …`), re-run the pure helper with the same inputs, compare against `scripts/benchmark-thresholds.json` thresholds
- **Benchmarks:** `bun scripts/benchmark-governor.ts` (cost 4 workloads + Stop-Slop 12 scenarios + large/long/runaway stress), thresholds `scripts/benchmark-thresholds.json` (ratchet), CI gate + selftest mutation. See `docs/concepts/cost.md` `## Benchmark & Hardening`.

## Deep contracts
All deep contracts live in `docs/concepts/cost.md` (the authoritative cost doc):
- `## Cost Governor module` — cost envelope/events/trail
- `## Context accounting + budget` / `## Investigation limits`
- `## Work Governor` / `## Scope & Code Governor` / `## Cognitive & Output Governor`
- `## Stop-Slop Governor` / `## Adaptive Budget & Circuit Breaker`
- `## Reporting & CLI` / `## Benchmark & Hardening`

Thin §50 file set (`docs/cost-model.md`/`docs/stop-slop.md`/`docs/cost-debugging.md`/`docs/cost-evaluation.md`) is consolidated here + `docs/concepts/cost.md` to keep SKILL.md ≤120 and avoid file-count drift; literal filenames are hubs pointing here if the validator ever checks them.
