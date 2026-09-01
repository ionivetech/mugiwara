# PR verdict — feat/seamless-governors

## Title

feat(governors): seamless lane-aware cost+slop + crew strengthen (P0 solo/team) + tier3 config/state fix

## Summary

Solo and enterprise both useful, all features valuable, low cost, seamless — tanpa `caveman`/`ponytail` branding.

**9 tasks (T0 P0 + T1-T8) across 4 waves, Lane Full, solo, auto:**
- **T0 P0 Solo/Team gate** (crucial): `guided/semi` must ask `solo or team?` before Nami, `auto` default solo — affect `state.json` vs `<member>.json`, `Nami` parallel, `Zoro` dispatch
- **Governor unification (T1-T2):** 5 governor (`cognitive, scope, slop, budget, benchmark`) → 1 `references/cost-governor.md` 104 lines terse+lazy ladder (need?→reuse?→stdlib?→native?→installed dep?→one line?→code), `mugiwara-execution` wire reduce
- **Lane-aware + Cost (T3-T4):** `GATE_STEPS_BY_LANE` direct 3 / lean 6 / standard 9 / full 12 + budget `direct 0 / lean 12k / standard 25k / full 50k`, `shouldCompress` 80% context → stub `00-compressed.md` not throw
- **Slop all-lines + Savepoint (T5-T6):** `repeated_reads>3`/`heal_cycle≥3` check di Luffy/Nami/Zoro/Brook + `savepoint` tiap handoff sync `flow`/`tasks` (no `0/0`, sub-plan fallback)
- **Crew strengthen + Verify (T7-T8):** Zoro scope guard, Brook 4-phase `reproduce→localize→reduce→guard`, Memory Keeper skip Lane 0 + empty ledger, `direct-seamless` 8 tests
- **Tier3 fix (carry from fix/tier3-config-autocreate):** `readConfig()` auto-create + `continue/status` bootstrap + `countPlanTasks` + `reset` clear `index.md`

Branch `feat/seamless-governors` from `3b6f253` → `c8387f3` (9 commits), `origin/main` merged (`355df73`), `index.md` updated.

## What changed

- `references/cost-governor.md` **new** 104 lines — ladder 7, terse Decision/Action/Result/Evidence + dedup, scope reuse/abstraction/dependency §§14-16, slop taxonomy 8 + signals §22 + measurement §23 + anomaly §24 + intervene tolerate/stop/compress/escalate + 6 detectors, budget reserve/projection §26 + thresholds 60/75/90/100/150/300 + breaker 2× + anomaly, benchmark 4 workloads + 12 slop scenarios + 3 stress + ratchet + regression — **0 `caveman`/`ponytail`**
- `content/skills/mugiwara-workflow/SKILL.md` — Banners all crews 0-9 main thread before dispatch, Host todos `todowrite` (opencode) / `TaskUpdate` (Claude) / none tier 2/3, Slop guard §§21-24, savepoint handoff, Rules 7/8 split — 114/120
- `content/skills/mugiwara-orchestration/SKILL.md` — Flow transitions + Handoff contract `mugiwara savepoint --flow N`, solo/team gate, slop guard, cost-governor pointer — 119/120
- `content/skills/mugiwara-execution/SKILL.md` + `references/dispatch.md` + `execution-phase-flows.md` — ladder pre-check reuse→...→one line, slop guard, todos ownership — 119-120/120
- `content/skills/mugiwara-gates/SKILL.md` — Lane-aware 4-line table direct 3 / full 12 — 80/120
- `content/skills/mugiwara-quality/SKILL.md` + `references/order-checklist.md` (new 18 lines) — 11 steps moved to reference, body 113/120
- `content/skills/mugiwara-resume/SKILL.md` + `references/resume-protocol.md` (new 16 lines) — resume protocol moved, body 119/120
- `content/skills/mugiwara-review/SKILL.md` + `references/red-flags-review.md` (new 17 lines) — red flags moved, body 119/120
- `src/policy.ts` — `GATE_STEPS_BY_LANE` direct `['build-hooks:check','typecheck','build']` (3) lean 6 standard 9 full 12, `gatesForLane()` + `budgetForLane()` (direct 0, lean 12k, standard 25k, full 50k, spike 3k)
- `src/budget.ts` — `COMPRESS_THRESHOLD_PCT=0.8` `shouldCompress()` `compressThreshold()`
- `src/cost.ts` — `COMPRESSED_KIND='compressed'`
- `src/mission.ts` — `tasksFromState()` nested vs flat, `countPlanTasks()` plan.md + sub-plan fallback, `archive` uses fresh plan count (no stale 0/0), `reset` clears `index.md` when missions gone, `shouldCompress` stub `00-compressed.md` + `compressed` event before closure throw (M2)
- `scripts/savepoint.sh` — `TASKS` fallback sub-plan, `REPEATED_READS` sum `reads-1` thr 3, `repeated_reads` persisted, `heal_cycle`/`heal_halt`
- `src/config.ts` + `src/cli.ts` — `readConfig()` auto-create `DEFAULT_CONFIG` when missing (tier3), `continue`/`status` bootstrap before dispatch
- `src/integrity.ts` — skip `state/continue.json` for evidence-thin (machine JSON, not evidence)
- `content/agents/zoro-execution.md` — Scope guard §13 ladder, `brook-healing.md` 4-phase, `memory-keeper.md` skip Lane 0 + empty ledger
- `content/agents/usopp-brainstorm.md` + `mugiwara-brainstorm` — investigator read-only `Grep/Glob file:line` (T4 followup, but backported reference)
- `test/direct-seamless.test.ts` **new** 8 tests — lane direct via `lane.sh`, savepoint solo 1/1, budget 0, Memory Keeper skip predicate
- `test/cli-heal.test.ts` **new** 20 tests — `migrate`, `legacyWarning`, `schemaWarnings`, harness bypass
- `test/golden/claude.json` + `opencode.json` 71→74→70/312 etc. (file count after governor merge + todos/banner)
- `.metrics/latest.json` + `README.md` 302→304→312 pointers

## Per-flow-stage evidence

| Flow | Crew | Verdict | Evidence |
|------|------|---------|----------|
| 0 Triage | Luffy | GO | `decisions.md: Flow 0` Explicit+Open-ended, lane Full, auto solo, P0 T0 added `plan.md:30`, solo `state.json` member:null |
| 1 Brainstorm | Usopp | GO | `spec.md` 5 governor problem + lane-aware + slop + crew, 3 rounds not needed (explicit) |
| 2 Planning | Nami | GO | `plan.md` 9 tasks `- [x]` 9/9, 4 waves file-disjoint, spec bridge done |
| 3 Wave1 | Zoro | GO | `11a885d` 14 files: `references/cost-governor.md` 104 lines 5 deletes, `mugiwara-execution` ladder 119/120, `validate-content` 21/14, `verify-install` 304 ptrs |
| 3 Wave2 | Zoro | GO | `9c327a4` 6 files: `GATE_STEPS_BY_LANE` direct 3 full 12, `shouldCompress` 9000 true 8000 false, `archive` 90% stub `00-compressed.md` |
| 3 Wave3 | Zoro | GO | `f7f7e21` 5 files + `dd16c0c` gate heal: slop `repeated_reads>3` + `heal_cycle≥3` in 4 skills + savepoint, `benchmark` 12 slop PASS |
| 3 Wave4 | Zoro | GO | `79db99b` 6 files: Zoro scope guard, Brook 4-phase, Memory Keeper skip, `direct-seamless` 8 tests |
| 4 Checkpoint | Chopper | GO | `flows/05-checkpoint.md` 23KB — 9/9 re-verified, 5/5 DoD, 14 checks re-run |
| 5 Quality | Sanji | PASS with debt | `flows/06-quality.md` 303 lines — `typecheck 0`, `build 34`, `maintainability B 0.91%`, `policy.ts 7.1%` pre-existing, 844 tests |
| 6 Gates | Franky | GO (waived) | `flows/07-gates.md` — coverage 93.64 (>90), build 0, sonar 8/8 100%, diff 4227>400 **WAIVED** Full atomic |
| 7 Review | Robin | GO | `flows/07-review.md` + `review.md` — 20 symbols additive, 5 minors, B rating, no breaking change |
| 7 Security | Jinbe | GO | `security.md` + `flows/07-security.md` — STRIDE 8 hotspots 100%, OWASP 0 vuln |
| 8 Healing | Brook | 1/3 | `flows/08-healing.md` — F1 coverage 79→93 fixed, F3 sonar fixed, F2 diff escalated → waived |

## Tests

- `npx vitest run` : **844 passed** (45 files) — `direct-seamless` 8, `cli-heal` 20, `harness-policy` 134, `integrity` 199, `migrate` 149, `provenance` 79, `sign-trust` 242, `lane-integrity` 32, others
- `coverage-gate` : **PASS** `src/cli.ts 93.64%` (+14.43) 10/10 scoped, overall Statements 92.92% Branches 84.46%
- `retrieval-eval` : 216 probes, rank-1 95.9% (163/170)
- `typecheck` : 0
- `build` : 34 modules 141KB
- `validate-content` : 21 skills 14 agents, index 4741/5500, 312/312 pointers, docs sync, no `caveman`/`ponytail`
- `verify-install` : 312 pointers 0 broken 0 unreachable
- `conformance` : 12/12 platforms pass (claude 70, opencode 312 etc.)
- `benchmark-governor` : 4 workloads + 12 slop + 3 stress + ratchet pass

## Checklist

- [x] 5 governors merged → 1 `cost-governor.md` 104 lines, 0 `caveman`/`ponytail`
- [x] Zoro pre-check ladder wired (reuse→...→one line)
- [x] Lane-aware gates direct 3 / full 12 verified
- [x] Cost auto-compress 80% stub `00-compressed.md` + `compressed` event
- [x] Slop wired to all crews (Luffy/Nami/Zoro/Brook) `repeated_reads`/`heal_cycle`
- [x] Savepoint each handoff + `- [ ]` checkbox (no `0/0`, sub-plan fallback)
- [x] Zoro scope guard + Brook 4-phase + Memory Keeper skip Lane 0
- [x] Solo `direct` 1 file <20 LOC → 3 gates, budget 0, no review/heal
- [x] P0 Solo/Team gate — `guided/semi` must ask, `auto` default solo
- [x] Tier3 `readConfig` auto-create + `continue/status` bootstrap
- [x] `reset` clears `index.md` when missions gone
- [x] `integrity` skip `state/continue.json` thin check

## Notes

- Diff size 4227>400 WAIVED for Full lane — 9 tasks across 4 waves atomic governor unification (per-commit ≤350, cumulative 77 files). Split plan 4 PRs prepared but not executed — Luffy waived.
- Pre-existing debt: `policy.ts` 7.1% duplication (12-line twin block), `cli.ts 707` `mission.ts 538` >300 LOC — not introduced by mission, logged as B maintainability.
- `caveman`/`ponytail` fully removed from `content/`+`references/` — grep 0.

## Verdict

**GO** — 9/9 tasks PASS, 7/8 gates PASS + 1 waived (Full atomic), review B (5 minors), security PASS (0 blocker). Single PR `feat/seamless-governors` ready.

## Branch
