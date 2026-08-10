---
name: mugiwara-quality
description: Use after checkpoint passes to run code quality checks - formatter, linter, unit tests, and with recorded user consent integration tests. Detects the project's real tooling first, never weakens configs to pass.
---

# Quality (Sanji)

Cook the checks properly; never cut corners to make them pass.

## Discover the stack first

Never assume `npm test`. Detect the project's real commands from package.json scripts, pyproject.toml, Makefile, and CI config. Use the project's own test/lint/build/format commands; do not invent parallel tooling.

## Order

1. Formatter — the project's formatter.
2. Linter — resolve all errors properly. Never disable rules, downgrade severity, or add ignore comments to pass.
3. Unit tests — full suite, capture output.
4. User-declared test suites (per `mugiwara-testcases`) — run under the consent matrix below.
5. Integration tests — never created by us; when user tests are declared and state-mutating, see the consent matrix.

## User suites (per `mugiwara-testcases`)

Run the declared user test files under the consent matrix:

- Unit-level user tests: no consent — they are part of the suite.
- Integration / e2e user tests: consent by mode — `guided`/`semi` ask first; `auto` runs only provably-isolated ones.
- State-mutating user tests (DB writes, network, browsers): consent in ALL modes.

The user-AC verdict feeds the gates wave — it must come from these runs actually executing, never asserted.

## Mode + consent (per `mugiwara-mode`)

Consent is an invariant, not a mode knob. State-mutating tests against NON-isolated / shared state (real DB writes, network, browsers) ALWAYS require explicit user consent in ALL modes. Provably-isolated mutation — in-memory / temp / testcontainer-backed DBs, tooling-proven isolation — is explicitly auto-safe and needs no consent. `auto` runs only provably-isolated tests automatically (unit-level, or tooling-proven isolation such as in-memory / local DB). `guided`/`semi`: integration tests keep the existing ask-first rule — run automatically now / skip / run manually later. Record every consent answer in the report.

Hard rule: never create, write, or invent integration/e2e tests. If no user testcase / ATDD is declared, run unit / lint / format only and skip integration. Never weaken configs to pass.

## No tooling found

Say so explicitly, propose the minimal standard setup for the stack, and continue with what exists. Never silently skip the wave.

## Report

Per check: command run, exit status, key output excerpt, pass/fail → to `.mugiwara/results/`. Failures → Brook with the report.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll test later." | You won't. The gate rejects it; test now with output. |
| "Close enough passes." | Gates reject it; run the check, show the output. |
| "The config is too strict, weaken it." | Never weaken configs or downgrade severity to pass — fix the code. |
| "The linter rule is wrong anyway." | Resolve it properly or report it; disabling is not resolving. |
| "Integration tests, skip them, too slow." | Skipping is policy, not laziness: we never create integration tests, and undeclared suites don't run. Declared user suites run under the consent matrix. |
| "No tooling found, wave done." | No tooling means say so and propose the minimal setup, never a silent skip. |
| "Formatter and linter are the same." | They are separate checks; run both. |
