# native-cost-governor — Phase 3 (Work Governor) — Execution (Flow 3, Zoro)

Mode=auto · branch=feat/native-cost-governor · commit=conventional · auto_commit=on
Campaign: 9-phase Cost Governor (user scope override). Phase 3 executes plan §"Phase 3: Work Governor".

## Harness note — parallelization deviation (logged, not silent)

The plan mandates `[PARALLEL]` Wave 1 (T1–T3, three file-disjoint files). This
harness exposes **no subagent/task tool**, so literal concurrent worker dispatch
is impossible. Executed **inline, sequentially, in plan order** (T1→T3). File
disjointness is preserved **by construction**: T1 creates `src/work.ts` +
`test/work.test.ts`, T2 modifies `src/evidence.ts` + `test/evidence.test.ts`,
T3 modifies `src/cost.ts` — no two tasks touched the same file. The parallel
contract (order + disjointness) holds; only the concurrency mechanism differs.
Waves 2 (T4) and 3 (T5) are sequential by the plan.

## Task table

| # | Task | Status | Commit | Evidence |
|---|------|--------|--------|----------|
| T1 | Work Governor verdict engine (six capabilities) + record helper | ✅ PASS | `0d1bf3e` | `vitest run test/work.test.ts` 34 pass; `bun run typecheck` clean |
| T2 | security F1: loadRegistry shape validation | ✅ PASS | `7736227` | `vitest run test/evidence.test.ts` 15 pass; typecheck clean |
| T3 | cost.ts type dedup (ContextMetrics import) | ✅ PASS | `bc4346e` | `vitest run test/cost.test.ts` 36 pass; grep ContextMetrics 2 matches; no inline dup; typecheck clean |
| T4 | wire verdicts into agent flow (workflow skill + cost.md) | ✅ PASS | `1bf7568` | `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` exit 0; grep Work Governor/work-governor 3 matches; description unchanged |
| T5 | full gate + evidence | ✅ PASS | (this commit) | `bun run gate` exit 0 (clean run; flake documented below) |

## Per-task detail

### T1 — `feat(work): work governor verdict engine (stage/skip/agent/skill/delegation/completion)` (`0d1bf3e`)
Files: `src/work.ts` (new), `test/work.test.ts` (new). TDD: test written first → RED (module missing) → implement → GREEN.
- `classifyStage`: required (protects quality/security OR provides required evidence) / conditional (uncertainty_high OR non-explicit) / optional
- `shouldSkipStage`: required never skips; conditional skips on evidence/investigation-stopped; optional skips on evidence/context-over; every skip has an explicit reason (§7)
- `evaluateInvocation`: invoke only when unique responsibility + evidence cannot answer + stage cannot perform + value > cost; refuse names the first failing clause (§8)
- `shouldLoadSkill`: load only when task/policy/dependency/verification requires (§9)
- `evaluateDelegation`: consumes `delegateAt(budget, threshold_pct)` (budget ceiling) + `laneBaseForLane(lane)` (overhead floor — one delegate ≥ one agent's context load); delegate only when ≥2 independent tasks, value > overhead floor, usage ≤ budget_at. **Closes the Phase-2 Q1 remainder.**
- `completionCheck`: complete iff all five §19 conditions; `missing[]` lists the gaps (§19)
- `recordWorkDecision` → sanitized `recordOptDecision` with `work-governor` actor (§41)
Acceptance: `vitest run test/work.test.ts` → **34 pass / 0 fail**. `bun run typecheck` → clean.

### T2 — `fix(evidence): validate registry shape on load (security F1)` (`7736227`)
Files: `src/evidence.ts`, `test/evidence.test.ts`. TDD: 4 new cases RED → GREEN.
- `loadRegistry` now drops any entry failing shape (non-string fingerprint/kind/file/id/ref, or reads not a finite number ≥0) — never crashes the reader; `reads` coerced to `Math.floor(reads)`. A malformed or `string reads` line (string-concat risk) can no longer reach consumers. No signature change.
Acceptance: `vitest run test/evidence.test.ts` → **15 pass / 0 fail** (11 pre-existing unchanged + 4 new F1 cases). typecheck clean.

### T3 — `refactor(cost): type context_metrics via imported ContextMetrics (quality nit)` (`bc4346e`)
Files: `src/cost.ts`. Type-only: `import type { ContextMetrics } from './context.ts'`; inline `context_metrics?: {…}` replaced by `context_metrics?: ContextMetrics` (single type definition). No runtime signature change.
Acceptance: `vitest run test/cost.test.ts` → **36 pass / 0 fail** (unchanged). `grep -n 'ContextMetrics' src/cost.ts` → 2 matches (import + usage). `grep 'context_metrics?: {'` → empty. typecheck clean.

### T4 — `docs(work): wire work governor verdicts into the workflow skill and cost docs` (`1bf7568`)
Files: `content/skills/mugiwara-workflow/SKILL.md`, `docs/concepts/cost.md`.
- SKILL.md `## Rules`: rule 2 now carries the Work Governor mandate (2a merged onto the rule-2 line — matches the file's existing rule 7+8 merge convention) + new `## Work Governor` subsection: classify stages required/conditional/optional (§7), skip only with a recorded reason, agents/skills load only when they earn cost (§8/§9), closure needs §19's five conditions, verdicts → `work-governor` trail rows.
- `docs/concepts/cost.md`: new `## Work Governor (src/work.ts)` section — six capabilities + verdict contract table, delegation consumes `delegateAt`/`laneBaseForLane`, the honest boundary (module records — crew acts via the workflow skill), F2/F3 security design rules.
Acceptance: validate-content exit 0 (description byte-unchanged, manifest/docs/drift clean). grep `Work Governor|work-governor` SKILL.md → 3 matches (≥2). grep `## Work Governor` cost.md → 1 match. typecheck clean.

### T5 — `chore(work): phase 3 verification evidence`
Files: `.mugiwara/missions/native-cost-governor/flows/02-execution.md` (this append).
`bun run gate` full run. See Gate summary below.

## Gate summary (`bun run gate`)

Exit code: **0** on the clean run (`/tmp/opencode/gate-r4.log`). Full output
captured. A prior run also exited 0 (first invocation); flaky runs fail only the
pre-existing `enforcement.test.ts` "escape #2" — see flake note.

| Stage | Result |
|-------|--------|
| build-hooks:check | ✓ 5 hook builds current |
| typecheck | ✓ clean |
| test:coverage | ✓ **524 tests / 31 files** (all pass on clean run) |
| build | ✓ |
| validate-content (manifest, docs, doc-integrity) | ✓ manifest in sync; index budget 4741/5500; 21 skills / 14 agents |
| lane-base | ✓ |
| check-doc-links | ✓ |
| run-evals | ✓ 55 cases |
| retrieval-eval | ✓ 201/201, rank-1 95.6%, top-3 100% |
| verify-install | ✓ pointers resolve, prose valid, no orphans |
| conformance | ✓ 12 platforms |
| coverage-gate | ✓ PASS — `src/work.ts` 100% new (≥90), `src/evidence.ts` 100% new (≥90), `src/cost.ts` 100% new (≥90), `src/mission.ts` 94.41% modified (≥80) |

No gate waived; no test skipped.

## Pre-existing flake note (NOT a Phase-3 defect)

`test/enforcement.test.ts` "guard: plan written + no planner dispatched → warns
(escape #2 closed)" intermittently fails under the full suite. It is **the only**
red on flaky runs (523 pass / 1 fail). Reproduction-on-clean-main was documented
in Phase-2 closure; it is tracked as a separate fix mission. Evidence it is
pre-existing and not mine: `git log --name-only` for my 4 commits shows zero
touches to `enforcement.test.ts`; its last commit predates this phase. Not
burning heal cycles — per plan risk table (row "Pre-existing enforcement flake").

## Commit hygiene

4 source commits (T1–T4), each touching only its declared files. `savepoint.sh`,
`scripts/lib/lane-base.sh`, and `src/config.ts` `DEFAULT_CONFIG` **untouched**
(git shows no change) — no new config keys, no runtime savepoint behavior change.
No git push, no merge, per instructions.

# Verdict:

**PASS** — Phase 3 Work Governor shipped: verdict engine with all six
capabilities + record helper (T1, `0d1bf3e`), security F1 shape validation on
`loadRegistry` (T2, `7736227`), cost.ts `ContextMetrics` type dedup (T3,
`bc4346e`), verdicts wired into the workflow skill + cost docs (T4, `1bf7568`).
Delegation closes the Phase-2 Q1 remainder (`delegateAt` + `laneBaseForLane`).
Full `bun run gate` exits 0 on the clean run; coverage-gate PASS with
`src/work.ts` 100% (new ≥90). Only deviation: harness has no subagent tool, so
mandated `[PARALLEL]` Wave 1 ran inline in plan order (disjointness preserved by
construction), and the SKILL.md rule line was merged onto rule 2 to stay within
the validator's 120-line body cap (same merge convention the file already uses
for rules 7+8). The only intermittent red is the pre-existing enforcement
"escape #2" flake (separate mission, proven on clean main in Phase 2). No blockers.

---

# native-cost-governor — Phase 2 (Context Governor) — Execution (Flow 3, Zoro)

Mode=auto · branch=feat/native-cost-governor · commit=conventional · auto_commit=on
Campaign: 9-phase Cost Governor (user scope override). Phase 2 executes plan §"Phase 2: Context Governor".

## Harness note — parallelization deviation (logged, not silent)

The plan mandates `[PARALLEL]` Wave 1 (T1–T4) and Wave 2 (T5–T6) via concurrent
WORKER subagents. This harness exposes **no subagent/task tool**, so literal
concurrent worker dispatch is impossible. Executed **inline, sequentially, in
plan order** (Wave 1: T1→T4; Wave 2: T5→T6; then T7 inline). File/interface
disjointness is preserved **by construction**: each task committed only its
declared files, one task at a time, so no two tasks could ever race the same
file. The parallel waves' contract (order + disjointness) holds; only the
concurrency mechanism differs. No file/interface overlap was observed between
any pair of tasks.

## Task table

| # | Task | Status | Commit | Evidence |
|---|------|--------|--------|----------|
| T1 | context accounting + budget gate + metrics | ✅ PASS | `475cfe9` | `bun test test/context.test.ts` 8 pass; typecheck clean |
| T2 | evidence registry + dedup + reuse refs | ✅ PASS | `1d8feb3` | `bun test test/evidence.test.ts` 11 pass; typecheck clean |
| T3 | investigation config keys | ✅ PASS | `804972f` | `bun test test/config.test.ts` 11 pass; grep 6 matches (≥3); typecheck clean |
| T4 | cost.ts hygiene (P1 clamp + S2 sanitize) | ✅ PASS | `b7712bf` | `bun test test/cost.test.ts` 36 pass; typecheck clean |
| T5 | investigation limits state machine | ✅ PASS | `46301e4` | `bun test test/investigation.test.ts` 9 pass; typecheck clean |
| T6 | mission.ts integration (C2/Q1/Q2 + metrics) | ✅ PASS | `740af37` | 3-file suite 73 pass; grep `budgetStatus(effBudget` empty; typecheck clean |
| T7 | full gate + evidence | ✅ PASS | (this commit) | `bun run gate` exit 0; 483 tests / 30 files |

## Per-task detail

### T1 — `feat(context): context accounting, budget gate, and efficiency metrics` (`475cfe9`)
Files: `src/context.ts` (new), `test/context.test.ts` (new), `docs/concepts/cost.md`.
TDD: test written first → RED (Cannot find module '../src/context.ts') → implement → GREEN.
- `measureContextChars` re-exports `budget.measureContextChars` (single impl, test-locked equality)
- `estContextTokens` 1 token / 4 chars, rounded
- `contextStatus` chars gate on `context_budget_chars`; budget 0 → ok
- `computeContextMetrics` (reuse_rate, duplicate_chars, read_avoidance; no NaN)
Acceptance: `bun test test/context.test.ts` → **8 pass / 0 fail**. `bun run typecheck` → clean.

### T2 — `feat(evidence): content fingerprint registry with stable E### references and dedup` (`1d8feb3`)
Files: `src/evidence.ts` (new), `test/evidence.test.ts` (new).
TDD: RED → GREEN.
- sha256 `fingerprint`; `registerRead` reuse-or-create (repeat → same ref, reads++)
- monotonic `E<seq>` ids, never reused; `findRepeats` reads ≥2; JSONL persist/load round-trip, append-safe, mkdir-on-write
Acceptance: `bun test test/evidence.test.ts` → **11 pass / 0 fail**. typecheck clean.
Note: one test assertion initially wrong (empty registry starts E001, not E012); fixed in test (seed E011 → E012/E013). Implementation correct.

### T3 — `feat(config): investigation limit keys (max_passes, max_unrelated_files, repeated_read_threshold)` (`804972f`)
Files: `src/config.ts`, `test/config.test.ts`, `docs/concepts/cost.md`.
TDD: RED → GREEN.
- 3 commented `investigation_*` keys in DEFAULT_CONFIG (mirrors `# context_budget_chars` style)
- `readInvestigationConfig` defaults 2/5/2; explicit values parsed; non-numeric/zero → default
- No existing config test pins the exact DEFAULT_CONFIG string → no in-scope string update needed
Acceptance: `bun test test/config.test.ts` → **11 pass / 0 fail**; `grep -cE 'investigation_(max_passes|max_unrelated_files|repeated_read_threshold)' src/config.ts` → **6** (≥3); typecheck clean.

### T4 — `fix(cost): clamp delegateAt threshold and sanitize opt-decision fields (P1, S2)` (`b7712bf`)
Files: `src/cost.ts`, `test/cost.test.ts`.
TDD: RED (2 new fail) → GREEN.
- `delegateAt` clamps thresholdPct to [1,100] before division (matches savepoint.sh)
- `recordOptDecision` strips `\r\n` from flat fields (S2 — no markdown/line injection)
Acceptance: `bun test test/cost.test.ts` → **36 pass / 0 fail** (all existing stay green). typecheck clean.

### T5 — `feat(investigation): bounded investigation state machine (max passes/unrelated/repeated-read)` (`46301e4`)
Files: `src/investigation.ts` (new), `test/investigation.test.ts` (new).
TDD: RED → GREEN.
- `evaluateInvestigation`: objective-met wins; then max passes (>=), max unrelated (>), repeated-read (>=); else continue
- `recordInvestigationStop` → sanitized `recordOptDecision` (only when stop)
Acceptance: `bun test test/investigation.test.ts` → **9 pass / 0 fail**. typecheck clean.
cost.md investigation-limits section (added T3) documents the state machine + Phase-3+ wiring boundary.

### T6 — `feat(context): reconcile status on lane budget, surface context metrics in report (C2/Q1/Q2)` (`740af37`)
Files: `src/mission.ts`, `test/closure-integration.test.ts`, `src/cost.ts` (CostEvent type).
TDD: RED (4 new fail) → GREEN.
- **C2:** closure event `status` gates on `laneBudget` via `costEnvelope` (never `effBudget`/char budget); `contextStatus(budget, chars)` is its own gate
- **Q2:** single `costEnvelope` computation; `statusLabel` derived at render; event reuses `env.status`
- **Q1:** Cost section renders planned/used/remaining/pct/status from the envelope; `Context budget status` + `Context efficiency` rows added
- **Context metrics:** from `context-registry.jsonl` (reads) or all-zero with `(no registry — reads not tracked)` note
- **Closure event:** payload extended with `context_status` + `context_metrics`
Acceptance: `bun test test/closure-integration.test.ts test/closure.test.ts test/cost.test.ts` → **73 pass / 0 fail** (existing closure tests unchanged green). `grep -nE 'budgetStatus\(effBudget' src/mission.ts` → **empty**. typecheck clean.
**Deviation (logged):** `src/cost.ts`'s `CostEvent` type gained two optional fields (`context_status`, `context_metrics`) inside T6. The plan lists T6 files as `src/mission.ts` + `test/closure-integration.test.ts`, but the plan's own T6 step ("extend `appendCostEvent` payload with ... `context_status`, and the metrics") requires the event type to declare them — otherwise TypeScript's excess-property check fails on the object literal. This is the minimal sound way to carry the mandated payload; an unsafe cast was rejected. One commit, one task, still atomic.

### T7 — `chore(context): phase 2 verification evidence`
Files: `.mugiwara/missions/native-cost-governor/flows/02-execution.md`.
`bun run gate` full run, exit **0**.

## Gate summary (`bun run gate`)

Exit code: **0**. Full output captured in `/tmp/opencode/t7-gate.log`.

| Stage | Result |
|-------|--------|
| build-hooks:check | ✓ 5 hook builds current |
| typecheck | ✓ clean |
| test:coverage | **483 tests / 30 files, all pass** |
| build | ✓ |
| validate-content (manifest, docs, doc-integrity) | ✓ manifest in sync; index budget 4741/5500; cost.md chars match; 21 skills / 14 agents |
| lane-base | ✓ |
| check-doc-links | ✓ |
| run-evals | ✓ 55 cases |
| retrieval-eval | ✓ 201/201, rank-1 95.6%, top-3 100% |
| verify-install | ✓ pointers resolve, prose valid, no orphans |
| conformance | ✓ 12 platforms |
| coverage-gate | ✓ src/mission.ts 94.28% modified (≥80) |

No gate waived; no test skipped.

## Commit hygiene

6 source commits (T1–T6), each touching only its declared files (T6 logs the
single necessary `src/cost.ts` type extension). `savepoint.sh` and
`scripts/lib/lane-base.sh` UNTOUCHED (git shows no change). Phase-1 tests pass
unchanged — preserved behavior.

# Verdict:

**PASS** — Phase 2 Context Governor shipped: context accounting + budget gate + efficiency metrics (T1), evidence fingerprint registry with stable E### refs + dedup (T2), investigation config keys (T3), cost.ts hygiene (T4), bounded investigation state machine (T5), mission.ts integration C2/Q1/Q2 + context metrics (T6). Full `bun run gate` exits 0 (483 tests / 30 files, coverage-gate PASS on src/mission.ts at 94.28%). Every pre-existing test passes unchanged; savepoint.sh and lane-base.sh untouched. Only deviation: harness has no subagent tool, so mandated `[PARALLEL]` waves ran inline in plan order (disjointness preserved by construction), and src/cost.ts gained two optional CostEvent fields required by T6's mandated payload — both logged above. No blockers.
