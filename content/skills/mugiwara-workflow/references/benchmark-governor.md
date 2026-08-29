# Benchmark & Hardening — Full Checklist (Phase 9)

Tracks `scripts/benchmark-governor.ts` harness (deterministic, no network).

## Cost suite (§48) — 4 workloads
- [ ] lean-trivial: projected 8000 + overhead 1000, context ≤20000, evidence ≥1, surface files 2 loc 50
- [ ] standard-feature: projected 15000 + overhead 1500, context ≤40000, evidence ≥3
- [ ] large-repo: projected 22000 + overhead 2200, context ≤80000, evidence ≥5, surface 50 files
- [ ] long-mission: projected 23000 + overhead 2300, context ≤90000, 9 stages projection ≤ budget
- Check: `measured.tokens ≤ projected + overhead` else fail; `measured.context ≤ max` else fail

## Stop-Slop suite (§45) — 12 scenarios detect→classify→intervene
- [ ] endless-exploration → investigation slop → stop
- [ ] repeated-reads (3× no evidence) → context slop → stop; with concrete reason → tolerate
- [ ] repeated-commands (same cmd+evidence fail) → retry slop → stop
- [ ] repeated-failed-test → retry slop → stop
- [ ] repeated-reasoning → reasoning slop → stop
- [ ] unnecessary-abstraction → code slop → stop
- [ ] unnecessary-dependency → code slop → stop
- [ ] unrelated-refactor → scope slop → stop
- [ ] verbose-output → output slop → stop
- [ ] no-progress-healing (cycle ≥3, 0 fixes) → healing slop → stop
- [ ] premature-completion → scope slop → escalate
- [ ] excessive-context (repeated reads + duplicate chars) → context slop → stop

## Stress (bench-only, no runtime)
- [ ] large repository: 50 files within declared scope → pass (scope drift negative)
- [ ] long mission: 9 stages, projectBudget max ≤ full budget 50000 → pass
- [ ] runaway: actual 2× expected with no progress/scope/evidence → breaker tripped → fail (measures, not enforces)

## Thresholds (ratchet, like retrieval-eval)
- Thresholds live in `scripts/benchmark-thresholds.json` (or in-script THRESHOLDS const)
- `tokens > projected + overhead` → harness fails workload
- `context_chars > context_max` → fail
- Thresholds only move on explicit fixture update (reviewed diff), never silently
- `ponytail: thresholds are fixture constants, not config — ratchet like retrieval-eval`

## Regression (§49)
- `checkRegression`: cost down but correctness/evidence/security/quality/scope down → fail
- Baseline from thresholds `baselines` + workload `expected_*`; measured vs baseline pure comparison

## Cross-platform & Determinism
- Harness pure over explicit fixture inputs, no Date.now/Math.random/network, deterministic on all platforms
- `scripts/conformance.ts` 12-platform parity proves cross-platform

## CI Enforcement
- `package.json:gate` includes `bun scripts/benchmark-governor.ts` (extend existing gate)
- `scripts/gate-selftest.ts` tampers thresholds → harness must exit 1 (G3 — gate that cannot fail is not a gate)
- ponytail: harness measures, does not enforce — no runtime gate

## Docs
- `docs/concepts/cost.md` ## Benchmark & Hardening documents harness/threshold/stress contracts
- `docs/cost-governor.md` hub links to cost.md for deep contracts
