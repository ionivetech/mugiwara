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

---

# native-cost-governor — Phase 2: Context Governor

**Scope:** Phase 2 of the Native Cost Governor initiative (plan §51), mission
split row 2 (`native-cost-governor-phase2`). Phase 2 delivers context
accounting, context budget enforcement, duplicate detection, evidence
references + reuse, investigation limits, and context efficiency metrics —
**without migrating `savepoint.sh`**, which stays the shell runtime source of
truth (architecture decision, `decisions.md` Flow 0 — Phase 2 triage).

**Primary goal:** make context consumption measurable and bounded. Every trail
artifact and read is accounted for, duplicates and repeated reads are detected
and deduplicated, evidence gets stable `E###` references so it is reused
instead of re-read, and investigation is bounded by explicit limits — with
context-economy metrics surfaced in the mission report. Phase 2 is
measurement + detection + records; the behavioral wiring that makes agents
*act* on these signals lands in Phase 3+.

## Key decisions

1. **`savepoint.sh` is NOT touched (confirmed).** It is the shell runtime
   source of truth and, critically, **it does not measure context today** —
   it measures *tokens* (`TOKENS_EST = LANE_BASE + DOC_WORDS*135/100 +
   LOC_TOKENS`, `scripts/savepoint.sh:438-441`) and a per-lane *token* budget
   gate. Because there is no shell-side context measurement to mirror, context
   accounting is defined **in TS** (`src/context.ts`) and the parity harness
   locks its formulas against fixed fixtures + the existing
   `measureContextChars` (`src/budget.ts`), so there is exactly one context
   implementation. The *token* gate parity vs `savepoint.sh` is already locked
   by `test/cost.test.ts` (D5, bash-evaluated) and stays.
2. **Honest boundary — no per-savepoint context telemetry.** Recording context
   at every flow boundary would require a hook inside `savepoint.sh`, which
   Phase 2 does not migrate. Context accounting therefore runs **on demand in
   TS** (at read/archive time) fed by the trail on disk + the evidence
   registry. Per-savepoint context snapshots are deferred to a phase that may
   touch `savepoint.sh`.
3. **Two budgets, never conflated (C2 reconciliation).** `savepoint.sh` gates
   the **lane token budget** (warn 1.5×, stop 3×). `context_budget_chars` is a
   separate **context (chars) budget** gate that `mission.ts` already enforces
   at closure. Phase 2 keeps them apart: the closure cost event `status` gates
   on the **lane token budget** (what savepoint enforces), and context
   accounting has its own `contextStatus` gate on `context_budget_chars`.
   This fixes C2 — the recorded `status` can no longer compare token `est`
   against a char-count threshold.
4. **Config keys — three flat `investigation_*` keys only, per §52.** New keys
   are policy boundaries (justified by spec §13): `investigation_max_passes=2`,
   `investigation_max_unrelated_files=5`, `investigation_repeated_read_threshold=2`.
   Added to `DEFAULT_CONFIG` as commented optional lines (mirrors the existing
   `# context_budget_chars=150000` pattern) and read via `src/config.ts`. No
   other cost-governor internals become config (§52: no micromanagement).
5. **Evidence + dedup share one module (`src/evidence.ts`).** A read/content
   fingerprint registry IS what enables both stable `E###` references (§11) and
   duplicate detection (§12) — "reuse if already available, else register
   E###". One module, one persisted `context-registry.jsonl` (append-only like
   `cost-events.jsonl`).
6. **Phase 2 = measurement, not enforcement.** The modules produce verdicts
   (duplicate, reuse-E###, investigation-stop) and record them as optimization
   decisions via `recordOptDecision` (which becomes live, absorbing S2). Wiring
   those verdicts into the agent flow is Phase 3+ (Work Governor). This is the
   honest boundary: Phase 2 builds the signals, Phase 3 consumes them.
7. **`DEFAULT_CONFIG` gains comment-only lines.** Three commented `investigation_*`
   keys. `readConfig` ignores comments, so no behavior change; existing tests
   that assert the exact `DEFAULT_CONFIG` string are updated in-scope (T3).

## Architecture overview

```
 savepoint.sh / lane-base.sh        (shell source of truth — UNTOUCHED)
      │ token budget gate only; does NOT measure context
      │
 src/cost.ts (Phase 1)              ── T4 hygiene: delegateAt clamp (P1),
      │                                  recordOptDecision \r\n strip (S2)
      ▼
 src/context.ts  ← NEW  accounting (chars+est tokens), contextStatus gate,
      │                  efficiency metrics       (consumes budget.ts measureContextChars)
      │
 src/evidence.ts ← NEW  context registry (context-registry.jsonl): content
      │                  fingerprints, stable E### refs, reuse-or-create,
      │                  repeated-read/symbol/output/diff detection  (T2)
      │
 src/config.ts    ← MODIFY  readInvestigationConfig (T3): max_passes /
      │                  max_unrelated_files / repeated_read_threshold
      │
      ├──────────────┐
      ▼              ▼
 src/investigation.ts ← NEW (T5): pass/surface/path state machine + limits,
      │                  stop verdicts → recordOptDecision  (consumes evidence+context+config)
 src/mission.ts        ← MODIFY (T6): Cost section via costEnvelope (Q1),
      │                  status gated on lane token budget (C2), status once (Q2),
      │                  context metrics surfaced; closure event carries them
      ▼
 mission report.md   +   decisions.md (## Cost governor decisions)
```

Pure functions (accounting, status, metrics, fingerprints, investigation
state machine) are unit-tested; I/O (registry append, decision records) uses
the Phase-1 append-only helpers and is tested against temp dirs.

## Project structure (touched)

| File | Change |
|------|--------|
| `src/context.ts` | NEW — context accounting (trail chars + est tokens), `contextStatus` gate, `computeContextMetrics` |
| `src/evidence.ts` | NEW — content fingerprint registry, stable `E###` refs, reuse-or-create, dedup/repeated-read detection |
| `src/investigation.ts` | NEW — investigation pass/surface/path state machine + limits; stop verdicts |
| `src/config.ts` | MODIFY — `readInvestigationConfig` + three commented `investigation_*` keys in `DEFAULT_CONFIG` |
| `src/cost.ts` | MODIFY — `delegateAt` [1,100] clamp (P1); `recordOptDecision` \r\n strip (S2) |
| `src/mission.ts` | MODIFY — Cost section via `costEnvelope` (Q1); `status` on lane token budget (C2); status once (Q2); context metrics + closure-event context fields |
| `docs/concepts/cost.md` | MODIFY — context accounting + investigation limits section |
| `test/context.test.ts` | NEW |
| `test/evidence.test.ts` | NEW |
| `test/investigation.test.ts` | NEW |
| `test/config.test.ts` | MODIFY — investigation config cases |
| `test/cost.test.ts` | MODIFY — delegateAt clamp + sanitize cases |
| `test/closure-integration.test.ts` | MODIFY — closure event context fields + Cost-section metrics |
| `test/closure.test.ts` | MODIFY — only if an existing assertion breaks (expected: none) |
| `scripts/savepoint.sh`, `scripts/lib/lane-base.sh` | UNCHANGED — shell runtime source of truth, untouched |

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Build the four disjoint foundations | T1–T4 | `bun test test/context.test.ts test/evidence.test.ts test/config.test.ts test/cost.test.ts` green |
| 2 | Investigate + integrate on top | T5–T6 | `bun test test/investigation.test.ts test/closure-integration.test.ts test/closure.test.ts test/cost.test.ts` green |
| 3 | Full verification | T7 | `bun run gate` exit 0 |

## Implementation graph

```
T1 context.ts ────────────────┐
T2 evidence.ts ──────────────┐│
T3 config.ts   ────────────┐ ││  [PARALLEL] — 4 disjoint files,
T4 cost.ts     ──────────┐ │ ││  no interface edges between them
                         ▼ ▼▼▼
T5 investigation.ts   (consumes T1,T2,T3)   ┐
T6 mission.ts         (consumes T1,T4)      ┘ [PARALLEL] — disjoint
                                               files (investigation.ts vs
                                               mission.ts), all interfaces
                                               satisfied from Wave 1
                         ▼
T7 full gate (consumes all)
```

**Wave 1 `[PARALLEL]` proof (T1–T4):** file-disjoint — T1 creates
`src/context.ts`+`test/context.test.ts`, T2 `src/evidence.ts`+`test/evidence.test.ts`,
T3 `src/config.ts`+`test/config.test.ts`, T4 `src/cost.ts`+`test/cost.test.ts`; no
two touch the same file. Interface-disjoint — `context.ts` consumes only the
existing `budget.ts`; `evidence.ts` consumes nothing new; `config.ts` touches
no new module; `cost.ts` hygiene imports nothing new. No cross-dependency in
Wave 1. Genuine independence.

**Wave 2 `[PARALLEL]` proof (T5–T6):** file-disjoint — T5 writes
`src/investigation.ts`+`test/investigation.test.ts`, T6 writes `src/mission.ts`+
`test/closure-integration.test.ts`; no overlap. Interface-disjoint — T5 reads
`evidence.ts`/`context.ts`/`config.ts` (all shipped in Wave 1); T6 reads
`context.ts`+`cost.ts` (Wave 1). Neither writes the other's file. Both
consume only completed Wave-1 surfaces.

No other parallel sets exist: T7 consumes every task. Every edge either shares
a file or consumes a not-yet-shipped interface.

## Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | context accounting + budget gate + metrics | src/context.ts, test/context.test.ts | M | — | `bun test test/context.test.ts` green |
| T2 | evidence registry + dedup + reuse refs | src/evidence.ts, test/evidence.test.ts | M | — | `bun test test/evidence.test.ts` green |
| T3 | investigation config keys | src/config.ts, test/config.test.ts, docs/concepts/cost.md | S | — | `bun test test/config.test.ts` green; grep finds the 3 keys |
| T4 | cost.ts hygiene (P1 clamp + S2 sanitize) | src/cost.ts, test/cost.test.ts | S | — | `bun test test/cost.test.ts` green |
| T5 | investigation limits state machine | src/investigation.ts, test/investigation.test.ts | M | T1, T2, T3 | `bun test test/investigation.test.ts` green |
| T6 | mission.ts integration (C2/Q1/Q2 + metrics) | src/mission.ts, test/closure-integration.test.ts | M | T1, T4 | closure + cost tests green; no `budgetStatus(effBudget` left in mission.ts |
| T7 | full gate + evidence | flows/02-execution.md | S | all | `bun run gate` exit 0 |

## Detail tasks

**Task 1: context accounting + budget gate + efficiency metrics** (§10, §52 Context)
- Files: create `src/context.ts`, `test/context.test.ts`
- Interfaces: produces `src/context.ts` (consumed by T5, T6); consumes `src/budget.ts` `measureContextChars` (reuse — never re-implement)
- Size: M
- Steps:
  - [ ] Write `test/context.test.ts` first (TDD — see acceptance)
  - [ ] Implement `src/context.ts`:
    - `measureContextChars` — re-export/use the existing `measureContextChars` from `src/budget.ts` (single implementation; grep-locked in acceptance)
    - `estContextTokens(chars: number): number` — documented chars→token ratio (`Math.round(chars / 4)`), pure. Marked `ponytail:` comment: ratio is a coarse estimate, refine when provider token telemetry exists.
    - `contextStatus(budgetChars: number, chars: number): 'ok' | 'over'` — chars > budgetChars (>0) → 'over', else 'ok'. Mirrors the existing closure throw condition (`src/mission.ts:153`) as a pure, tested gate.
    - `type ContextMetrics = { files_loaded: number; repeated_reads: number; duplicate_chars: number; reuse_rate: number; read_avoidance_chars: number }`
    - `computeContextMetrics(stats: { reads_total: number; reads_reused: number; unique_chars: number; total_chars: number; repeated_reads: number }): ContextMetrics` — reuse_rate = reads_reused/reads_total (0 when total 0); duplicate_chars = total_chars − unique_chars; read_avoidance_chars = duplicate_chars (bytes not reloaded). Pure.
  - [ ] `docs/concepts/cost.md`: one section "Context accounting + budget" — chars measure, est-token ratio, `contextStatus` gate on `context_budget_chars`, that savepoint.sh does not measure context so the TS module is the single definition (formula-locked by test)
  - [ ] Commit `feat(context): context accounting, budget gate, and efficiency metrics`
- Acceptance:
  - `bun test test/context.test.ts` passes. Cases:
    - `measureContextChars` equals `budget.measureContextChars` for a temp trail (reuse proof)
    - `estContextTokens(120000)` === 30000; `estContextTokens(0)` === 0
    - `contextStatus`: over budget (> budgetChars) → 'over'; at/under → 'ok'; budget 0 → 'ok'
    - `computeContextMetrics`: reuse_rate rounds (0.5 → 0.5); duplicate_chars = total−unique; read_avoidance = duplicate; reads_total 0 → reuse_rate 0 (no NaN/Infinity)
  - `bun run typecheck` passes
- Risk: none
- Honesty note: no shell parity needed — savepoint.sh measures tokens, not context; the formula lock is the dedicated fixture test above.

**Task 2: evidence registry + duplicate detection + stable references** (§11, §12)
- Files: create `src/evidence.ts`, `test/evidence.test.ts`
- Interfaces: produces `src/evidence.ts` (consumed by T5); persisted `context-registry.jsonl` beside the mission state (same append-only contract as `cost-events.jsonl`)
- Size: M
- Steps:
  - [ ] Write `test/evidence.test.ts` first (TDD — see acceptance)
  - [ ] Implement `src/evidence.ts`:
    - `fingerprint(content: string): string` — `createHash('sha256')` hex of content (pure)
    - `type RegistryEntry = { fingerprint: string; kind: 'file' | 'symbol' | 'command' | 'test' | 'diff' | 'evidence' | 'agent_response'; file: string; range?: string; id: string; reads: number; ref: string }`
    - `registerRead(registry: RegistryEntry[], e: { kind; file; range?; content }): { ref: string; repeated: boolean }` — if `fingerprint(content)` already present with the same kind → `repeated: true`, `reads`++, return the existing `ref` (reuse, §11); else append a new entry with a stable `E<seq>` id (next integer after the max existing, e.g. `E013`) and return it with `repeated: false`
    - `id` stability: `E<zero-padded seq>` monotonic, never reused across a mission (§11 stable references)
    - `findRepeats(registry, kind?)` → entries with `reads >= 2` (dedup signal, §12)
    - `persistRegistry(missionDir, registry)` / `loadRegistry(missionDir)` — append-one-line-per-entry JSONL `context-registry.jsonl`; read returns the full list. Reuses the mkdir-on-write pattern of `appendCostEvent`
  - [ ] Commit `feat(evidence): content fingerprint registry with stable E### references and dedup`
- Acceptance:
  - `bun test test/evidence.test.ts` passes. Cases:
    - same file read twice → second returns same `ref`, `repeated: true`, `reads === 2`
    - different content → distinct fingerprints, distinct `E###` ids, monotonic (E012 then E013)
    - `findRepeats` returns only entries with reads ≥ 2
    - `persistRegistry`/`loadRegistry` round-trips a temp dir; appends a second entry without rewriting the first; missing dir is created
  - `bun run typecheck` passes
- Risk: none

**Task 3: investigation config keys** (§13, §52)
- Files: modify `src/config.ts`; extend `test/config.test.ts`; `docs/concepts/cost.md`
- Interfaces: produces `readInvestigationConfig` (consumed by T5)
- Size: S
- Steps:
  - [ ] Extend `test/config.test.ts` with cases (below) — TDD
  - [ ] In `src/config.ts`:
    - Add three commented lines to `DEFAULT_CONFIG` (mirror the existing `# context_budget_chars=…` style):
      `# investigation_max_passes=2  # optional: cap investigation passes (spec §13)`, `# investigation_max_unrelated_files=5`, `# investigation_repeated_read_threshold=2`
    - `type InvestigationConfig = { max_passes: number; max_unrelated_files: number; repeated_read_threshold: number }`
    - `readInvestigationConfig(projectDir): InvestigationConfig` — defaults `{ max_passes: 2, max_unrelated_files: 5, repeated_read_threshold: 2 }`; reads the three flat keys via `readConfig`; each parses to a positive integer or falls back to its default (invalid/non-numeric → default)
  - [ ] `docs/concepts/cost.md`: note the three keys + defaults in the investigation-limits section
  - [ ] Run `bun test test/config.test.ts`; if an existing case asserts the exact `DEFAULT_CONFIG` string, update it in-scope (comment lines only — behavior unchanged)
  - [ ] Commit `feat(config): investigation limit keys (max_passes, max_unrelated_files, repeated_read_threshold)`
- Acceptance:
  - `bun test test/config.test.ts` passes. Cases:
    - defaults returned when keys absent (2/5/2)
    - explicit values parsed (4/9/3)
    - non-numeric or zero → default (2/5/2)
  - `grep -E 'investigation_(max_passes|max_unrelated_files|repeated_read_threshold)' src/config.ts` returns 3+ matches
  - `bun run typecheck` passes
- Risk: low — `DEFAULT_CONFIG` string change; existing config tests updated in-scope if they pin the exact string. Rollback: revert the single commit.

**Task 4: cost.ts hygiene — delegateAt clamp (P1) + recordOptDecision sanitize (S2)**
- Files: modify `src/cost.ts`; extend `test/cost.test.ts`
- Interfaces: consumes `src/cost.ts` (self-contained hygiene; no new deps)
- Size: S
- Steps:
  - [ ] Extend `test/cost.test.ts` with cases (below) — TDD
  - [ ] In `src/cost.ts`:
    - `delegateAt`: clamp `thresholdPct` to `[1,100]` before the integer division — matches savepoint.sh's clamp (`DELEGATE_THRESHOLD` clamped 1..100, `scripts/savepoint.sh:110-111`). Fixes review P1.
    - `recordOptDecision`: strip `\n` and `\r` from `actor`, `decision`, `reason`, and `evidence` before interpolation into the markdown bullet (flat fields by contract). Fixes review S2 (markdown/line injection into decisions.md → report.md).
  - [ ] Run `bun test test/cost.test.ts` — existing cases must stay green (clamp only affects out-of-range inputs)
  - [ ] Commit `fix(cost): clamp delegateAt threshold and sanitize opt-decision fields (P1, S2)`
- Acceptance:
  - `bun test test/cost.test.ts` passes. Cases:
    - `delegateAt(12000, 0)` === `delegateAt(12000, 1)` === 120; `delegateAt(12000, 150)` === `delegateAt(12000, 100)` === 12000 (clamped to [1,100]); mid-range unchanged (`delegateAt(12000, 60)` === 7200)
    - `recordOptDecision` with `decision: "stop\n## fake section"` and `reason: "x\ry"` produces exactly one bullet line; `\n`/`\r` absent; no `## fake section` in the file (no markdown injection)
  - `bun run typecheck` passes
- Risk: none

**Task 5: investigation limits state machine** (§13)
- Files: create `src/investigation.ts`, `test/investigation.test.ts`
- Interfaces: consumes `src/evidence.ts` (repeated-read detection), `src/context.ts` (budget), `src/config.ts` `readInvestigationConfig`; emits stop verdicts via `recordOptDecision`
- Size: M
- Steps:
  - [ ] Write `test/investigation.test.ts` first (TDD — see acceptance)
  - [ ] Implement `src/investigation.ts`:
    - `type InvestigationStatus = { pass: number; stop: boolean; reason: '' | 'max passes' | 'max unrelated files' | 'repeated read' | 'objective met' }`
    - `type InvestigationInput = { pass: number; acceptance_mapped: boolean; surface_understood: boolean; path_established: boolean; unrelated_files_opened: number; repeated_reads: number; max_passes: number; max_unrelated_files: number; repeated_read_threshold: number }`
    - `evaluateInvestigation(input): InvestigationStatus` — stop when (stop condition first, spec §13): `acceptance_mapped && surface_understood && path_established` → 'objective met'; `pass >= max_passes` → 'max passes'; `unrelated_files_opened > max_unrelated_files` → 'max unrelated files'; `repeated_reads >= repeated_read_threshold` → 'repeated read'; else continue (`stop: false`)
    - `recordInvestigationStop(missionDir, status, evidence?)` — calls `recordOptDecision` with `{ actor: 'cost-governor', decision: 'stop investigation', reason: status.reason, evidence }` when `status.stop`
  - [ ] `docs/concepts/cost.md`: one line — investigation limits come from config (T3), the state machine enforces spec §13's three limits + objective stop; agent wiring is Phase 3+
  - [ ] Commit `feat(investigation): bounded investigation state machine (max passes/unrelated/repeated-read)`
- Acceptance:
  - `bun test test/investigation.test.ts` passes. Cases:
    - objective-met stops with reason 'objective met' even before any limit
    - pass 2 / max_passes 2 → stop 'max passes' (limit at the boundary)
    - pass 1 / max_passes 2 → continue
    - unrelated_files_opened 6 / max 5 → stop 'max unrelated files'; 5 → continue
    - repeated_reads 2 / threshold 2 → stop 'repeated read'; 1 → continue
    - `recordInvestigationStop` writes a single `## Cost governor decisions` bullet with the reason (reuses sanitized `recordOptDecision`)
  - `bun run typecheck` passes
- Risk: none
- Honesty note: `acceptance_mapped / surface_understood / path_established` are inputs the Phase-3+ consumer supplies; Phase 2 owns the verdict + the audit record.

**Task 6: mission.ts integration — C2/Q1/Q2 + context metrics in report**
- Files: modify `src/mission.ts`; extend `test/closure-integration.test.ts`
- Interfaces: consumes `src/context.ts` (`computeContextMetrics`, `contextStatus`, `measureContextChars`), `src/cost.ts` (`costEnvelope` — Q1 becomes live, `budgetStatus`)
- Size: M
- Steps:
  - [ ] Extend `test/closure-integration.test.ts` with cases (below) — TDD
  - [ ] In `src/mission.ts` archiveMission cost-section block (lines 148–209):
    - **C2:** `status` must gate on the lane token budget — replace `budgetStatus(effBudget, est)` (lines 166, 206) with `budgetStatus(laneBudget, est)`; keep `effBudget = budget || laneBudget` only for the display delta (`under/over`), never for `status`. The `context_budget_chars` gate stays its own line via `contextStatus(contextBudget, chars)`.
    - **Q2:** compute `status` once (single `budgetStatus(laneBudget, est)`), derive `.toUpperCase()` at render; reuse for the event — no double computation.
    - **Q1 (consume costEnvelope):** build the envelope `costEnvelope({ lane, budget: laneBudget, tokens_est: est })` and render `planned/used/remaining/pct/status/warn_at/stop_at` from it instead of the manual `pct`/`delta` math; keep the readable `under/over` delta as a derived display string.
    - **Context metrics:** compute `contextMetrics = computeContextMetrics({...from `context-registry.jsonl` if present, else all-zero with a `(no registry — reads not tracked)` note})`; add a `Context efficiency` row to the Cost section (files_loaded, repeated_reads, duplicate_chars, reuse_rate, read_avoidance_chars).
    - **Closure event:** extend `appendCostEvent` payload with `context_chars` (already present), `context_status`, and the metrics.
  - [ ] Run `bun test test/closure-integration.test.ts test/closure.test.ts test/cost.test.ts`
  - [ ] Commit `feat(context): reconcile status on lane budget, surface context metrics in report (C2/Q1/Q2)`
- Acceptance:
  - `bun test test/closure-integration.test.ts test/closure.test.ts test/cost.test.ts` passes. Cases:
    - with `context_budget_chars` set, the closure event `status` reflects the **lane token budget** (e.g. 'ok' when tokens under warn even if chars over), and the context line separately reports `over`/`ok` from `contextStatus`
    - `status` is not recomputed: single `budgetStatus(laneBudget, est)` in the non-dry-run path (asserted via the closure event + report `Budget status` being identical)
    - Cost section renders planned/used/remaining/pct from the envelope and a `Context efficiency` row with the metrics (zeros when no registry)
    - existing closure tests pass UNCHANGED (behavior preserved)
  - `grep -nE 'budgetStatus\(effBudget' src/mission.ts` returns nothing (no token-vs-char conflation)
  - `bun run typecheck` passes
- Risk: medium — mission.ts Cost-section refactor; closure-integration + closure tests are the safety net. Rollback: revert the single commit.
- Deferred: `delegateAt` + `laneBaseForLane` consumption (Q1 remainder) belongs to Phase 3 (Work Governor) — explicitly not consumed here.

**Task 7: full gate + evidence**
- Files: none new; evidence → `.mugiwara/missions/native-cost-governor/flows/02-execution.md`
- Interfaces: consumes T1–T6
- Size: S
- Steps:
  - [ ] Run `bun run gate` — capture full output
  - [ ] If any gate fails: fix within scope, re-run. No gate waived.
  - [ ] Write `flows/02-execution.md`: task table (T1–T7), per-task evidence (test commands + outputs), gate summary, `# Verdict:` line
  - [ ] Commit `chore(context): phase 2 verification evidence`
- Acceptance: `bun run gate` exit 0 (full output captured in `.mugiwara/missions/native-cost-governor/flows/02-execution.md`)
- Risk: none

## Risk & rollback

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Token-status vs context-status conflation resurfaces (C2 regression) | low | wrong budget verdict in ledger | T6 grep-locks `budgetStatus(effBudget` out; closure event + closure tests cover both budgets |
| `DEFAULT_CONFIG` change breaks an existing config test | low | CI red | T3 updates the pinned-string test in-scope; comment-only, no behavior change |
| Evidence registry grows unbounded per mission | low | trail bloat | append-only JSONL folds at archive (same as cost-events.jsonl); entries are single-line fingerprints |
| Context metrics zeros misread as "efficient" when no registry exists | medium | misleading report | explicit `(no registry — reads not tracked)` note in the Cost section when absent |
| Full gate slow (evals/retrieval) | certain | time | run once at T7 with captured output |
| Test-count regression | low | CI red | all Phase-1 tests + existing closure tests pass unchanged — proof of preserved behavior |

Rollback plan: each task is one revertible commit; T7 evidence lists exact
commits. Worst case: `git revert` the Phase-2 commits. `savepoint.sh` and
`lane-base.sh` are untouched, so runtime savepoint behavior is preserved by
construction; the only runtime-facing change is the archive Cost section and
closure event (TS-side).

## Phase-2 sub-scope → deliverable map

| Spec | Sub-scope | Deliverable |
|------|-----------|-------------|
| §10/§52 | 1. Context accounting | T1 `src/context.ts` (chars + est tokens; savepoint has no context measure → TS owns it) |
| §52/§53 | 2. Context budget enforcement | T1 `contextStatus` + T6 mission.ts reconcile (C2: token status on lane budget, chars on `context_budget_chars`) |
| §12 | 3. Duplicate detection | T2 `src/evidence.ts` (repeated file/symbol/command/test/diff/evidence/agent-response via fingerprints) |
| §11 | 4. Evidence references | T2 stable monotonic `E###` refs (`E012 src/auth/middleware.ts:42-91`) |
| §11 | 5. Evidence reuse | T2 reuse-or-create (`registerRead` returns the existing ref on repeat) |
| §13 | 6. Investigation limits | T3 config keys + T5 `src/investigation.ts` state machine + stop records |
| §11/§39 | 7. Context efficiency metrics | T1 `computeContextMetrics` + T6 Cost-section `Context efficiency` row + closure-event metrics |

## Definition of Done (Phase 2)

- `src/context.ts` exists: context accounting, `contextStatus` gate, `computeContextMetrics`, all unit-tested, reusing `budget.measureContextChars` (no duplicated measure).
- `src/evidence.ts` exists: fingerprint registry, stable `E###` refs, reuse-or-create, dedup/repeated-read detection, persisted `context-registry.jsonl`.
- `src/investigation.ts` exists: spec §13 limits (max passes / max unrelated / repeated-read) + objective stop, emitting decision records via sanitized `recordOptDecision`.
- Three `investigation_*` config keys exist (commented in `DEFAULT_CONFIG`, read by `readInvestigationConfig`, defaults 2/5/2).
- `src/cost.ts`: `delegateAt` clamps to [1,100] (P1); `recordOptDecision` strips `\r\n` (S2).
- `src/mission.ts`: closure event `status` gates on the **lane token budget** (C2 fixed); `status` computed once (Q2); Cost section renders via `costEnvelope` (Q1) and surfaces a `Context efficiency` row; context metrics in the closure event.
- `savepoint.sh` and `lane-base.sh` untouched; no runtime savepoint behavior changed.
- `bun run gate` passes fully; every pre-existing test passes unchanged.
