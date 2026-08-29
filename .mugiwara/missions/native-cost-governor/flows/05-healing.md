# Flow 8 — Healing (cycle 1) — Phase 2 must-fix defects

Fixes applied to the three review must-fix findings (`review-phase2.md` H1/M1/M2).
TDD: each fix's test was written first, run red, then the fix landed green.

## H1 (High) — `context-registry.jsonl` survives archive loose

- **Root cause:** the archive fold set (`src/mission.ts` `archiveMission`) and its
  removal loop only handled `cost-events.jsonl`; `context-registry.jsonl` was
  neither folded into `report.md` nor removed → it survived loose, breaking
  survival parity with its sibling ledger.
- **Fix:** added `if (existsSync(join(dir,'context-registry.jsonl'))) fold.push('context-registry.jsonl')`
  beside the cost-events fold. The shared fold loop both appends `## Archived:
  context-registry.jsonl` to `report.md` and `rmSync`s the file.
- **Test:** `closure-integration.test.ts` "context-registry.jsonl folds into
  report.md and is removed (survival parity)" — asserts `## Archived:
  context-registry.jsonl` and the archived entry id are in report.md AND the
  file no longer exists after archive.
- **Commit:** `17b4c7c fix(context): fold and remove context-registry.jsonl at archive (H1)`

## M1 (Med) — contradictory efficiency metrics

- **Root cause:** `src/mission.ts` fed `unique_chars:0, total_chars:0` into
  `computeContextMetrics` because the registry tracked reads, not char payloads.
  So `duplicate_chars`/`read_avoidance_chars` were always `0` beside a real
  `reuse_rate>0` — a contradiction.
- **Fix (honest-data):** extended `RegistryEntry` with a `chars` field (content
  length); `registerRead` records `chars: e.content.length`. `mission.ts` now
  sums `unique_chars`/`total_chars` from real payloads (`duplicate_chars` =
  `total − unique` = bytes re-read, `read_avoidance_chars` = same). When a
  registry exists but carries no char payloads (legacy/absent field), the char
  fields render as `n/a` with a `(char data not tracked)` note — never a
  fabricated `0` — so `reuse_rate > 0` can never coexist with a false
  `read_avoidance_chars: 0`.
- **Tests:** `closure-integration.test.ts` "renders context metrics from a
  present registry" (now asserts `duplicate_chars: 100`, `read_avoidance_chars:
  100`, `reuse_rate: 0.333…`, and `not read_avoidance_chars: 0`) + new "renders
  n/a for char fields when registry carries no char payloads".
- **Commit:** `115785a fix(context): real char accounting for efficiency metrics (M1)`

## M2 (Med) — `context_status:'over'` unreachable

- **Root cause:** `src/mission.ts` threw on over-budget (context char budget
  exceeded) at the top of the cost block, before `appendCostEvent` ran — so
  every persisted closure event had `context_status:'ok'`; `'over'` could never
  be recorded.
- **Fix (option a):** moved the over-budget throw to AFTER `appendCostEvent`.
  An over-budget closure now writes the closure event (with
  `context_status:'over'`) to the ledger, then the hard gate throws. The
  over-budget condition is captured, not erased.
- **Test:** `closure-integration.test.ts` "over-budget closure records a cost
  event with context_status 'over' before the gate throws" — asserts the
  archive still throws `context budget failed` AND `cost-events.jsonl` contains
  `"context_status":"over"`.
- **Commit:** `5ca71bb fix(context): record 'over' closure event before the budget throw (M2)`

## Verification

- `bun run typecheck` — pass.
- Affected tests (`closure-integration`, `context`, `evidence`, `cost`):
  **73 pass** (baseline 70 → +3 new).
- Full `bun run gate`: blocked by the **pre-existing `enforcement.test.ts`
  "guard: plan written + no planner dispatched → warns" flake** — reproduced on
  the parent commit `02c4d78` (2/5 fails) in this session; tracked in
  blockers.md row 3 as a separate fix mission. My diff does not touch that path.
  485/486 tests pass (the one failure is that flake).
- Every post-test gate step run individually — all green: `build`,
  `validate-content`, `lane-base`, `check-doc-links`, `verify-pack`,
  `run-evals`, `retrieval-eval` (201/201), `verify-install`, `conformance`.
- Coverage (flake excluded, coverage-gate metric = lines): `evidence.ts` **100%**
  (new, limit 90) ✓, `mission.ts` **94.41%** (modified, limit 80) ✓.

## Savepoints

`scripts/savepoint.sh` and `scripts/lane-base.sh` untouched. No PR, no push, no
merge (per Luffy). Escalation: the `enforcement.test.ts` timing flake is the
only thing between the branch and a green gate; it is already a separate
tracked fix mission (blockers.md row 3), not a Phase-2 defect.
