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
