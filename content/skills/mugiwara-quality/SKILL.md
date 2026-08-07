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
