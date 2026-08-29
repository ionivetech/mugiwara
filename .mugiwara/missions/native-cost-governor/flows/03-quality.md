# native-cost-governor — Flow 5 quality report

Flow base: `a1136a7` · Changed source: `src/cost.ts` (new, 161 lines), `src/mission.ts` (356 lines, small diff), `docs/concepts/cost.md`.

# Verdict: PASS

## Stack discovery

- **Formatter:** none configured (no prettier/dprint/etc. in package.json) — recorded skip.
- **Linter:** none configured (no eslint/biome) — recorded skip; the repo's strictest TS check is `bun run typecheck` (tsc --noEmit, strict) — run and clean.
- **User-declared test suites:** none (no mugiwara-testcases declared) — nothing to run under the consent matrix.
- **E2E:** no playwright/cypress/e2e setup + no matching changed files — gate not triggered, skip logged.

## Checks

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Formatter | (none configured) | n/a | SKIP (no tooling) |
| Linter | (none configured) | n/a | SKIP (no tooling) |
| Typecheck | `bun run typecheck` | `tsc --noEmit` clean | ✅ PASS |
| Duplication | 10-line sliding-window scan, cost.ts × mission.ts (self + cross) | 0 duplicate blocks; density 0% (< 3% flag) | ✅ PASS |
| Complexity | manual: all changed/added functions | max cyclomatic 3 (budgetStatus, costEnvelope, recordOptDecision), max cognitive ~2 — thresholds 10/15 | ✅ PASS |
| Maintainability | issues above = 0 | tech debt ratio ~0% → rating A | ✅ PASS |
| Code attributes | naming/consistency | cost.ts follows repo conventions (file-header comment, camelCase fns, snake_case state keys) | ✅ PASS |
| Unit tests | full suite | recorded in `flows/02-audit.md` + gate logs: 27 files / 441 tests (1 green capture); diff unchanged since audit → cited, not re-run | ✅ PASS (cited) |
| Integration/e2e | — | not triggered (no user-declared suites, no e2e setup) | SKIP (policy) |

## Complexity detail (changed functions)

| Function | Cyclomatic | Cognitive | Notes |
|----------|-----------|-----------|-------|
| `budgetForLane` / `laneBaseForLane` / `warnAt` / `stopAt` / `delegateAt` | 1 | 1 | one-liners |
| `budgetStatus` | 3 | 2 | two guards, mirrors savepoint.sh |
| `costEnvelope` | 3 | 2 | ternaries only |
| `appendCostEvent` | 1 | 1 | single append |
| `recordOptDecision` | 3 | 2 | try/catch + section check |
| `archiveMission` (modified) | unchanged from base | unchanged | diff replaced ternaries with function calls (same branch count) + one no-branch append + one no-branch fold push |

## Code attributes (metrics only — Robin does the qualitative pass in Flow 7)

- **Consistency:** no formatting drift (no formatter exists); naming matches repo.
- **Intentionality:** `delegateAt` and `costEnvelope` have no Phase-1 production consumer (unit-tested only) — deliberate foundation API for later phases (plan §7 delegation, §39 ledger, §42 `mugiwara cost` CLI). Recorded, not dead code.
- **Adaptability:** `src/cost.ts` is single-responsibility (cost domain); `mission.ts` stays large (pre-existing).
- Intentional cross-source duplication: `cost.ts` constants mirror `scripts/lib/lane-base.sh` — by design (shell cannot import TS), machine-checked by the parity test (D5). Not a defect.

## Consent record

No state-mutating or integration/e2e suites exist in scope — nothing required consent. Auto-safe unit runs only.
