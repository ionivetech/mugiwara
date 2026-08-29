---
name: mugiwara-quality
description: Use after checkpoint passes — formatter, linter, duplication, complexity, maintainability, code attributes, eslint, prettier, lint, format, unit tests, test suite. Never weakens configs.
gate_artifact: flows/01-execution.md quality evidence — duplicated_lines_density + cognitive_complexity table
---

# Quality (Sanji)

## Skip when

- No code changed: docs-only or config-only diff with no lint/test surface.
- Repo has no detectable tooling (no test/lint/format commands) — record the skip.

Cook the checks properly; never cut corners to make them pass. The gate artifact lives in `flows/01-execution.md`: a table of `duplicated_lines_density` and `cognitive_complexity` per changed file, which the gates flow stage reads.

## Discover the stack first

Never assume `npm test`. Detect the project's real commands from package.json scripts, pyproject.toml, Makefile, and CI config. Use the project's own test/lint/build/format commands; do not invent parallel tooling.

Reuse across flow stages: a check whose result is already recorded in `flows/02-audit.md` for an unchanged diff (same flow-base) is cited, not re-run; a changed diff re-runs fresh.

## Order

1. Formatter — the project's formatter, exit status captured.
2. Linter — resolve all errors properly. Never disable rules, downgrade severity, or add ignore comments to pass. Use the repo's own rules; do not add new ones.
3. Complexity — per changed function, both metrics:
   - Cyclomatic (McCabe): 1 + decision points; flag >10, major >20. When ESLint drives the repo, run its `complexity` rule at max 10 — docs: https://eslint.org/docs/latest/rules/complexity.
   - Cognitive: nesting-weighted; flag >15, major >25. Where an ESLint `cognitive-complexity` plugin or SonarJS/SonarScanner metrics exist, read them directly; record the measured value.
   Method + thresholds: `_shared/references/complexity.md`. # note: manual counting is the baseline; a scanner result outranks it.
4. Duplication — scan changed files for near-identical blocks ≥10 lines. Compute `duplicated_lines_density` % = duplicated lines / total lines. Flag any file ≥3%. When the repo ships a scanner (SonarScanner, jscpd, Simian), read its density directly.
5. File health — changed files ≤300 LOC, functions ≤30 LOC. Flag exceeded. Thresholds fixed; do not inflate.
6. Maintainability rating — sum remediation effort (estimated minutes per issue severity) into technical debt; divide by code size for debt ratio. Map A-E per Sonar scale: A ≤5%, B <10%, C <20%, D <50%, E ≥50%. C or worse fails the gate.
7. Code attributes (quantitative) — consistency (formatting drift count, naming convention violations), intentionality (dead code %, unreachable branches count), adaptability (files with >1 responsibility). Metrics only — Robin does qualitative deep review in Flow 7.
8. Unit tests — full suite, capture output. A failing suite fails the stage; never assert green.
9. User-declared test suites (per `mugiwara-testcases`) — run under the consent matrix below.
10. Integration tests — never created by us; when user tests are declared and state-mutating, see the consent matrix.
11. Optional e2e gate — only when BOTH repo e2e setup AND changed-file e2e patterns hold, consent by mode, see below.

## User suites (per `mugiwara-testcases`)

Run the declared user test files under the consent matrix:

- Unit-level user tests: no consent — they are part of the suite.
- Integration / e2e user tests: consent by mode — `guided`/`semi` ask first; `auto` runs only provably-isolated ones.
- State-mutating user tests (DB writes, network, browsers): consent in ALL modes.

The user-AC verdict feeds the gates flow stage — it must come from these runs actually executing, never asserted.

## Optional e2e gate

Optional, never default-on. Trigger ONLY when BOTH hold:
- Repo has e2e setup — any of `playwright.config.*`, `cypress.config.*`, `e2e/` dir, `test:e2e` npm script.
- Changed/staged files match e2e patterns — `e2e/**`, `*.e2e.*`, `specs/**`.

When triggered, consent by mode (per mode config invariant): `guided`/`semi` ask first — run now / skip / run manually later; `auto` runs only provably-isolated e2e (in-memory / local / tooling-proven isolation). Otherwise skip-and-log: record the skip reason (no setup, no matching files, no consent) in the report. The e2e gate never blocks silently and never blocks a pass — a skip is logged, not a failure.

## Mode + consent (per mode config)

Consent is an invariant, not a mode knob. State-mutating tests against NON-isolated / shared state (real DB writes, network, browsers) ALWAYS require explicit user consent in ALL modes. Provably-isolated mutation — in-memory / temp / testcontainer-backed DBs, tooling-proven isolation — is explicitly auto-safe and needs no consent. `auto` runs only provably-isolated tests automatically (unit-level, or tooling-proven isolation such as in-memory / local DB). `guided`/`semi`: integration tests keep the existing ask-first rule — run automatically now / skip / run manually later. Record every consent answer in the report.

Hard rule: never create, write, or invent integration/e2e tests. If no user testcase / ATDD is declared, run unit / lint / format only and skip integration. Never weaken configs to pass.

## No tooling found

Say so explicitly, propose the minimal standard setup for the stack, and continue with what exists. Never silently skip the flow stage.

## Report

Per check: command run, exit status, key output excerpt, pass/fail → to `.mugiwara/missions/<mission>/flows/03-quality.md`; the `duplicated_lines_density` + `cognitive_complexity` table is mirrored into `flows/01-execution.md` for the gate artifact. **Return to Luffy.** Do not dispatch Zoro or Brook yourself. Luffy decides based on severity: pass → next flow stage, fail → Brook (healing) or Zoro (trivial fix).

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll test later." | You won't. The gate rejects it; test now with output. |
| "Close enough passes." | Gates reject it; run the check, show the output. |
| "The config is too strict, weaken it." | Never weaken configs or downgrade severity to pass — fix the code. |
| "The linter rule is wrong anyway." | Resolve it properly or report it; disabling is not resolving. |
| "The file is 350 LOC, close enough." | File health caps at 300 LOC / 30 LOC per function; extract and re-run. |
| "Integration tests, skip them, too slow." | Skipping is policy, not laziness: we never create integration tests, and undeclared suites don't run. Declared user suites run under the consent matrix. |
| "No tooling found, flow stage done." | No tooling means say so and propose the minimal setup, never a silent skip. |
| "Formatter and linter are the same." | They are separate checks; run both. |
| "E2E setup exists, so the gate runs." | No — trigger needs BOTH setup AND changed-file e2e patterns, plus consent by mode. Otherwise skip-and-log, never run unasked. |

## Red flags

- Weakening configs or disabling rules to make checks pass.
- Asserting test results without running the suite.
- Silently skipping the flow stage when no tooling is found.
- Running state-mutating user tests without consent.
- Reporting complexity/duplication from memory instead of a measured run.
- Echoing raw output when `verbosity=normal` — summarize and cite the evidence path.
