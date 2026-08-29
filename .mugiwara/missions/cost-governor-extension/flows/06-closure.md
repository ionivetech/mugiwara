# Closure — cost-governor-extension

## Ship verdict: **GO**

## Pre-launch checklist (evidence)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Build / typecheck | PASS | `bun run gate` exit 0 (typecheck + build) |
| 2 | Tests + coverage | PASS | 774 tests pass; cli.ts 91.39%, slop 95.14%, reporting 96.62%, mission 94.79% (≥90 new / ≥85 mod defaults) |
| 3 | Docs updated | PASS | README rewrite + audit fixes; config.md, closure-tools.md, glossary, workflow, modes, features, cost, lanes synced |
| 4 | Changelog / version | PASS | version 0.7.0 via Manual Release workflow (AGENTS: never manual); no committed CHANGELOG in this repo |
| 5 | Secrets scan | PASS | `git diff main...HEAD` grep clean (only prose false positives) |
| 6 | Backup / rollback | PASS | 17 commits on `feat/cost-governor-extension`; rollback = revert merge commit |

## Changes shipped

- **Resume fast-path (§10)** — `continue`/`status` read-only, no config created.
- **Stop-Slop live wiring (§3.3)** — `mugiwara cost` shows live slop per crew member.
- **Adaptive execution foundation (Phases A–E)** — three-decision model (control
  mode / execution posture / Cost Governor), deterministic `selectPosture()`,
  boundary-based posture switching, adaptation report, posture evals, 12-platform
  conformance. Conservative: default inline, no state-schema change.
- **De-brand** — removed all `ponytail`/`caveman` references; kept capability.
- **Config** — coverage defaults `new=85 / modified=90`; `sign` attestation key;
  documented investigation_* keys.
- **Docs** — newcomer-first README; full audit fixes.

## Feature flags

Not required — the adaptive foundation is additive and defaults to inline
execution. No new risky runtime behavior ships behind nothing.

## Rollback plan

- **What:** the entire change set.
- **How:** `git revert -m 1 <merge-commit>` on `main` (single revert), then re-run
  the Manual Release workflow to publish the revert.
- **Owner:** maintainer. **Speed:** one commit, same as the merge.

## Non-critical findings (ship-with-tracking)

- `coverage_modified` default raised 80 → 90: existing projects with explicit
  configs are unaffected; projects relying on the old default will see stricter
  gates. Tracked as an intentional, documented default change.

## Binary verdict

**GO.** All items proven; no critical findings.
