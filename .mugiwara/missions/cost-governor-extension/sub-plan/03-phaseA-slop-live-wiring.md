# Sub-plan 03 — Phase A/§3.3: Stop-Slop Live Wiring + Per-Crew Attribution

Phase: A (§3.3 of parent plan)
Goal: Wire the existing Stop-Slop engine into the runtime — detectors currently
have zero live callers, so `slop_interventions` in the ledger is always 0.

## Tasks

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | Find the flow-boundary/savepoint invocation point | `scripts/savepoint.sh`, `src/` | S | — | call site chosen |
| T2 | Populate `slopMetrics.interventions` from live detections | `src/reporting.ts`, call site | M | T1 | ledger reflects non-zero slop on a sloppy fixture |
| T3 | Per-crew attribution in trail rows | `src/slop.ts` / call site | S | T2 | verdicts carry owning role |
| T4 | Surface per-role slop in report | report render | S | T2 | report shows slop per role |

## Context (verified gap)

- `src/slop.ts` has 8-kind taxonomy + 6 detectors, all pure, but **no runtime
  caller** — only `scripts/benchmark-governor.ts` exercises them.
- `reporting.ts:88` reads `input.slopMetrics?.interventions ?? 0` — the ledger
  field exists but is never populated from real detections.
- Reuse everything; no new engine/taxonomy/CLI; no live halt gate (deferred).

## Detail

### T1 — invocation point
Prefer ONE call site over wiring per-crew everywhere. Candidates:
- `scripts/savepoint.sh` — computes state at every flow-stage boundary.
- A new `recordLiveSlop()` in `src/slop.ts` called from the CLI/report path.
Goal: single place that reads mission state (files_touched, heal_cycle,
evidence, scope) and runs the applicable detectors, writing `slop-governor`
trail rows via existing `recordSlopDecision`.

### T2 — populate ledger
Feed live detection counts into `slopMetrics.interventions` (reporting.ts) so
`mugiwara cost` + report show real numbers, not 0.

### T3 — per-crew attribution
Map kind → owning role in the verdict reason/row:
- investigation → Usopp/Nami (Flow 1/2)
- code, scope → Zoro (Flow 3)
- retry, healing → Brook (Flow 8)
- context → all

### T4 — report
Render per-role slop summary in the Cost section.

## Acceptance
- `bun run typecheck` green; `bun run test` green (no new fails beyond the 2
  pre-existing config.test.ts).
- Detectors invoked live; `slop_interventions` non-zero on a sloppy fixture.
- Slop verdicts carry owning role; report surfaces per-role slop.
- `bun run gate` green (benchmark slop gate unaffected).

## Risk
- Double counting if wired in multiple places — single call site.
- Benchmark gate already enforces slop floors; live wiring must not perturb it.
