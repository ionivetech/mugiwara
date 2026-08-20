# Definition of Done

Canonical, single source. Every skill references this file — no duplicate definitions.

## Five axes

Every mission wave must satisfy all five before it is Done:

| Axis | What it means | How to verify |
|------|--------------|---------------|
| **Correctness** | The work does what the plan specifies. | Every per-task acceptance criterion passes — re-run the check command, capture output. |
| **Quality** | Lint, format, and tests are clean. | Run project formatter → linter → unit suite. Zero errors. Configs unweakened. |
| **Integration** | The work fits the existing system. | Build/typecheck exits 0 against full tree. No regression in existing tests. |
| **Docs** | User-facing and internal docs match the change. | README, changelog, API docs, and in-code docstrings updated where the change requires it. |
| **Ship-readiness** | No blockers left open. | Blocker ledger `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md` has zero open rows. |

## Verdict

- **PASS** — all five axes green with evidence.
- **FAIL** — any axis red. No partial pass, no "almost". A FAIL axis → entire mission FAIL.
- Any axis passed without command output or a file path is unverified → FAIL.

## Optional e2e gate

Optional, never default-on. Triggered only when BOTH:
1. Repo has e2e setup: `playwright.config.*`, `cypress.config.*`, `e2e/` dir, or `test:e2e` npm script.
2. Changed files match e2e patterns: `e2e/**`, `*.e2e.*`, `specs/**`.

When triggered, consent by mode (`mugiwara-mode`):
- `guided`/`semi`: ask user — run now / skip / run manually later.
- `auto`: runs only provably-isolated e2e (in-memory / local / tooling-proven isolation). Otherwise skip-and-log.

**e2e never blocks a PASS.** A skipped or unrun e2e gate is logged, not a failure. The final verdict is coverage + build + DoD.

## Sources this replaces

This file supersedes duplicate definitions in:
- `mugiwara-checkpoint` (correctness, quality, integration, docs, ship-readiness)
- `mugiwara-gates` (correctness, quality, integration, docs, ship-readiness — same axes but different list)
- `mugiwara-planning` (referenced, not enumerated)

Both skills now link here. Audit trail has one bar, not two.
