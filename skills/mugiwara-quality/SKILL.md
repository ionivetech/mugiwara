---
name: mugiwara-quality
description: Use after checkpoint passes to run code quality checks - formatter, linter, unit tests, and with user consent integration tests. Detects project tooling first, never weakens configs to pass.
---

# Quality (Sanji)

Cook the checks properly; never cut corners to make them pass.

## Order

1. Detect tooling from the project (package.json scripts, pyproject.toml, Makefile, CI config). Use the project's own commands; do not invent parallel tooling.
2. Formatter — the project's formatter.
3. Linter — resolve all errors properly. Never disable rules, downgrade severity, or add ignore comments to pass.
4. Unit tests — full suite, capture output.
5. Integration tests — ASK THE USER FIRST: run automatically now / skip / run manually later. Record the answer in the report. Do not run integration tests without consent.

## No tooling found

Say so explicitly, propose the minimal standard setup for the stack, and continue with what exists. Never silently skip the wave.

## Report

Per check: command run, exit status, key output excerpt, pass/fail. Failures → Brook with the report.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "The config is too strict, weaken it." | Never weaken configs or downgrade severity to pass — fix the code. |
| "Integration tests, skip them, too slow." | No consent, no run — but the decision must be asked and recorded, not assumed. |
| "The linter rule is wrong anyway." | Resolve it properly or report it; disabling is not resolving. |
| "No tooling found, wave done." | No tooling means say so and propose the minimal setup, never a silent skip. |
| "Formatter and linter are the same." | They are separate checks; run both. |
