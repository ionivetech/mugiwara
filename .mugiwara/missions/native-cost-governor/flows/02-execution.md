# native-cost-governor — Phase 7 Execution Evidence (Flow 3)

Mode=auto, branch=feat/native-cost-governor, commit=conventional, auto_commit=on.
Plan: `.mugiwara/missions/native-cost-governor/plan.md` §Phase 7 (lines 1921-2218).

## Task table

| # | Task | Files | Status | Evidence |
|---|------|-------|--------|----------|
| T1 | Adaptive budget verdict engine (reservation/projection/expansion/thresholds/breaker/anomaly) + record helper | src/adaptive-budget.ts, test/adaptive-budget.test.ts | ✅ done | `bun test test/adaptive-budget.test.ts` 41 pass; `bun run typecheck` pass; `src/adaptive-budget.ts` 100% lines ≥90 |
| T2 | wire verdicts into agent flow (workflow skill + cost docs) | content/skills/mugiwara-workflow/SKILL.md, content/skills/mugiwara-workflow/references/adaptive-budget-governor.md, docs/concepts/cost.md, test/golden/*.json | ✅ done | `validate-content --check-manifest --check-docs --check-doc-integrity` exit 0; `verify-install` 258 pointers 0 orphans; `conformance` 12 pass (goldens 64→65); grep acceptances; `bun run typecheck` pass |
| T3 | full gate + evidence | flows/02-execution.md | ✅ done | `bun run gate` 694 pass + 1 fail enforcement escape#2 (waivable, reproduced on main); other gates green; `bun run typecheck` pass |

## Commits

| Commit | Type | SHA |
|--------|------|-----|
| T1 | feat(budget): adaptive budget verdict engine (reservation/projection/expansion/thresholds/breaker/anomaly) | `74ba69d` |
| T2 | docs(budget): wire adaptive budget & circuit breaker verdicts | `fabfa25` |
| T3 | chore(budget): phase 7 verification evidence | `pending-below` |

`savepoint.sh`, `lane-base.sh`, `src/config.ts` (`DEFAULT_CONFIG`), `src/cost.ts`, `src/context.ts`, `src/slop.ts` untouched (no new config keys, pre-existing primitives only).

## T1 evidence

Command: `bun test test/adaptive-budget.test.ts`

```
bun test v1.3.14 (0d9b296a)
 41 pass
 0 fail
 48 expect() calls
Ran 41 tests across 1 file. [116.00ms]
```

Command: `bun run typecheck` → `tsc --noEmit` exit 0.

Command: `bun test --coverage test/adaptive-budget.test.ts`

```
 File                    | % Funcs | % Lines | Uncovered Line #s
 src/adaptive-budget.ts |  100.00 |  100.00 |
```

Coverage `src/adaptive-budget.ts` = 100% lines (gate threshold `coverage_new=90` satisfied).

Verdict families covered (each a non-trivial exact assertion, no typeof/Array.isArray):
`reserveBudget` (14000/4000→available 10000, 1000/4000→0, exact), `projectBudget` (11200+4000+500+5000→15700/20700, all-zero→0/0, no healing→min==max), `evaluateExpansion` (5 valid reasons with flag→allow, no evidence→deny, invalid reason agent was verbose→deny even with flag, empty reason→deny, valid reason no flag→deny), `checkProgressiveThreshold` (59→ok, 60→optimize, 74→optimize, 75→aggressive, 89→aggressive, 90→protect, 99→protect, 100→pause, 149→pause, 150→warning, 299→warning, 300→stop, 50% pct, budget 0→0 ok), `checkCircuitBreaker` (13000/26000 no progress/scope/evidence→tripped, evidence 1→false, scope true→false, progress 1→false, 25999→false), `detectBudgetAnomaly` (5k zero-progress→true, 4.9k→false, 5k with progress→false, 10k zero→true), `recordBudgetDecision` (single bullet budget-governor actor, S2 newline sanitize, dir creation, second append).

## T2 evidence

Command: `grep -c adaptive-budget-governor content/skills/mugiwara-workflow/SKILL.md` → 1
Command: `grep -c 'Adaptive Budget' docs/concepts/cost.md` → 1
Body line count: `awk '/^---$/ {p++} p==2{body=1; next} body' SKILL.md | wc -l` → 118/120 (cap satisfied; merged Scope/Cognitive/Stop-Slop headers to single lines, freed 4)
Command: `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` → exit 0 (index budget 4741/5500)
Command: `bun scripts/verify-install.ts` → 258 pointers, 0 orphans, pointers resolve after install
Command: `bun scripts/conformance.ts` → 12 platforms pass (goldens 64→65 for claude+opencode, adaptive-budget-governor.md)
Command: `bun run typecheck` → exit 0

SKILL rule 2e added: `Adaptive Budget & Circuit Breaker: reserve/projection/expansion/thresholds/breaker/anomaly; record budget-governor trail rows.` Pointer: `Full definition: references/adaptive-budget-governor.md — reservation/projection/adaptive/expansion/thresholds/breaker/anomaly; budget-governor trail rows.`

## T3 evidence

Full `bun run gate` (failed at test:coverage only on pre-existing flake — waivable):

```
 FAIL  test/enforcement.test.ts > guard: plan written + no planner dispatched → warns (escape #2 closed)
 AssertionError: expected false to be true
  Test Files  1 failed | 34 passed (35)
       Tests  1 failed | 694 passed (695)
 error: script "test:coverage" exited with code 1
```

Waiver proof: flake reproduces on clean main (enforcement escape#2, blockers.md row 3, heal_halt true at 4/3). Not a Phase-7 regression — same 1 fail on branch and on base, same precedent Phases 2-6 (decisions.md Flow 9 waivers). Re-run `bun test test/adaptive-budget.test.ts` alone passes 41/41.

Individual gates all green when run outside the flaky test:

```
 bun run typecheck → exit 0
 bun run build → Bundled 31 modules
 bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity → exit 0
 bun scripts/verify-install.ts → 258 pointers 0 orphans
 bun scripts/lane-base.ts → lane-base: constants match
 bun scripts/retrieval-eval.ts → 201/201 passed, rank-1 95.6%
 bun scripts/run-evals.ts → 42 cases, no fail
 bun test test/adaptive-budget.test.ts --coverage → src/adaptive-budget.ts 100% (≥90)
 bun scripts/conformance.ts → 12 pass
```

## Verdict

`# Verdict: PASS (waived 1 pre-existing enforcement escape#2 flake; 694/695 tests pass, 41/41 adaptive-budget pass, all other gates exit 0, no new regression)`
