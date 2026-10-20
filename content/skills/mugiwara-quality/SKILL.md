---
name: mugiwara-quality
description: Use after checkpoint passes: format, linter, eslint, prettier, duplication, complexity, test suite, then gate verdict on coverage thresholds, build, definition of done. Also user test cases, e2e, integration tests.
gate_artifact: flows/01-execution.md quality evidence — duplicated_lines_density + cognitive_complexity table
---

# Quality (Sanji)

## Skip when
- The user declared no tests or criteria: the ATDD contract (`references/testcases.md`) does not apply; ordinary test-writing requests are not declarations.
- No code changed: a docs-only or config-only diff with no lint or test surface.
- The repo has no detectable tooling (no test, lint, or format commands, 0 found): record the skip.

Run the checks properly; never cut corners to make them pass. Stage number and owner: stage table (`mugiwara-orchestration`, stages.md). This stage is the only place complexity and duplication are measured; Robin cites these numbers and does not re-measure. The gate artifact is a table of `duplicated_lines_density` and `cognitive_complexity` per changed file, mirrored into `flows/01-execution.md` for the gates stage.

## Discover the stack first
Never assume `npm test`. Detect the project's real commands from package scripts, `pyproject.toml`, `Makefile`, and CI config. Use the project's own test, lint, build, and format commands; do not invent parallel tooling.

Reuse across stages: a check already recorded in `flows/02-audit.md` for an unchanged diff is cited, not re-run; a changed diff re-runs fresh.

## Delta, not absolute
Judge duplication, complexity, and file health on the change: what the mission added or modified fails, a file's pre-existing condition does not. Example: a file already at 290 lines before the mission is not this mission's debt. If the project's config sets an absolute threshold, that threshold applies as written. Configs get the same proof: `git diff <base>..HEAD` on lint, format, and typecheck configs must be empty, or each hunk carries the user's explicit approval. "Never weakens configs" without that diff is a claim, not a fact.

## Order
Full checklist: `references/order-checklist.md` — 12 steps with thresholds and evidence. Step 12 is the waste pass (`mugiwara waste`): advisory, never blocks. Skipping it silently is the defect; reporting that no CLI answered is not.

## Gates (Franky)
After the checks, the binary gates stage runs coverage, build, diff size, and Definition of Done, and writes `flows/04-gates.md`: `references/gates.md`. Quality evidence (`flows/03-quality.md`) feeds it.

## User suites (ATDD contract: `references/testcases.md`)
Run the declared user test files under the consent matrix:
- Unit-level user tests: no consent needed; they are part of the suite.
- Integration and e2e user tests: `guided` and `semi` ask first; `auto` runs only provably isolated ones.
- State-mutating user tests (DB writes, network, browsers): consent in all modes.
The user-test verdict feeds the gates stage and must come from runs that actually executed.

## Optional e2e gate
Optional, never default-on. Trigger only when both hold: the repo has e2e setup (`playwright.config.*`, `cypress.config.*`, an `e2e/` directory, or a `test:e2e` script) and the changed files match e2e patterns (`e2e/**`, `*.e2e.*`, `specs/**`). When triggered, consent follows the mode: `guided` and `semi` ask (run now, skip, run manually later); `auto` runs only provably isolated e2e. Otherwise skip and log the reason (no setup, no matching files, no consent). A skip is logged, not a failure.

## Consent
Consent is an invariant, not a mode setting. State-mutating tests against shared state (real DB writes, network, browsers) always need explicit user consent. Provably isolated tests (in-memory, temp, or container-backed databases) need none. Record every consent answer in the report.

Never create, write, or invent integration or e2e tests. If no user test is declared, run unit, lint, and format checks only. Never weaken configs to pass.

## No tooling found
Say so, propose the minimal standard setup for the stack, and continue with what exists. Never skip the stage silently.

## Report
Per check: command, exit status, key output excerpt, pass or fail, written to `.mugiwara/missions/<mission>/flows/03-quality.md`, plus a `## Waste (advisory)` section with step 12's rows (or one line saying why there are none). Return to Luffy; do not dispatch Zoro or Brook. Recommend `continue` on pass, `Brook` for a real fix, `Zoro` for a trivial one. A clean pass is one line plus the evidence path.

## Rationalizations
| Excuse | Reality |
|--------|---------|
| "Close enough passes." | Run the check and show the output. |
| "The config is too strict, weaken it." | Fix the code; weakening a config or severity is never allowed. |
| "No tooling found, stage done." | Say so and propose the minimal setup; a silent skip hides the gap, so report it. |

## Red flags
- A stage closed without its one-line summary, or padded with prose.
- Weakening configs or disabling rules to make checks pass.
- Claiming configs unweakened without the empty-diff proof.
- Asserting test results without running the suite.
- Silently skipping the stage when no tooling is found.
- Running state-mutating user tests without consent.
- Reporting complexity or duplication from memory instead of a measured run.
