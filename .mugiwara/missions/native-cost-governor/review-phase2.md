# Robin — Phase 2 Context/Investigation Governor review (`1451758..HEAD`)

Diff: `src/context.ts` (new), `src/evidence.ts` (new), `src/investigation.ts` (new), modifications to `src/cost.ts`, `src/config.ts`, `src/mission.ts`, `docs/concepts/cost.md`, plus `test/context.test.ts`, `test/evidence.test.ts`, `test/investigation.test.ts`, `test/config.test.ts`, `test/cost.test.ts`, `test/closure-integration.test.ts`. Depth: `full`.

## Verdict: **FAIL — with must-fix** (context-registry survival gap + contradictory efficiency metrics)

The core math is **correct** — I verified every formula against `src/budget.ts`, `scripts/savepoint.sh`, and the spec §10–13. The Phase-1 C2 bug (status gated on the context char budget) is genuinely fixed, and the Phase-1 S1 security gap (`.jsonl` outside `TRAIL_EXTS`) landed in `src/integrity.ts:41`. But the Phase-2 surface ships two defects: the new registry file is **not** archived like its `cost-events.jsonl` sibling (survival parity broken), and the "Context efficiency" report row emits **contradictory** numbers whenever a registry exists. Both are only latent now (nothing writes the registry in Phase 2) but are guaranteed to bite the Phase-3 consumer the plan already reserves.

---

## Correctness

### `[Pass]` estContextTokens — chars/4 ratio verified
- `Math.round(chars/4)`: `estContextTokens(120000)=30000`, `(3)=1`, `(7)=2` — test-locked (`test/context.test.ts:32-37`). Matches the documented 4 chars/token. **PASS.**

### `[Pass]` contextStatus gate mirrors the archive closure throw
- `contextStatus(budgetChars, chars)` returns `'over'` iff `budgetChars > 0 && chars > budgetChars` (`src/context.ts:39`). This is **identical** to the archive-time guard `if (budget && chars > budget) throw` (`src/mission.ts:165`). Budget 0 → `'ok'` both sides. Test-locked. **PASS.**

### `[Pass]` computeContextMetrics division-by-zero guarded
- `reuse_rate = reads_total > 0 ? reads_reused/reads_total : 0` — never NaN/Infinity (test `:72-82` locks it). `duplicate_chars = total − unique`. No negative guard, but callers pass `total >= unique` by construction. **PASS** for the guard.

### `[Pass]` evidence fingerprint / E### monotonicity / repeated-read detection
- `fingerprint` = stable sha256 hex (`src/evidence.ts:15`). `registerRead` matches on `fingerprint + kind` (kind-scoped — same content in different kinds is **not** a repeat, test-locked `:60-66`). `maxSeq`+1 gives monotonic, never-reused `E<zero-padded seq>` ids; test-locks E012→E013 and continuing past a seed (`:44-58`). `findRepeats` = `reads >= 2`, kind-optional. **PASS.**

### `[Low]` loadRegistry: one malformed line wipes the whole registry
- `src/evidence.ts:111-114`: `readFileSync(...).split(...).map(JSON.parse)` is inside one `try/catch` that returns `[]` on **any** failure. A single corrupt JSONL line silently discards every valid entry already loaded → metrics degrade to the "no registry" note. Missing dir → `[]` is correct; malformed-line handling should skip the bad line, not blank the file.
- Fix: map with per-line try, filter out failures.

### `[Medium]` `context_status: 'over'` is unreachable in a real closure event
- `src/mission.ts:165`: the archive **throws** when `chars > budget` (hard gate), *before* `ctxStatus = contextStatus(budget, chars)` is computed at `:172`. So every closure event that reaches `appendCostEvent` has `context_status: 'ok'` by construction; the `'over'` value in the `CostEvent` type can never be recorded by a real archive. The status field is dead — the enforcement is the throw, and the "status" adds nothing observable.
- Either record `'over'` and let the throw be the enforcement *decision*, or drop the field. Today it misleads a Phase-3 consumer into thinking "over" is a possible persisted state.
- Note: the C2 closure-integration test only exercises the `'ok'` path (`:211`), so this is untested-by-construction.

### `[Pass]` investigation state machine — precedence + boundaries verified
- `src/investigation.ts:49-60`: objective-met checked **first** (wins over all counters), then `pass >= max_passes` (stop at boundary), then `unrelated > max`, then `repeated >= threshold`. All four boundaries test-locked (`test/investigation.test.ts:23-62`): pass===max_passes→stop, unrelated===cap→continue (only `>` stops), repeated===threshold→stop. Matches spec §13. `recordInvestigationStop` records nothing when `!stop`, mkdir-on-write. **PASS.**

### `[Pass]` mission.ts C2/Q1/Q2 — status gated and computed once
- `status` now gates on the **lane token budget** via `costEnvelope({ lane, budget: laneBudget, tokens_est })` — never the context char budget (`src/mission.ts:167-168`). Phase-1 C2 fixed; closure-integration test locks it (`:196-213`). Computed once (`env`), reused for display (`statusLabel`, `warn_at`, `stop_at`) and the closure event (`env.status`) — Q2 honored. **PASS.**

---

## Breaking-change map / parity

### `[Pass]` No public API signature changed
- `cost.ts`: `delegateAt` clamps `thresholdPct` to `[1,100]` now, matching `savepoint.sh:110-111` (verified `-lt 1 → 1`, `-gt 100 → 100`). Signature unchanged — internal behavior fix, and it resolves Phase-1 nit P1. `CostEvent` gained **optional** `context_status`/`context_metrics` — backward compatible. `costEnvelope`/`recordOptDecision` were dead in Phase 1, now wired (mission.ts / investigation.ts) — good progression.
- `config.ts`: `readInvestigationConfig` + `InvestigationConfig` are **new** exports — additive.
- `context.ts` / `evidence.ts` / `investigation.ts`: all new modules, all exports new. No removals anywhere.

### `[Low]` `CostEvent.budget` semantic change for Phase-3 consumers
- Phase 1 wrote `budget: effBudget` (context char budget, or lane if unset). Phase 2 writes `budget: laneBudget` (`src/mission.ts:231`) — a **different meaning** for the same field, even though it's the correct C2 fix. Any Phase-3 consumer that read `budget` off a closure event gets a different value now. No in-repo consumer (grep confirms), so internal-safe; document the semantic change so the reserved Phase-3 surface reads it as lane-token-budget.

### `[High]` context-registry.jsonl NOT folded into report.md and survives loose
- `src/mission.ts:264` folds `cost-events.jsonl` (and the `.json` cleanup loop `:291` matches only `*.json`, not `*.jsonl`). `context-registry.jsonl` is **not** added to the fold list and **not** removed by any cleanup → it **survives loose** after archive and its contents never fold into `report.md`. The brief's survival check fails: the new ledger breaks parity with `cost-events.jsonl`, which both folds **and** is removed.
- Latent now (nothing calls `persistRegistry` in production yet), but the Phase-3 consumer will write it — and this gap is exactly the Phase-1 S1-class defect pattern the team fixed for `cost-events.jsonl`. Fix it now, in the same commit that wires the registry, or the archive leaves a dangling artifact.
- Fix: add `if (existsSync(join(dir, 'context-registry.jsonl'))) fold.push('context-registry.jsonl');` beside `:264`. Also note: registry is a `.jsonl`, so it now **is** covered by the S1 `TRAIL_EXTS` secret scan (good), but the fold must include it.

---

## Quality / Maintainability

### `[Low]` `CostEvent.context_metrics` shape duplicated inline instead of importing `ContextMetrics` (nit a from quality pass)
- `src/cost.ts:121-126` re-declares the exact five fields of `context.ts:44-52`'s `ContextMetrics`. Two definitions that must stay in sync; a field added to one silently desyncs the other. This is the Phase-2 LOW nit — it **stays LOW** (no drift today, but an obvious import opportunity).
- Fix: `import { type ContextMetrics } from './context.ts'` and use `context_metrics?: ContextMetrics`. Type-only import, no runtime cycle.

### `[Medium]` "Context efficiency" row emits contradictory numbers when a registry exists (nit b rises above LOW)
- `src/mission.ts:181-187`: when a registry exists, `computeContextMetrics` is called with `unique_chars: 0, total_chars: 0` hardcoded (`:184-185`). So `duplicate_chars` and `read_avoidance_chars` are **always `0`** — while `reuse_rate` and `repeated_reads` reflect the real registry. With `E001 reads:2, E002 reads:1` the row reads: `reuse_rate: 0.33 · duplicate_chars: 0 · read_avoidance_chars: 0` — **a contradiction** ("33% reused but 0 duplication/avoidance").
- This is worse than the LOW nit described: it's not "can show 0 when registry exists" — it **always** shows 0 when a registry exists, because the char-payload basis is hardcoded zero (the registry stores fingerprints, not char counts). The row mixes real read-based metrics with fabricated char-based zeros.
- Fix: either (a) drop `duplicate_chars`/`read_avoidance_chars` from the row when they can't be computed (show `n/a` or omit), or (b) store char payload counts per entry so the metrics are real. Do not ship a row that asserts `duplicate_chars:0` next to `reuse_rate>0`.

### `[Low]` Dead exports / speculative API — documented but unwired (mirrors Phase-1 Q1)
- Production (`src/`) uses only: `contextStatus`, `computeContextMetrics`, `measureContextChars`, `costEnvelope`, `recordOptDecision`, `loadRegistry`. **Zero production callers** for `fingerprint`, `registerRead`, `findRepeats`, `persistRegistry`, `estContextTokens`, `evaluateInvestigation`, `recordInvestigationStop`, `readInvestigationConfig` — all test-only.
- Mitigating: the `investigation.ts` header explicitly documents "Phase-3+ consumer supplies the inputs" — honest boundary, not drift. But the registry **write side** (`registerRead`/`persistRegistry`/`fingerprint`) has **no** Phase-2 wiring at all, which is exactly why the metrics row and the survival gap are latent. Keep them but note in `docs/concepts/cost.md` that the registry is write-inert until Phase 3.

### `[Low]` persistRegistry re-appends the whole passed array on every call
- `src/evidence.ts:100-106`: iterates the entire registry and appends each entry. The contract comment says "callers append the new (or re-saved) batch" — but the signature takes the **full** registry, so a caller that loads, mutates (`reads++`), and re-persists would duplicate every entry. Tests only ever pass fresh arrays, so it's untested. Phase-3 footgun.
- Fix: document the "new entries only" contract on the signature, or accept a `RegistryEntry[]` of *new* entries.

---

## ESM / concurrency

### `[Pass]` ESM correctness
- `context.ts`/`evidence.ts`/`investigation.ts` use `node:fs`/`node:path`/`node:crypto` imports only; no `require()`. `context.ts` re-exports `measureContextChars` from `budget.ts` (single implementation, test-locked). **PASS.**

### `[Pass]` Append-only writes
- `persistRegistry`/`appendCostEvent` single `appendFileSync` lines → O_APPEND; `JSON.stringify` escapes newlines so content can't break a JSONL line. `mkdirSync(recursive)` safe. `registerRead` mutates the in-memory array only (no I/O). **PASS.**

### `[Pass]` No TOCTOU in new registry/decision code
- The only read-then-write race is the pre-existing `recordOptDecision` section-header check (Phase-1 finding, benign single-writer-per-mission, documented). The new `loadRegistry` is read-only; `registerRead`/`persistRegistry` are not yet wired. **PASS** for the new code.

---

## Reliability rating: **6.5 / 10**

Core formulas and state machines are correct and spec-faithful (verified line-by-line); the C2 fix and the S1 `.jsonl`-in-scan fix from Phase 1 both landed cleanly. Deductions:
- −1.5: `context-registry.jsonl` survival gap — the new ledger is not archived/removed like `cost-events.jsonl` (explicit survival check failed). Must-fix.
- −1: "Context efficiency" row is contradictory (real reuse_rate beside hardcoded-0 duplicate/avoidance) — misleads any reader or Phase-3 consumer.
- −1: `context_status: 'over'` unreachable + dead/write-inert registry surface + `loadRegistry` all-or-nothing parse + re-persist duplication footgun.

Math reliability is high; **archive-survival and metric-integrity** are what hold it back.

---

## Findings summary

| # | Sev | Location | One-liner |
|---|-----|----------|-----------|
| H1 | High | `src/mission.ts:264` | `context-registry.jsonl` not folded into report.md and not removed → survives loose; parity broken with cost-events.jsonl. |
| M1 | Med | `src/mission.ts:181-187` | Efficiency row shows `duplicate_chars:0`/`read_avoidance_chars:0` (hardcoded) next to real `reuse_rate>0` — contradictory. |
| M2 | Med | `src/mission.ts:165,172` | `context_status:'over'` unreachable — archive throws first, so every persisted closure event is 'ok'. |
| L1 | Low | `src/evidence.ts:111-114` | `loadRegistry` returns `[]` on any single malformed line — wipes valid entries; should skip per-line. |
| L2 | Low | `src/cost.ts:121-126` | `context_metrics` shape duplicated inline instead of importing `ContextMetrics` (nit a — stays LOW). |
| L3 | Low | `src/cost.ts:231` | `CostEvent.budget` semantic change (context→lane budget); document for Phase-3 consumers. |
| L4 | Low | `src/evidence.ts:100-106` | `persistRegistry` re-appends full array — mutation+re-persist would duplicate entries; document "new entries only". |
| L5 | Low | `src/evidence.ts`/`investigation.ts`/`context.ts`/`config.ts` | Dead exports (registerRead/fingerprint/persistRegistry/estContextTokens/evaluate/readInvestigationConfig) — write-inert until Phase 3. |

**Resolved from Phase 1:** C1-pattern gate parity (delegateAt clamp now matches savepoint, P1 → fixed); C2 status-gate bug (fixed, test-locked); S1 `.jsonl`-in-`TRAIL_EXTS` (fixed, `src/integrity.ts:41`); Q1 dead exports partially wired (costEnvelope/recordOptDecision now live).

**Blockers/majors routed to Brook:** H1 (High), M1 + M2 (Medium).

---

*Review evidence: read `src/context.ts`, `src/evidence.ts`, `src/investigation.ts`, `src/cost.ts`, `src/config.ts`, `src/mission.ts`, `src/budget.ts`, `src/integrity.ts`, `scripts/savepoint.sh`, all six test files, `docs/concepts/cost.md`, and spec §10–13. Caller mapping via grep across `src/`. No execution, no writes outside this review file.*
