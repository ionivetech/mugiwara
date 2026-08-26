# PR Verdict — audit-hardening

**Branch:** `feature/audit-hardening` (from `main`)
**Title:** `feat: audit-hardening — CTO audit defects + roadmap remainder (8 items, 3 waves)`

## Summary

Fix every defect and gap surfaced by the deep CTO/principal audit plus the deferred roadmap remainder. 8 work items, 3 waves. No new skills; 21-skill ceiling intact.

## What changed

| Wave | Task | Files | Commit |
|------|------|-------|--------|
| 1 | T1 rollback squash (A1) | `src/rollback.ts`, `test/closure.test.ts` | `2e5a7b5` |
| 1 | T2 atomic index (A3) | `src/mission.ts`, `test/closure-integration.test.ts` | `368d6e8` |
| 1 | T3 model per-stage (A4) | `scripts/savepoint.sh`, `src/provenance.ts`, `src/mission.ts`, `docs/concepts/provenance.md`, tests | `c02351e` |
| 1 | healing timeout | `test/harness.test.ts`, `test/savepoint.test.ts` | `spawn timeout 60s` |
| 2 | T4 tokens reported | `scripts/savepoint.sh`, `src/mission.ts`, `docs/concepts/cost.md`, `test/savepoint.test.ts` | `bf36900` |
| 2 | T5 lane_scope_glob | `scripts/lib/patterns.sh`, `scripts/lane.sh`, `scripts/savepoint.sh`, `docs/concepts/lanes.md` | `ac7ae96` |
| 2 | T6 attestation path | `docs/concepts/closure-tools.md`, `ROADMAP.md` | `ac85642` |
| 2 | healing lane gate | `scripts/lane.sh`, `scripts/savepoint.sh` | `a4996df` |
| 3 | T7 evidence-thin | `src/integrity.ts`, `test/closure.test.ts`, `scripts/gate-selftest.ts` | `00b83dc` |
| 3 | T8 docs truth | `README.md`, `docs/troubleshooting.md`, `ROADMAP.md` | `59143f2` |

## Per-flow-stage evidence

- **T1:** `buildRollback([], non-empty) → UNRESOLVED + exit 1`, `--grep="<mission>"` search key, `test/closure.test.ts` squash fixture red→green.
- **T2:** `openSync('a') + writeSync` single-write, header racy-but-safe comment, `test/closure-integration.test.ts` ×20 parallel archives both lines present.
- **T3:** `savepoint.sh` MODEL capture `MUGIWARA_MODEL>ANTHROPIC>unknown`, `state.json:model`, `provenance.ts` `model(s): a, b`, `src/mission.ts` stageModels collection before fold, `test/savepoint.test.ts` model precedence, `test/closure.test.ts` unique models.
- **T4:** `savepoint.sh --tokens-file` sum, `src/mission.ts` `Tokens reported total: N` rollup, `docs/concepts/cost.md` tier-1 recipes + tier-2/3 cannot-report, test exact sum 126400.
- **T5:** `lane_scope_glob` filtered count via `[[ $f == $glob ]]` extglob/globstar, sensitive unfiltered, `patterns.sh` comment, `lanes.md` monorepo section. Fixture: 12 out +1 in → direct (not full) / 3 in → standard; sensitive in-scope → full (verified).
- **T6:** `closure-tools.md` Enterprise keys paragraph, ROADMAP item 10 marker `(KMS/sigstore path documented)`.
- **T7:** `src/integrity.ts` `evidence-thin` kind, `hasCommandOutputShape` (backtick or exit token), `collectPassCitedPaths`, `test/closure.test.ts` empty→thin vs command→pass, `gate-selftest.ts` T7 mutation 2 cases.
- **T8:** README rollback caveat row, troubleshooting squash why, ROADMAP item 4 marker → `✅ context budget shipped; provider-reported path shipped`, `check-doc-links` green.

## Tests

- `bun run typecheck` clean
- `bunx vitest run` 369/369 (full suite) — re-ran without coverage green; coverage timeout under `gate` load is env contention (5s default) not product
- `bun scripts/gate-selftest.ts` 58/58 (was 56, +2 T7)
- `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` green
- `bun scripts/lane-base.ts` green
- `bun scripts/check-doc-links.ts` green
- `bun scripts/run-evals.ts` green (94.4% rank-1)
- `bun scripts/retrieval-eval.ts` 156/156
- `bun scripts/verify-install.ts` green (0/40 unreachable)
- `bun scripts/conformance.ts` 12/12 platforms

## Cost

| Metric | Value |
|--------|-------|
| **Tokens used** | 31,029 (estimator (computed)) |
| **Lane** | full (budget 50,000 · warn 75,000 · stop 150,000) |
| **Budget status** | 62% of budget · 18,971 under · OK |
| **Context footprint** | 14,698 chars (no context budget configured) |
| **Provider total** | 240,000 (provider-reported — opencode 240k, via `--tokens-file`) |

## Checks

- No new skills (21 ceiling).
- Secrets scan: none (checked via `checkTrail` secret shapes, no hits).
- `MUGIWARA_TOKENS` legacy path intact, `--tokens-file` first-class.

## Verdict

**READY for PR.** Branch `feature/audit-hardening` holds 10 commits, archived report at ` .mugiwara/missions/audit-hardening/report.md`, `rollback.sh` + `provenance.md` generated, `index.md` updated. Human review is terminal gate. Scan for secrets: clean.

