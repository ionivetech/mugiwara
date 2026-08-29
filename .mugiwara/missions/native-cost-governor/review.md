# Robin — Phase 1 Cost Governor review (`a1136a7..HEAD`)

Diff: `src/cost.ts` (new), `src/mission.ts`, `docs/concepts/cost.md`, `test/cost.test.ts`, `test/closure-integration.test.ts`. Depth: `full`.

## Verdict: **FAIL — with must-fix** (gate-parity enforcement + ledger secret-scan gap)

The implementation math is **correct** — I verified every formula against `scripts/savepoint.sh`
and `scripts/lib/lane-base.sh` (see Breaking-change/parity check below). The refactor cleanly
kills the hardcoded `12000/25000/50000/3000` + `1.5x/3x` literals in `src/mission.ts`. But two
things must be fixed before merge:

1. **The documented "drift between the two sides is a CI failure" guarantee is only half-true.**
   Constant parity is test-enforced; **gate-semantics parity with `savepoint.sh` is not**.
2. **`cost-events.jsonl` (ext `.jsonl`) bypasses the closure secret-scan** and folds into
   `report.md` after the gate has run.

---

## Correctness

### `[High]` Gate-semantics parity with savepoint.sh is NOT enforced — the mission's core claim is unguarded
- Location: `test/cost.test.ts:48-88` (thresholds + budgetStatus + delegateAt) vs `scripts/savepoint.sh` gate (`WARN_AT=$(( BUDGET * 3 / 2 ))`, `STOP_AT=$(( BUDGET * 3 ))`, stop-then-warn-then-ok).
- Issue: `warnAt/stopAt/budgetStatus/delegateAt` are asserted against **frozen literals** (18000/36000/…), never parsed from `savepoint.sh`. The parity harness at `test/cost.test.ts:127-144` reads only `lane-base.sh` for the *constants*. If savepoint.sh's gate changes (e.g. `STOP_AT` → `BUDGET * 4`, or the `-ge` boundary → `-gt`), **every test stays green while cost.ts silently diverges**. The plan's own risk table (`plan.md:271`) names "Threshold math drift" and claims "parity test" as mitigation — that mitigation is absent for the gate. `docs/concepts/cost.md:154` ("Drift between the two sides is a CI failure") overstates the coverage.
- Fix: extend the parity harness to regex-parse `scripts/savepoint.sh` for `WARN_AT=$(( BUDGET * N / M ))`, `STOP_AT`, and the gate branch order; assert `warnAt/stopAt/budgetStatus` reproduce them. Same D5 pattern already used for lane-base.sh.

### `[Low]` Closure event `status` may disagree with savepoint's `budget_status` when a context budget is configured
- Location: `src/mission.ts:162,201-208` vs `scripts/savepoint.sh` gate.
- Issue: `effBudget = readBudgetConfig() || laneBudget` (`src/budget.ts:15`, `context_budget_chars`, in **chars**) is used for `budgetStatus`, but savepoint gates against the **lane token budget**. With `context_budget_chars` set, the event's recorded `status` and the report's `Budget status` compare token `est` against char-count thresholds — apples-to-oranges and divergent from state.json `budget_status`. Pre-existing display quirk, but the new event now bakes it into the append-only ledger that later phases consume.
- Fix: record `status` against the **lane** budget (the gate savepoint actually enforces), or gate both on the same budget.

### `[Pass]` warnAt / stopAt / budgetStatus / delegateAt integer math verified
- `Math.floor((b*3)/2)` == `$(( BUDGET * 3 / 2 ))` for all positive integer budgets (and equals plan's `Math.floor(b*1.5)` for integer b). `stopAt` == `BUDGET*3`. Gate branch order (stop → warn → else ok) and `budget > 0` guard match savepoint exactly; budget ≤ 0 → ok. `delegateAt` == `$(( BUDGET * T / 100 ))`. **PASS.**
- Nit: `delegateAt` doesn't clamp `thresholdPct` to [1,100] like savepoint does (`savepoint.sh` clamps). Dormant (unused) — clamp when Phase 2 consumes it.

---

## Quality / Maintainability

### `[Medium]` Four exported functions are dead code — plan-vs-code drift
- Location: `src/cost.ts:39-70,87-103,148-160` — `laneBaseForLane`, `delegateAt`, `costEnvelope`, `recordOptDecision`.
- Issue: zero consumers in `src/` (grep confirms). `plan.md:47-49` architecture diagram claims they are "consumed by mission.ts" / "mission.ts archive + decisions.md", but `mission.ts` imports only `budgetForLane, budgetStatus, warnAt, stopAt, appendCostEvent`. Speculative Phase-2 surface shipped now. YAGNI + the plan diagram is inaccurate.
- Fix: either defer the four to Phase 2, or correct the plan diagram and add a one-line note that they are reserved Phase-2 surface. Do not ship tested-but-unwired API and document it as consumed.

### `[Low]` `status` computed twice though in scope
- Location: `src/mission.ts:166` (uppercase for display) and `:206` (lowercase for event).
- Issue: plan T3 (`plan.md:199`) says "Reuse values already computed for the cost section; do not recompute anything." Reuse the first `budgetStatus` result for both display and event.
- Fix: compute once, derive display casing at render.

### `[Nit]` Unused import `readdirSync`
- Location: `test/cost.test.ts:7`.
- Issue: imported, never used (only `mkdtempSync/writeFileSync/readFileSync/existsSync` used).
- Fix: drop `readdirSync`.

### `[Nit]` Redundant closure-event in report
- Location: `src/mission.ts:201-208` + `:273` + `:258`.
- Issue: the report carries the event twice — once folded (`## Archived: cost-events.jsonl`) and once in the `## Cost` section. Harmless duplication; note it so later phases don't grow it.

---

## Archive fold / survival (asked #2)

### `[Pass]` cost-events.jsonl cannot survive loose in a real archive
- Traced: with state → `appendCostEvent` writes it (`:201`) → `existsSync` fold add (`:237`, uses live fs check, not the stale `files` snapshot at `:135`) → folded into report (`:258`) → `rmSync` removed (`:276-279`). Even with state null and a pre-existing ledger (later-phase savepoint), the `existsSync` guard still folds + removes it. `rmSync *.json` at `:286` does not match `.jsonl`, but the fold rm covers it. **No survival path. PASS.**
- Dry-run never calls `appendCostEvent` (guarded by `!dryRun`) — matches the new test.

### `[Low]` Dry-run misreports a pre-existing ledger as removed
- Location: `src/mission.ts:318-320`.
- Issue: dry-run with a pre-existing `cost-events.jsonl` adds it to `removed` (`:319`) but neither folds nor removes it — the dry-run plan is inaccurate. The new dry-run test only covers the no-pre-existing case.
- Fix: in dry-run, only report removals that would actually occur, or fold the ledger content into the dry-run report so the "removed" is honest.

---

## ESM / concurrency (asked #3)

### `[Pass]` ESM correctness
- `node:fs` / `node:path` imports only; no `require()` in `cost.ts` or `mission.ts`. `import.meta.dirname` matches existing test convention (`test/plugin.test.ts`). **PASS.**

### `[Pass]` appendCostEvent append-only
- Single `appendFileSync(..., 'a')` → O_APPEND; line-sized writes don't interleave under concurrency; `JSON.stringify` escapes newlines so a hostile `mission` can't break the JSONL line. `mkdirSync(recursive)` safe. **PASS.**

### `[Low]` recordOptDecision read-then-append TOCTOU
- Location: `src/cost.ts:151-158`.
- Issue: two concurrent writers both seeing the section missing can each prepend the header → duplicate `## Cost governor decisions` sections. Benign (mission.ts already accepts the same race for index.md, `:332-336`), but the file is single-writer per mission in practice.
- Fix: accept + document, or write the header under an exclusive lock if Phase 2 opens concurrent writers.

---

## Security (asked #4 — hand to Jinbe per `mugiwara-security`)

### `[Medium]` cost-events.jsonl bypasses the closure secret/path scan, then ships in report.md
- Location: `src/integrity.ts:41` `TRAIL_EXTS = {'.md','.json','.sh'}` vs `src/mission.ts:237` fold.
- Issue: extension `.jsonl` is outside `TRAIL_EXTS`, so a pre-existing ledger (a later-phase savepoint-write) is **not** scanned by `SECRET_PATTERNS` or path/link checks — and it folds into `report.md` **after** the gate ran (`:123` gate, `:201+237` fold). A secret in the ledger could ship in the archived report unflagged.
- Fix: add `.jsonl` to `TRAIL_EXTS`, or run the gate after the fold/write of the final report. Route to Jinbe.

### `[Medium]` recordOptDecision injects unsanitized content into decisions.md → report.md
- Location: `src/cost.ts:156-158`.
- Issue: `actor/decision/reason/evidence` interpolated raw into a markdown bullet with no newline/markdown sanitization. A model-authored decision containing `\n` breaks the one-bullet structure and can inject arbitrary markdown (fake rows/sections) that later folds into `report.md`. Not code-exec (local single-writer) but corrupts the audit log and can inject misleading content. Dormant now (no consumer) — becomes live in Phase 2.
- Fix: strip `\n` and `\r` from all four fields before interpolation (they're flat fields by contract).

### `[Low]` appendCostEvent / recordOptDecision take unvalidated missionDir
- Location: `src/cost.ts:124,148`.
- Issue: no path or name validation inside the exported helpers — they write wherever `missionDir` points. Safe today because `archiveMission` passes an allowlisted `join(root, 'missions', mission)` (`src/mission.ts:113`), but the exported API itself is unguarded against a caller passing `..`/absolute.
- Fix: validate `missionDir` resolves inside the missions tree, or document the trust boundary on the helpers.

---

## Reliability rating: **7 / 10**

Core budget/threshold math is correct and exactly matches `savepoint.sh` (verified line-by-line); the
refactor is clean and the existing closure tests pass unchanged (behavior preserved). Deductions:
- −1.5: the central guarantee ("drift = CI failure") is half-unenforced — gate semantics untested vs `savepoint.sh`.
- −1: `.jsonl` ledger evades the closure secret-scan, and the security surface grows in Phase 2 without a test.
- −0.5: dead exported API + plan-vs-code drift + minor fold/dry-run edge cases.

Math reliability is high; **governance reliability** (the parity guard and the ledger's integrity
enforcement) is what keeps it from 9–10.

---

## Findings summary

| # | Sev | Location | One-liner |
|---|-----|----------|-----------|
| C1 | High | `test/cost.test.ts:48-88` | Gate-semantics parity with savepoint.sh unenforced — constants locked, gate not. Must-fix. |
| C2 | Low | `src/mission.ts:162,206` | Event status vs context-budget (chars) can disagree with savepoint's lane-budget gate. |
| S1 | Med | `src/integrity.ts:41` | `.jsonl` ledger bypasses secret/path scan; folds into report.md post-gate. Route to Jinbe. |
| S2 | Med | `src/cost.ts:156-158` | recordOptDecision interpolates unsanitized fields → markdown injection in decisions/report. |
| S3 | Low | `src/cost.ts:124,148` | Exported helpers write to unvalidated missionDir; rely on caller allowlist. |
| Q1 | Med | `src/cost.ts` | laneBaseForLane/delegateAt/costEnvelope/recordOptDecision dead — plan claims consumed, mission.ts doesn't. |
| Q2 | Low | `src/mission.ts:166,206` | status recomputed twice despite plan "do not recompute". |
| Q3 | Nit | `test/cost.test.ts:7` | Unused `readdirSync` import. |
| Q4 | Nit | `src/mission.ts:258,273` | Closure event appears twice in report (folded + Cost section). |
| F1 | Low | `src/mission.ts:318-320` | Dry-run reports pre-existing ledger as removed but doesn't remove/fold it. |
| P1 | Nit | `src/cost.ts:68` | delegateAt lacks savepoint's [1,100] threshold clamp (dormant). |

**Blockers/majors routed to Brook:** C1 (High), S1 + S2 (Med security).
**Security handoff to Jinbe:** S1, S2, S3 via `mugiwara-security`.
