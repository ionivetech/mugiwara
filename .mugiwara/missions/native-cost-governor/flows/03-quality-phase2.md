# native-cost-governor — Flow 5 quality report (Phase 2)

Flow base: `1451758` (phase-2 plan commit) · Reviewed diff: `1451758..HEAD`
Changed source: `src/context.ts` (new, 72), `src/evidence.ts` (new, 114),
`src/investigation.ts` (new, 72), `src/config.ts` (+36), `src/cost.ts` (+22),
`src/mission.ts` (+47). Tests: `test/context|evidence|investigation|config|cost|closure-integration.test.ts`.

# Verdict: PASS (with notes — no must-fix)

## Stack discovery

- **Formatter:** none configured (no prettier/dprint/biome in package.json or repo) — recorded skip, matches Phase-1.
- **Linter:** none configured (no eslint/biome) — recorded skip; strictest TS check is `bun run typecheck` (tsc --noEmit, strict) — clean.
- **User-declared test suites:** none declared — nothing under the consent matrix; auto-safe unit + repo integration only.

## Checks

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Formatter | (none configured) | n/a | SKIP (no tooling) |
| Linter | (none configured) | n/a | SKIP (no tooling) |
| Typecheck | `bun run typecheck` | `tsc --noEmit` clean, exit 0 | ✅ PASS |
| Unit tests (scoped) | context/evidence/investigation/config/cost/closure-integration | 6 files / 90 tests pass | ✅ PASS |
| Full suite | `bun run test` | 30 files / 483 tests pass | ✅ PASS |
| Duplication | manual sliding-window scan (new + modified × self + cross, vs Phase-1 budget/cost) | 0 duplicate blocks; density 0% | ✅ PASS |
| Complexity | manual per function | max cyclomatic 5 (`evaluateInvestigation`); all others ≤3 | ✅ PASS (note) |
| Maintainability | consumer map, naming, dead/speculative code | foundation API unwired (documented); 2 type-shape nits | ✅ PASS (note) |
| Code attributes | consistency/intentionality/adaptability | naming + conventions match repo | ✅ PASS |
| Integration/e2e | — | not triggered (no user-declared suites, no e2e setup) | SKIP (policy) |

## Complexity detail (new/changed functions)

| Function | Cyclomatic | Notes |
|----------|-----------|-------|
| `evaluateInvestigation` | **5** | 4 flat sequential `if…return` (objective-met, max passes, max unrelated, repeated read). Linear, non-nested → cognitive ~1. Exceeds Phase-1's demonstrated bar of 3 but well under the 10/15 thresholds; flat decision chain is the natural shape for "N stop conditions". Acceptable. |
| `computeContextMetrics` | 2 | one guard ternary (0-total → 0, no NaN/Infinity) |
| `contextStatus` | 2 | one ternary |
| `registerRead` | 2 | one `if (existing)` |
| `recordInvestigationStop` | 2 | one `if (!stop)` |
| `findRepeats` / `maxSeq` | 1–3 | trivial |
| `estContextTokens` | 1 | one-liner |
| `readInvestigationConfig` | 1 | three pure `positiveInt` calls |
| `positiveInt` | 2–3 | one guard + one ternary |

## Duplication

- **`measureContextChars` REUSED from `src/budget.ts`** via re-export, never re-implemented; test locks the equality (`context.test.ts` "reuse proof"). ✅ Correct — single implementation honored.
- `recordInvestigationStop` reuses `recordOptDecision` — good reuse, not a re-implementation. ✅
- `persistRegistry` (evidence.ts) and `appendCostEvent` (cost.ts) are parallel ~3-line mkdir+appendFileSync JSONL helpers. Same documented contract, trivial bodies. A shared `appendJsonl` helper could serve both, but the coupling gains nothing for 3 lines. Noted, not debt.
- `fingerprint` (sha256) is the only fingerprint implementation in the repo — no prior art duplicated. ✅
- `cost.ts` Phase-2 deltas (delegateAt clamp P1, recordOptDecision sanitize S2) are small fixes, no new duplication.
- **Duplication density: 0%** — no 10-line block is duplicated across the new modules or against Phase-1.

## Maintainability

**Consumer map (production `src/` + `scripts/`, tests excluded):**

| Export | Consumer |
|--------|----------|
| `loadRegistry` | ✅ `mission.ts:176` |
| `computeContextMetrics` | ✅ `mission.ts:180` |
| `contextStatus` | ✅ `mission.ts:173` |
| `measureContextChars` (re-export) | test-locked equality; `mission.ts` consumes budget's internally |
| `registerRead`, `findRepeats`, `persistRegistry`, `fingerprint` | ⚠️ test-only (Phase-3 consumer) |
| `evaluateInvestigation`, `recordInvestigationStop` | ⚠️ test-only (Phase-3 consumer) |
| `readInvestigationConfig` | ⚠️ test-only (Phase-3 consumer) |
| `estContextTokens` | ⚠️ test-only |

The unwired surface is **deliberate and documented**: plan decision 6 ("Phase 2 = measurement, not enforcement … Phase 3 consumes them"). Same pattern Phase-1 already recorded for `delegateAt`/`costEnvelope` (foundation API, not dead code). `costEnvelope` now gains a real production consumer (`mission.ts`, Q2) — Phase-1's lone-foundation note for it is resolved. `delegateAt` remains test-only (legitimate — it only got the P1 clamp). Recorded, **not dead code**.

**Type-shape nits (LOW, optional):**
1. `CostEvent.context_metrics` (cost.ts:121) duplicates the `ContextMetrics` shape from context.ts inline rather than importing it. No runtime duplication; two definitions of the same record must be kept in sync by hand. Fix is trivial (import the type) if a later phase touches this.
2. `mission.ts:181-183` feeds `unique_chars: 0, total_chars: 0` into `computeContextMetrics` because the registry tracks reads, not char payloads. Result: **`duplicate_chars` and `read_avoidance_chars` are always `0` in the actual archive row whenever a registry exists** — and no note is shown (the `ctxNote` "no registry — reads not tracked" only renders for the empty case). A reader may misread "duplicate_chars: 0 · read_avoidance_chars: 0" as *measured zero duplication* when it actually means *chars not tracked*. `reuse_rate` (= repeated_reads/reads_total) and `repeated_reads` are the only meaningful live fields. The `duplicate_chars`/`read_avoidance_chars`/`unique_chars`/`total_chars` metric machinery is effectively dead in production (exercised only by unit tests). **LOW** — honest data, but a reporting-semantics hazard; consider either dropping the two always-zero fields from the archive row or adding a note when the registry is present but char payloads aren't tracked.

## Config (§52 check)

- `DEFAULT_CONFIG` grew from 1 to 4 **comment-only** optional keys (`context_budget_chars` + the 3 `investigation_*`). `readConfig` skips `#` lines (line 46) → **no behavior change**, existing string-assertion test updated in-scope. ✅
- Exactly 3 flat `investigation_*` keys, justified policy boundaries (spec §13): `max_passes=2`, `max_unrelated_files=5`, `repeated_read_threshold=2`. Defaults are sensible. snake_case matches existing config convention. No over-grown surface — internal governor internals are NOT exposed (§52 honored). ✅

## Error handling

- `loadRegistry`: wraps read+parse in try/catch → empty list on missing/corrupt file; `filter(Boolean)` drops blank lines. ✅ Malformed JSONL line would throw on `JSON.parse` — but that's inside the same try, so a corrupt line yields `[]` silently (no partial-rescue). Acceptable for a measurement registry; noted.
- `persistRegistry` / `recordOptDecision` / `appendCostEvent`: `mkdirSync(recursive)` on write — creates mission dir. ✅
- `recordOptDecision` S2 fix strips `\r\n` from actor/decision/reason/evidence — no markdown/line injection into decisions.md → report.md. Tested (`cost.test.ts` injection case). ✅

## The two logged deviations

**(a) Parallel waves ran inline** — process choice, not code-quality. No source impact. Confirmed not a quality defect.

**(b) T6 added two optional `CostEvent` fields (`context_status`, `context_metrics`)** — sound. Optional fields are backward-compatible with persisted JSONL (old events lack them; `appendCostEvent` uses `Object.assign` so absent fields simply aren't serialized). C2 separation is preserved: `status` gates the **lane token budget**, `context_status` gates the **chars budget** — distinct fields, never conflated, verified by `closure-integration.test.ts:214` (`status: 'warn', context_status: 'ok'`). The only caveat is the type-shape duplication in note (1) above. No debt introduced.

## Consent record

No user-declared integration/e2e or state-mutating suites exist in scope — nothing required consent. Auto-safe unit + repo-integration runs only.

## Final verdict

**PASS.** Complexity ≤3 on every function except `evaluateInvestigation` (cyclomatic 5, flat/linear, acceptable). Duplication 0%. Maintainability A — new modules are single-responsibility, well-named, documented, and error-guarded; the unwired foundation API is the documented Phase-2 boundary. No must-fix. Two LOW, optional nits (type-shape duplication in `CostEvent`, and the always-zero `duplicate_chars`/`read_avoidance_chars` in the archive metrics row) — routing decision left to Luffy.
