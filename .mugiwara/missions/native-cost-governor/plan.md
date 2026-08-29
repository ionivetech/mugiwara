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

---

# native-cost-governor — Phase 4: Scope & Code Governor

**Scope:** Phase 4 of the Native Cost Governor initiative (plan §51), mission
split row 4 (`native-cost-governor-phase4`). Phase 4 delivers the **Scope &
Code Governor** — the seven capabilities §51 Phase 4 enumerates (scope drift
detection, existing-code reuse checks, abstraction justification, dependency
justification, minimum sufficient implementation policy, code waste detection,
change-surface measurement). It **prefers the smallest correct scope and
actively prevents unnecessary implementation** (§14/§15/§16): before a change
grows, the governor asks the §14 scope questions (can existing code solve it /
can a utility be reused / can a component be modified / can this remain local /
is a new abstraction or dependency actually required) and records the answer.

**Primary goal:** make the *code and scope* a change touches efficient — detect
scope drift before it lands, reuse what already exists over introducing new
architecture, reject speculative abstractions and unjustified dependencies,
prefer minimum sufficient implementation over incidental complexity, surface
code waste, and measure the change surface so the Phase-8 ledger has the §5.4
metrics. Every scope/code verdict lands in the trail (§41) so the crew's
build decisions are machine-checkable, not vibe.

## What Phase 4 consumes (shipped Phase 1/2/3 primitives) and what it enforces

| Shipped primitive | Module | Phase-4 consumer |
|-------------------|--------|-------------------|
| Optimization decision trail | `src/cost.ts` `recordOptDecision` | records every scope/code verdict with the `scope-governor` actor (§41) |
| Work Governor verdict engine | `src/work.ts` `classifyStage`/`shouldSkipStage`/`completionCheck` | scope decisions stay consistent with stage classification (scope drift is the code-side mirror of the work-side stage skip) |
| Context Governor metrics | `src/context.ts` `computeContextMetrics` | reuse checks align with `read_avoidance_chars` — reusing existing code is the code-side analog of context reuse |
| Investigation bounds | `src/config.ts` `readInvestigationConfig` | scope drift detection bounds the investigation surface (unrelated files opened) — same §13 limit ethos |
| Cost envelope | `src/cost.ts` `costEnvelope` | change-surface measurement feeds the code-cost dimension of the mission cost profile (§5.4) |

Phase 4 **enforces**: a change never expands beyond the declared scope without a
recorded drift verdict; new code is only introduced when §14's reuse checks say
existing code cannot solve it; an abstraction is only built when used in ≥2
places or required by contract — never speculatively; a dependency is only added
with explicit justification (§16); an implementation is never "minimum LOC" at
the expense of verification/quality (§15/§38); code waste (unnecessary helper/
wrapper/interface/config/generated code/refactor) is named; the change surface
(files/LOC/new abstractions/deps/boilerplate) is measured and judged proportional.

## Key decisions

1. **The Scope & Code Governor is a pure TS module (`src/scope.ts`), like
   `src/work.ts`.** Same architecture as Phase 3: verdict functions take explicit
   inputs (unit-testable, parity locked by fixtures), plus a separate record
   helper persists the verdict through the sanitized `recordOptDecision` (§41).
   `savepoint.sh`/`lane-base.sh` stay untouched; the shell runtime has no
   scope/code-classification role and Phase 4 does not migrate it.
2. **Honest boundary — the module produces and records verdicts; the crew acts.**
   The LLM crew (workflow skill) is the only thing that can actually refuse a
   speculative abstraction or reject a dependency. Phase 4 makes the *decision*
   a structured, recorded, auditable verdict the crew is instructed to follow
   (T2 wiring) — it does not pretend a TS function can force the model. Same
   honest boundary Phase 3 drew for `src/work.ts`.
3. **`DEFAULT_CONFIG` untouched — no new config keys (§52).** Scope & code
   governance needs no policy boundary beyond the primitives already shipped
   (investigation limits, delegation threshold). The §6 cost-profile
   `scope.mode` belongs to the adaptive-budget phases (7/8), not here. All
   verdict thresholds are pure function inputs with internal defaults — nothing
   reads config. No runtime config behavior change.
4. **Defer report/CLI surface to Phase 8.** The code-cost ledger block (§5.4/§39
   code rows: `files_changed`, `LOC added/removed`, `new abstractions/
   dependencies`) and the `mugiwara cost` CLI (§42) are Phase 8 Reporting.
   Phase 4 records the *decisions* and *produces the pure `measureChangeSurface`
   metrics* (§41 trail) but does not build the report surface. Avoids gold-plating.
5. **Defer slop-specific detection to Phase 6 (Stop-Slop).** The §21.11 code-slop
   taxonomy, §45 scenarios 6/7 (unnecessary abstraction/dependency) with
   detect→classify→intervene, and the §56 "code slop is detected" DoD item are
   Stop-Slop (Phase 6). Phase 4 is scope & **code** governance: it *detects* the
   §15 waste types as verdicts and records them, but does not build the slop
   detector/intervention machinery — that is Phase 6's surface. No gold-plating
   of Phase 4 into slop.
6. **Security F2/F3 stay accepted Low (carried to Phase 8).** The Phase-4
   record helper reuses the same S2-sanitized `recordOptDecision`, so no new
   injection surface. F2 (don't `registerRead` secret-bearing files) and F3
   (`.mugiwara/` is local trusted state) remain documented design rules in
   `docs/concepts/cost.md` (T2); harden at Phase 8 per decisions.md.

## Architecture overview

```
  Shipped primitives (unchanged interfaces)
  src/cost.ts (recordOptDecision, costEnvelope)
  src/work.ts (stage classification — scope mirror)
  src/context.ts (metrics)      src/config.ts (investigation limits)
       │
       ▼
  src/scope.ts ← NEW (T1): the Scope & Code Governor verdict engine —
       │       detectScopeDrift, checkExistingCodeReuse,
       │       evaluateAbstraction, evaluateDependency,
       │       minimumSufficientCheck, detectCodeWaste, measureChangeSurface
       │       + recordScopeDecision (→ recordOptDecision §41)
       │
       ├──────────────────────────┐
       ▼                          ▼
  decisions.md (## Cost governor decisions)   content/skills/mugiwara-workflow
       (every drift/reuse/abstraction/dependency/    SKILL.md (T2 wiring: crew
        sufficient/waste/surface verdict)             consults the verdicts before
                                                      adding code/abstractions/
                                                      deps) + docs/concepts/cost.md
```

Pure verdict functions are unit-tested (T1); the agent-flow wiring (T2) is the
workflow-skill + docs surface; T3 is the gate.

## Project structure (touched)

| File | Change |
|------|--------|
| `src/scope.ts` | NEW — Scope & Code Governor verdict engine (seven capabilities) + `recordScopeDecision` |
| `test/scope.test.ts` | NEW |
| `content/skills/mugiwara-workflow/SKILL.md` | MODIFY — reference the Scope & Code Governor: check reuse before adding code, justify abstractions/dependencies, prefer minimum sufficient implementation; record scope verdicts in the decision trail |
| `docs/concepts/cost.md` | MODIFY — Scope & Code Governor section (seven capabilities, verdict contracts, honesty boundary, F2/F3 design rules) |
| `src/cost.ts`, `src/work.ts`, `src/context.ts`, `src/investigation.ts`, `src/config.ts` | UNCHANGED — consumed with pre-existing signatures; no edits |
| `scripts/savepoint.sh`, `scripts/lib/lane-base.sh`, `src/config.ts` (`DEFAULT_CONFIG`) | UNCHANGED — no new config, no shell change |

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Scope & Code Governor module + tests | T1 | `bun test test/scope.test.ts` green |
| 2 | Wire the verdicts into the agent flow + docs | T2 | `bun run validate-content --check-manifest --check-docs --check-doc-integrity` green |
| 3 | Full verification | T3 | `bun run gate` exit 0 |

## Implementation graph

```
T1 scope.ts ────────────────┐
                             ▼
T2 workflow skill + docs  (consumes T1)   [SEQUENTIAL, depends-on T1]
                             ▼
T3 full gate (consumes all) [SEQUENTIAL, depends-on all]
```

**No `[PARALLEL]` set in Phase 4.** T1 is a single new module + test file with
no disjoint sibling hygiene task (Phase 3 had T2/T3 because it carried F1 + a
quality nit from Phase 2; Phase 4 carries no code-hygiene debt — F2/F3 are
docs-only design rules and defer to Phase 8). T2 consumes T1 (wiring documents
the real verdicts); T3 consumes everything. Every edge either shares the module
surface or consumes a not-yet-shipped interface — parallel-proof would be
false.

## Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | Scope & Code Governor verdict engine (seven capabilities) + record helper | src/scope.ts, test/scope.test.ts | L | — | `bun test test/scope.test.ts` green; `bun run typecheck` passes |
| T2 | wire verdicts into agent flow (workflow skill + docs) | content/skills/mugiwara-workflow/SKILL.md, docs/concepts/cost.md | S | T1 | `bun run validate-content --check-manifest --check-docs --check-doc-integrity` exit 0; workflow description unchanged |
| T3 | full gate + evidence | flows/02-execution.md | S | all | `bun run gate` exit 0 |

## Detail tasks

**Task 1: Scope & Code Governor verdict engine** (§5.4, §14, §15, §16, §38, §41)
- Files: create `src/scope.ts`, `test/scope.test.ts`
- Interfaces: consumes `src/cost.ts` `recordOptDecision` (the S2-sanitized trail
  helper) — that is the only imported primitive; the seven verdict functions are
  pure over explicit inputs (no other module dependency). Produces `src/scope.ts`
  (consumed by T2) and structured decisions via `recordScopeDecision` → `recordOptDecision` (§41).
- Size: L
- Steps:
  - [ ] Write `test/scope.test.ts` first (TDD — see acceptance)
  - [ ] Implement `src/scope.ts`:
    - **Scope drift detection (§14/§51-1):** `export type ScopeDriftInput = { change: string; declared_scope: string[]; touched_files: string[] }`; `detectScopeDrift(input): { change; drift: boolean; reason: string; scope_score: number }` — a touched file is in scope when it includes any `declared_scope` token (substring match); `scope_score = outside_files / touched_files.length` (0 when none); `drift = scope_score > 0`; reason names the outside files or `'within declared scope'`. Pure.
    - **Existing-code reuse checks (§14/§51-2):** `export type ReuseInput = { change: string; existing_symbol: boolean; existing_component: boolean; existing_utility: boolean; existing_module: boolean; local_modification_viable: boolean }`; `checkExistingCodeReuse(input): { change; reuse: boolean; reason: string }` — `reuse:true` when any existing_* holds AND local modification is viable (the §14 default: prefer reuse + local modification over new architecture); else `reuse:false` naming whether the gap is "no existing code solves this" vs "existing present but local modification not viable". Never returns `reuse:true` just because *some* code exists — it must be usable via local modification.
    - **Abstraction justification (§15/§51-3):** `export type AbstractionInput = { abstraction: string; used_in_places: number; reduces_duplication: boolean; required_by_contract: boolean; speculative: boolean }`; `evaluateAbstraction(input): { abstraction; justified: boolean; reason: string; use_count: number }` — `justified` only when `!speculative && ((used_in_places >= 2 && reduces_duplication) || required_by_contract)`; rejects speculative abstraction for hypothetical future requirements (§15/§17); single-use abstraction with no contract and no duplication benefit → `justified:false`. Reason names the deciding clause.
    - **Dependency justification (§16/§51-4):** `export type DependencyInput = { dependency: string; equivalent_available: boolean; solvable_with_existing: boolean; long_term_value: boolean; maintenance_cost: number; removed_cost: number }`; `evaluateDependency(input): { dependency; justified: boolean; reason: string }` — `justified` only when `!equivalent_available && !solvable_with_existing && long_term_value && maintenance_cost <= removed_cost`; else `justified:false` naming the first failing clause (§16: a new dependency requires explicit justification). Never justified merely because it is convenient.
    - **Minimum sufficient implementation policy (§15/§38/§51-5):** `export type SufficientInput = { change: string; necessary_complexity: number; incidental_complexity: number; verifiable: boolean; coverage_satisfied: boolean }`; `minimumSufficientCheck(input): { change; status: 'under'|'over'|'sufficient'; sufficient: boolean; reason: string }` — `under` when `!verifiable || !coverage_satisfied` (never sacrifice required verification/quality — §38; sufficient always preserves quality); `over` when `incidental_complexity > 0` (complexity added without need — §15 waste); else `sufficient`. Reason names the status driver. Does NOT optimize for minimum LOC at the expense of maintainability (necessary complexity is not penalized).
    - **Code waste detection (§15/§51-6):** `export type WasteInput = { change: string; unnecessary_helper: boolean; unnecessary_abstraction: boolean; unnecessary_wrapper: boolean; unnecessary_interface: boolean; unnecessary_config: boolean; unnecessary_dependency: boolean; unnecessary_generated_code: boolean; unnecessary_refactor: boolean }`; `detectCodeWaste(input): { change; waste: boolean; reason: string; waste_types: string[] }` — `waste_types` lists every true flag's name (the §15 detect list: helper/abstraction/wrapper/interface/config/dependency/generated code/refactor); `waste = waste_types.length > 0`; reason joins the types. Pure.
    - **Change-surface measurement (§5.4/§51-7):** `export type SurfaceInput = { change: string; files_changed: number; loc_added: number; loc_removed: number; new_abstractions: number; new_dependencies: number; new_files: number; generated_boilerplate: number; within_declared_scope: boolean }`; `measureChangeSurface(input): { change; surface: ChangeSurface; justified: boolean; reason: string }` where `ChangeSurface = { files_changed; loc_added; loc_removed; loc_changed; new_abstractions; new_dependencies; new_files; generated_boilerplate; within_declared_scope }` and `loc_changed = loc_added + loc_removed`; `justified` when `within_declared_scope && new_abstractions === 0 && new_dependencies === 0`; reason names proportionality (or the driver of injustice). Produces the §5.4 metric block the Phase-8 ledger consumes — this task measures, Phase 8 renders.
    - **Decision trail (§41):** `recordScopeDecision(missionDir: string, d: { decision: string; reason: string; evidence?: string }): void` — thin wrapper over `recordOptDecision` with `actor: 'scope-governor'` (reuses the S2 sanitizer). Callers call it with the reason/evidence from any verdict with `drift:true`/`reuse:false`/`justified:false`/`status !== 'sufficient'`/`waste:true`/`justified:false`.
  - [ ] `docs/concepts/cost.md` (in T2, not here — T2 owns docs) — T1 writes only code + tests
  - [ ] Commit `feat(scope): scope & code governor verdict engine (drift/reuse/abstraction/dependency/sufficient/waste/surface)`
- Acceptance:
  - `bun test test/scope.test.ts` passes. Cases (each a non-trivial exact assertion):
    - `detectScopeDrift`: all files within declared_scope → `drift:false`, `scope_score:0`; one file outside → `drift:true`, `scope_score:0.5` (2 files, 1 outside); empty `touched_files` → `scope_score:0`, `drift:false`; outside file name appears in `reason`
    - `checkExistingCodeReuse`: existing_utility + local_modification_viable → `reuse:true`; existing_symbol but NOT viable → `reuse:false` with reason containing 'not viable'; no existing_* → `reuse:false` with reason containing 'no existing'
    - `evaluateAbstraction`: used_in_places:2 + reduces_duplication → `justified:true`; required_by_contract → `justified:true`; speculative → `justified:false`; single-use no-contract no-dup → `justified:false`; `use_count` echoes input exactly
    - `evaluateDependency`: equivalent_available → `justified:false`; solvable_with_existing → `justified:false`; `maintenance_cost > removed_cost` → `justified:false`; all four §16 conditions → `justified:true`
    - `minimumSufficientCheck`: `!verifiable` → `status:'under'`, `sufficient:false`; `incidental_complexity:5` → `status:'over'`, `sufficient:false`; necessary_complexity:10 + incidental:0 + verifiable + coverage → `status:'sufficient'`, `sufficient:true`
    - `detectCodeWaste`: one true flag → `waste:true`, `waste_types` equals that one name; multiple → all named; none → `waste:false`, `waste_types:[]`
    - `measureChangeSurface`: `loc_added:100, loc_removed:20` → `loc_changed:120`; within_declared_scope + 0 new abstractions/deps → `justified:true`; `new_dependencies:1` → `justified:false`; `new_abstractions:2` → `justified:false`
    - `recordScopeDecision` writes a single `## Cost governor decisions` bullet with `scope-governor` actor, sanitized (newline-stripped) reason
  - `bun run typecheck` passes
  - Coverage: `src/scope.ts` ≥90% (config `coverage_new=90`; verified at T3 gate)
- Risk: medium — a new L module must meet the 90% coverage bar; TDD-first with the acceptance cases above is the safety net. Rollback: revert the single commit.
- Deferred: none in T1 — report/CLI surface (§5.4/§39/§42) is Phase 8; slop machinery (§21.11/§45/§56) is Phase 6. Both noted in the honesty section.

**Task 2: wire the verdicts into the agent flow** (§14, §15, §16, §38, §41)
- Files: modify `content/skills/mugiwara-workflow/SKILL.md`; `docs/concepts/cost.md`
- Interfaces: consumes `src/scope.ts` verdicts (T1) — documents them as the decision trail the crew follows; no code import (the skill is prose the agent reads; the trail is the machine-checkable artifact via `recordOptDecision`)
- Size: S
- Steps:
  - [ ] In `content/skills/mugiwara-workflow/SKILL.md`, under `## Rules` (after rule 2a), add one rule line (≤120 chars) and a short "Scope & Code Governor" subsection:
    - Rule: `2b. Scope & Code Governor: before adding code, check §14 reuse; justify new abstractions (§15) and dependencies (§16); prefer minimum sufficient implementation; record scope verdicts as scope-governor trail rows.`
    - Subsection `## Scope & Code Governor` (3–5 lines): prefer the smallest correct scope — reuse existing code + local modification over new architecture (§14); an abstraction is justified only when used in ≥2 places or required by contract, never speculatively (§15); a dependency is added only with explicit justification (§16); an implementation is minimum sufficient — never minimum LOC at the expense of verification/quality (§15/§38); code waste (unnecessary helper/abstraction/wrapper/interface/config/dependency/generated code/refactor) is named; the change surface is measured. Every scope verdict lands as a `scope-governor` trail row in `.mugiwara/.../decisions.md` → `## Cost governor decisions`. `savepoint.sh`/`lane-base.sh`/config untouched.
    - Ensure description frontmatter is byte-unchanged (validate-content requires it).
  - [ ] In `docs/concepts/cost.md`, append a `## Scope & Code Governor (src/scope.ts)` section: the seven capabilities + their verdict contracts (`detectScopeDrift`, `checkExistingCodeReuse`, `evaluateAbstraction`, `evaluateDependency`, `minimumSufficientCheck`, `detectCodeWaste`, `measureChangeSurface`, `recordScopeDecision`), that Phase 4 records decisions but the report/CLI surface (§5.4/§39/§42) is Phase 8 and slop detection (§21.11/§45) is Phase 6, the honest boundary (module records — crew acts via the workflow skill), and the security design rules (F2: do not `registerRead` secret-bearing files such as `.env`/keys; F3: `.mugiwara/` is local trusted state — validate `missionDir` if writers ever open).
  - [ ] Run `bun run validate-content --check-manifest --check-docs --check-doc-integrity`
  - [ ] Commit `docs(scope): wire scope & code governor verdicts into the workflow skill and cost docs`
- Acceptance:
  - `bun run validate-content --check-manifest --check-docs --check-doc-integrity` exits 0 (skill description unchanged, manifest/docs drift clean)
  - `grep -E 'Scope & Code Governor|scope-governor' content/skills/mugiwara-workflow/SKILL.md` returns 2+ matches
  - `grep -E '## Scope & Code Governor' docs/concepts/cost.md` returns a match
  - `bun run typecheck` passes (docs-only, still confirmed)
- Risk: low — a skill body change could trip validate-content if a line exceeds 120 chars or the description drifts; acceptance locks both. Rollback: revert the commit.
- Deferred: the report/CLI code ledger (§5.4/§39/§42) stays Phase 8; slop detection (§21.11/§45) stays Phase 6.

**Task 3: full gate + evidence**
- Files: none new; evidence → `.mugiwara/missions/native-cost-governor/flows/02-execution.md`
- Interfaces: consumes T1–T2
- Size: S
- Steps:
  - [ ] Run `bun run gate` — capture full output
  - [ ] If any gate fails: fix within scope, re-run. No gate waived.
  - [ ] Write `flows/02-execution.md`: task table (T1–T3), per-task evidence (test commands + outputs), gate summary, `# Verdict:` line
  - [ ] Commit `chore(scope): phase 4 verification evidence`
- Acceptance: `bun run gate` exit 0 (full output captured in `.mugiwara/missions/native-cost-governor/flows/02-execution.md`)
- Risk: none

## Risk & rollback

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| New `src/scope.ts` misses the 90% coverage bar | medium | CI red | TDD-first; acceptance cases lock every verdict family; gate catches at T3 |
| Skill-body edit trips validate-content | low | CI red | T2 acceptance locks description-unchanged + ≤120-char lines; run validator in T2 |
| Reuse check returns `reuse:true` when existing code is not usable | low | false positive | test-locked: existing_* must AND with `local_modification_viable`; reason names the gap otherwise |
| Abstraction/dependency refusals block legitimate work | medium | over-conservative | verdicts are pure and auditable; reason names the deciding clause so the crew can record a justification override (still audited); §16 keeps the explicit-justification path open |
| Slop/ledger scope bleed (gold-plating into Stop-Slop or Reporting) | low | scope slop | hard boundary: Phase 4 records decisions + measures surface only; slop machinery = Phase 6, report/CLI = Phase 8 (honesty section) |
| Pre-existing enforcement flake (escape #2) | certain (intermittent) | red on a random run | tracked separate mission (blockers row 3); not a Phase-4 regression — proven by reproduction on clean main in Phase-2 closure |

Rollback plan: each task is one revertible commit; T3 evidence lists exact
commits. Worst case: `git revert` the Phase-4 commits. `savepoint.sh`,
`lane-base.sh`, and `DEFAULT_CONFIG` are untouched, so runtime savepoint +
config behavior is preserved by construction.

## Phase-4 sub-scope → deliverable map + user-AC mapping

Spec DoD Scope & Code (user acceptance) maps to Phase-4 tasks; each user AC has
≥1 per-task command-verifiable criterion:

| User AC (spec DoD Scope & Code) | Capability (§51/§spec) | Deliverable |
|----------------------------------|------------------------|-------------|
| scope drift is detected | 1 (scope drift detection) | T1 `detectScopeDrift` (test-locked: `scope_score` exact, outside files named); T2 workflow-skill rule 2b |
| unnecessary abstractions are detected | 3 (abstraction justification) | T1 `evaluateAbstraction` (test-locked: speculative + single-use refuse) |
| unnecessary dependencies are discouraged | 4 (dependency justification) | T1 `evaluateDependency` (test-locked: §16 four-condition gate) |
| minimum sufficient implementation is preferred | 5 (minimum sufficient policy) | T1 `minimumSufficientCheck` (test-locked: `under`/`over`/`sufficient` exact) |
| unnecessary code can be detected | 6 (code waste detection) | T1 `detectCodeWaste` (test-locked: §15 waste-type list exact) |
| optimization decisions auditable (§41) | all | T1 `recordScopeDecision` → `recordOptDecision` (test-locked bullet shape + actor) |
| code cost measurable (§5.4) | 7 (change-surface measurement) | T1 `measureChangeSurface` (test-locked `loc_changed`, proportionality verdict) — metrics feed Phase-8 ledger |

## Definition of Done (Phase 4)

- `src/scope.ts` exists: `detectScopeDrift`, `checkExistingCodeReuse`,
  `evaluateAbstraction`, `evaluateDependency`, `minimumSufficientCheck`,
  `detectCodeWaste`, `measureChangeSurface`, `recordScopeDecision` — all pure,
  unit-tested, ≥90% coverage.
- The seven §51 Phase-4 capabilities are covered by verdict functions with
  explicit reasons on every refusal.
- `content/skills/mugiwara-workflow/SKILL.md` wires the Scope & Code Governor:
  reuse-first, justification for abstractions/dependencies, minimum sufficient
  implementation + recorded scope verdicts (rule 2b); description unchanged;
  validate-content green.
- `docs/concepts/cost.md` documents the Scope & Code Governor verdicts, the
  honest boundary, the Phase-8/Phase-6 deferral boundaries, and the F2/F3
  security design rules.
- No changes to `savepoint.sh`, `lane-base.sh`, or `DEFAULT_CONFIG` runtime
  behavior — no new config keys.
- `bun run gate` passes fully; every pre-existing test passes unchanged.
- Phase 4 records decisions and measures surface only — no report/CLI surface
  (Phase 8) and no slop machinery (Phase 6) built here.

## Honesty notes / deferred items

- **Honest boundary:** `src/scope.ts` produces and records verdicts; the LLM
  crew (workflow skill, T2) is the only thing that acts on them. The module does
  not pretend to force the model — it makes the scope/code decision structured,
  auditable, and instructed.
- **Report/CLI code ledger deferred to Phase 8:** `files_changed`, `LOC
  added/removed/changed`, `new abstractions/dependencies/files`, `generated
  boilerplate` (§5.4/§39) and `mugiwara cost` (§42) are Phase 8 Reporting —
  Phase 4 produces the pure `measureChangeSurface` metrics and records the
  decisions only, avoiding gold-plating.
- **Slop-specific detection deferred to Phase 6 (Stop-Slop):** code-slop
  taxonomy (§21.11), §45 scenarios 6/7 (unnecessary abstraction/dependency) with
  detect→classify→intervene, and the §56 "code slop is detected" DoD item are
  Phase 6 — Phase 4 detects the §15 waste types as verdicts, not the slop
  detector/intervention machinery.
- **F2/F3 accepted Low (unchanged):** secret-bearing files should not be
  `registerRead`-ed (F2) and `.mugiwara/` is local trusted state (F3) — both
  documented as design rules in `docs/concepts/cost.md` (T2), hardened at
  Phase 8 per decisions.md.
- **Enforcement flake (escape #2) tracked separately:** not a Phase-4 regression.
- **No new config:** Phase 4 adds nothing to `DEFAULT_CONFIG` — scope & code
  verdicts are pure over explicit inputs; the §6 `scope.mode` profile belongs to
  the adaptive-budget phases (7/8).

---

# native-cost-governor — Phase 5: Cognitive & Output Governor

**Scope:** Phase 5 of the Native Cost Governor initiative (plan §51), mission
split row 5 (`native-cost-governor-phase5`). Phase 5 delivers the **Cognitive &
Output Governor** — the six capabilities §51 Phase 5 enumerates (focused
reasoning policy, investigation termination, alternative limitation, output
compression, duplicate explanation detection, mission-focused output structure).
It **makes cognition and output efficient** (§17/§18): reasoning stays on the
Question→Evidence→Decision→Action path, stops when evidence is sufficient,
considers only justified alternatives, and output is compressed, deduplicated,
and structured for the mission. Every cognitive/output verdict lands in the
trail (§41) so the crew's reasoning and output choices are machine-checkable,
not vibe.

**Primary goal:** make *reasoning and output* efficient — keep reasoning
focused on the mission, terminate investigation when the acceptance/surface/path
triad is met, limit alternatives to evidence-backed options, compress output to
Decision/Action/Result/Evidence/Blocker, detect duplicate explanations, and
enforce a mission-focused output structure. Every verdict is recorded so the
crew's cognitive choices are auditable and the interactive output stays
concise while the full trail remains for audit (§18).

## What Phase 5 consumes (shipped Phase 1–4 primitives) and what it enforces

| Shipped primitive | Module | Phase-5 consumer |
|-------------------|--------|-------------------|
| Investigation verdicts | `src/investigation.ts` `evaluateInvestigation` | investigation termination — cognitive stop reuses the §13 triad (acceptance_mapped + surface_understood + path_established) but at the reasoning layer |
| Evidence registry | `src/evidence.ts` `fingerprint`/`registerRead`/`findRepeats` | duplicate explanation detection — fingerprint output explanations and reuse the §12 dedup machinery |
| Context metrics | `src/context.ts` `computeContextMetrics`/`estContextTokens` | output compression — chars/token cost of verbose output is measurable, not guessed |
| Work verdicts | `src/work.ts` `classifyStage`/`completionCheck` | mission-focused structure — required evidence and completion conditions bound what output must contain |
| Cost envelope | `src/cost.ts` `costEnvelope`/`recordOptDecision` | records every cognitive/output verdict with the `cognitive-governor` actor (§41) |
| Scope surface | `src/scope.ts` `measureChangeSurface` | scope-aware output — output describes only the declared-scope change, not unrelated surfaces |

Phase 5 **enforces**: reasoning never speculates without evidence; investigation
never continues after the triad is met without a concrete reason; only
evidence-backed alternatives are considered (bounded); output is never verbose
when concise carries the same signal; duplicate explanations are detected via
fingerprints; every output follows the mission-focused Decision/Action/Result/
Evidence/Blocker structure (§18).

## Key decisions

1. **The Cognitive & Output Governor is a pure TS module (`src/cognition.ts`),
   like `src/work.ts`/`src/scope.ts`.** Same architecture: verdict functions
   take explicit inputs (unit-testable, fixtures lock the thresholds), plus a
   separate record helper persists the verdict through the sanitized
   `recordOptDecision` (§41). `savepoint.sh`/`lane-base.sh` stay untouched; the
   shell runtime has no cognition/output role and Phase 5 does not migrate it.
2. **Honest boundary — the module produces and records verdicts; the crew acts.**
   The LLM crew (workflow + output) is the only thing that can actually stop
   reconsidering or compress its next message. Phase 5 makes the *decision* a
   structured, recorded, auditable verdict the crew is instructed to follow (T2
   wiring) — it does not pretend a TS function can force the model. Same honest
   boundary Phases 3/4 drew.
3. **`DEFAULT_CONFIG` untouched — no new config keys (§52).** Cognitive/output
   governance needs no policy boundary beyond the primitives already shipped
   (investigation limits, delegation threshold). Thresholds for alternatives,
   reconsideration, and compression are pure function inputs with internal
   defaults — nothing reads config. No runtime config behavior change. The §6
   `output.mode` profile belongs to the adaptive-budget phases (7/8), not here.
4. **Defer slop-specific intervention to Phase 6 (Stop-Slop).** The §21.3
   reasoning slop and §21.4 output slop taxonomy, §45 scenarios 5/9 (repeated
   reasoning/verbose output) with detect→classify→intervene, and the §56 slop
   signals are Stop-Slop (Phase 6). Phase 5 is cognition & **output** governance:
   it *detects* speculative/repetitive/verbose output as verdicts and records
   them, but does not build the slop detector/intervention machinery — that is
   Phase 6's surface.
5. **Defer reporting/CLI cognition rows to Phase 8.** The ledger's reasoning/
   output efficiency rows (§39/§43: reasoning focused vs slop, output compressed
   chars) and the `mugiwara cost` CLI's cognition section (§42) are Phase 8
   Reporting. Phase 5 records the *decisions* and *produces pure verdicts* (§41
   trail) but does not build the report surface. Avoids gold-plating.
6. **Security F2/F3 stay accepted Low (carried to Phase 8).** The Phase-5
   record helper reuses the same S2-sanitized `recordOptDecision`, so no new
   injection surface. F2/F3 remain documented design rules in `docs/concepts/
   cost.md` (T2); harden at Phase 8 per decisions.md.

## Architecture overview

```
  Shipped primitives (unchanged interfaces)
  src/investigation.ts (evaluateInvestigation)
  src/evidence.ts (fingerprint, findRepeats)
  src/context.ts (estContextTokens)   src/work.ts (completionCheck)
  src/cost.ts (recordOptDecision)      src/scope.ts (measureChangeSurface)
       │
       ▼
  src/cognition.ts ← NEW (T1): the Cognitive & Output Governor verdict engine —
       │       isFocusedReasoning, shouldTerminateInvestigation,
       │       limitAlternatives, compressOutput, detectDuplicateExplanation,
       │       structureOutput + recordCognitiveDecision (→ recordOptDecision §41)
       │
       ├──────────────────────────┐
       ▼                          ▼
  decisions.md (## Cost governor decisions)   content/skills/mugiwara-workflow
       (every reasoning/alternative/output   SKILL.md (T2 wiring: crew
        verdict)                              consults the verdicts before
                                              reasoning deeply / writing verbose
                                              output) + docs/concepts/cost.md
```

Pure verdict functions are unit-tested (T1); the agent-flow wiring (T2) is the
workflow-skill + docs surface; T3 is the gate.

## Project structure (touched)

| File | Change |
|------|--------|
| `src/cognition.ts` | NEW — Cognitive & Output Governor verdict engine (six capabilities) + `recordCognitiveDecision` |
| `test/cognition.test.ts` | NEW |
| `content/skills/mugiwara-workflow/SKILL.md` | MODIFY — reference the Cognitive & Output Governor: Question→Evidence→Decision→Action, bounded alternatives, compressed deduplicated mission-focused output; record cognitive verdicts in the decision trail |
| `docs/concepts/cost.md` | MODIFY — Cognitive & Output Governor section (six capabilities, verdict contracts, honesty boundary, F2/F3 design rules) |
| `src/cost.ts`, `src/work.ts`, `src/scope.ts`, `src/context.ts`, `src/investigation.ts`, `src/evidence.ts` | UNCHANGED — consumed with pre-existing signatures; no edits |
| `scripts/savepoint.sh`, `scripts/lib/lane-base.sh`, `src/config.ts` (`DEFAULT_CONFIG`) | UNCHANGED — no new config, no shell change |

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Cognitive & Output Governor module + tests | T1 | `bun test test/cognition.test.ts` green |
| 2 | Wire the verdicts into the agent flow + docs | T2 | `bun run validate-content --check-manifest --check-docs --check-doc-integrity` green |
| 3 | Full verification | T3 | `bun run gate` exit 0 |

## Implementation graph

```
T1 cognition.ts ────────────────┐
                                ▼
T2 workflow skill + docs  (consumes T1)   [SEQUENTIAL, depends-on T1]
                                ▼
T3 full gate (consumes all) [SEQUENTIAL, depends-on all]
```

**No `[PARALLEL]` set in Phase 5.** T1 is a single new module + test file with
no disjoint sibling hygiene task (no carry-over F1/nit from Phase 4 — Phase 4
closed clean; F2/F3 docs-only defer to Phase 8). T2 consumes T1 (wiring
documents the real verdicts); T3 consumes everything. Every edge either shares
the module surface or consumes a not-yet-shipped interface — parallel-proof
would be false.

## Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | Cognitive & Output Governor verdict engine (six capabilities) + record helper | src/cognition.ts, test/cognition.test.ts | L | — | `bun test test/cognition.test.ts` green; `bun run typecheck` passes |
| T2 | wire verdicts into agent flow (workflow skill + docs) | content/skills/mugiwara-workflow/SKILL.md, docs/concepts/cost.md | S | T1 | `bun run validate-content --check-manifest --check-docs --check-doc-integrity` exit 0; workflow description unchanged |
| T3 | full gate + evidence | flows/02-execution.md | S | all | `bun run gate` exit 0 |

## Detail tasks

**Task 1: Cognitive & Output Governor verdict engine** (§17, §18, §13, §41)
- Files: create `src/cognition.ts`, `test/cognition.test.ts`
- Interfaces: consumes `src/cost.ts` `recordOptDecision` (the S2-sanitized trail
  helper) and `src/evidence.ts` `fingerprint` (for duplicate explanation
  detection) — the only imported primitives; the six verdict functions are pure
  over explicit inputs (no other module dependency). Produces `src/cognition.ts`
  (consumed by T2) and structured decisions via `recordCognitiveDecision` →
  `recordOptDecision` (§41).
- Size: L
- Steps:
  - [ ] Write `test/cognition.test.ts` first (TDD — see acceptance)
  - [ ] Implement `src/cognition.ts`:
    - **Focused reasoning policy (§17):** `export type ReasoningInput = { question: string; evidence_available: boolean; speculative_paths: number; reconsiderations: number; hypothetical_requirements: boolean; unrelated_implementations: number }`; `isFocusedReasoning(input): { focused: boolean; reason: string; slop_types: string[] }` — `slop_types` lists every §17 slop present (speculative_architecture when `speculative_paths > 0`, repeated_reconsideration when `reconsiderations >= 2`, hypothetical_requirements, unrelated_implementations when `>0`); `focused = slop_types.length === 0`; when `!evidence_available && slop_types.length>0` reason names the slop, else `'Question→Evidence→Decision→Action — reasoning is focused'`. Pure.
    - **Investigation termination (§13 re-consumed at the cognition layer, §17):** `export type CognitiveTerminationInput = { acceptance_mapped: boolean; surface_understood: boolean; path_established: boolean; passes: number; max_passes: number; unrelated_files_opened: number; repeated_reads: number; has_concrete_reason: boolean }`; `shouldTerminateInvestigation(input): { terminate: boolean; reason: string }` — terminate when `acceptance_mapped && surface_understood && path_established` → reason `'triad complete — terminate'` (objective met, §13); else when `passes >= max_passes` without `has_concrete_reason` → `'max passes — terminate'`; else when `unrelated_files_opened > 5` or `repeated_reads >= 2` (reuses Phase-2 thresholds as defaults, caller may override via `max_passes`) without concrete reason → terminate naming the signal; else `terminate:false` with `'continue — concrete reason present'` or `'continue — triad incomplete'`. Pure, mirrors `investigation.ts` triad but at the cognitive-reasoning boundary.
    - **Alternative limitation (§17):** `export type AlternativeInput = { alternatives: string[]; evidence_backed: boolean[]; max_alternatives: number }` where `evidence_backed[i]` parallels `alternatives[i]`; `limitAlternatives(input): { alternatives: string[]; limited: boolean; reason: string; dropped: string[] }` — `dropped` are alternatives beyond `max_alternatives` (default 3) OR without evidence backing when at least one backed alternative exists; `limited = dropped.length>0`; reason names `'bounded to N evidence-backed alternatives'` or `'all alternatives within bound'`. Pure.
    - **Output compression (§18):** `export type CompressionInput = { output: string; essential_sections: string[] }` where `essential_sections` are the Decision/Action/Result/Evidence/Blocker headings present; `compressOutput(input): { compressed: string; saved_chars: number; reason: string; well_structured: boolean }` — `compressed` keeps only lines that contain an essential heading or are within 2 lines of one (mission-focused slimming); `saved_chars = output.length - compressed.length`; `well_structured = essential_sections.length >= 2` (at least Decision+Evidence per §18); reason names the compression. Pure, no LLM call.
    - **Duplicate explanation detection (§17/§18, reuses `fingerprint`):** `export type DuplicateInput = { explanations: string[] }`; `detectDuplicateExplanation(input): { duplicate: boolean; reason: string; duplicate_groups: string[][] }` — fingerprint each explanation via `fingerprint` (sha256 hex), group by fingerprint; `duplicate_groups` lists groups with ≥2 identical fingerprints (exact duplicates); `duplicate = duplicate_groups.length>0`; reason joins the duplicate count or `'no duplicate explanations'`. Pure, deterministic.
    - **Mission-focused output structure (§18):** `export type StructureInput = { output: string; has_decision: boolean; has_action: boolean; has_result: boolean; has_evidence: boolean; has_blocker: boolean }`; `structureOutput(input): { well_structured: boolean; missing: string[]; reason: string }` — `missing` lists false headings among Decision/Action/Result/Evidence/Blocker filtered to required (Decision+Evidence always required; Action/Result required when `has_action`/`has_result` expected by the mission); `well_structured = missing.length===0`; reason names missing headings or `'Decision/Action/Result/Evidence/Blocker — mission-focused'`. Pure.
    - **Decision trail (§41):** `recordCognitiveDecision(missionDir: string, d: { decision: string; reason: string; evidence?: string }): void` — thin wrapper over `recordOptDecision` with `actor: 'cognitive-governor'` (reuses the S2 sanitizer). Callers call it with the reason/evidence from any verdict with `focused:false`/`terminate:true`/`limited:true`/`duplicate:true`/`well_structured:false`.
  - [ ] `docs/concepts/cost.md` (in T2, not here — T2 owns docs) — T1 writes only code + tests
  - [ ] Commit `feat(cognition): cognitive & output governor verdict engine (reasoning/termination/alternatives/compression/duplicate/structure)`
- Acceptance:
  - `bun test test/cognition.test.ts` passes. Cases (each a non-trivial exact assertion):
    - `isFocusedReasoning`: `speculative_paths:1` → `focused:false`, `slop_types` contains `'speculative_architecture'`, reason names it; `reconsiderations:2` → `focused:false` with `'repeated_reconsideration'`; `hypothetical_requirements:true` → `focused:false`; `unrelated_implementations:1` → `focused:false`; all zero/false + `evidence_available:true` → `focused:true`, `slop_types:[]`
    - `shouldTerminateInvestigation`: triad all true → `terminate:true` with `'triad complete'`; `passes:2/max_passes:2` without concrete reason → `terminate:true`; same with `has_concrete_reason:true` → `terminate:false`; `unrelated_files_opened:6` → `terminate:true`; `repeated_reads:2` → `terminate:true`; triad incomplete + under limits + no concrete reason → `terminate:false`
    - `limitAlternatives`: 5 alternatives, `max_alternatives:3`, 2 evidence-backed among first 3 → `dropped` is the 2 beyond bound + any non-backed beyond first backed set, `limited:true`; 2 alternatives within bound all backed → `limited:false`, `dropped:[]`
    - `compressOutput`: output with Decision/Evidence headings + verbose filler lines 10 lines away → `compressed` drops the filler, `saved_chars > 0`, `well_structured:true`; output with only one heading → `well_structured:false`
    - `detectDuplicateExplanation`: `['fix X','fix X','fix Y']` → `duplicate:true`, `duplicate_groups` contains `['fix X','fix X']`; all unique → `duplicate:false`, `duplicate_groups:[]`
    - `structureOutput`: `has_decision:true, has_evidence:true, has_action:false, has_result:false, has_blocker:false` but Decision+Evidence present → `well_structured:true`; missing Decision → `well_structured:false`, `missing` contains `'Decision'`
    - `recordCognitiveDecision` writes a single `## Cost governor decisions` bullet with `cognitive-governor` actor, sanitized (newline-stripped) reason
  - `bun run typecheck` passes
  - Coverage: `src/cognition.ts` ≥90% (config `coverage_new=90`; verified at T3 gate)
- Risk: medium — a new L module must meet the 90% coverage bar; TDD-first with the acceptance cases above is the safety net. Rollback: revert the single commit.
- Deferred: none in T1 — report/CLI cognition rows (§39/§43) are Phase 8; slop machinery (§21.3/§21.4/§45) is Phase 6.

**Task 2: wire the verdicts into the agent flow** (§17, §18, §41)
- Files: modify `content/skills/mugiwara-workflow/SKILL.md`; `docs/concepts/cost.md`
- Interfaces: consumes `src/cognition.ts` verdicts (T1) — documents them as the decision trail the crew follows; no code import (the skill is prose the agent reads; the trail is the machine-checkable artifact via `recordOptDecision`)
- Size: S
- Steps:
  - [ ] In `content/skills/mugiwara-workflow/SKILL.md`, under `## Rules` (after rule 2b), add one rule line (≤120 chars) and a short "Cognitive & Output Governor" subsection. If body would exceed 120 lines (validator caps body at 120 lines, not chars), move the body to `content/skills/mugiwara-workflow/references/cognitive-output-governor.md` with a one-line pointer (sanctioned pattern, Phase-4 precedent af8a204):
    - Rule: `2c. Cognitive & Output Governor: keep reasoning Question→Evidence→Decision→Action; bound alternatives; compress output to Decision/Action/Result/Evidence/Blocker; dedup explanations; record cognitive verdicts as cognitive-governor trail rows.`
    - Subsection `## Cognitive & Output Governor` (3–5 lines): reasoning stays focused — Question→Evidence→Decision→Action, no speculative architecture/hypothetical requirements/repeated reconsideration/unrelated implementations (§17); investigation terminates when acceptance_mapped+surface_understood+path_established or limits hit without concrete reason (§13); alternatives bounded to evidence-backed options (default 3); output compressed to mission-focused structure (Decision/Action/Result/Evidence/Blocker, §18), duplicate explanations fingerprinted; every cognitive verdict lands as a `cognitive-governor` trail row. `savepoint.sh`/`lane-base.sh`/config untouched.
    - Ensure description frontmatter is byte-unchanged (validate-content requires it).
  - [ ] In `docs/concepts/cost.md`, append a `## Cognitive & Output Governor (src/cognition.ts)` section: the six capabilities + their verdict contracts (`isFocusedReasoning`, `shouldTerminateInvestigation`, `limitAlternatives`, `compressOutput`, `detectDuplicateExplanation`, `structureOutput`, `recordCognitiveDecision`), that Phase 5 records decisions but the report/CLI cognition surface (§39/§43) is Phase 8 and slop detection (§21.3/§21.4/§45) is Phase 6, the honest boundary (module records — crew acts via the workflow skill), and the security design rules (F2/F3).
  - [ ] Run `bun run validate-content --check-manifest --check-docs --check-doc-integrity`
  - [ ] Commit `docs(cognition): wire cognitive & output governor verdicts into the workflow skill and cost docs`
- Acceptance:
  - `bun run validate-content --check-manifest --check-docs --check-doc-integrity` exits 0 (skill description unchanged, manifest/docs drift clean)
  - `grep -E 'Cognitive & Output Governor|cognitive-governor' content/skills/mugiwara-workflow/SKILL.md` returns 2+ matches
  - `grep -E '## Cognitive & Output Governor' docs/concepts/cost.md` returns a match
  - `bun run typecheck` passes (docs-only, still confirmed)
- Risk: low — a skill body change could trip validate-content if a line exceeds 120 chars or the description drifts OR the 120-line body cap is exceeded (Phase-4 precedent: move to `references/` with a pointer); acceptance locks all three. Rollback: revert the commit.
- Deferred: the report/CLI cognition ledger (§39/§43) stays Phase 8; slop detection (§21.3/§21.4/§45) stays Phase 6.

**Task 3: full gate + evidence**
- Files: none new; evidence → `.mugiwara/missions/native-cost-governor/flows/02-execution.md`
- Interfaces: consumes T1–T2
- Size: S
- Steps:
  - [ ] Run `bun run gate` — capture full output
  - [ ] If any gate fails: fix within scope, re-run. No gate waived. Known pre-existing `enforcement.test.ts` escape#2 flake (blockers.md row 3, heal_halt true) is waivable — re-run or prove on clean base is not a Phase-5 regression.
  - [ ] Write `flows/02-execution.md`: task table (T1–T3), per-task evidence (test commands + outputs), gate summary, `# Verdict:` line
  - [ ] Commit `chore(cognition): phase 5 verification evidence`
- Acceptance: `bun run gate` exit 0 (full output captured in `.mugiwara/missions/native-cost-governor/flows/02-execution.md`; pre-existing flake not counted as Phase-5 regression when reproduced on base)
- Risk: none

## Risk & rollback

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| New `src/cognition.ts` misses the 90% coverage bar | medium | CI red | TDD-first; acceptance cases lock every verdict family; gate catches at T3 |
| Skill-body edit trips validate-content (description drift, 120-line cap, 120-char line cap) | low | CI red | T2 acceptance locks all three; Phase-4 precedent: move to `references/` with pointer |
| Cognitive verdicts over-conservative (reject legitimate reasoning) | medium | false terminate/limit | verdicts are pure and auditable; reason names the deciding clause so crew can record a concrete-reason override (still audited); `has_concrete_reason` escape hatch test-locked |
| Investigation termination duplicates `src/investigation.ts` logic | low | confusion | Phase-5 `shouldTerminateInvestigation` is the cognitive-layer re-consumption of the §13 triad with a `has_concrete_reason` override — documented as re-consumption, not a fork; investigation.ts stays the file-investigation limit, cognition.ts is the reasoning-investigation limit |
| Duplicate detection false positives (fingerprint collision) | negligible | missed dedup | sha256 hex — collision negligible; exact-match grouping only, not fuzzy |
| Pre-existing enforcement flake (escape #2) | certain (intermittent) | red on a random run | tracked separate mission (blockers row 3); not a Phase-5 regression — proven by reproduction on clean main |
| Slop/ledger scope bleed (gold-plating into Stop-Slop or Reporting) | low | scope slop | hard boundary: Phase 5 records decisions + pure verdicts only; slop machinery = Phase 6, report/CLI = Phase 8 (honesty section) |

Rollback plan: each task is one revertible commit; T3 evidence lists exact
commits. Worst case: `git revert` the Phase-5 commits. `savepoint.sh`,
`lane-base.sh`, and `DEFAULT_CONFIG` are untouched, so runtime savepoint +
config behavior is preserved by construction.

## Phase-5 sub-scope → deliverable map + user-AC mapping

Spec DoD Cognitive & Output (user acceptance) maps to Phase-5 tasks; each user AC has ≥1
per-task command-verifiable criterion:

| User AC (spec DoD) | Capability (§51/§spec) | Deliverable |
|---------------------|------------------------|-------------|
| reasoning stays focused | 1 (focused reasoning policy) | T1 `isFocusedReasoning` (test-locked: speculative/reconsideration/hypothetical/unrelated slop_types exact) |
| investigation terminates when sufficient | 2 (investigation termination) | T1 `shouldTerminateInvestigation` (test-locked: triad + limits + concrete-reason override) |
| alternatives bounded | 3 (alternative limitation) | T1 `limitAlternatives` (test-locked: max 3, evidence-backed filter, dropped list exact) |
| output compressed | 4 (output compression) | T1 `compressOutput` (test-locked: saved_chars, well_structured) |
| duplicate explanations detected | 5 (duplicate explanation detection) | T1 `detectDuplicateExplanation` (test-locked: fingerprint grouping exact) |
| output mission-focused | 6 (mission-focused output structure) | T1 `structureOutput` + T1 `compressOutput` (test-locked: Decision/Action/Result/Evidence/Blocker) |
| optimization decisions auditable (§41) | all | T1 `recordCognitiveDecision` → `recordOptDecision` (test-locked bullet shape + actor) |

## Definition of Done (Phase 5)

- `src/cognition.ts` exists: `isFocusedReasoning`, `shouldTerminateInvestigation`,
  `limitAlternatives`, `compressOutput`, `detectDuplicateExplanation`,
  `structureOutput`, `recordCognitiveDecision` — all pure, unit-tested, ≥90% coverage.
- The six §51 Phase-5 capabilities are covered by verdict functions with
  explicit reasons on every refusal/terminate/limit/compress/duplicate verdict.
- `content/skills/mugiwara-workflow/SKILL.md` wires the Cognitive & Output Governor:
  Question→Evidence→Decision→Action, bounded alternatives, compressed
  deduplicated mission-focused output + recorded cognitive verdicts (rule 2c);
  description unchanged; body ≤120 lines (or references pointer); validate-content green.
- `docs/concepts/cost.md` documents the Cognitive & Output Governor verdicts, the
  honest boundary, the Phase-8/Phase-6 deferral boundaries, and the F2/F3
  security design rules.
- No changes to `savepoint.sh`, `lane-base.sh`, or `DEFAULT_CONFIG` runtime
  behavior — no new config keys.
- `bun run gate` passes fully; every pre-existing test passes unchanged (pre-existing
  escape#2 flake not counted when reproduced on base).
- Phase 5 records decisions and pure verdicts only — no report/CLI surface
  (Phase 8) and no slop machinery (Phase 6) built here.

## Honesty notes / deferred items

- **Honest boundary:** `src/cognition.ts` produces and records verdicts; the LLM
  crew (workflow skill, T2) is the only thing that acts on them. The module does
  not pretend to force the model — it makes the cognitive/output decision
  structured, auditable, and instructed.
- **Report/CLI cognition ledger deferred to Phase 8:** `reasoning focused` vs
  `slop`, `output compressed chars`, `duplicate explanations avoided` (§39/§43)
  and `mugiwara cost` cognition section (§42) are Phase 8 Reporting — Phase 5
  produces the pure verdicts and records the decisions only.
- **Slop-specific detection deferred to Phase 6 (Stop-Slop):** reasoning/output
  slop taxonomy (§21.3/§21.4), §45 scenarios 5/9 (repeated reasoning/verbose
  output) with detect→classify→intervene, and the §56 slop signals are Phase 6
  — Phase 5 detects the §17/§18 slop types as verdicts, not the slop
  detector/intervention machinery.
- **F2/F3 accepted Low (unchanged):** secret-bearing files should not be
  fingerprinted/registered (F2) and `.mugiwara/` is local trusted state (F3) —
  both documented as design rules in `docs/concepts/cost.md` (T2), hardened at
  Phase 8 per decisions.md.
- **No new config:** Phase 5 adds nothing to `DEFAULT_CONFIG` — cognitive &
  output verdicts are pure over explicit inputs; the §6 `output.mode` profile
  belongs to the adaptive-budget phases (7/8).
- **Re-consumption note:** `shouldTerminateInvestigation` re-consumes the §13
  triad at the cognition layer with a `has_concrete_reason` override — it does
  not fork `src/investigation.ts`; file-investigation limits stay in
  investigation.ts, reasoning-investigation limits live in cognition.ts.

---

# native-cost-governor — Phase 6: Stop-Slop

**Scope:** Phase 6 of the Native Cost Governor initiative (plan §51), mission
split row 6 (`native-cost-governor-phase6`). Phase 6 delivers the **Stop-Slop**
governor — the eleven capabilities §51 Phase 6 enumerates (slop taxonomy,
detection signals, progress measurement, work-to-cost anomaly, intervention
rules, retry slop, healing slop, scope slop, context slop, investigation slop,
code slop). It **turns the spec §20–§24 framework into auditable verdicts**:
every loop, drift, retry, or waste signal is detected, classified, and
recorded with a stop/compress/tolerate intervention — without enforcing
behavior that only the LLM crew can act on.

**Primary goal:** make *waste* visible and stoppable — detect when work
consumes cost without producing progress, classify the slop kind, measure
progress-to-cost anomaly, and emit a recorded intervention (stop, compress,
tolerate, escalate) for each of the six concrete slop categories. Every
verdict lands in the trail (§41) so the crew's waste-control choices are
machine-checkable, not vibe. The ledger/report surface stays Phase 8.

## What Phase 6 consumes (shipped Phase 1–5 primitives) and what it enforces

| Shipped primitive | Module | Phase-6 consumer |
|-------------------|--------|------------------|
| Cost envelope + thresholds | `src/cost.ts` `costEnvelope`/`budgetStatus`/`delegateAt`/`recordOptDecision` | progress vs cost anomaly — `costEnvelope` is the cost side of the ratio; `recordOptDecision` is the §41 trail |
| Context metrics + dedup | `src/context.ts` `computeContextMetrics`/`contextStatus` + `src/evidence.ts` `fingerprint`/`findRepeats`/`loadRegistry` | context slop detection (§21.2/§12) — repeated reads, duplicate content, irrelevant files |
| Investigation limits | `src/investigation.ts` `evaluateInvestigation` + `src/config.ts` `readInvestigationConfig` | investigation slop detection (§21.1/§13) — re-consumes the pass/unrelated/repeated-read triad as a slop signal |
| Work stage classification | `src/work.ts` `classifyStage`/`completionCheck`/`shouldDelegate` | scope slop detection via stage drift; work-to-cost anomaly uses stage counts |
| Change surface | `src/scope.ts` `measureChangeSurface`/`detectScopeDrift`/`detectCodeWaste` | scope/code slop — `detectScopeDrift` and `detectCodeWaste` are the scope/code slop signals re-consumed as taxonomy rows |
| Cognitive verdicts | `src/cognition.ts` `isFocusedReasoning`/`shouldTerminateInvestigation`/`detectDuplicateExplanation`| reasoning/output slop overlap — Phase 6 reuses the cognition verdicts as slop taxonomy inputs but owns the slop-specific intervention layer |
| Retry/healing history | caller-supplied history arrays (explicit inputs) | retry slop (§21.6/§31) and healing slop (§21.7/§32) — same evidence + same failure without new hypothesis → STOP |

Phase 6 **enforces**: every slop signal is classified into the §21 taxonomy
(investigation/context/reasoning/output/code/retry/healing/scope); progress
is measured against cost (evidence gained / criteria satisfied / tests fixed
vs tokens consumed); a work-to-cost anomaly is flagged when tokens grow
without progress; each of the six concrete slop categories emits a
tolerate/stop/compress/escalate intervention with an explicit reason;
retry/healing without new evidence is stopped; scope expansion without
acceptance expansion is rejected; all verdicts are recorded via
`recordSlopDecision` → `recordOptDecision` (§41).

## Key decisions

1. **The Stop-Slop Governor is a pure TS module (`src/slop.ts`), like
   `src/work.ts`/`src/scope.ts`/`src/cognition.ts`.** Same architecture:
   verdict functions take explicit inputs (unit-testable, fixtures lock the
   thresholds), plus a separate record helper persists the verdict through the
   sanitized `recordOptDecision` (§41). `savepoint.sh`/`lane-base.sh` stay
   untouched; the shell runtime has no slop role and Phase 6 does not migrate
   it.
2. **Honest boundary — the module produces and records verdicts; the crew acts.**
   The LLM crew (workflow skill) is the only thing that can actually stop
   retrying, stop healing, or reject a scope expansion. Phase 6 makes the
   *decision* a structured, recorded, auditable verdict the crew is instructed
   to follow (T2 wiring) — it does not pretend a TS function can force the
   model. Same honest boundary Phases 3/4/5 drew.
3. **`DEFAULT_CONFIG` untouched — no new config keys (§52).** Slop governance
   needs no policy boundary beyond the primitives already shipped
   (investigation limits, delegate threshold, context budget). All slop
   thresholds (repeated-read N, retry history window, healing progress floor,
   anomaly ratio) are pure function inputs with internal defaults — nothing
   reads config. No runtime config behavior change. The §6 `slop.detection`
   profile belongs to adaptive phases (7/8), not here.
4. **Re-consumption, not forking.** `detectInvestigationSlop` re-consumes
   `evaluateInvestigation`'s pass/unrelated/repeated-read triad as a taxonomy
   row; `detectScopeSlop` re-consumes `detectScopeDrift`; `detectCodeSlop`
   re-consumes `detectCodeWaste`. The source modules stay the single definition;
   slop wraps them with the §21 classification + intervention layer. No logic
   fork.
5. **Defer reporting/CLI slop rows to Phase 8.** The ledger's slop counts
   (§39: `slop.events_detected/stopped/compressed`, §43 Cost section slop rows,
   §42 `mugiwara cost` slop section) and the §45 benchmark scenarios are
   Phase 8/9 Reporting & Benchmark. Phase 6 records the *decisions* and *produces
   pure verdicts* (§41 trail) but does not build the report surface. Avoids
   gold-plating.
6. **Security F2/F3 stay accepted Low (carried to Phase 8).** The Phase-6
   record helper reuses the same S2-sanitized `recordOptDecision`, so no new
   injection surface. F2 (do not fingerprint secret-bearing files) and F3
   (`.mugiwara/` is local trusted state) remain documented design rules in
   `docs/concepts/cost.md` (T2); harden at Phase 8 per decisions.md.

## Architecture overview

```
  Shipped primitives (unchanged interfaces)
  src/cost.ts (costEnvelope, recordOptDecision)
  src/context.ts (computeContextMetrics)  src/evidence.ts (fingerprint, findRepeats)
  src/investigation.ts (evaluateInvestigation)  src/work.ts (classifyStage)
  src/scope.ts (detectScopeDrift, detectCodeWaste)  src/cognition.ts (isFocusedReasoning)
       │
       ▼
  src/slop.ts ← NEW (T1): the Stop-Slop verdict engine —
       │       slop taxonomy (§21), detection signals (§22),
       │       progress measurement (§23), work-to-cost anomaly (§24),
       │       intervention rules (§20), + 6 concrete detectors:
       │       detectRetrySlop, detectHealingSlop, detectScopeSlop,
       │       detectContextSlop, detectInvestigationSlop, detectCodeSlop
       │       + recordSlopDecision (→ recordOptDecision §41)
       │
       ├──────────────────────────┐
       ▼                          ▼
  decisions.md (## Cost governor decisions)   content/skills/mugiwara-workflow
       (every slop verdict)                   SKILL.md (T2 wiring: crew
                                              consults slop verdicts before
                                              retrying/healing/expanding scope
                                              /re-reading/over-investigating)
                                              + docs/concepts/cost.md
```

Pure verdict functions are unit-tested (T1); the agent-flow wiring (T2) is the
workflow-skill + docs surface; T3 is the gate.

## Project structure (touched)

| File | Change |
|------|--------|
| `src/slop.ts` | NEW — Stop-Slop verdict engine (taxonomy, signals, progress, anomaly, intervention + 6 category detectors) + `recordSlopDecision` |
| `test/slop.test.ts` | NEW |
| `content/skills/mugiwara-workflow/SKILL.md` | MODIFY — reference the Stop-Slop Governor: taxonomy, signals, progress vs cost, intervention rules, six slop detectors; record slop verdicts in the decision trail |
| `docs/concepts/cost.md` | MODIFY — Stop-Slop Governor section (eleven capabilities, verdict contracts, honesty boundary, F2/F3 design rules) |
| `src/cost.ts`, `src/context.ts`, `src/evidence.ts`, `src/investigation.ts`, `src/work.ts`, `src/scope.ts`, `src/cognition.ts` | UNCHANGED — consumed with pre-existing signatures; no edits |
| `scripts/savepoint.sh`, `scripts/lib/lane-base.sh`, `src/config.ts` (`DEFAULT_CONFIG`) | UNCHANGED — no new config, no shell change |

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Stop-Slop module + tests | T1 | `bun test test/slop.test.ts` green |
| 2 | Wire the verdicts into the agent flow + docs | T2 | `bun run validate-content --check-manifest --check-docs --check-doc-integrity` green |
| 3 | Full verification | T3 | `bun run gate` exit 0 |

## Implementation graph

```
T1 slop.ts ──────────────────────┐
                                 ▼
T2 workflow skill + docs  (consumes T1)   [SEQUENTIAL, depends-on T1]
                                 ▼
T3 full gate (consumes all) [SEQUENTIAL, depends-on all]
```

**No `[PARALLEL]` set in Phase 6.** T1 is a single new module + test file with
no disjoint sibling hygiene task (no carry-over F1/nit from Phase 5 — Phase 5
closed GO; F2/F3 docs-only defer to Phase 8). T2 consumes T1 (wiring
documents the real verdicts); T3 consumes everything. Every edge either shares
the module surface or consumes a not-yet-shipped interface — parallel-proof
would be false.

## Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | Stop-Slop verdict engine (taxonomy + signals + progress + anomaly + intervention + 6 category detectors) + record helper | src/slop.ts, test/slop.test.ts | L | — | `bun test test/slop.test.ts` green; `bun run typecheck` passes |
| T2 | wire verdicts into agent flow (workflow skill + docs) | content/skills/mugiwara-workflow/SKILL.md, docs/concepts/cost.md | S | T1 | `bun run validate-content --check-manifest --check-docs --check-doc-integrity` exit 0; workflow description unchanged |
| T3 | full gate + evidence | flows/02-execution.md | S | all | `bun run gate` exit 0 |

## Detail tasks

**Task 1: Stop-Slop verdict engine** (§20–§24, §21.1–§21.8, §31/§32, §41)
- Files: create `src/slop.ts`, `test/slop.test.ts`
- Interfaces: consumes `src/cost.ts` `recordOptDecision` (the S2-sanitized trail
  helper) and `src/evidence.ts` `fingerprint` (for dedup/context signals) — the
  only imported primitives; all verdict functions are pure over explicit inputs
  (no other module dependency). Produces `src/slop.ts` (consumed by T2) and
  structured decisions via `recordSlopDecision` → `recordOptDecision` (§41).
- Size: L
- Steps:
  - [ ] Write `test/slop.test.ts` first (TDD — see acceptance)
  - [ ] Implement `src/slop.ts`:
    - **Slop taxonomy (§21):** `export type SlopKind = 'investigation' | 'context' | 'reasoning' | 'output' | 'code' | 'retry' | 'healing' | 'scope'` (the eight §21 categories; reasoning/output map to the cognition module's §17/§18 signals and are included for completeness even though their *detection* lives in `src/cognition.ts` — the slop module classifies them, not re-detects them); `export const SLOP_TAXONOMY: Record<SlopKind, string>` — one-line description per kind (e.g. `investigation: 'reading unrelated files / searching without narrowing / repeated exploration'`); `classifySlop(signal: string): SlopKind | null` — keyword match against the taxonomy descriptions (e.g. `'repeated file read'` → `context`, `'same command repeated'` → `retry`, `'LOC increases without acceptance expansion'` → `code`/`scope`). Pure.
    - **Detection signals (§22):** `export type SlopSignal = { kind: SlopKind; signal: string; count: number; threshold: number }`; `detectSlopSignal(input: { kind: SlopKind; count: number; threshold: number; evidence_delta?: number }): { slop: boolean; reason: string }` — `slop = count >= threshold && (evidence_delta === undefined || evidence_delta === 0)` ; reason names `'slop: <kind> — count <N> ≥ threshold <T> with no evidence gain'` or `'no slop: <kind> — <reason>'`. Pure. Thresholds are caller-supplied (no config read); defaults mirror spec examples (repeated-read 2, repeated-command 2, LOC-without-acceptance 1).
    - **Progress measurement (§23):** `export type ProgressSnapshot = { tokens_used: number; evidence_items: number; criteria_mapped: number; files_understood: number; tests_fixed: number; code_chars: number }`; `measureProgress(before: ProgressSnapshot, after: ProgressSnapshot): { progress: number; cost_delta: number; progress_per_cost: number; slop_signal: boolean; reason: string }` — `progress = (evidence_items_delta + criteria_mapped_delta + tests_fixed_delta + (code_chars_delta>0?1:0))` (evidence-gain weighted progress); `cost_delta = after.tokens_used - before.tokens_used`; `progress_per_cost = cost_delta>0 ? progress/cost_delta : 0`; `slop_signal = cost_delta>0 && progress===0` (spec §23 example: +5k tokens, +0 evidence/criteria/code → slop). Pure.
    - **Work-to-cost anomaly (§24):** `export type AnomalyInput = { progress_per_cost: number; baseline_per_cost: number; drop_threshold?: number }` (`drop_threshold` default 0.5 = 50% drop); `detectAnomaly(input): { anomaly: boolean; reason: string }` — `anomaly = progress_per_cost < baseline_per_cost * drop_threshold` when `baseline_per_cost>0`; else `false` (division-by-zero safe). Reason names the drop percentage or `'no anomaly — baseline 0 or above threshold'`. Pure. Not a quality score — documented as anomaly signal (§24).
    - **Intervention rules (§20):** `export type Intervention = 'tolerate' | 'stop' | 'compress' | 'escalate'`; `export type InterventionInput = { kind: SlopKind; slop: boolean; severity: 'harmless' | 'wasteful' | 'harmful'; progress_stalled: boolean }`; `decideIntervention(input): { intervention: Intervention; reason: string }` — `!slop → tolerate`; `slop && severity==='harmful' → escalate` (stop+escalate per §20); `slop && severity==='wasteful' → stop`; `slop && severity==='harmless' → tolerate` unless `progress_stalled` then `compress`. Pure. Tolerance rule: no single signal auto-classifies legitimate work as harmful.
    - **Retry slop detection (§21.6/§31):** `export type RetryInput = { action: string; evidence_fingerprint: string; outcome: 'fail' | 'pass'; history: { action: string; evidence_fingerprint: string; outcome: string }[] }`; `detectRetrySlop(input): { slop: boolean; reason: string; kind: SlopKind }` — `slop = history.some(h => h.action===action && h.evidence_fingerprint===evidence_fingerprint && h.outcome==='fail') && outcome==='fail'` (same action + same evidence + same failure → STOP per §31); else `slop:false`. `kind='retry'` always when returned. Pure.
    - **Healing slop detection (§21.7/§32):** `export type HealingInput = { cycle: number; fixes_in_cycle: number; history_fixes: number[]; max_cycles?: number }`; `detectHealingSlop(input): { slop: boolean; reason: string; kind: SlopKind }` — `slop = fixes_in_cycle===0 && history_fixes.some(n=>n===0)` OR `cycle >= (max_cycles??3) && fixes_in_cycle===0` (no progress in previous cycle → stop, §32). `kind='healing'`. Pure.
    - **Scope slop detection (§21.8):** `export type ScopeSlopInput = { files_changed: string[]; declared_scope: string[]; acceptance_expanded: boolean; unrelated_refactors: string[] }`; `detectScopeSlop(input): { slop: boolean; reason: string; kind: SlopKind }` — `slop = (files_changed.some(f=>!declared_scope.includes(f)) || unrelated_refactors.length>0) && !acceptance_expanded`; reason names the out-of-scope files or `'no scope slop — within declared scope or acceptance expanded'`. `kind='scope'`. Pure. Re-consumes the `detectScopeDrift` idea as a verdict without importing it (same file-list logic, avoids a runtime import).
    - **Context slop detection (§21.2/§12):** `export type ContextSlopInput = { repeated_reads: number; repeated_read_threshold: number; duplicate_chars: number; irrelevant_files: string[] }`; `detectContextSlop(input): { slop: boolean; reason: string; kind: SlopKind }` — `slop = repeated_reads >= repeated_read_threshold || duplicate_chars>0 || irrelevant_files.length>0`; reason joins the present signals. `kind='context'`. Pure. Re-consumes the Phase-2 repeated-read / duplicate_chars signals.
    - **Investigation slop detection (§21.1/§13):** `export type InvestigationSlopInput = { unrelated_files_opened: number; max_unrelated_files: number; repeated_reads: number; repeated_read_threshold: number; exploration_passes: number; max_passes: number; acceptance_mapped: boolean; has_concrete_reason: boolean }`; `detectInvestigationSlop(input): { slop: boolean; reason: string; kind: SlopKind }` — `slop = (unrelated_files_opened > max_unrelated_files || repeated_reads >= repeated_read_threshold || exploration_passes >= max_passes) && !has_concrete_reason && acceptance_mapped` is insufficient alone — slop when any limit breached without concrete reason, or when `acceptance_mapped && exploration_passes>max_passes` (investigation continues after triad met). `kind='investigation'`. Pure. Re-consumes the §13 triad without importing `evaluateInvestigation`.
    - **Code slop detection (§21.5/§15):** `export type CodeSlopInput = { new_abstractions: number; new_dependencies: number; loc_added: number; acceptance_expanded: boolean; justification_provided: boolean; boilerplate_chars: number }`; `detectCodeSlop(input): { slop: boolean; reason: string; kind: SlopKind }` — `slop = (new_abstractions>0 || new_dependencies>0 || boilerplate_chars>0 || loc_added>100) && !acceptance_expanded && !justification_provided`; reason names the waste type. `kind='code'`. Pure. Re-consumes `detectCodeWaste`'s LOC/abstraction/dependency signals.
    - **Decision trail (§41):** `recordSlopDecision(missionDir: string, d: { decision: string; reason: string; evidence?: string; kind?: SlopKind }): void` — thin wrapper over `recordOptDecision` with `actor: 'slop-governor'` (reuses the S2 sanitizer). Callers call it with the reason/evidence from any detector that returned `slop:true` or `anomaly:true`.
  - [ ] Commit `feat(slop): stop-slop verdict engine (taxonomy/signals/progress/anomaly/intervention + six category detectors)`
- Acceptance:
  - `bun test test/slop.test.ts` passes. Cases (each a non-trivial exact assertion):
    - `classifySlop`: `'repeated file read'` → `'context'`; `'same command repeated'` → `'retry'`; `'LOC increases without acceptance'` → `'code'` or `'scope'`; unknown signal → `null`
    - `detectSlopSignal`: `count:2/threshold:2/evidence_delta:0` → `slop:true`; same with `evidence_delta:1` → `slop:false`; `count:1/threshold:2` → `slop:false`
    - `measureProgress`: before `{tokens_used:8000,evidence_items:4,criteria_mapped:2,files_understood:3,tests_fixed:1,code_chars:1000}` after `{tokens_used:13000,evidence_items:4,criteria_mapped:2,files_understood:3,tests_fixed:1,code_chars:1000}` → `progress:0, cost_delta:5000, slop_signal:true` (spec §23 example); with +1 evidence → `progress:1, slop_signal:false`
    - `detectAnomaly`: `progress_per_cost:0.0001, baseline:0.001, drop_threshold:0.5` → `anomaly:true` (10x drop); `progress_per_cost:0.0006, baseline:0.001` → `anomaly:false`; `baseline:0` → `anomaly:false`
    - `decideIntervention`: `slop:false` → `tolerate`; `slop:true, severity:'harmful'` → `escalate`; `slop:true, severity:'wasteful'` → `stop`; `slop:true, severity:'harmless', progress_stalled:false` → `tolerate`; same with `progress_stalled:true` → `compress`
    - `detectRetrySlop`: history `[{action:'test', fingerprint:'abc', outcome:'fail'}]` + same action/fingerprint/fail → `slop:true`; different fingerprint → `slop:false`; history empty → `slop:false`
    - `detectHealingSlop`: `cycle:3, fixes_in_cycle:0, history_fixes:[3,1,0]` → `slop:true`; `cycle:1, fixes_in_cycle:3` → `slop:false`; `cycle:3, fixes_in_cycle:1` → `slop:false`
    - `detectScopeSlop`: `files_changed:['src/a.ts','src/unrelated.ts'], declared_scope:['src/a.ts'], acceptance_expanded:false` → `slop:true`; same with `acceptance_expanded:true` → `slop:false`; within scope → `slop:false`
    - `detectContextSlop`: `repeated_reads:2/threshold:2` → `slop:true`; `duplicate_chars:500` → `slop:true`; `irrelevant_files:['tmp/foo']` → `slop:true`; all zero/empty → `slop:false`
    - `detectInvestigationSlop`: `unrelated_files_opened:6/max:5` without concrete reason → `slop:true`; same with `has_concrete_reason:true` → `slop:false`; `exploration_passes:2/max:2` without reason → `slop:true`
    - `detectCodeSlop`: `new_abstractions:1, acceptance_expanded:false, justification:false` → `slop:true`; same with `justification:true` → `slop:false`; `acceptance_expanded:true` → `slop:false`; `boilerplate_chars:500` without acceptance → `slop:true`
    - `recordSlopDecision` writes a single `## Cost governor decisions` bullet with `slop-governor` actor, sanitized (newline-stripped) reason
  - `bun run typecheck` passes
  - Coverage: `src/slop.ts` ≥90% (config `coverage_new=90`; verified at T3 gate)
- Risk: medium — a new L module must meet the 90% coverage bar; TDD-first with the acceptance cases above is the safety net. Rollback: revert the single commit.
- Deferred: none in T1 — report/CLI slop rows (§39/§43) are Phase 8; benchmark suite (§45) is Phase 9.

**Task 2: wire the verdicts into the agent flow** (§20–§24, §41)
- Files: modify `content/skills/mugiwara-workflow/SKILL.md`; `docs/concepts/cost.md`
- Interfaces: consumes `src/slop.ts` verdicts (T1) — documents them as the decision trail the crew follows; no code import (the skill is prose the agent reads; the trail is the machine-checkable artifact via `recordOptDecision`)
- Size: S
- Steps:
  - [ ] In `content/skills/mugiwara-workflow/SKILL.md`, under `## Rules` (after rule 2c), add one rule line (≤120 chars) and a short "Stop-Slop Governor" subsection. If body would exceed 120 lines (validator caps body at 120 lines, not chars), move the body to `content/skills/mugiwara-workflow/references/stop-slop-governor.md` with a one-line pointer (sanctioned pattern, Phase-4 precedent af8a204):
    - Rule: `2d. Stop-Slop Governor: detect slop via taxonomy/signals; measure progress vs cost; flag anomaly; intervene (tolerate/stop/compress/escalate); detect retry/healing/scope/context/investigation/code slop; record slop verdicts as slop-governor trail rows.`
    - Subsection `## Stop-Slop Governor` (3–5 lines): slop taxonomy (§21 eight kinds); detection signals (§22: repeated reads/commands, token-without-evidence, LOC-without-acceptance, abstraction-without-justification); progress measurement (§23: evidence/criteria/tests/code vs cost delta, slop when cost grows without progress); work-to-cost anomaly (§24 drop signal); intervention rules (§20 tolerate/stop/compress/escalate by severity); six category detectors (retry §21.6/§31 same-action-same-evidence-same-failure→STOP, healing §21.7/§32 no-progress→stop, scope §21.8 out-of-scope-without-acceptance→reject, context §21.2 duplicate/irrelevant→discard/compress, investigation §21.1 unbounded-exploration→stop, code §21.5 unnecessary abstraction/dependency/boilerplate→remove/simplify); every slop verdict lands as a `slop-governor` trail row. `savepoint.sh`/`lane-base.sh`/config untouched.
    - Ensure description frontmatter is byte-unchanged (validate-content requires it).
  - [ ] In `docs/concepts/cost.md`, append a `## Stop-Slop Governor (src/slop.ts)` section: the eleven capabilities + their verdict contracts (`classifySlop`, `detectSlopSignal`, `measureProgress`, `detectAnomaly`, `decideIntervention`, `detectRetrySlop`, `detectHealingSlop`, `detectScopeSlop`, `detectContextSlop`, `detectInvestigationSlop`, `detectCodeSlop`, `recordSlopDecision`), that Phase 6 records decisions but the report/CLI slop surface (§39/§43) is Phase 8 and the benchmark suite (§45) is Phase 9, the honest boundary (module records — crew acts via the workflow skill), and the security design rules (F2/F3).
  - [ ] Run `bun run validate-content --check-manifest --check-docs --check-doc-integrity`
  - [ ] Commit `docs(slop): wire stop-slop governor verdicts into the workflow skill and cost docs`
- Acceptance:
  - `bun run validate-content --check-manifest --check-docs --check-doc-integrity` exits 0 (skill description unchanged, manifest/docs drift clean)
  - `grep -E 'Stop-Slop Governor|slop-governor' content/skills/mugiwara-workflow/SKILL.md` returns 2+ matches
  - `grep -E '## Stop-Slop Governor' docs/concepts/cost.md` returns a match
  - `bun run typecheck` passes (docs-only, still confirmed)
- Risk: low — a skill body change could trip validate-content if a line exceeds 120 chars or the description drifts OR the 120-line body cap is exceeded (Phase-4/5 precedent: move to `references/` with a pointer); acceptance locks all three. Rollback: revert the commit.
- Deferred: the report/CLI slop ledger (§39/§43) stays Phase 8; benchmark suite (§45) stays Phase 9.

**Task 3: full gate + evidence**
- Files: none new; evidence → `.mugiwara/missions/native-cost-governor/flows/02-execution.md`
- Interfaces: consumes T1–T2
- Size: S
- Steps:
  - [ ] Run `bun run gate` — capture full output
  - [ ] If any gate fails: fix within scope, re-run. No gate waived. Known pre-existing `enforcement.test.ts` escape#2 flake (blockers.md row 3, heal_halt true) is waivable — re-run or prove on clean base is not a Phase-6 regression.
  - [ ] Write `flows/02-execution.md`: task table (T1–T3), per-task evidence (test commands + outputs), gate summary, `# Verdict:` line
  - [ ] Commit `chore(slop): phase 6 verification evidence`
- Acceptance: `bun run gate` exit 0 (full output captured in `.mugiwara/missions/native-cost-governor/flows/02-execution.md`; pre-existing flake not counted as Phase-6 regression when reproduced on base)
- Risk: none

## Risk & rollback

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| New `src/slop.ts` misses the 90% coverage bar | medium | CI red | TDD-first; acceptance cases lock every verdict family; gate catches at T3 |
| Skill-body edit trips validate-content (description drift, 120-line cap, 120-char line cap) | low | CI red | T2 acceptance locks all three; Phase-4/5 precedent: move to `references/` with pointer |
| Slop verdicts over-sensitive (flag legitimate work as slop) | medium | false stop/compress | every detector is threshold-gated and requires "without new evidence/acceptance/justification" — reason names the clause so crew can record a concrete-reason override (still audited); no single signal classifies as harmful automatically (§22) |
| Investment investigation re-detection duplicates `src/investigation.ts` logic | low | confusion | Phase-6 `detectInvestigationSlop` re-consumes the §13 triad as a slop taxonomy row — documented as re-consumption, not a fork; investigation.ts stays the file-investigation limit, slop.ts adds the classification+intervention layer |
| Scope/code re-consumption drift vs `src/scope.ts` | low | inconsistent verdicts | both use the same file-list / LOC / justification signals; slop.ts does not import scope.ts at runtime (avoids circular), same pure logic documented as re-consumption with identical thresholds |
| Pre-existing enforcement flake (escape #2) | certain (intermittent) | red on a random run | tracked separate mission (blockers row 3); not a Phase-6 regression — proven by reproduction on clean main |
| Slop/ledger scope bleed (gold-plating into Reporting) | low | scope slop | hard boundary: Phase 6 records decisions + pure verdicts only; report/CLI (`mugiwara cost`, §39/§42/§43) = Phase 8, benchmark = Phase 9 (honesty section) |

Rollback plan: each task is one revertible commit; T3 evidence lists exact
commits. Worst case: `git revert` the Phase-6 commits. `savepoint.sh`,
`lane-base.sh`, and `DEFAULT_CONFIG` are untouched, so runtime savepoint +
config behavior is preserved by construction.

## Phase-6 sub-scope → deliverable map + user-AC mapping

Spec DoD Slop (user acceptance) maps to Phase-6 tasks; each user AC has ≥1
per-task command-verifiable criterion:

| User AC (spec DoD) | Capability (§51/§spec) | Deliverable |
|---------------------|------------------------|-------------|
| slop taxonomy exists | 1 (slop taxonomy) | T1 `SLOP_TAXONOMY` + `classifySlop` (test-locked: context/retry/code classifications exact) |
| detection signals work | 2 (detection signals) | T1 `detectSlopSignal` (test-locked: threshold + evidence_delta gating) |
| progress measured | 3 (progress measurement) | T1 `measureProgress` (test-locked: §23 5k-tokens-zero-progress slop_signal) |
| work-to-cost anomaly flagged | 4 (anomaly) | T1 `detectAnomaly` (test-locked: drop vs baseline, division-by-zero safe) |
| intervention decided | 5 (intervention rules) | T1 `decideIntervention` (test-locked: all four interventions) |
| retry slop stopped | 6 (retry slop) | T1 `detectRetrySlop` (§21.6/§31 same-action-same-evidence→STOP, test-locked) |
| healing slop stopped | 7 (healing slop) | T1 `detectHealingSlop` (§21.7/§32 no-progress→stop, test-locked) |
| scope slop rejected | 8 (scope slop) | T1 `detectScopeSlop` (§21.8 out-of-scope without acceptance → slop) |
| context slop discarded | 9 (context slop) | T1 `detectContextSlop` (§21.2/§12 repeated-read/duplicate/irrelevant) |
| investigation slop stopped | 10 (investigation slop) | T1 `detectInvestigationSlop` (§21.1/§13 unbounded exploration without reason) |
| code slop removed | 11 (code slop) | T1 `detectCodeSlop` (§21.5/§15 abstraction/dependency/boilerplate without justification) |
| optimization decisions auditable (§41) | all | T1 `recordSlopDecision` → `recordOptDecision` (test-locked bullet shape + actor) |

## Definition of Done (Phase 6)

- `src/slop.ts` exists: `SLOP_TAXONOMY`, `classifySlop`, `detectSlopSignal`,
  `measureProgress`, `detectAnomaly`, `decideIntervention`, `detectRetrySlop`,
  `detectHealingSlop`, `detectScopeSlop`, `detectContextSlop`,
  `detectInvestigationSlop`, `detectCodeSlop`, `recordSlopDecision` — all pure,
  unit-tested, ≥90% coverage.
- The eleven §51 Phase-6 capabilities are covered by verdict functions with
  explicit reasons on every slop/intervention verdict.
- `content/skills/mugiwara-workflow/SKILL.md` wires the Stop-Slop Governor:
  taxonomy/signals/progress/anomaly/intervention + six category detectors +
  recorded slop verdicts (rule 2d); description unchanged; body ≤120 lines (or
  references pointer); validate-content green.
- `docs/concepts/cost.md` documents the Stop-Slop Governor verdicts, the honest
  boundary, the Phase-8/Phase-9 deferral boundaries, and the F2/F3 security
  design rules.
- No changes to `savepoint.sh`, `lane-base.sh`, or `DEFAULT_CONFIG` runtime
  behavior — no new config keys.
- `bun run gate` passes fully; every pre-existing test passes unchanged
  (pre-existing escape#2 flake not counted when reproduced on base).
- Phase 6 records decisions and pure verdicts only — no report/CLI surface
  (Phase 8) and no benchmark suite (Phase 9) built here.

## Honesty notes / deferred items

- **Honest boundary:** `src/slop.ts` produces and records verdicts; the LLM crew
  (workflow skill, T2) is the only thing that acts on them. The module does not
  pretend to force the model — it makes the slop decision structured, auditable,
  and instructed.
- **Report/CLI slop ledger deferred to Phase 8:** `slop.events_detected`,
  `stopped`, `compressed` (§39) and `mugiwara cost` slop section (§42) and
  the Cost section slop rows (§43) are Phase 8 Reporting — Phase 6 produces
  the pure verdicts and records the decisions only.
- **Benchmark deferred to Phase 9:** the twelve §45 Stop-Slop scenarios
  (endless exploration, repeated reads/commands/tests/reasoning, unnecessary
  abstraction/dependency, unrelated refactor, verbose output, no-progress
  healing, premature completion, excessive context) with detect→classify→
  intervene are Phase 9 benchmark — Phase 6's unit fixtures cover the verdicts.
- **F2/F3 accepted Low (unchanged):** secret-bearing files should not be
  fingerprinted/registered (F2) and `.mugiwara/` is local trusted state (F3) —
  both documented as design rules in `docs/concepts/cost.md` (T2), hardened at
  Phase 8 per decisions.md.
- **No new config:** Phase 6 adds nothing to `DEFAULT_CONFIG` — slop verdicts
  are pure over explicit inputs; the §6 `slop.detection` profile belongs to the
  adaptive-budget phases (7/8).
- **Re-consumption note:** `detectInvestigationSlop`/`detectScopeSlop`/
  `detectCodeSlop` re-consume the §13/`detectScopeDrift`/`detectCodeWaste`
  signals as taxonomy rows with the §21 classification + intervention layer —
  they do not fork the source modules; file-investigation limits stay in
  investigation.ts, scope/code waste signals stay in scope.ts, slop.ts adds
  the slop-specific intervention.
