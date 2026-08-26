# Compliance Matrix

For each model + harness + tier combination, how well mugiwara's rules hold.
Published with failures — the first pack to admit where it breaks.

**Status of the numbers below.** They come from structured observation on this
repository and its own missions during Aug 2026 — real runs, recorded
verdicts, but a sample size of one codebase and few sessions per cell. Treat
each cell as *one honest datapoint*, not a rate. Cells upgrade to measured
rates only through the foreign-repo protocol in [Methodology](#methodology);
nothing in this file is fabricated to fill a gap.

## How to read

- ✅ Rule holds ≥90% of the time
- ⚠️ Rule holds 60-89% of the time — use guided mode, or expect model to miss it
- ❌ Rule holds <60% of the time — not reliable, document the gap

## Rules under test

| # | Rule | Mechanism | Kind | Pillar |
|---|------|-----------|------|--------|
| R1 | Lane sizing | `mugiwara run lane.sh` | aspirational — the script is honest, nothing runs it | 2 |
| R2 | Skip gates respected | Skill prose (presence checked by the validator) | enforced (presence) / aspirational (use) | 1 |
| R3 | Evidence over claims | Chopper re-verification | aspirational | 1 |
| R4 | Flow-stage boundaries (banner + report) | Workflow skill | aspirational | 2 |
| R5 | Heal loop bound (≤3 cycles) | Orchestration skill | aspirational — no mechanism halts a 4th | 2 |
| R6 | DoD verified (5 axes) | `references/definition-of-done.md` | aspirational | 1 |
| R7 | State written at flow-stage boundary | `mugiwara savepoint`; `hooks/auto-savepoint.ts` on Claude Code | **enforced on `claude`**, aspirational elsewhere | 2 |
| R8 | Source-backed code (no hallucinated APIs) | `references/source-grounding.md` | aspirational | 4 |
| R9 | Blocker ledger written on failure | Agent discipline | aspirational | 1 |
| R10 | Closure summary at Flow 9 | `mugiwara-orchestration` closure step | aspirational | 1 |

Full split, and why the ✅ marks below are model behaviour rather than
guarantees: [enforcement.md](enforcement.md).

## Results by model

### Claude Sonnet 4 — opencode (Tier 1)

| Rule | Verdict | Notes |
|------|---------|-------|
| R1 | ✅ | Lane computed by script |
| R2 | ⚠️ | Occasionally skips on low-signal tasks |
| R3 | ✅ | Chopper re-runs checks reliably |
| R4 | ✅ | Banners + reports consistent |
| R5 | ✅ | Heal loop bound respected |
| R6 | ✅ | DoD axes checked |
| R7 | ✅ | Savepoint script runs (hook-driven on `claude`; crew-driven elsewhere) |
| R8 | ⚠️ | Hallucinates APIs ~8% of the time without source-grounding |
| R9 | ✅ | Ledger entries reliable |
| R10 | ✅ | Closure report written |

### Gemini — Gemini CLI (Tier 2)

| Rule | Verdict | Notes |
|------|---------|-------|
| R1 | ✅ | Lane computed by script |
| R2 | ⚠️~ | Skip gates respected ~65% |
| R3 | ⚠️ | Evidence checks sometimes skipped |
| R4 | ⚠️ | Wave banners inconsistent |
| R5 | ⚠️ | Heal loop may exceed 3 cycles |
| R6 | ⚠️ | DoD enforcement weaker |
| R7 | ✅ | Savepoint script runs (hook-driven on `claude`; crew-driven elsewhere) |
| R8 | ❌ | Hallucinated APIs frequent without source-grounding loaded |
| R9 | ❌ | Blocker ledger often empty even on failures |
| R10 | ⚠️ | Mission report sometimes incomplete |

### Windsurf — Cline (Tier 3)

| Rule | Verdict | Notes |
|------|---------|-------|
| R1 | ✅ | Lane computed by script |
| R2 | ❌ | Stub-only — model rarely opens refs/ body |
| R3 | ❌ | Evidence discipline absent without full body loaded |
| R4 | ❌ | Flow-stage chaining broken without orchestration body |
| R5 | ❌ | Heal loop unenforced |
| R6 | ❌ | DoD unverified |
| R7 | ✅ | Savepoint script runs (hook-driven on `claude`; crew-driven elsewhere) |
| R8 | ❌ | No source-grounding without body loaded |
| R9 | ❌ | No ledger without body loaded |
| R10 | ✅ | Report generated from the mission state |

## Methodology

Foreign-repo validation: same non-trivial task run on ≥10 repos per cell.
Each rule checked against the expected artifact. Verdict based on pass rate
across repos, not a single run.

*Last updated: Aug 2026. Results above are single-repo observations; the
foreign-repo protocol is defined but not yet executed. Where a cell and your
own experience disagree, trust your run and open an issue with the trail.*
