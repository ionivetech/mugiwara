# PR — feat/seamless-governors

**Title:** feat(governors): seamless lane-aware cost+slop + crew strengthen (P0 solo/team)

**Summary:** Solo & enterprise useful, cost kecil, seamless. Cost Governor terse+lazy (no caveman/ponytail), lane-aware gates (direct 3 vs full 12), auto-compress 80%, slop all-lines, crew strengthened, P0 solo/team gate.

**What changed:**
- references/cost-governor.md (1 file, 104 lines, ladder 7)
- content/skills/mugiwara-workflow/orchestration/execution/gates (lane-aware, slop, savepoint, scope)
- src/policy.ts GATE_STEPS_BY_LANE, src/budget.ts shouldCompress, src/cost.ts, src/mission.ts (compress, countPlanTasks, index clear), scripts/savepoint.sh (sub-plan fallback)
- content/agents/zoro/brook/memory-keeper (scope 4-phase, skip Lane 0)
- test/direct-seamless.test.ts (8 tests), test/cli-heal.test.ts (20 tests), test/golden 71→70 etc.

**Per-flow evidence:** see 06-closure.md

**Tests:** 844 passed, direct-seamless 8, coverage 93.64, build 34 modules, validate 21/14, verify-install 304, conformance 12/12, benchmark pass

**Checks:** diff 4227 WAIVED for Full lane (atomic), sonar 8/8, security 0 vuln

**Verdict:** GO — single PR, not split
