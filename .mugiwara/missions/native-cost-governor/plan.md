# native-cost-governor — Phase 1: Cost Governor Foundation

**Scope:** Phase 1 of the Native Cost Governor initiative (plan §51). Phases
2–9 are follow-up missions — see Mission split. Phase 1 delivers the domain
module, centralized budget/threshold handling on the TS side, cost events,
and optimization decision records — **preserving existing behavior exactly**.

**Primary goal:** centralize the budget/threshold logic that today is
duplicated (`src/mission.ts` hardcodes the same lane budgets + warn/stop
math that `scripts/lib/lane-base.sh` owns), and introduce the two record
primitives (cost events, optimization decisions) the later phases build on.

## Key decisions

1. **Shell stays the runtime source of truth.** `savepoint.sh` + `lane-base.sh`
   compute the live token budget at savepoint time and cannot import TS. Phase 1
   does NOT migrate them (that would risk "preserve existing behavior"). Instead
   `src/cost.ts` mirrors the constants and a **parity test machine-checks**
   `cost.ts` against `lane-base.sh` — the same D5 pattern `scripts/lane-base.ts`
   already uses. A drift fails CI, exactly like lane-base drift.
2. **Kill the mission.ts duplicate.** `src/mission.ts:159` hardcodes
   `lean 12000 / standard 25000 / full 50000 / spike 3000` and lines 186–187
   re-implement the 1.5×/3× thresholds by hand. Replace with `cost.ts` calls.
   Numbers and behavior stay byte-identical.
3. **Cost events = append-only JSONL** at `.mugiwara/missions/<m>/cost-events.jsonl`
   (single atomic write per record; no read-modify-write race). First real
   consumer: archive records a `closure` event. Archive folds the file into
   report.md (like every other trail artifact) so nothing survives loose.
4. **Optimization decision records live in the existing `decisions.md`**
   under a `## Cost governor decisions` section — the trail the plan §41 asks
   for already folds at archive for free. No new file.
5. **No new config keys in Phase 1.** The plan §6 cost profile
   (`cost: mode/budget/context/…`) belongs to the adaptive-budget phases.
   Default config stays byte-identical; `DEFAULT_CONFIG` untouched.
6. **No new docs files.** `docs/concepts/cost.md` already documents the budget
   model (referenced by `src/budget.ts`); extend it by one section pointing at
   the new module. Full docs set (`docs/cost-governor.md` etc.) is Phase 9.
7. **`savepoint.sh` is NOT touched.** All Phase 1 consumers are TS-side.

## Architecture overview

```
lane-base.sh (shell source of truth, D5)
      │  parsed by scripts/lane-base.ts (gate) and cost.parity test (new)
      ▼
src/cost.ts  ← NEW Cost Governor domain module (pure + record helpers)
      │  budgetForLane / laneBaseForLane / warnAt / stopAt / budgetStatus /
      │  delegateAt / costEnvelope     → consumed by mission.ts
      │  appendCostEvent / recordOptDecision → mission.ts archive + decisions.md
      ▼
src/mission.ts  (modified: no hardcoded budgets/thresholds; closure cost
                 event; folds cost-events.jsonl into report.md)
```

Pure functions live in `cost.ts` and are unit-tested; I/O helpers
(appendCostEvent, recordOptDecision) take the mission dir and are tested
against temp dirs.

## Project structure (touched)

| File | Change |
|------|--------|
| `src/cost.ts` | NEW — domain module (constants, pure budget/threshold/envelope functions, CostEvent + OptDecision types, append helpers) |
| `src/mission.ts` | MODIFY — consume cost.ts for lane budgets + thresholds; record closure cost event; fold `cost-events.jsonl` into report |
| `docs/concepts/cost.md` | MODIFY — add Cost Governor module section (short) |
| `test/cost.test.ts` | NEW — module + parity + event + decision-record tests |
| `test/mission.test.ts` | MODIFY — only if an existing assertion breaks (expected: none — behavior preserved) |
| `scripts/lib/lane-base.sh` | UNCHANGED — source of truth, parsed by tests |
| `scripts/savepoint.sh` | UNCHANGED |

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Centralize budgets + thresholds on TS side | T1–T2 | `bun test test/cost.test.ts test/mission.test.ts test/closure.test.ts` green; no hardcoded lane budgets left in mission.ts |
| 2 | Record primitives: cost events + optimization decisions | T3–T4 | `bun test test/cost.test.ts` green; archive folds `cost-events.jsonl` |
| 3 | Full verification | T5 | `bun run gate` fully green |

## Implementation graph

```
T1 cost.ts (module) ──consumes: lane-base.sh values──► T2 mission.ts refactor
                                                          │ (same file)
                                                          ▼
                                                       T3 cost events (mission.ts + cost.ts)
                                                          │ (same cost.ts)
                                                          ▼
                                                       T4 opt decision records (cost.ts)
                                                          │
                                                          ▼
                                                       T5 full gate
```

T2 consumes T1 (imports cost.ts). T3 consumes T2 (edits mission.ts archive
path T2 just refactored). T4 consumes T3 (both add to cost.ts). T5 consumes
all. Chain is strictly sequential — no `[PARALLEL]` anywhere (every edge
shares a file: mission.ts between T2/T3, cost.ts between T3/T4).

## Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | cost.ts domain module | src/cost.ts, test/cost.test.ts | M | — | `bun test test/cost.test.ts` green |
| T2 | mission.ts consumes cost.ts | src/mission.ts, docs/concepts/cost.md, test/cost.test.ts (parity) | S | T1 | no lane budget literal in mission.ts; parity + existing tests green |
| T3 | cost events (JSONL + closure wiring + fold) | src/cost.ts, src/mission.ts, test/cost.test.ts | S | T2 | event append + archive fold tests green |
| T4 | optimization decision records | src/cost.ts, test/cost.test.ts | S | T3 | decision-record tests green |
| T5 | full gate + evidence | — | S | T4 | `bun run gate` exit 0, evidence captured |

## Detail tasks

**Task 1: cost.ts domain module**
- Files: create `src/cost.ts`, `test/cost.test.ts`
- Interfaces: produces `src/cost.ts` (imported by T2, T3, T4)
- Size: M
- Steps:
  - [ ] Write `test/cost.test.ts` first (TDD — see acceptance for the full case list)
  - [ ] Implement `src/cost.ts`:
    - Constants `LANE_BASE` and `LANE_BUDGET` for `lean | standard | full | spike`
      — values copied from `scripts/lib/lane-base.sh` (read it; do not guess;
      the parity test in T2 locks them against the file)
    - `budgetForLane(lane: string): number` — lean 12000, standard 25000,
      full 50000, spike 3000, anything else 0
    - `laneBaseForLane(lane: string): number` — LANE_BASE_* values from
      lane-base.sh, unknown lane → 0
    - `warnAt(budget: number): number` — `Math.floor(budget * 1.5)` — MUST
      equal savepoint.sh's `BUDGET * 3 / 2` integer math for all four budgets
      (floor(12000*1.5)=18000 == 12000*3/2; verify per lane with the same
      formula savepoint.sh uses: `BUDGET * 3 / 2`, integer division)
    - `stopAt(budget: number): number` — `budget * 3` (savepoint.sh exact math)
    - `budgetStatus(budget: number, tokens: number): 'ok' | 'warn' | 'stop'`
      — replicate savepoint.sh: `budget > 0 && tokens >= stopAt → 'stop'`,
      `budget > 0 && tokens >= warnAt → 'warn'`, else 'ok'. Edge: budget ≤ 0 → 'ok'
    - `delegateAt(budget: number, thresholdPct: number): number` —
      `budget * thresholdPct / 100` integer division (savepoint.sh exact)
    - `costEnvelope(state: { tokens_est?: number; budget?: number; lane?: string })`
      → `{ planned, used, remaining, pct, warn_at, stop_at, status }` —
      remaining = budget − tokens (floor at 0), pct = budget > 0
      ? round(used/planned*100) : 0. Pure, computed — nothing written to state
    - Type `CostEvent` (see T3) and `OptDecision` (see T4) — declare in this
      task so consumers type against them
  - [ ] Commit `feat(cost): add cost governor domain module`
- Acceptance:
  - `bun test test/cost.test.ts` passes. Test cases:
    - budgetForLane returns 12000/25000/50000/3000/0 for
      lean/standard/full/spike/unknown
    - warnAt/stopAt match savepoint.sh math for every budget
    - budgetStatus boundaries: below warn → 'ok'; at warn → 'warn'; at stop → 'stop';
      over stop → 'stop'; budget 0 → 'ok'
    - delegateAt(12000, 60) === 7200; delegateAt(25000, 60) === 15000
    - costEnvelope: full envelope shape with planned/used/remaining/pct/status;
      remaining floors at 0; pct rounds; budget 0 → pct 0, status 'ok'
  - `bun run typecheck` passes
- Risk: none

**Task 2: mission.ts consumes cost.ts**
- Files: modify `src/mission.ts`, `docs/concepts/cost.md`; extend `test/cost.test.ts` (parity)
- Interfaces: consumes `src/cost.ts` from T1
- Size: S
- Steps:
  - [ ] In `test/cost.test.ts` add parity cases: parse
    `scripts/lib/lane-base.sh` with a regex for `LANE_BASE_<lane>=` and
    `BUDGET_<lane>=` (same parse `scripts/lane-base.ts` uses — copy that
    pattern) and assert each equals the matching `cost.ts` constant — all
    four lanes
  - [ ] Refactor `src/mission.ts`:
    - Line 159 hardcoded ternary → `budgetForLane(lane)` (import from './cost.ts')
    - Lines 186–187 `est >= effBudget * 3` / `est >= effBudget * 1.5` →
      `budgetStatus(effBudget, est)` mapped to uppercase 'STOP'/'WARN'/'OK'
    - Line 162 `(est <= effBudget ? under : over)` math stays as-is (display)
  - [ ] `docs/concepts/cost.md`: add one section "Cost Governor module
    (`src/cost.ts`)" — one paragraph: what it centralizes, that lane-base.sh
    remains the shell source of truth, parity enforced by test
  - [ ] Run `bun test test/cost.test.ts test/mission.test.ts test/closure.test.ts`
    — all green, no existing assertion changed (behavior preserved)
  - [ ] Commit `refactor(cost): centralize lane budgets and thresholds in cost.ts`
- Acceptance:
  - `grep -nE '12000|25000|50000|3000|\* 3|\* 1\.5' src/mission.ts` returns
    nothing (no hardcoded budget/threshold logic left)
  - parity tests pass; existing `test/mission.test.ts` + `test/closure.test.ts`
    pass UNCHANGED (proof of preserved behavior)
- Risk: medium — refactor of archive path; existing closure tests are the
  safety net. Rollback: revert the single commit.

**Task 3: cost events (JSONL + closure wiring + fold)**
- Files: modify `src/cost.ts`, `src/mission.ts`; extend `test/cost.test.ts`
- Interfaces: consumes `src/cost.ts` types from T1; edits mission.ts archive path from T2
- Size: S
- Steps:
  - [ ] Extend `test/cost.test.ts` with event cases (below) — TDD
  - [ ] In `src/cost.ts`:
    - `type CostEvent = { ts: string; kind: 'closure' | 'savepoint' | 'decision' | string; mission: string; tokens_est: number; budget: number; status: string; [k: string]: unknown }`
    - `appendCostEvent(missionDir: string, event: Omit<CostEvent, 'ts'>): void`
      — appends ONE JSON line to `<missionDir>/cost-events.jsonl` (create dir
      if missing; single `appendFileSync` write; no read-modify-write)
  - [ ] In `src/mission.ts` archiveMission (non-dry-run path, right before the
    fold): build a `closure` event — `{ kind: 'closure', mission, tokens_est:
    est, budget: effBudget, status: pct-based same as costSection, context_chars: chars }`
    — and `appendCostEvent(dir, …)`. Reuse values already computed for the
    cost section; do not recompute anything.
  - [ ] Extend the fold: add `'cost-events.jsonl'` to the fold set in
    archiveMission so it folds into report.md as `## Archived:
    cost-events.jsonl` and is removed with the rest (verify the existing fold
    loop handles a non-md file — it reads via readFileSync generically; if the
    FOLD_TOP list or flow-fold list is md-specific, add a dedicated fold entry
    for the jsonl).
  - [ ] Run `bun test test/cost.test.ts test/closure.test.ts test/mission.test.ts`
  - [ ] Commit `feat(cost): record closure cost event and fold cost ledger into report`
- Acceptance:
  - Test cases green:
    - appendCostEvent creates the file on first write, appends a second line
      (file has exactly 2 lines, both parse as JSON with the expected fields)
    - append to a missing dir creates it
    - archive of a temp mission produces a report.md containing
      `## Archived: cost-events.jsonl` and the event line; `cost-events.jsonl`
      no longer exists after archive (folded + removed)
    - existing closure-integration tests still pass (fold change did not break
      the existing fold contract)
- Risk: medium — archive fold change. Rollback: revert the single commit;
  closure-integration tests cover.

**Task 4: optimization decision records**
- Files: modify `src/cost.ts`; extend `test/cost.test.ts`
- Interfaces: consumes `src/cost.ts` from T3 (same file, sequential)
- Size: S
- Steps:
  - [ ] Extend `test/cost.test.ts` with decision-record cases (below) — TDD
  - [ ] In `src/cost.ts`:
    - `type OptDecision = { ts: string; actor: string; decision: string; reason: string; evidence?: string }`
    - `recordOptDecision(missionDir: string, d: Omit<OptDecision, 'ts'>): void`
      — appends a bullet to `<missionDir>/decisions.md` under a
      `## Cost governor decisions` section: create the section header if the
      file does not already have it (append `\n## Cost governor decisions\n\n`
      then the bullet), otherwise append the bullet after the last line of the
      file. Bullet format: `- <iso-ts> — <actor>: <decision> — reason: <reason>`
      (evidence appended when present: ` — evidence: <evidence>`). Existing
      file content is never modified — only appended to.
  - [ ] Run `bun test test/cost.test.ts`
  - [ ] Commit `feat(cost): add optimization decision record`
- Acceptance:
  - Test cases green:
    - on a fresh decisions.md, first record creates the section header + one
      bullet
    - a second record appends a second bullet; the file has exactly one
      `## Cost governor decisions` header
    - an existing decisions.md with other sections keeps them untouched, header
      + bullets appended at the end
    - missing dir → creates dir + file
  - `bun run typecheck` passes
- Risk: none

**Task 5: full gate + evidence**
- Files: none new; evidence → `.mugiwara/missions/native-cost-governor/flows/01-execution.md`
- Interfaces: consumes T1–T4
- Size: S
- Steps:
  - [ ] Run `bun run gate` — capture full output (this runs build-hooks:check,
    typecheck, test:coverage, build, validate-content, lane-base, run-evals,
    retrieval-eval, verify-install — per AGENTS.md)
  - [ ] If any gate fails: fix within scope, re-run. No gate may be waived.
  - [ ] Write `flows/01-execution.md`: task table (T1–T5), per-task evidence
    (test commands + outputs), gate output summary, `# Verdict:` line
  - [ ] Commit `chore(cost): phase 1 verification evidence`
- Acceptance: `bun run gate` exit 0 (full output captured in
  `.mugiwara/missions/native-cost-governor/flows/01-execution.md`)
- Risk: none

## Risk & rollback

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Threshold math drift (cost.ts ≠ savepoint.sh) | low | wrong budget gates | parity test + existing lane-integrity + closure tests |
| Archive fold change breaks closure | low | archive fails | closure-integration/closure-runtime tests cover fold; rollback = revert commit |
| Full gate slow (evals/retrieval) | certain | time | run once at T5 with captured output |
| Test count regression | low | CI red | existing 400+ tests must pass unchanged — proof of preserved behavior |

Rollback plan: each task is one revertible commit; T5 evidence lists exact
commits. Worst case: `git revert` the phase commits — behavior is preserved
by construction (no savepoint.sh/config changes).

## Mission split (Phase 1 of the initiative)

The Native Cost Governor initiative (plan §51) is a 9-phase campaign. Each
phase = its own mission, branch, and PR (trunk-based, reviewable diffs —
same pattern as the roadmap-v0.8 campaign). No parallel tracks: later phases
consume Phase 1's module.

| Phase | Scope | Follow-up mission |
|-------|-------|-------------------|
| 1 (THIS) | Foundation: cost.ts, centralized budgets/thresholds, cost events, opt decisions | — |
| 2 | Context Governor: accounting, duplicate detection, evidence refs | `native-cost-governor-phase2` |
| 3 | Work Governor: stage classification, invocation control, completion | `native-cost-governor-phase3` |
| 4 | Scope & Code Governor | `native-cost-governor-phase4` |
| 5 | Cognitive & Output Governor | `native-cost-governor-phase5` |
| 6 | Stop-Slop | `native-cost-governor-phase6` |
| 7 | Adaptive budget + circuit breaker | `native-cost-governor-phase7` |
| 8 | Reporting & CLI (`mugiwara cost`) | `native-cost-governor-phase8` |
| 9 | Benchmark & hardening | `native-cost-governor-phase9` |

## Definition of Done

- `src/cost.ts` exists: constants + pure functions + event/decision helpers,
  all unit-tested.
- `src/mission.ts` has zero hardcoded lane budgets or threshold math.
- `cost.ts` constants are machine-checked against `lane-base.sh` (parity test).
- `cost-events.jsonl` is created on archive with a closure event and folds
  into report.md (nothing loose survives).
- `decisions.md` gains the `## Cost governor decisions` section via
  `recordOptDecision`.
- `bun run gate` passes fully; every pre-existing test passes unchanged.
- No changes to `savepoint.sh`, `lane-base.sh`, `DEFAULT_CONFIG`, or any
  runtime behavior.
