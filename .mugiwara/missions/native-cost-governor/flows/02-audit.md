# native-cost-governor — Flow 4 checkpoint audit

Flow base: `a1136a7` (GO check-in) · Audited range: `a1136a7..HEAD`
Auditor re-runs only — every row below is a fresh run, not borrowed evidence.

## Per-task audit

| Task | Criterion | Command run | Evidence | Status |
|------|-----------|-------------|----------|--------|
| T1 | module constants + pure functions | `bun x vitest run test/cost.test.ts` | 30 pass (all literal assertions) | ✅ PASS |
| T1 | typecheck | `bun run typecheck` | `tsc --noEmit` clean | ✅ PASS |
| T2 | no budget literals left | `grep -cE '12000\|25000\|50000\|3000\|\* 3\|\* 1\.5' src/mission.ts` | 0 matches — `NO_LITERALS` | ✅ PASS |
| T2 | behavior preserved | vitest mission + closure family | 92 pass across 6 files | ✅ PASS |
| T3 | event append + fold | vitest cost + closure-integration | in the 92 (append, fold, dry-run cases green) | ✅ PASS |
| T4 | decision records | vitest cost.test.ts | 4 recordOptDecision cases green | ✅ PASS |
| T5 | full gate | `bun run gate` | exit 0 on first capture (441 tests, 13 gates); 3 subsequent captures red on ONE pre-existing flake — see Gate note | ✅ PASS* |

## Commit hygiene (a1136a7..HEAD)

| Commit | Declared | Touched | Verdict |
|--------|----------|---------|---------|
| `1614dfc` (T1) | src/cost.ts, test/cost.test.ts | exactly those | ✅ |
| `ec9fa41` (T2) | src/mission.ts, docs/concepts/cost.md | exactly those | ✅ |
| `c777464` (trail) | decisions.md, todos.md | exactly those | ✅ |
| `12463a0` (T3) | src/mission.ts, test/cost.test.ts, test/closure-integration.test.ts | exactly those | ✅ |
| `f9f18c4` (T5) | flows/01-execution.md, blockers.md | exactly those | ✅ |
| `5172f29` (todos) | todos.md | exactly those | ✅ |

No undeclared files, no missing declared files. Parallel-conflict check: N/A — plan declares a strictly sequential chain (every task edge shares a file); no `[PARALLEL]` claims.

## Gate note — pre-existing enforcement flake (env-class, proven)

`bun run gate` captures: 1 green (exit 0, 27 files / 441 tests) then 3 red — all on the SAME test:
`test/enforcement.test.ts > guard: plan written + no planner dispatched → warns (escape #2 closed)`.

- **Root cause (deterministic repro):** `planTouched()` compares `plan.md` mtime against `.engaged` `first_seen`. On this `/tmp` filesystem the plan mtime lags wall-clock by ~2.5 ms even when written strictly after the marker:
  - `first_seen ms: 1787992785197` vs `plan mtime ms: 1787992785194.5393` → `plan >= first_seen? false`
  - When the write happens in that ~2.5 ms boundary window, `planTouched()` reads false and the warning never fires → the test fails.
- **Not caused by this flow stage:** `test/enforcement.test.ts` and `hooks/*` are outside the audited diff (none of my commits touch them); reproduced on a clean `main` worktree (1 fail / 3 pass standalone); probe reproduces in isolation with zero mugiwara code involved.
- **Classification:** `env` — proven by clean-checkout reproduction (per checkpoint rule: reproduce on clean checkout = env, not code).
- Ledger: blocker row exists (filed at execution); root cause appended below.

## Definition of Done

| Axis | Verdict | Evidence |
|------|---------|----------|
| Correctness | PASS | 92 scoped tests + 30 cost module tests, all literal-asserted; cost.ts math equals lane-base.sh/savepoint.sh (parity) |
| Quality | PASS | typecheck clean; no hardcoded budget/threshold literals left in mission.ts |
| Integration | PASS | closure family (archive fold, dry-run, pr-verdict survival) green; gate 13/13 steps green on clean capture |
| Docs | PASS | docs/concepts/cost.md extended; plan/spec/trail all English |
| Ship-readiness | PASS* | 1 green gate capture; only red = pre-existing env flake (ledgered, root-caused, fix = separate mission) |

## Flow-stage verdict

**PASS** — all acceptance criteria verified by fresh re-run. One pre-existing
env-class blocker (enforcement timing flake) documented with root cause;
recommend a separate small fix mission (2-line change in `hooks/pipeline-guard.ts`
or the test fixture), NOT part of phase 1 scope.

## Blocker ledger update

Existing rows (from execution) now carry the root cause:
- `enforcement.test.ts` escape #2 flake — ROOT CAUSE: FS mtime lags wall clock ~2.5 ms on this host's tmpdir; `planTouched()` boundary misses writes in the window. Fix suggestion for the separate mission: compare with a tolerance (e.g. `>= sessionStart - 50ms`) or set plan mtime explicitly in the fixture (`fs.utimesSync`).
