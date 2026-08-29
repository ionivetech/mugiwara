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

---

# Robin — Phase 3 Work Governor review (`3ca5d23..HEAD`)

Diff: `src/work.ts` (new), `src/evidence.ts` (F1), `src/cost.ts` (type dedup), `test/work.test.ts` (new), `test/evidence.test.ts`, `content/skills/mugiwara-workflow/SKILL.md`, `docs/concepts/cost.md`. Depth: `full`.

## Verdict: **GO — no blockers.** Two majors to track (unwired module + F1 whole-registry-loss edge). All six §51 capabilities match spec; verdict math verified against `src/cost.ts` (delegateAt/laneBaseForLane) and `LANE_BASE`.

## Breaking-change map

| Symbol | File | Type | Callers | Class |
|--------|------|------|---------|-------|
| `classifyStage`, `shouldSkipStage`, `evaluateInvocation`, `shouldLoadSkill`, `evaluateDelegation`, `completionCheck`, `recordWorkDecision` (+ 6 input/verdict types) | `src/work.ts` | NEW module | none — only `test/work.test.ts` imports it | additive, safe |
| `loadRegistry` | `src/evidence.ts` | signature unchanged; behavior hardened | `src/mission.ts:173` | internal-safe (well-formed registries pass through exactly; only malformed lines change) |
| `CostEvent.context_metrics` | `src/cost.ts` | type-only (`import type ContextMetrics`) | cost-event constructors | internal-safe, behavior identical |

No public break. `test/cost.test.ts` unchanged → no pinned assertion broke (confirmed type-only). Migration path: none required.

## Findings

- **MAJOR `src/work.ts` — zero runtime consumers.** Only the test imports it. Plan architecture claims it "consumes evaluateInvestigation / findRepeats / contextStatus / readInvestigationConfig"; code imports **only** `cost.ts` and takes raw booleans. Phase 3 as delivered *documents* verdicts but *enforces/records nothing at runtime* — the crew is told in prose (SKILL.md rule 2a) to "record skip/avoid verdicts as work-governor trail rows" with **no tool to do so** (skills are markdown; no CLI/adapter). This is consistent with the plan's declared honest boundary (decision 2), so not a blocker — but plan's "enforces" language overstates it. Fix suggestion: either add a thin adapter that assembles the real signal booleans (`findRepeats`→evidence_present, `contextStatus`→context_over, `evaluateInvestigation`→investigation_stopped) and a CLI/helper the skill can invoke, or soften plan "enforces" → "instructs".
- **MAJOR `src/evidence.ts:118-131` — one corrupt line empties the whole registry.** A `null` JSON line (`typeof e.fingerprint` throws) or any unparseable-JSON line throws inside the chain → outer `try/catch` returns `[]`, silently discarding **all** valid dedup entries for `mission.ts`. Defeats F1's "drop malformed lines *selectively*" intent — the documented cases (string `reads`, missing `ref`, negative/fractional `reads`) work, but a single corrupt line nukes everything. Fix suggestion: guard each entry before property access (`e !== null && typeof e === 'object'`) and wrap each line's parse in its own try so only that line is dropped.
- **MINOR `src/work.ts:150,160` — `evidence` field set to `input.stage`, not evidence.** `shouldSkipStage` returns `evidence: input.stage` (the stage name), which is not evidence. Misleads downstream trail readers. Fix suggestion: drop the field or pass a real `E###` ref.
- **MINOR `content/skills/mugiwara-workflow/SKILL.md:98` — rules list mangled.** Rules 7 and 8 collapsed onto one line (155 chars); line 93 inserts "2a." inside a numbered list (227 chars). Not a gate failure (validator enforces 120 *lines*, not chars; long lines pre-existed) but a real list-structure regression. Fix suggestion: restore each rule to its own numbered line.
- **MINOR `test/evidence.test.ts` F1 cases — no null/unparseable-line case.** Would have caught the MAJOR above. Fix suggestion: add a `null`-line and a non-JSON-line case.

## Five-axis

- **Correctness: PASS.** All six capabilities match §51/§7/§8/§9/§19/§30. Verified `delegateAt(25000,60)=15000`, `laneBaseForLane('full')=22016`, overhead floor `max(est, lane_base)`, delegate gating order (tasks≥2, value>overhead, tokens≤budget_at) — all exact. F1 shape coercion (`floor`, drop negative/non-finite/string) correct for object lines. Type dedup exact (ContextMetrics = 5 same fields).
- **Design/architecture: WEAK.** Verdict functions are clean and pure, but the phase ships an unwired library (see MAJOR #1). Honest boundary is documented well in both `work.ts` header and `docs/concepts/cost.md`.
- **Maintainability: GOOD.** Pure functions, explicit input types, single type source (dedup landed), clear per-function doc comments. `COMPLETION_FIELDS` array avoids duplication.
- **Test quality: STRONG.** Exact non-trivial assertions (`toBe(22016)`, `toBe(15000)`, `toEqual(['tests_complete'])`), no `expect` inside conditional, delegation/completion/record-path well covered, S2 sanitizer tested with injected `\n## fake`. Missing the one F1 edge case (minor above). Coverage of work.ts appears ≥90%.
- **Docs: GOOD.** `docs/concepts/cost.md` Work Governor section is honest about the boundary and carries the F2/F3 security design rules (handoff to Jinbe lane — not duplicated here). Workflow skill description unchanged (plan T4 acceptance met). Minor: rules-list mangling + plan's "consumes Phase-2 signals" not reflected in code.

## Reliability rating: **B** — verdict logic is correct and well-tested, but the module has no runtime consumer, so the verified behavior has no production effect yet.

## Handoff to Brook
No blockers. **MAJOR #1** (unwired module) and **MAJOR #2** (F1 whole-registry loss) recommended before Phase 8 consumes these signals. Security handoff: F2/F3 rules documented in `docs/concepts/cost.md` — no new Jinbe lane work required this phase.

---

# Robin — Phase 4 Scope & Code Governor review (`eb8229d..HEAD`)

Diff: `src/scope.ts` (new), `test/scope.test.ts` (new), `content/skills/mugiwara-workflow/SKILL.md`, `content/skills/mugiwara-workflow/references/scope-code-governor.md` (new), `docs/concepts/cost.md`, `test/golden/claude.json`, `test/golden/opencode.json`. Depth: `full`.

## Verdict: **APPROVE** — reliability **A**. Zero public/internal breaks (8 additive exports, none consumed by runtime). All seven verdict functions match plan contracts exactly; `recordScopeDecision` correctly wraps `recordOptDecision` with the `scope-governor` actor + S2 sanitizer. Four findings (M1 + N1–N3), all minor/non-blocking. Two heal cycles closed the real blockers (SKILL.md governance-line loss → references move; conformance golden drift 61→62).

## Scope read

Phase 4 = the seven §51 capabilities: scope drift detection, existing-code reuse, abstraction justification, dependency justification, minimum sufficient implementation, code waste detection, change-surface measurement — plus the `recordScopeDecision` trail helper. Consumes the shipped Phase 1/2/3 primitives; adds **no** config keys; `savepoint.sh` / `lane-base.sh` / `DEFAULT_CONFIG` untouched. Same honest boundary as Phase 3: the module *produces and records* verdicts; the crew acts via the workflow skill (rule 2b). Docs (`cost.md:250-258`) state the Phase-6/Phase-8 boundary (slop machinery / report+CLI ledger) explicitly. Matches plan §Phase 4 and `decisions.md` triage.

## Breaking-change map

| Symbol | File | Type | Callers | Class |
|--------|------|------|---------|-------|
| `detectScopeDrift` | `src/scope.ts:41` | NEW export | none — `test/scope.test.ts` only | additive, safe |
| `checkExistingCodeReuse` | `src/scope.ts:76` | NEW export | none | additive, safe |
| `evaluateAbstraction` | `src/scope.ts:114` | NEW export | none | additive, safe |
| `evaluateDependency` | `src/scope.ts:146` | NEW export | none | additive, safe |
| `minimumSufficientCheck` | `src/scope.ts:186` | NEW export | none | additive, safe |
| `detectCodeWaste` | `src/scope.ts:231` | NEW export | none | additive, safe |
| `measureChangeSurface` | `src/scope.ts:279` | NEW export | none | additive, safe |
| `recordScopeDecision` | `src/scope.ts:311` | NEW export | none | additive, safe |

`scope.ts` imports only `recordOptDecision` from `cost.ts` (grep: no `src/` module imports `scope.ts`). **0 public breaks, 0 internal breaks, 8 new exports.** Migration path: none required. As with Phase 3, the module is unwired at runtime — consistent with the plan's declared honest boundary (records, doesn't enforce), so not a blocker.

## Eight-export contract verification

| # | Export | Plan/spec contract | Verified |
|---|--------|--------------------|----------|
| 1 | `detectScopeDrift` | drift iff any touched file outside declared scope; `scope_score` = fraction outside; 0 files → 0 | **MATCH** — substring token match; reason names outside files; empty-array guard at `:45`. |
| 2 | `checkExistingCodeReuse` | reuse only when existing code present AND local modification viable | **MATCH** — three-way reason (`no existing` / `not viable` / reusable); never `reuse:true` on code-exists alone. |
| 3 | `evaluateAbstraction` | justified only when not speculative AND (required by contract OR used ≥2 + duplication benefit) | **MATCH** — speculative short-circuits; single-use/no-contract refused (`:114-125`). |
| 4 | `evaluateDependency` | justified only when no equivalent, not solvable with existing, long-term value, maintenance ≤ removal cost | **MATCH** — first-failing-clause reason; never justified merely for convenience. |
| 5 | `minimumSufficientCheck` | `under` (missing verification/coverage) / `over` (incidental complexity) / `sufficient`; never min-LOC at expense of quality | **MATCH** — verif/coverage fail first; incidental-complexity → over (`:186-197`). |
| 6 | `detectCodeWaste` | name every true §15 waste type | **MATCH** — `WASTE_TYPES` table (8 flags) maps to names; empty → `no code waste`. |
| 7 | `measureChangeSurface` | `loc_changed = loc_added + loc_removed`; justified iff within scope and no new abstraction/dependency | **MATCH** — full §5.4 metric block; reason names first failing clause. |
| 8 | `recordScopeDecision` | persist any verdict via sanitized `recordOptDecision` with `scope-governor` actor | **MATCH** — wraps `recordOptDecision` (`scope.ts:315-320`), `actor: 'scope-governor'`, optional evidence spread, S2 sanitizer inherited from cost.ts (newline/CR stripped — tested at `scope.test.ts:383`). |

## Five-axis

- **Correctness: PASS.** All 8 contracts verified above against the plan's §14/§15/§16/§38/§41/§5.4 contracts. Edge guards present (empty touched-files → score 0, empty waste → `waste:false`). `recordScopeDecision` S2 injection case (`\n## fake` reason) explicitly tested — sanitizer holds.
- **Design/architecture: PASS.** Pure verdict engine, explicit input types, thin wrapper over the sanctioned `recordOptDecision` trail — no new persistence path, no reinvention. `WASTE_TYPES` table removes 8-way flag duplication. Honest boundary documented in both module header and `cost.md`. Consistent with Phase 3 `work.ts` pattern.
- **Readability: PASS.** Per-function doc comments state the §-contract and the failure semantics; block-section comments mirror the §51 capability ordering; naming matches plan symbols.
- **Security: PASS** (confirming Jinbe's lane, not duplicating it). `recordScopeDecision` routes through the S2-sanitized `recordOptDecision`; no new file writes, no new deps, no `registerRead`. F2/F3 design rules documented in `cost.md`. No injection surface beyond the already-sanitized decision bullet.
- **Performance: PASS.** All verdicts are O(n) linear scans over explicit input arrays; no IO in the pure functions; `recordScopeDecision` appends one line. No concern.

## Findings

- **M1 (minor, not a defect)** — `content/skills/mugiwara-workflow/SKILL.md` — Phase-4 heal moved the `## Scope & Code Governor` body to `references/scope-code-governor.md` (`af8a204`) with a one-line pointer, restoring the two governance lines Chopper flagged as lost. Documented Luffy-approved Option A in `decisions.md:222-243`; content byte-preserved (verified pointer + 14-line reference); SKILL.md back to ≤120 body lines. This is the sanctioned >budget pattern, not a regression.
- **N1 (minor)** — `docs/concepts/cost.md:222-224` and `:260-262` — the F2/F3 security design rules are duplicated verbatim (pre-existing Work-Governor section + new Phase-4 section). Same text, two copies. Harmless but drifts if one is edited. Fix: Phase 4 section can reference the existing F2/F3 block instead of restating it.
- **N2 (minor)** — `test/scope.test.ts` — several `reason` assertions are loose (`toContain('2')` at `:130`, `toMatch(/equivalent/)`/`/existing/`/`/verif/`/`/dependenc/` at `:178,184,190,196,206,223,230,237,338,344,350`, `toContain('not viable')`/`'no existing'` at `:97,103`). The boolean verdict fields are all asserted exactly; only the human-readable reason strings are fuzzy-matched. Defensible (reason is prose), but the reason contract is not pinned — a wording drift passes green. Fix (optional): assert full reason strings on the fixed-verdict cases.
- **N3 (minor / sanity-verify)** — `test/golden/claude.json:39` + `test/golden/opencode.json:39` — golden `skills` bumped 61→62 for the new `references/scope-code-governor.md` (tier-1 install surface). Tier-2 target goldens unchanged (43/29). Correct: the reference is a tier-1 shared-reference install, not a tier-2 file. Sanity-verify at Phase 8 that the conformance `.file_count` stays green if any later phase adds another tier-1 reference — the golden-bump regression gate (heal cycle 2, `ff14f57`) is now the guard.

## Reliability rating: **A**

All 8 verdict functions are pure, contract-exact, and tested; `recordScopeDecision` correctly reuses the sanctioned sanitized trail. Zero breaking changes (all additive, none runtime-wired). Both heal cycles (governance-line restore + conformance golden regen) were root-caused, proven, and left the tree green. Deductions: −0.5 for N1 (F2/F3 duplication) and the loose reason assertions (N2); no functional, security, or integrity risk in the shipped surface.

## Final verdict: **APPROVE**

No blockers, no majors. M1 is a documented heal, not a defect. N1–N3 are minor and none block merge. Security lane owned by Jinbe (F2/F3 confirmed documented; S2 reuse verified — no new Jinbe work). Same honest-boundary caveat as Phase 3 carries forward: the module records/measures but has no runtime consumer until Phase 6/8 — expected per plan, not a blocker. Route to Brook for merge of the Phase-4 branch.
