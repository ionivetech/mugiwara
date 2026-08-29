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

---

# native-cost-governor — Phase 3: Work Governor

**Scope:** Phase 3 of the Native Cost Governor initiative (plan §51), mission
split row 3 (`native-cost-governor-phase3`). Phase 3 delivers the **Work
Governor** — the six capabilities §51 Phase 3 enumerates (required/conditional/
optional stage classification, evidence-backed stage skipping, agent invocation
control, skill loading control, delegation optimization, completion detection).
It **wires the Phase-2 signals into the agent flow**: Phase 2 was measurement-only
(the verdicts existed but nothing consumed them); Phase 3 is the consumer that
turns those verdicts into auditable skip/avoid/delegate/complete decisions.

**Primary goal:** make *work* efficient — skip what the evidence says is
unnecessary, invoke only the agents and skills that earn their cost, delegate
only when parallelism beats overhead, and know when a mission is genuinely done.
Every optimization decision lands in the trail (§41) so the crew's agent-flow
choices are machine-checkable, not vibe.

## What Phase 3 consumes (Phase-2 signals) and what it enforces

| Phase-2 signal | Module | Phase-3 consumer |
|----------------|--------|------------------|
| Investigation verdict | `src/investigation.ts` `evaluateInvestigation` | evidence-backed stage skipping (investigation stopped → skip the stage that needed it) |
| Repeated-read / reuse detection | `src/evidence.ts` `findRepeats`, `loadRegistry`, `registerRead` | skip when evidence already answers; dedup reads; completion evidence present |
| Context budget status | `src/context.ts` `contextStatus` | guard before a conditional/optional stage (over budget → tighten, don't expand) |
| Investigation config limits | `src/config.ts` `readInvestigationConfig` | bounds the skip/continue decision with real policy |
| Delegation threshold | `src/cost.ts` `delegateAt` (Q1 remainder — deferred from Phase 2) | delegation optimization: the budget ceiling below which delegation is refused |
| Per-invocation overhead | `src/cost.ts` `laneBaseForLane` (Q1 remainder — deferred from Phase 2) | delegation overhead floor: one delegate ≈ one agent's context load |
| Decision trail | `src/cost.ts` `recordOptDecision` | records every skip/avoid/delegate/complete verdict (§41) |

Phase 3 **enforces**: a stage is never skipped without a recorded reason; an
agent/skill is only loaded when it earns its cost; delegation only fires when
parallelism value exceeds overhead AND budget is inside the delegate threshold;
a mission is marked complete only when all five §19 conditions hold.

## Key decisions

1. **The Work Governor is a pure TS module (`src/work.ts`), like Phase 2.** Same
   architecture as `investigation.ts`: verdict functions take explicit inputs
   (so they are unit-testable and the parity is locked by fixtures), and a
   separate record helper persists the verdict through the sanitized
   `recordOptDecision` (§41 trail). `savepoint.sh`/`lane-base.sh` stay untouched;
   the shell runtime has no work-classification role and Phase 3 does not migrate
   it.
2. **Honest boundary — the module produces and records; the crew acts.** The
   LLM crew (workflow skill) is the only thing that can actually skip a flow
   stage or avoid an agent. Phase 3 makes the *decision* a structured, recorded,
   auditable verdict the crew is instructed to follow (T4 wiring) — it does not
   pretend a TS function can force the model. This is the same honest boundary
   Phase 2 drew for `investigation.ts` inputs.
3. **`DEFAULT_CONFIG` untouched.** Delegation already has a key
   (`delegate_threshold=60`) and the investigation limits were added in Phase 2.
   Phase 3 needs no new config (§52 — no micromanaging every optimization
   decision; policy boundaries already exist). No runtime config behavior change.
4. **Report/cost-ledger work rows defer to Phase 8.** The `stages_executed /
   skipped`, `agents_invoked / avoided` ledger block (§39) and the `mugiwara cost`
   CLI (§42) are Phase 8 Reporting. Phase 3 records the *decisions* (§41) but does
   not build the report work-section — that is Phase 8's surface. Avoids gold-plating.
5. **Security F1 closes here (required by Phase-2 DoD).** `loadRegistry` shape
   validation: drop lines that fail shape (string `reads` → string-concat risk),
   coerce `reads` to a bounded integer. F2/F3 remain accepted Low (documented
   trust boundary + secret-fingerprint design rule noted in `docs/concepts/cost.md`).
6. **Quality nit closes here.** `CostEvent.context_metrics` inline shape is
   replaced by an import of `ContextMetrics` from `context.ts` (single type
   definition — the LOW review nit deferred to Phase-3 wiring).
7. **Delegation consumes the Phase-2 Q1 remainder.** `delegateAt` and
   `laneBaseForLane` were explicitly deferred to Phase 3 (plan Phase 2 T6
   deferred note); they are wired inside `evaluateDelegation`.

## Architecture overview

```
  Phase-2 signals (all shipped, interfaces unchanged by Phase 3)
  src/investigation.ts  src/evidence.ts  src/context.ts
  src/config.ts         src/cost.ts
       │                    │
       ▼                    ▼
  src/work.ts ← NEW (T1): the Work Governor verdict engine — classifyStage,
       │       shouldSkipStage, evaluateInvocation, shouldLoadSkill,
       │       evaluateDelegation (consumes delegateAt + laneBaseForLane),
       │       completionCheck + recordWorkDecision (→ recordOptDecision §41)
       │
       ├──────────────────────────┐
       ▼                          ▼
  decisions.md (## Cost governor decisions)      content/skills/mugiwara-workflow
       (every skip/avoid/delegate/complete)      SKILL.md (T4 wiring: crew consults
                                                 the recorded verdicts before each
                                                 flow stage) + docs/concepts/cost.md
```

Pure verdict functions are unit-tested (T1); the security hardening (T2) and
type-dedup (T3) are self-contained hygiene on `evidence.ts`/`cost.ts`; the
agent-flow wiring (T4) is the workflow-skill + docs surface; T5 is the gate.

## Project structure (touched)

| File | Change |
|------|--------|
| `src/work.ts` | NEW — Work Governor verdict engine (six capabilities) + `recordWorkDecision` |
| `src/evidence.ts` | MODIFY — security F1: `loadRegistry` shape validation (drop malformed lines; coerce `reads` to bounded integer) |
| `src/cost.ts` | MODIFY — quality nit: `context_metrics` typed via imported `ContextMetrics` (drop inline dup) |
| `content/skills/mugiwara-workflow/SKILL.md` | MODIFY — reference the Work Governor: classify each stage before running it; record skip/avoid decisions via the decision trail (rule 2 already demands it — this makes it structured) |
| `docs/concepts/cost.md` | MODIFY — Work Governor section (six capabilities, verdict contracts, honesty boundary, F2/F3 design rules) |
| `test/work.test.ts` | NEW |
| `test/evidence.test.ts` | MODIFY — F1 shape-validation cases |
| `test/cost.test.ts` | MODIFY — only if a pinned assertion breaks (expected: none — type-only change) |
| `scripts/savepoint.sh`, `scripts/lib/lane-base.sh`, `src/config.ts` (`DEFAULT_CONFIG`) | UNCHANGED — no new config, no shell change |

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Work Governor module + security/type hygiene on two disjoint files | T1–T3 | `bun test test/work.test.ts test/evidence.test.ts test/cost.test.ts` green |
| 2 | Wire the verdicts into the agent flow + docs | T4 | `bun run validate-content --check-manifest --check-docs --check-doc-integrity` green |
| 3 | Full verification | T5 | `bun run gate` exit 0 |

## Implementation graph

```
T1 work.ts ────────────────┐
T2 evidence.ts (F1) ──────┐│  [PARALLEL] — 3 disjoint files; the
T3 cost.ts (type dedup) ─┐││  interfaces T1 consumes (evidence.ts
                         ▼▼▼  loadRegistry/findRepeats, cost.ts
T4 workflow skill + docs  (consumes T1)   delegateAt/laneBaseForLane/
                                              recordOptDecision) are UNCHANGED
                         ▼                     by T2/T3
T5 full gate (consumes all)
```

**Wave 1 `[PARALLEL]` proof (T1–T3):** file-disjoint — T1 creates
`src/work.ts`+`test/work.test.ts`, T2 modifies `src/evidence.ts`+`test/evidence.test.ts`,
T3 modifies `src/cost.ts`+`test/cost.test.ts`; no two touch the same file.
Interface-disjoint — T1 consumes `evidence.ts` (`loadRegistry`, `findRepeats`),
`investigation.ts`, `context.ts`, `config.ts`, and `cost.ts` (`delegateAt`,
`laneBaseForLane`, `recordOptDecision`) with their **pre-existing signatures**;
T2 is a robustness change to `loadRegistry` (drops malformed lines, coerces
`reads`) with **no signature change** — T1's tests feed well-formed registry
entries, so T1 never depends on T2's new behavior; T3 is a **type-only** change
(imported `ContextMetrics`) with no runtime signature change. Genuine independence.

No other parallel sets exist: T4 consumes T1 (wiring documents the real
verdicts); T5 consumes everything. Every edge either shares a file or consumes a
not-yet-shipped interface.

## Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | Work Governor verdict engine (six capabilities) + record helper | src/work.ts, test/work.test.ts | L | — | `bun test test/work.test.ts` green; `bun run typecheck` passes |
| T2 | security F1: loadRegistry shape validation | src/evidence.ts, test/evidence.test.ts | S | — | `bun test test/evidence.test.ts` green |
| T3 | cost.ts type dedup (ContextMetrics import) | src/cost.ts, test/cost.test.ts | S | — | `bun test test/cost.test.ts` green; `bun run typecheck` passes |
| T4 | wire verdicts into agent flow (workflow skill + docs) | content/skills/mugiwara-workflow/SKILL.md, docs/concepts/cost.md | S | T1 | `bun run validate-content --check-manifest --check-docs --check-doc-integrity` exit 0; workflow description unchanged |
| T5 | full gate + evidence | flows/02-execution.md | S | all | `bun run gate` exit 0 |

## Detail tasks

**Task 1: Work Governor verdict engine** (§7, §8, §9, §19, §30, §41)
- Files: create `src/work.ts`, `test/work.test.ts`
- Interfaces: consumes `src/investigation.ts` `evaluateInvestigation` (+ `InvestigationStatus`), `src/evidence.ts` `findRepeats`/`loadRegistry`/`registerRead`, `src/context.ts` `contextStatus`, `src/config.ts` `readInvestigationConfig`, `src/cost.ts` `delegateAt`/`laneBaseForLane`/`recordOptDecision` (Q1 remainder — now consumed). Produces `src/work.ts` (consumed by T4) and structured decisions via `recordOptDecision` (§41).
- Size: L
- Steps:
  - [ ] Write `test/work.test.ts` first (TDD — see acceptance)
  - [ ] Implement `src/work.ts`:
    - **Stage classification (§7/§34):** `export type StageClass = 'required'|'conditional'|'optional'`; `export type StageClassifyInput = { stage: string; requirement_kind: 'explicit'|'exploratory'|'ambiguous'; uncertainty_high: boolean; provides_required_evidence: boolean; protects_quality_security: boolean }`; `classifyStage(input): { stage; class: StageClass; reason: string }` — `required` when `protects_quality_security || provides_required_evidence`; else `conditional` when `uncertainty_high || requirement_kind !== 'explicit'`; else `optional`. Pure.
    - **Evidence-backed skipping (§7/§34/§13):** `export type SkipInput = { stage: string; classification: StageClass; evidence_present: boolean; investigation_stopped: boolean; context_over: boolean }`; `shouldSkipStage(input): { stage; skip: boolean; reason: string; evidence?: string }` — `required` → never skip (`skip:false`, reason `'required — protects quality/security'`); `conditional` → skip when `evidence_present` OR `investigation_stopped` (reason names the deciding signal); `optional` → skip when `evidence_present` OR `context_over` (reason names it) else run. Always emits a reason (every skip is explicit, §7).
    - **Agent invocation control (§8):** `export type InvocationInput = { agent: string; unique_responsibility: boolean; evidence_answers: boolean; stage_can_perform: boolean; expected_value_gt_cost: boolean }`; `evaluateInvocation(input): { agent; invoke: boolean; reason: string }` — invoke only when `unique_responsibility && !evidence_answers && !stage_can_perform && expected_value_gt_cost`; else `invoke:false` with the first failing clause named. Never invokes merely because the agent exists in the crew.
    - **Skill loading control (§9):** `export type SkillInput = { skill: string; required_by_task: boolean; required_by_policy: boolean; required_by_dependency: boolean; failing_verification: boolean }`; `shouldLoadSkill(input): { skill; load: boolean; reason: string }` — load only when any of the four "load only when" conditions holds (§9); else `load:false` reason `'not required by task/policy/dependency/verification'`. Minimum sufficient set.
    - **Delegation optimization (§30, consumes `delegateAt` + `laneBaseForLane`):** `export type DelegationInput = { lane: string; budget: number; tokens_used: number; threshold_pct: number; independent_tasks: number; parallel_value: number; estimated_overhead: number }`; `evaluateDelegation(input): { delegate: boolean; reason: string; budget_at: number; lane_base: number; parallel_value: number; overhead: number }` — `budget_at = delegateAt(budget, threshold_pct)`; `lane_base = laneBaseForLane(lane)`; `overhead = max(estimated_overhead, lane_base)` (one delegate costs at least one agent's context load); delegate only when `independent_tasks >= 2 && parallel_value > overhead && tokens_used <= budget_at` — else `delegate:false` with the failing clause named. Closes the Phase-2 Q1 remainder.
    - **Completion detection (§19):** `export type CompletionInput = { acceptance_satisfied: boolean; implementation_complete: boolean; tests_complete: boolean; quality_gates_complete: boolean; evidence_collected: boolean }`; `completionCheck(input): { complete: boolean; missing: string[]; reason: string }` — complete iff all five; `missing` lists the false ones; `reason` = `'ready for closure'` or `'missing: a, b'`.
    - **Decision trail (§41):** `recordWorkDecision(missionDir: string, d: { decision: string; reason: string; evidence?: string }): void` — thin wrapper over `recordOptDecision` with `actor: 'work-governor'` (reuses the S2 sanitizer). Callers call it with the reason/evidence from any verdict with `skip`/`invoke:false`/`load:false`/`delegate:false`/`complete:true`.
  - [ ] `docs/concepts/cost.md` (in T4, not here — T4 owns docs) — T1 writes only code + tests
  - [ ] Commit `feat(work): work governor verdict engine (stage/skip/agent/skill/delegation/completion)`
- Acceptance:
  - `bun test test/work.test.ts` passes. Cases (each a non-trivial exact assertion):
    - `classifyStage`: security-protecting stage → `'required'` even when evidence present; evidence-providing → `'required'`; uncertainty_high → `'conditional'`; `explicit` + no-evidence + no-protection + no-uncertainty → `'optional'`
    - `shouldSkipStage`: `required` never skips (reason contains 'required'); `conditional` + `evidence_present` → skip; `conditional` + `investigation_stopped` → skip; `optional` + `context_over` → skip; `optional` + no signals → run (`skip:false`); every skip has a non-empty reason
    - `evaluateInvocation`: unique+evidence-answers → `invoke:false` (evidence clause); unique+no-evidence+stage-can-perform → `invoke:false`; all four pass → `invoke:true`; no unique responsibility → `invoke:false`
    - `shouldLoadSkill`: each of the four §9 conditions alone → `load:true`; none → `load:false`
    - `evaluateDelegation`: `independent_tasks:1` → never delegate regardless of value; `parallel_value:5000, overhead:4000, lane_base:22016` → `overhead===22016` (floor) and delegate:false (value not > floor); `parallel_value:40000, overhead:5000, tokens_used:6000, budget:25000, threshold_pct:60` → `budget_at===15000`, delegate:true; same but `tokens_used:16000` (> budget_at) → delegate:false (over threshold)
    - `completionCheck`: all five true → `complete:true`, `missing:[]`; one false → `complete:false` with that item in `missing`; multiple false → all listed
    - `recordWorkDecision` writes a single `## Cost governor decisions` bullet with `work-governor` actor, sanitized (newline-stripped) reason
  - `bun run typecheck` passes
  - Coverage: `src/work.ts` ≥90% (config `coverage_new=90`; verified at T5 gate)
- Risk: medium — a new L module must meet the 90% coverage bar; TDD-first with the acceptance cases above is the safety net. Rollback: revert the single commit.
- Deferred: none in T1 — delegation Q1 remainder closes here.

**Task 2: security F1 — loadRegistry shape validation** (§? security F1)
- Files: modify `src/evidence.ts`; extend `test/evidence.test.ts`
- Interfaces: consumes `src/evidence.ts` `loadRegistry` (self-contained; signature unchanged — a parsed entry failing shape is dropped, valid entries pass through exactly)
- Size: S
- Steps:
  - [ ] Extend `test/evidence.test.ts` with cases (below) — TDD
  - [ ] In `src/evidence.ts` `loadRegistry`: after `JSON.parse`, validate each parsed entry — drop the line when any of `typeof e.fingerprint !== 'string'`, `typeof e.kind !== 'string'`, `typeof e.file !== 'string'`, `typeof e.id !== 'string'`, `typeof e.ref !== 'string'`, or `typeof e.reads !== 'number' || !Number.isFinite(e.reads) || e.reads < 0`; coerce `e.reads` to `Math.floor(e.reads)`. Entries that fail shape are skipped (never crash the reader). Comment: fixes F1 — a malformed/`string reads` line (string-concat risk) can no longer reach consumers.
  - [ ] Run `bun test test/evidence.test.ts` — existing cases must stay green
  - [ ] Commit `fix(evidence): validate registry shape on load (security F1)`
- Acceptance:
  - `bun test test/evidence.test.ts` passes. Cases:
    - a JSONL line with `reads: "3"` (string) is dropped (not coerced-by-concat); the rest load intact
    - a line missing `ref` is dropped; valid lines before/after it load
    - `reads: 2.7` loads as `2` (floored); `reads: -1` is dropped
    - existing round-trip + empty-registry cases still pass unchanged
  - `bun run typecheck` passes
- Risk: low — existing tests unchanged; F1 behavior is additive (drops only malformed lines). Rollback: revert the commit.
- Deferred: none — this closes F1 as required by the Phase-2 DoD.

**Task 3: cost.ts type dedup — import ContextMetrics** (quality LOW nit)
- Files: modify `src/cost.ts`; `test/cost.test.ts` (expected: no change, run to confirm)
- Interfaces: consumes `src/context.ts` `ContextMetrics` (type-only import); `CostEvent.context_metrics` gains the imported type instead of the inline duplicate. No runtime signature change.
- Size: S
- Steps:
  - [ ] In `src/cost.ts`: `import type { ContextMetrics } from './context.ts';` and change the `context_metrics?: { files_loaded; repeated_reads; duplicate_chars; reuse_rate; read_avoidance_chars }` inline shape to `context_metrics?: ContextMetrics` (single type definition). Type-only import — no runtime edge on the module graph.
  - [ ] Run `bun test test/cost.test.ts` and `bun run typecheck` — all green (type-only change)
  - [ ] Commit `refactor(cost): type context_metrics via imported ContextMetrics (quality nit)`
- Acceptance:
  - `bun test test/cost.test.ts` passes unchanged (no assertion on the inline shape); `bun run typecheck` passes
  - `grep -n 'ContextMetrics' src/cost.ts` returns a match (import + usage); no inline `context_metrics?: {` duplicate remains in `src/cost.ts`
- Risk: none — type-only. Rollback: revert the commit.
- Deferred: none.

**Task 4: wire the verdicts into the agent flow** (§7, §8, §9, §19, §34)
- Files: modify `content/skills/mugiwara-workflow/SKILL.md`; `docs/concepts/cost.md`
- Interfaces: consumes `src/work.ts` verdicts (T1) — documents them as the decision trail the crew follows; no code import (the skill is prose the agent reads; the trail is the machine-checkable artifact via `recordOptDecision`)
- Size: S
- Steps:
  - [ ] In `content/skills/mugiwara-workflow/SKILL.md`, under `## Rules` (after rule 2), add one rule line (≤120 chars) and a short "Work Governor" subsection:
    - Rule: `2a. Work Governor: before each flow stage classify it required/conditional/optional (Work Governor §7) and record any skip/avoid decision — `work-governor` entry in the decision trail; never skip a required stage.`
    - Subsection `## Work Governor` (3–5 lines): every stage is classified `required`/`conditional`/`optional`; a stage is skipped only with a recorded reason (§7); an agent is invoked only when it has unique responsibility and evidence cannot answer (§8); skills load only when required (§9); a mission is ready for closure only when §19's five conditions all hold — `completionCheck` verdict recorded in the decision trail. The decision trail is the machine-checkable record (`.mugiwara/.../decisions.md` → `## Cost governor decisions`). `savepoint.sh`/`lane-base.sh`/config untouched.
    - Ensure description frontmatter is byte-unchanged (validate-content requires it).
  - [ ] In `docs/concepts/cost.md`, append a `## Work Governor (src/work.ts)` section: the six capabilities + their verdict contracts (`classifyStage`, `shouldSkipStage`, `evaluateInvocation`, `shouldLoadSkill`, `evaluateDelegation`, `completionCheck`, `recordWorkDecision`), that delegation consumes `delegateAt`/`laneBaseForLane`, the honest boundary (module records — crew acts via the workflow skill), and the security design rules (F2: do not `registerRead` secret-bearing files such as `.env`/keys; F3: `.mugiwara/` is local trusted state — validate `missionDir` if writers ever open).
  - [ ] Run `bun run validate-content --check-manifest --check-docs --check-doc-integrity`
  - [ ] Commit `docs(work): wire work governor verdicts into the workflow skill and cost docs`
- Acceptance:
  - `bun run validate-content --check-manifest --check-docs --check-doc-integrity` exits 0 (skill description unchanged, manifest/docs drift clean)
  - `grep -E 'Work Governor|work-governor' content/skills/mugiwara-workflow/SKILL.md` returns 2+ matches
  - `grep -E '## Work Governor' docs/concepts/cost.md` returns a match
  - `bun run typecheck` passes (docs-only, still confirmed)
- Risk: low — a skill body change could trip validate-content if a line exceeds 120 chars or the description drifts; acceptance locks both. Rollback: revert the commit.
- Deferred: the report/CLI work ledger (§39/§42) stays Phase 8.

**Task 5: full gate + evidence**
- Files: none new; evidence → `.mugiwara/missions/native-cost-governor/flows/02-execution.md`
- Interfaces: consumes T1–T4
- Size: S
- Steps:
  - [ ] Run `bun run gate` — capture full output
  - [ ] If any gate fails: fix within scope, re-run. No gate waived.
  - [ ] Write `flows/02-execution.md`: task table (T1–T5), per-task evidence (test commands + outputs), gate summary, `# Verdict:` line
  - [ ] Commit `chore(work): phase 3 verification evidence`
- Acceptance: `bun run gate` exit 0 (full output captured in `.mugiwara/missions/native-cost-governor/flows/02-execution.md`)
- Risk: none

## Risk & rollback

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| New `src/work.ts` misses the 90% coverage bar | medium | CI red | TDD-first; acceptance cases lock every verdict family; gate catches at T5 |
| Skill-body edit trips validate-content | low | CI red | T4 acceptance locks description-unchanged + ≤120-char lines; run validator in T4 |
| `loadRegistry` F1 change drops a legit line | low | lost registry entry | validation is conservative (drops only malformed shape); existing round-trip tests stay green |
| Parallel-proof edge between T1 and T2/T3 breaks | low | false [PARALLEL] | proof in graph: T1 consumes pre-existing signatures only; T2 robustness + T3 type-only change neither signature |
| Delegation floor (`lane_base`) makes delegation look never-worthwhile | medium | over-conservative | floor is the honest per-invocation context cost; `evaluateDelegation` exposes `parallel_value`/`overhead`/`budget_at` so the trade is auditable, not hidden |
| Pre-existing enforcement flake (escape #2) | certain (intermittent) | red on a random run | tracked separate mission (blockers row 3); not a Phase-3 regression — proven by reproduction on clean main in Phase-2 closure |

Rollback plan: each task is one revertible commit; T5 evidence lists exact
commits. Worst case: `git revert` the Phase-3 commits. `savepoint.sh`,
`lane-base.sh`, and `DEFAULT_CONFIG` are untouched, so runtime savepoint +
config behavior is preserved by construction.

## Phase-3 sub-scope → deliverable map + user-AC mapping

Spec DoD Work (user acceptance) maps to Phase-3 tasks; each user AC has ≥1
per-task command-verifiable criterion:

| User AC (spec DoD Work) | Capability (§51/§spec) | Deliverable |
|--------------------------|------------------------|-------------|
| unnecessary stages can be skipped | 1+2 (stage classification + evidence-backed skipping) | T1 `classifyStage` + `shouldSkipStage`; T4 workflow-skill rule 2a |
| every skipped stage has an explicit reason (§7) | 1+2 | T1 every skip verdict carries a non-empty `reason` (test-locked); T4 rule 2a |
| unnecessary agents can be avoided | 3 (agent invocation control) | T1 `evaluateInvocation` (test-locked: evidence-answers / stage-can-perform refuse invocation) |
| unnecessary skills can be avoided | 4 (skill loading control) | T1 `shouldLoadSkill` (test-locked: load only when §9 condition holds) |
| delegation considers overhead | 5 (delegation optimization) | T1 `evaluateDelegation` consumes `delegateAt` + `laneBaseForLane` (Q1 remainder); parallel_value > overhead gate test-locked |
| completion detection prevents unnecessary continuation | 6 (completion detection) | T1 `completionCheck` (five §19 conditions; `missing[]` lists gaps); T4 workflow-skill readiness note |
| optimization decisions auditable (§41) | all | T1 `recordWorkDecision` → `recordOptDecision` (test-locked bullet shape + actor) |

## Definition of Done (Phase 3)

- `src/work.ts` exists: `classifyStage`, `shouldSkipStage`, `evaluateInvocation`,
  `shouldLoadSkill`, `evaluateDelegation`, `completionCheck`, `recordWorkDecision` —
  all pure, unit-tested, ≥90% coverage.
- Delegation consumes the Phase-2 Q1 remainder: `evaluateDelegation` calls
  `delegateAt(budget, threshold_pct)` and `laneBaseForLane(lane)` (Q1 closed).
- `loadRegistry` validates entry shape on load (security F1 closed): string/negative/
  non-finite `reads` and malformed entries are dropped, never reach consumers.
- `src/cost.ts` types `context_metrics` via imported `ContextMetrics` (quality
  nit closed); no inline duplicate.
- `content/skills/mugiwara-workflow/SKILL.md` wires the Work Governor: stage
  classification before each flow stage + recorded skip/avoid decisions (rule 2a);
  description unchanged; validate-content green.
- `docs/concepts/cost.md` documents the Work Governor verdicts, the honest
  boundary, and the F2/F3 security design rules.
- No changes to `savepoint.sh`, `lane-base.sh`, or `DEFAULT_CONFIG` runtime
  behavior — no new config keys.
- `bun run gate` passes fully; every pre-existing test passes unchanged.

## Honesty notes / deferred items

- **Honest boundary:** `src/work.ts` produces and records verdicts; the LLM crew
  (workflow skill, T4) is the only thing that acts on them. The module does not
  pretend to force the model — it makes the decision structured, auditable, and
  instructed.
- **F2/F3 accepted Low (unchanged):** secret-bearing files should not be
  `registerRead`-ed (F2) and `.mugiwara/` is local trusted state (F3) — both
  documented as design rules in `docs/concepts/cost.md` (T4), not code-forced.
- **Report/CLI work ledger deferred to Phase 8:** `stages_executed/skipped`,
  `agents_invoked/avoided` (§39 ledger) and `mugiwara cost` (§42) are Phase 8
  Reporting — Phase 3 records the decisions only, avoiding gold-plating.
- **Enforcement flake (escape #2) tracked separately:** not a Phase-3 regression.
- **No new config:** delegation reuses `delegate_threshold`; investigation limits
  came in Phase 2 — Phase 3 adds nothing to `DEFAULT_CONFIG`.
