# Quality Report — Phase 3 (Work Governor)

- Mission: native-cost-governor
- Branch: feat/native-cost-governor
- Scope commits: 0d1bf3e 7736227 bc4346e 1bf7568 3331762 (base 3ca5d23)
- Scope files: src/work.ts (new, 273 ln / 10.6K), src/cost.ts (+2/-7), src/evidence.ts (+21/-1), content/skills/mugiwara-workflow/SKILL.md, docs/concepts/cost.md, test/work.test.ts (new), test/evidence.test.ts, .mugiwara/.../02-execution.md
- quality_depth: full
- Verdict: **GO** (non-blocking findings below)

## Tooling detection

No ESLint / Prettier / Biome in repo (checked `package.json` scripts + devDeps + config globs). Only `typescript`, `vitest`. There is **no `lint` and no `format` script** in `package.json`. Formatter/linter gates are **not runnable as written** — recorded as a gap, not silently skipped. Real quality surface = typecheck + build + validate-content + unit tests, which were all run fresh.

## Gate results

| Gate | Command | Exit | Result |
|------|---------|------|--------|
| Lint | `bun run lint` | — | **SKIP** — no script, no linter installed |
| Format check | `bun run format --check` | — | **SKIP** — no script, no formatter installed |
| Content validation | `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` | 0 | **PASS** |
| Typecheck | `bun run typecheck` (`tsc --noEmit`) | 0 | **PASS** |
| Build | `bun run build` | 0 | **PASS** |
| Unit tests | `bun run test` (`vitest run`) | 0 | **PASS** — 31 files / 524 tests, incl. new `test/work.test.ts` |

Content validation emitted 2 pre-existing advisories on `mugiwara-quality/SKILL.md` and `mugiwara-review/SKILL.md` (section ≥15 content lines) — not in scope, non-blocking. Test fixtures wrote under `.mugiwara/missions/{run-fixture,cwd-fixture}` — expected test behavior, not a defect.

## Code-quality findings — src/work.ts (273 lines)

### Duplication
- **MEDIUM — `evaluateDelegation` repeated verdict object.** The 6-field result literal (`{delegate, reason, budget_at, lane_base, parallel_value, overhead}`) is rebuilt verbatim in 4 places (lines 184–192, 194–202, 204–212, 213–220); only `delegate` + `reason` differ. ~24–28 of 38 function lines are repeated shape → duplicated_lines_density ≈ 9% in this construct, above the 3% flag threshold. Any new verdict field must be added in 4 spots → drift risk. Refactor: build one base object, override `delegate`/`reason` per branch. (Sanji does not fix — reported only.)
- **LOW — `shouldSkipStage` duplicate block.** Lines 73–75 and 82–84 are near-identical `evidence already answers` returns (~3 lines; below the 10-line threshold).
- **Cross-module: none.** `work.ts` reuses `delegateAt`, `laneBaseForLane`, `recordOptDecision` from `cost.ts`; no re-implementation of cost/context/investigation logic. Duplication with existing modules: **PASS**.

### Complexity (cyclomatic McCabe + cognitive)
Max cyclomatic = **7** (`shouldSkipStage`); all others ≤5. Flag threshold 10, major 20. Cognitive max ~8 (nesting depth 2 in `shouldSkipStage`), threshold 15. **PASS** for every function.

### Maintainability rating
Remediation effort from the findings (MEDIUM duplication refactor + LOW nit) ≈ <1h vs 273 lines → ratio ≪5%. **Rating: A**.

### Dead code / intentionality
No dead code, no unreachable branches. `work.ts` is not imported by the cli/pipeline — that is intentional (header declares the LLM crew is the only actor on verdicts; module produces+records, dedicated `test/work.test.ts` proves it executes). **PASS**.

### Correctness / clarity nit
- **LOW — `evidence: input.stage` (lines 74, 83).** The `evidence` field of `SkipVerdict` is populated with the *stage name*, not actual evidence. Misleading field semantics; likely a placeholder mis-fill. Verify intent or drop the field.

### Accidental complexity / adaptability
Verbose but consistent with the repo's auditable-verdict pattern (`cost.ts`, `investigation.ts`); single responsibility (verdict engine + decision trail). No accidental complexity. **PASS**.

## Consent ledger
No user-declared integration/e2e/state-mutating suites exist for this mission — nothing required consent; nothing skipped under consent. Unit suite ran (no consent needed).

## Recommended (not required)
Add minimal standard tooling for the stack — `prettier` (format) + `eslint` (lint, with `complexity` and `sonarjs/cognitive-complexity` plugins) wired as `format`/`lint` scripts. None exist today; the formatter/linter quality gates are currently a gap for every mission.
