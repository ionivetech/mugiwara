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
