# PR verdict — Phase 4: Scope & Code Governor

**Branch:** `feat/native-cost-governor` (base: `main` @ 075bd69; stacked on Phase 1 + 2 + 3)

## Title

feat(scope): Scope & Code Governor — scope drift detection, reuse checks, abstraction/dependency justification, minimum sufficient implementation, code waste detection, change-surface measurement

## Summary

Phase 4 of the Native Cost Governor initiative (spec §51 Phase 4). Adds
`src/scope.ts`, a pure verdict engine with the seven capabilities:
`detectScopeDrift` (touched files vs declared scope, `scope_score`),
`checkExistingCodeReuse` (§14 reuse-first — reuse only when existing AND local
modification viable), `evaluateAbstraction` (§15 — justified only when ≥2 uses +
dedup or contract-required, never speculative), `evaluateDependency` (§16 —
four-condition gate), `minimumSufficientCheck` (§15/§38 — under/over/sufficient,
never minimum LOC at the expense of verification), `detectCodeWaste` (§15 — the
8-type waste list), `measureChangeSurface` (§5.4 — loc_changed, proportionality
verdict), plus `recordScopeDecision` → `recordOptDecision` (scope-governor
actor, S2-sanitized). The workflow skill (rule 2b) and cost docs wire the
verdicts into the agent flow — honest boundary: module records verdicts, crew
acts. `savepoint.sh`/`lane-base.sh`/`DEFAULT_CONFIG` untouched — runtime
preserved.

## What changed

| File | Change |
|------|--------|
| `src/scope.ts` | NEW — scope & code governor verdict engine + recordScopeDecision (7 capabilities) |
| `test/scope.test.ts` | NEW suite (41 tests, 82 exact-value assertions) |
| `content/skills/mugiwara-workflow/SKILL.md` | wire scope-governor verdicts into the agent flow (rule 2b) |
| `content/skills/mugiwara-workflow/references/scope-code-governor.md` | NEW — full Scope & Code Governor reference (moved from inline to keep ≤120-line cap) |
| `docs/concepts/cost.md` | Scope & Code Governor section: seven verdicts, honest boundary, Phase-6/8 deferral, F2/F3 rules |
| `test/golden/claude.json`, `test/golden/opencode.json` | conformance golden bump 61→62 (new reference file, tier-1) |

## Per-flow-stage evidence

- Execution: `[flows/02-execution.md](.mugiwara/missions/native-cost-governor/flows/02-execution.md)` — T1–T3, all done
- Audit: `[flows/02-audit.md](.mugiwara/missions/native-cost-governor/flows/02-audit.md)` — PASS (DoD met)
- Quality: `[flows/03-quality.md](.mugiwara/missions/native-cost-governor/flows/03-quality.md)` — PASS (scope.ts 100% coverage)
- Gates: `[flows/04-gates.md](.mugiwara/missions/native-cost-governor/flows/04-gates.md)` — GO except known pre-existing flake; conformance goldens healed
- Review: `[review.md](.mugiwara/missions/native-cost-governor/review.md)` — APPROVE (reliability A)
- Security: `[security.md](.mugiwara/missions/native-cost-governor/security.md)` — PASS (no new surface, S2 sanitizer reused)
- Heal: `[flows/05-healing.md](.mugiwara/missions/native-cost-governor/flows/05-healing.md)` — cycle 1 (SKILL.md governance lines + references move `af8a204`), cycle 2 (conformance goldens `ff14f57`)

## Tests

`bun test test/scope.test.ts` → **41 pass / 0 fail / 82 expect**; scope.ts
coverage **100% lines / 100% funcs** (≥90). Full suite **566 tests / 32
files** — all green except the documented pre-existing `enforcement.test.ts`
"escape #2" flake (reproduced on clean base `3490284`, tracked separately, not
a Phase-4 regression). typecheck exit 0, build exit 0, validate-content exit 0,
conformance (12 platforms) exit 0, verify-install exit 0.

## Checks

- Commit hygiene: T1/T2/T3 + 2 heal commits + review, each touching only
  declared files (audit + review verified). One task per commit.
- Secrets: no keys/tokens/credentials in diff or trail (scanned clean).
- Runtime preserved: `savepoint.sh`, `lane-base.sh`, `DEFAULT_CONFIG` untouched.
- No new config keys; no changes to shipped primitives (consumed by signature).
- Conformance goldens regenerated for the single new reference file (61→62).

## Verdict

**GO** — ready for PR. User opens the PR (crew never creates/merges/deploys).

## Known pre-existing debt (not introduced by this PR)

- Enforcement timing flake (`test/enforcement.test.ts` escape #2) — FS mtime
  lag vs `.engaged` first_seen. Proven pre-existing (reproduced on clean
  `main`/base), tracked as separate fix mission.
- F2/F3 (Low) security design rules deferred to Phase 8; accepted, documented.
- Report/CLI code ledger (§5.4/§39/§42) → Phase 8; slop detection (§21.11/§45)
  → Phase 6. Neither built here.

---

# PR verdict — Phase 3: Work Governor

**Branch:** `feat/native-cost-governor` (base: `main` @ 075bd69; stacked on Phase 1 + 2)

## Title

feat(work): Work Governor — required/conditional/optional stage classification, evidence-backed skipping, agent/skill/delegation control, completion detection

## Summary

Phase 3 of the Native Cost Governor initiative (spec §51 Phase 3; consumes
the Phase-2 measurement signals). Adds `src/work.ts`, a pure verdict engine
with six capabilities: `classifyStage` (required/conditional/optional),
`shouldSkipStage` (evidence-backed stage skipping), `evaluateInvocation`
(agent invocation control), `shouldLoadSkill` (skill loading control),
`evaluateDelegation` (delegation optimization — consumes `delegateAt` +
`laneBaseForLane`, closing the Phase-2 Q1 remainder), and `completionCheck`
(completion detection), plus `recordWorkDecision` → `recordOptDecision`
(work-governor actor). `src/evidence.ts` closes security F1 (`loadRegistry`
shape validation) and heal W1 (per-line JSON.parse so one corrupt line drops
itself, not the whole registry). `src/cost.ts` closes the quality nit
(`context_metrics` typed via imported `ContextMetrics`). The workflow skill
and cost docs wire the verdicts into the agent flow — honest boundary: the
module records verdicts, the crew acts (no forced TS hook). `savepoint.sh`/
`lane-base.sh`/`DEFAULT_CONFIG` untouched — runtime preserved.

## What changed

| File | Change |
|------|--------|
| `src/work.ts` | NEW — work governor verdict engine + recordWorkDecision (6 capabilities) |
| `src/evidence.ts` | F1 shape validation on load; W1 per-line parse (corrupt line drops itself, valid entries preserved) |
| `src/cost.ts` | context_metrics via imported ContextMetrics type (quality nit) |
| `content/skills/mugiwara-workflow/SKILL.md` | wire work-governor verdicts into the agent flow (rule 2a + WG subsection) |
| `docs/concepts/cost.md` | Work Governor section: classification, skipping, invocation/skill/delegation control, completion; F2/F3 design rules |
| `test/work.test.ts` | NEW suite (34 tests, exact-value assertions) |
| `test/evidence.test.ts` | +4 F1 cases + W1 null/unparseable-line regression |

## Per-flow-stage evidence

- Execution: `[flows/02-execution.md](.mugiwara/missions/native-cost-governor/flows/02-execution.md)` — T1–T5, all done
- Audit: `[flows/02-audit.md](.mugiwara/missions/native-cost-governor/flows/02-audit.md)` — PASS
- Quality: `[flows/03-quality-phase3.md](.mugiwara/missions/native-cost-governor/flows/03-quality-phase3.md)` — PASS (dup none, complexity ≤7, maint A)
- Gates: `[flows/04-gates.md](.mugiwara/missions/native-cost-governor/flows/04-gates.md)` — GO (all 8 + coverage green)
- Review: `[review.md](.mugiwara/missions/native-cost-governor/review.md)` — GO, no blockers; 2 majors (1 healed as W1)
- Security: `[security.md](.mugiwara/missions/native-cost-governor/security.md)` — PASS (no Crit/High, Hotspots A; W1 healed)
- Heal: `[flows/05-healing.md](.mugiwara/missions/native-cost-governor/flows/05-healing.md)` — cycle 1, W1 healed `4dc2490`

## Tests

`bun run gate`: **525 tests / 31 files** — all green except the documented
pre-existing `enforcement.test.ts` "escape #2" flake (fails ~2–3/4 on clean
`main`, reproduced Phase 2, tracked separately; all other 524 pass). Coverage
PASS: work/evidence/cost 100% new ≥ 90; mission 94.41% modified ≥ 80. build
exit 0. validate-content, lane-base, run-evals, retrieval-eval,
verify-install — all green.

## Checks

- Commit hygiene: T1–T5 source commits + 1 heal commit, each touching only
  declared files (audit-verified). Wave 1 (T1/T2/T3) file-disjoint, executed
  inline.
- Secrets: no keys/tokens/credentials in diff or trail (scanned).
- Runtime preserved: `savepoint.sh`, `lane-base.sh`, `DEFAULT_CONFIG` untouched.
- F1 closed (registry shape validation); W1 healed (per-line parse, test-locked).
- Q1 closed (evaluateDelegation consumes delegateAt + laneBaseForLane).

## Verdict

**GO** — ready for PR. User opens the PR (crew never creates/merges/deploys).

## Known pre-existing debt (not introduced by this PR)

- Enforcement timing flake (`test/enforcement.test.ts` escape #2) — FS mtime
  lag vs `.engaged` first_seen. Proven pre-existing (reproduced on clean
  `main`), tracked as separate fix mission.
- F2/F3 (Low) security design rules deferred to Phase 8 (registry signals get
  consumed); accepted, documented.

---
# PR verdict — Phase 2: Context Governor

**Branch:** `feat/native-cost-governor` (base: `main` @ 075bd69; stacked on Phase 1)

## Title

feat(context): Context Governor — context accounting, budget enforcement, duplicate detection, evidence references/reuse, investigation limits, efficiency metrics

## Summary

Phase 2 of the Native Cost Governor initiative (spec §10–13). Adds context
measurement and bounds: `src/context.ts` (chars + estimated-token accounting,
`contextStatus` gate on `context_budget_chars`, efficiency metrics — reusing
`budget.measureContextChars` so there is one context implementation),
`src/evidence.ts` (sha256 content-fingerprint registry with stable monotonic
`E###` references, reuse-or-create, duplicate/repeated-read detection,
persisted `context-registry.jsonl`), three `investigation_*` config keys
(comment-only, defaults 2/5/2), and `src/investigation.ts` (bounded state
machine: objective-met + max-passes + max-unrelated + repeated-read stops,
emitting sanitized optimization decisions). `src/mission.ts` integrates: the
closure-event `status` now gates on the **lane token budget** while context
charts gate on `context_budget_chars` (fixes Phase-1 C2), the Cost section
renders via `costEnvelope` and surfaces a `Context efficiency` row. Phase-1
review items P1 (delegateAt [1,100] clamp) and S2 (recordOptDecision \r\n
strip) absorbed. `savepoint.sh`/`lane-base.sh` untouched — runtime preserved.

## What changed

| File | Change |
|------|--------|
| `src/context.ts` | NEW — accounting, estContextTokens, contextStatus, computeContextMetrics (reuses budget.measureContextChars) |
| `src/evidence.ts` | NEW — sha256 fingerprint registry, stable E### refs, reuse-or-create, findRepeats, context-registry.jsonl persist/load |
| `src/investigation.ts` | NEW — pass/surface/path state machine + §13 limits; stop verdicts via recordOptDecision |
| `src/config.ts` | 3 commented `investigation_*` keys + readInvestigationConfig (defaults 2/5/2) |
| `src/cost.ts` | delegateAt [1,100] clamp (P1); recordOptDecision \r\n strip (S2); CostEvent +context_status/context_metrics |
| `src/mission.ts` | status on lane token budget (C2), computed once (Q2), Cost section via costEnvelope (Q1); Context efficiency row; fold+remove context-registry.jsonl at archive; record 'over' event before throw (M2) |
| `src/evidence.ts` | registry entries carry `chars`; real duplicate/read-avoidance accounting (M1) |
| `docs/concepts/cost.md` | context accounting + investigation limits sections |
| `test/context.test.ts` / `test/evidence.test.ts` / `test/investigation.test.ts` | NEW suites |
| `test/cost.test.ts` / `test/config.test.ts` / `test/closure-integration.test.ts` | extended |

## Per-flow-stage evidence

- Execution: `[flows/02-execution.md](.mugiwara/missions/native-cost-governor/flows/02-execution.md)` — T1–T7, all done
- Audit: `[flows/02-audit.md](.mugiwara/missions/native-cost-governor/flows/02-audit.md)` — PASS
- Quality: `[flows/03-quality-phase2.md](.mugiwara/missions/native-cost-governor/flows/03-quality-phase2.md)` — PASS (dup 0%, maint A)
- Gates: `[flows/04-gates.md](.mugiwara/missions/native-cost-governor/flows/04-gates.md)` — GO (DoD 8/8)
- Review: `[review-phase2.md](.mugiwara/missions/native-cost-governor/review-phase2.md)` — 3 findings, all healed
- Security: `[security-phase2.md](.mugiwara/missions/native-cost-governor/security-phase2.md)` — PASS (no Crit/High, Hotspots A)

## Tests

`bun run gate` exit **0**: **486 tests / 30 files**. Coverage-gate PASS
(mission.ts 94.41% modified ≥ 80; evidence.ts 100% new ≥ 90). build exit 0.
validate-content, lane-base, run-evals (55), retrieval-eval (201/201 rank-1
95.6%), verify-install, conformance (12 platforms) — all green.

## Checks

- Commit hygiene: T1–T6 source commits + 3 heal commits + trail commits, each
  touching only declared files (audit-verified). `[PARALLEL]` waves (T1–T4,
  T5–T6) file+interface-disjoint, executed inline (no harness worker) preserving
  order.
- Secrets: no keys/tokens/credentials; `.jsonl` covered by TRAIL_EXTS.
- Runtime preserved: `savepoint.sh`, `lane-base.sh` untouched.
- C2 reconciled: closure event `status` on lane token budget, chars on
  `context_budget_chars` (grep `budgetStatus(effBudget` → none).

## Verdict

**GO** — ready for PR. User opens the PR (crew never creates/merges/deploys).

## Known pre-existing debt (not introduced by this PR)

- Enforcement timing flake (`test/enforcement.test.ts` "escape #2") — FS mtime
  lag vs `.engaged` first_seen. Proven pre-existing (reproduced on clean `main`
  2/3 this session), tracked as separate fix mission. Intermittent: single
  red run in this phase's gate, green on re-run.
- Gate-run file-mutation collateral (security skill file restored to HEAD).

---
## PR verdict — Phase 1: Cost Governor Foundation

**Branch:** `feat/native-cost-governor` (base: `main` @ 075bd69)

## Title

feat(cost): native Cost Governor foundation — centralized budgets/thresholds, cost events, optimization decisions

## Summary

Phase 1 of the Native Cost Governor initiative. Introduces `src/cost.ts`, a
single TS-side cost domain module that centralizes lane budget + threshold
math (warn 1.5× / stop 3× / delegate), kills the hardcoded duplicate in
`src/mission.ts`, and adds two record primitives (cost events → append-only
JSONL folded into the mission report; optimization decisions → structured
rows in `decisions.md`). Runtime behavior is preserved — the shell source of
truth (`lane-base.sh`, `savepoint.sh`) is untouched, and a parity test
machine-checks `cost.ts` against both.

## What changed

| File | Change |
|------|--------|
| `src/cost.ts` | NEW — LANE_BASE/LANE_BUDGET constants, budgetForLane, laneBaseForLane, warnAt, stopAt, budgetStatus, delegateAt, costEnvelope, appendCostEvent (JSONL), recordOptDecision (decisions.md) |
| `src/mission.ts` | archive cost-section consumes cost.ts (removes hardcoded 12000/25000/50000/3000 + 1.5×/3× math); records closure cost event; folds cost-events.jsonl into report.md |
| `src/integrity.ts` | `.jsonl` added to TRAIL_EXTS — cost-events.jsonl now covered by the closure secret-scan |
| `docs/concepts/cost.md` | Cost Governor module section |
| `test/cost.test.ts` | NEW — 30+ tests: constants, thresholds, budgetStatus, envelope, **parity vs lane-base.sh + savepoint.sh (bash-evaluated formulas)**, event + decision-record cases |
| `test/closure.test.ts` | jsonl secret-scan regression test |
| `test/closure-integration.test.ts` | closure-event fold + dry-run tests |

## Per-flow-stage evidence

- Execution: `[flows/01-execution.md](.mugiwara/missions/native-cost-governor/flows/01-execution.md)` — T1–T5, all done
- Audit: `[flows/02-audit.md](.mugiwara/missions/native-cost-governor/flows/02-audit.md)` — PASS
- Quality: `[flows/03-quality.md](.mugiwara/missions/native-cost-governor/flows/03-quality.md)` — PASS (dup 0%, complexity ≤3, maint A)
- Gates: `[flows/04-gates.md](.mugiwara/missions/native-cost-governor/flows/04-gates.md)` — PASS (sonar + coverage + build + DoD)
- Review: `[review.md](.mugiwara/missions/native-cost-governor/review.md)` — 2 findings, both healed
- Security: `[security.md](.mugiwara/missions/native-cost-governor/security.md)` — PASS, no Crit/High, Rating A

## Tests

`bun run gate` exit 0: **446 tests pass, 27 files**. Coverage-gate PASS
(mission.ts 94.08% modified ≥ 80). build exit 0. validate-content, lane-base
(constants match load), check-doc-links, verify-pack (npm clean), run-evals,
retrieval-eval, verify-install, conformance (12 platforms) — all green.

## Checks

- Commit hygiene: 6 task commits + trail commits, each touching only declared files (audit-verified).
- Secrets: no keys/tokens/credentials in diff or trail (scanned).
- Runtime preserved: `savepoint.sh`, `lane-base.sh`, `DEFAULT_CONFIG` untouched.
- Cross-source parity enforced by test (lane-base.sh constants + savepoint.sh
  gate-math formulas evaluated through bash).

## Verdict

**GO** — ready for PR. User opens the PR (crew never creates/merges/deploys).

## Known pre-existing debt (not introduced by this PR)

- Enforcement timing flake (`test/enforcement.test.ts` escape #2) — FS mtime
  lag ~2.5ms vs `.engaged` first_seen → intermittent `planTouched()` boundary
  miss. Proven pre-existing (reproduced on clean main), root-caused, ledgered
  for a separate fix mission.
- Gate-run file-mutation collateral (security skill file restored to HEAD).
