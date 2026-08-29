# native-cost-governor — Flow 4 checkpoint audit — Phase 2 (Context Governor)

Flow base: `1451758` (phase-2 plan tip) · Audited range: `1451758..HEAD` · Branch: `feat/native-cost-governor`
Auditor re-runs only — every row below is a fresh run, not borrowed evidence.

## Per-task audit

| Task | Criterion | Command run | Evidence | Status |
|------|-----------|-------------|----------|--------|
| T1 | context accounting + gate + metrics | `npx vitest run test/context.test.ts` | 8 pass; `estContextTokens(120000)=30000`; reuse proof vs `budget.measureContextChars`; contextStatus over/ok/budget-0; metrics no-NaN | ✅ PASS |
| T1 | measureContextChars reuse | grep `src/context.ts` | `import { measureContextChars as budgetMeasureContextChars } from './budget.ts'` + `export const measureContextChars = budgetMeasureContextChars` — single impl, no duplicate | ✅ PASS |
| T1 | typecheck | in `bun run gate` | clean | ✅ PASS |
| T2 | evidence registry + dedup + reuse refs | `npx vitest run test/evidence.test.ts` | 11 pass; repeat → same ref/`repeated:true`/`reads===2`; monotonic E012/E013; findRepeats ≥2; persist/load JSONL round-trip + mkdir | ✅ PASS |
| T3 | investigation config keys | `npx vitest run test/config.test.ts` + grep | 11 pass; defaults 2/5/2, explicit 4/9/3, non-numeric/zero→default; 3 commented keys in DEFAULT_CONFIG + reader | ✅ PASS |
| T4 | cost.ts hygiene (P1 clamp + S2 sanitize) | `npx vitest run test/cost.test.ts` | 36 pass; `delegateAt(12000,0)=delegateAt(12000,1)=120`, `delegateAt(12000,150)=12000`, mid 7200; `recordOptDecision` strips `\n\r`, no `## fake section`/`- injected`/`* injected` bullets (no markdown injection) | ✅ PASS |
| T5 | investigation state machine | `npx vitest run test/investigation.test.ts` | 9 pass; objective-met wins; pass2/max2→stop; unrelated 6/5→stop, 5→continue; repeated 2/2→stop; recordInvestigationStop single sanitized bullet | ✅ PASS |
| T6 | mission.ts integration C2/Q1/Q2 + metrics | `npx vitest run test/closure-integration.test.ts test/closure.test.ts test/cost.test.ts` | 73 pass (3 files); C2: event `status:'warn'` + `context_status:'ok'` (lane-vs-chars kept apart); status computed once (event == report); envelope render + `Context efficiency` row + `no registry` note | ✅ PASS |
| T6 | grep-lock no token-vs-char conflation | `grep -nE 'budgetStatus\(effBudget' src/mission.ts` | 0 matches (grep exit 1) — C2 locked out | ✅ PASS |
| T6 | CostEvent type extension sound | grep `src/cost.ts` | `context_status?: 'ok'\|'over'` + `context_metrics?:` two optional fields — required by T6's mandated payload, safe (no unsafe cast) | ✅ PASS |
| T7 | full gate | `bun run gate` | exit 0 (fresh run, log `/tmp/opencode/chopper-gate.log`); 483 tests pass; manifest sync; retrieval 201/201 rank-1 95.6%; verify-install clean; conformance 12 platforms; coverage-gate src/mission.ts 94.28% | ✅ PASS |

## Toolchain note — `bun test` vs `vitest run` (env-class, pre-existing, NOT a Phase-2 defect)

The plan's acceptance commands say `bun test <file>`. Running `bun test` (bun's
bundled runner) on the closure family errors:

```
test/closure.test.ts:3 — TypeError: vi.setConfig is not a function
```

Root cause: `test/closure*.test.ts` (pre-existing, unchanged by Phase 2) call
`vi.setConfig({ testTimeout })`, which vitest v4.1.10 removed from the `vi`
API. Bun's shim does not expose it, so `bun test` fails those files. The repo's
actual CI/gate runner is **`vitest run`** (`package.json` `"test": "vitest run"`,
wired into `bun run gate`), where `vi.setConfig` works and every file passes:

- `npx vitest run test/closure.test.ts` → 22 pass
- T6 3-file suite via vitest → 73 pass (matches Zoro)

Zoro's evidence counts are consistent with the **vitest** runner. The plan's
literal `bun test` invocation is not reproducible on this toolchain, but this
predates Phase 2 and is not a Phase-2 code change. Honest classification:
**env**, pre-existing, affects the runner choice not the shipped code. Gate
(the real acceptance) passes fully. Not a blocker.

## Commit hygiene (1451758..HEAD)

| Commit | Task | Declared | Touched | Verdict |
|--------|------|----------|---------|---------|
| `475cfe9` | T1 | src/context.ts, test/context.test.ts, docs/concepts/cost.md | exactly those | ✅ |
| `1d8feb3` | T2 | src/evidence.ts, test/evidence.test.ts | exactly those | ✅ |
| `804972f` | T3 | src/config.ts, test/config.test.ts, docs/concepts/cost.md | exactly those | ✅ |
| `b7712bf` | T4 | src/cost.ts, test/cost.test.ts | exactly those | ✅ |
| `46301e4` | T5 | src/investigation.ts, test/investigation.test.ts | exactly those | ✅ |
| `740af37` | T6 | src/mission.ts, test/closure-integration.test.ts (+ src/cost.ts type ext) | cost.ts type ext logged, necessary, sound | ✅ |
| `02c4d78` | T7 | flows/02-execution.md + state | exactly those | ✅ |

Parallel-conflict check: Wave 1 (T1–T4) file-disjoint — context/evidence/config/
cost each own their files. Wave 2 (T5–T6) file-disjoint — investigation.ts vs
mission.ts. T6's `src/cost.ts` edit does not collide with T4's (different waves,
different commits, sequential). No shared-file collisions across any parallel pair.

`savepoint.sh` / `scripts/lib/lane-base.sh`: `git diff 1451758..HEAD --` shows
**zero changes** — shell runtime source of truth untouched.

## Definition of Done (Phase 2)

| Axis | Verdict | Evidence |
|------|---------|----------|
| Correctness | PASS | all acceptance cases re-run green: context accounting/gate/metrics, evidence dedup+reuse+refs, config defaults, cost clamp+sanitize, investigation state machine, mission C2/Q1/Q2 reconcile |
| Quality | PASS | typecheck clean (gate); single measureContextChars impl; no hardcoded token-vs-char conflation left; CostEvent extension minimal + typed |
| Integration | PASS | 73-test closure/cost suite green (existing closure tests unchanged); 483 tests pass in full gate |
| Docs | PASS | docs/concepts/cost.md extended (context accounting + investigation limits); plan/spec/trail English |
| Ship-readiness | PASS | `bun run gate` exit 0 independently; savepoint.sh/lane-base.sh untouched; no runtime savepoint behavior change |

## Flow-stage verdict

**PASS** — all Phase-2 acceptance criteria verified by fresh re-run. `bun run gate`
exits 0. Only caveat is the pre-existing `bun test` vs `vitest run` toolchain
mismatch on the closure family (env-class, predates Phase 2, does not affect the
gate). No blockers filed. Nothing requires Brook (healing) or re-work by Zoro.

---

# native-cost-governor — Flow 4 checkpoint audit — Phase 3 (Work Governor)

Flow base: `3ca5d23` (phase-3 plan tip) · Audited range: `3ca5d23..HEAD` · Branch: `feat/native-cost-governor`
Auditor re-runs only — every row below is a fresh run, not borrowed evidence.

## Per-task audit

| Task | Criterion | Command run | Evidence | Status |
|------|-----------|-------------|----------|--------|
| T1 | Work Governor verdict engine | `bun test test/work.test.ts test/evidence.test.ts test/cost.test.ts` | 85 pass / 0 fail (34 work + 15 evidence + 36 cost); all six verdict fns + `recordWorkDecision` present in `src/work.ts`; every skip carries a reason | ✅ PASS |
| T1 | typecheck | `bun run typecheck` | clean (exit 0) | ✅ PASS |
| T1 | coverage ≥90% | `bun scripts/coverage-gate.ts --show` | `src/work.ts` 100.00% new (limit 90) | ✅ PASS |
| T1 | delegation closes Q1 | file inspect `src/work.ts` | `evaluateDelegation` calls `delegateAt(budget, threshold_pct)` + `laneBaseForLane(lane)`; `overhead = max(estimated_overhead, lane_base)` (lines 180–182) | ✅ PASS |
| T2 | F1 loadRegistry shape validation | `bun test test/evidence.test.ts` (in Wave-1 suite) | 15 pass; `loadRegistry` `.filter` drops non-string fingerprint/kind/file/id/ref + non-finite/negative `reads`, `Math.floor(reads)` (diff verified) | ✅ PASS |
| T2 | F1 test cases present | grep `test/evidence.test.ts` | `reads:'3'` (string) dropped; missing-`ref` line dropped; `reads:2.7`→floored; `reads:-1` dropped | ✅ PASS |
| T2 | F1 closed (Phase-2 DoD) | git diff | `loadRegistry` now validates entry shape on load — malformed lines can no longer reach consumers | ✅ PASS |
| T3 | cost.ts type dedup | grep `src/cost.ts` | `import type { ContextMetrics } from './context.ts'` (line 21) + `context_metrics?: ContextMetrics` (line 122); no inline `context_metrics?: {` dup (grep empty) | ✅ PASS |
| T3 | cost tests + typecheck | `bun test test/cost.test.ts` (in Wave-1 suite) + `bun run typecheck` | 36 pass unchanged; typecheck clean | ✅ PASS |
| T4 | validate-content | `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` | exit 0; manifest/docs/drift clean (⚠ = pre-existing warnings on other skills, non-failing) | ✅ PASS |
| T4 | workflow-skill wiring | grep `content/skills/mugiwara-workflow/SKILL.md` | 3 matches for `Work Governor|work-governor` (≥2); rule 2a added + `## Work Governor` subsection | ✅ PASS |
| T4 | cost.md Work Governor section | grep `docs/concepts/cost.md` | `## Work Governor (src/work.ts)` present; six capabilities + verdict contracts + honest boundary + F2/F3 design rules | ✅ PASS |
| T4 | description unchanged | grep `^description:` SKILL.md | byte-identical to HEAD (validate-content confirmed) | ✅ PASS |
| T5 | full gate | `bun run gate` | exit 1 — **only** red = pre-existing `enforcement.test.ts` escape #2 (523 pass / 1 fail); all other 14 gate stages green (see flake note) | ✅ PASS (flake noted) |
| T5 | coverage-gate | `bun scripts/coverage-gate.ts --show` | work 100%, evidence 100%, cost 100%, mission 94.41% modified (≥80) — matches Zoro's claim exactly | ✅ PASS |

## Commit hygiene (3ca5d23..HEAD)

| Commit | Task | Declared | Touched | Verdict |
|--------|------|----------|---------|---------|
| `0d1bf3e` | T1 | src/work.ts, test/work.test.ts | exactly those | ✅ |
| `7736227` | T2 | src/evidence.ts, test/evidence.test.ts | exactly those | ✅ |
| `bc4346e` | T3 | src/cost.ts (+ test/cost.test.ts, expected no-change) | src/cost.ts only | ✅ |
| `1bf7568` | T4 | SKILL.md, docs/concepts/cost.md | exactly those | ✅ |
| `3331762` | T5 | flows/02-execution.md | exactly that | ✅ |

Each commit is one logical task with a conventional message matching the plan.
Parallel-conflict check (T1/T2/T3): file-disjoint by construction — work.ts,
evidence.ts, cost.ts each own disjoint files; `git diff --name-only` across the
three commits shares no file. No shared-file collision.

`savepoint.sh` / `scripts/lib/lane-base.sh` / `src/config.ts` `DEFAULT_CONFIG`:
`git diff --name-only 3ca5d23..HEAD --` → **zero changes**. No new config keys,
no runtime savepoint/config behavior change (DoD guard satisfied).

## Pre-existing flake — honest classification (NOT a Phase-3 regression)

The gate's only red is `test/enforcement.test.ts` "guard: plan written + no
planner dispatched → warns (escape #2 closed)". Verification that it is
pre-existing and not introduced by Phase 3:

- `git log 3ca5d23..HEAD -- test/enforcement.test.ts` → **empty** (Phase-3 commits
  never touch it). Its last commit is `60df23c` (Aug 26, predates the phase).
- Confirmed intermittent: standalone re-runs flaked — run2 = 21 pass / 1 fail,
  run3 = 22 pass / 0 fail. Timing-dependent (`mtime`/`first_seen` race in the
  guard state machine).
- Already tracked in this mission's blockers ledger (row "enforcement escape #2",
  reproduced on clean `main` in Phase-2 closure) as a **separate fix mission**.

Classification: `env`/pre-existing test flake, not a Phase-3 code failure. Not
filed as a new blocker — already on the ledger. Do not flag as regression.

## Definition of Done (Phase 3)

| Axis | Verdict | Evidence |
|------|---------|----------|
| Correctness | PASS | all six verdict fns pure + test-locked (85-wave-1 tests fresh green); delegation closes Phase-2 Q1 remainder (`delegateAt` + `laneBaseForLane` consumed); security F1 closed (`loadRegistry` shape validation) |
| Quality | PASS | typecheck clean; work/evidence/cost 100% new coverage; mission 94.41% modified (≥80); cost.ts `ContextMetrics` type dedup (no inline dup) |
| Integration | PASS | T1/T2/T3 file-disjoint (no shared-file collisions); all Wave-1 tests + full suite pass except the pre-existing tracked flake; savepoint/lane-base/DEFAULT_CONFIG untouched |
| Docs | PASS | workflow-skill rule 2a + Work Governor subsection; cost.md Work Governor section (six capabilities, verdict contracts, honest boundary, F2/F3 design rules); description unchanged; validate-content exit 0 |
| Ship-readiness | PASS | `bun run gate` red only on the pre-existing tracked enforcement flake (separate mission, proven on clean main) — not a Phase-3 regression; no new config keys; all coverage limits exceeded |

## Flow-stage verdict

**GO** — all Phase-3 acceptance criteria verified by fresh re-run. Every task
(T1–T5) meets its acceptance criteria and commit hygiene. The Work Governor
module (six capabilities + record helper) ships, delegation closes the Phase-2
Q1 remainder, `loadRegistry` F1 and the cost.ts type nit are closed, and the
verdicts are wired into the workflow skill + cost docs. The single `bun run gate`
red is the pre-existing, separately-tracked `enforcement.test.ts` escape #2 flake
(intermittent, reproduced on clean main in Phase-2 closure, untouched by Phase-3
commits) — noted, not a regression. No new blockers filed; nothing requires
Brook (healing) or re-work by Zoro.

---

# Flow 8 heal re-audit — security W1 (evidence registry corrupt-line handling)

Heal commit: `4dc2490` · Branch: `feat/native-cost-governor` · Auditor re-run, not borrowed evidence. Read-only.

## Per-task audit

| Task | Criterion | Command run | Evidence | Status |
|------|-----------|-------------|----------|--------|
| W1 fix | per-line JSON.parse in its own try/catch; null/non-object skipped; malformed dropped without discarding valid neighbors | `git show 4dc2490 -- src/evidence.ts` + file inspect | old `.map(JSON.parse)` chain (one throw → outer catch → `[]`) replaced by `for...of` loop: each `JSON.parse` in own try/catch (`continue` on catch); `if (e === null \|\| typeof e !== 'object') continue` guards JSON literals (`null`, `"str"`, `5`); `out.push` per valid line | ✅ PASS — old whole-registry-`[]` behavior genuinely gone |
| W1 fix | valid-entry handling preserved (drop non-string/missing ref, non-string/negative/fractional/non-finite reads, floor reads) | `git show 4dc2490 -- src/evidence.ts` | all shape checks retained verbatim: `typeof ref === 'string'`, `typeof reads === 'number'`, `Number.isFinite`, `reads >= 0`, `reads = Math.floor(reads)` before push | ✅ PASS |
| regression test | exact non-trivial assertions + covers null-line AND unparseable-line | `git show 4dc2490 -- test/evidence.test.ts` | W1 test writes `E001`/`null`/`E002`/`{ not valid json`/`E003(reads 2)` → `toHaveLength(3)`, `toEqual(['E001','E002','E003'])`, `loaded[2].reads === 2` — exact, non-trivial; both null-line and unparseable-line cases covered | ✅ PASS |
| suite | `bun vitest run test/evidence.test.ts` → 16 pass exit 0 | `bun vitest run test/evidence.test.ts` | `Test Files 1 passed (1) / Tests 16 passed (16) / exit 0` | ✅ PASS |
| commit hygiene | one logical commit, conventional message, only declared files; savepoint.sh/lane-base.sh/DEFAULT_CONFIG untouched | `git show --stat 4dc2490` | single commit `fix(evidence): drop corrupt registry lines without discarding valid entries (W1)` touching only: `blockers.md`(+1), `flows/05-healing.md`(+25/-1), `src/evidence.ts`(+29/-21), `test/evidence.test.ts`(+21). No savepoint.sh/lane-base.sh/DEFAULT_CONFIG in diff | ✅ PASS |
| security.md W1 + blockers.md marked HEALED | both artifacts mark W1 closed | `grep HEALED security.md` / `git show 4dc2490 -- blockers.md` | blockers.md HEALED row added ✓; **security.md has NO `HEALED` marker** — W1 still listed as open must-fix (`Reviewed → Fix`, "must land before Phase 8"); commit never touched security.md | ⚠️ FAIL (docs closure gap) |

## Root-cause verification (code read)

Current `loadRegistry` (src/evidence.ts:113-138): per-line `for...of`, `.trim()` skip,
per-line `try { JSON.parse } catch { continue }`, null/non-object guard, shape filter,
`Math.floor`, push. A `null` literal line (`JSON.parse('null') === null`) hits the guard —
previously `typeof null.fingerprint` threw inside `.map` → outer catch returned `[]`.
Now a corrupt line drops only itself; valid lines before/after load intact. Old behavior
confirmed genuinely eliminated from the diff (`-` lines).

## Honest classification

No code failures mislabeled as env. The single failing criterion is a **docs/closure
status gap** (`missing-impl` category — audit artifact not updated), not a code defect.

## Definition of Done

- **correctness** ✅ — per-line isolation verified in code; test asserts exact values.
- **quality** ✅ — minimal one-guard-in-shared-function fix, no new abstraction.
- **integration** ✅ — 16/16 evidence pass; no parallel conflict (single commit, no shared-file edits within this commit).
- **docs** ⚠️ — 05-healing.md + blockers.md updated; **security.md W1 not marked HEALED**.
- **ship-readiness** ✅ — W1 code defect closed, no regression introduced.

## Verdict: NOT-HEALED (single docs-closure gap — code fix is verified HEALED)

The W1 **code fix is real, correct, and regression-free** (criteria 1-5 all PASS). The
sole blocker is criterion 6's second half: `security.md` still flags W1 as an open
must-fix and was never marked HEALED. Closing that status flag is a one-line doc edit —
an auditor's finding, not a fix of my own.
