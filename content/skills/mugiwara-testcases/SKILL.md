---
name: mugiwara-testcases
description: Use when a mission declares user-provided test cases or acceptance criteria - intake formats, immutable-gold rule, declarative-AC routing, consent, and failure adjudication. Single home for the ATDD contract; referenced by the quality and gates agents.
---

# Test Cases (ATDD Contract)

User tests are the crew's acceptance oracle. This is the single home for the ATDD contract — intake, immutable gold, routing, consent, and failure adjudication. Shared by planning, execution, quality, and gates so they cannot drift.

## Accepted formats

1. Existing repo test files (vitest / pytest / playwright / JUnit).
2. User-written acceptance criteria — Gherkin AND plain markdown.

## Intake

The declared test source is a path glob in the mission prompt (e.g. `tests/acceptance/`) or an explicit repo path, read at Wave 0 alongside the mode config. No automatic whole-repo scan. No test source declared → no user tests; quality runs unit / lint / format only.

## Immutable gold

User-supplied executable tests are never edited to pass and never skipped. A needed change requires user consent + a ledger row. Model-translated tests (markdown AC → project test file) get checkpoint re-run scrutiny because self-written tests can encode the bug.

## Declarative AC routing

Gherkin has no step-definition glue in mugiwara — never "run the .feature file". Route each declarative AC to either:

- a translated project test file (written by the executor, reviewed at the checkpoint), or
- a literal command check (re-run at the checkpoint).

## Consent

State-mutating user tests (DB writes, network, browsers) always require consent in ALL modes; `auto` runs only provably-isolated user tests.

## Failure adjudication

A red user test needs green-run evidence, not silence. After the 3-cycle heal loop, escalate to the human with the test untouched. Never skip a user test to pass.

## Integration-class rule

Sanji never creates integration tests; user-declared suites are the only integration-class tests that exist. The verdict on them comes from the quality wave evidence — user suites actually run, never asserted.

## Rules

1. Read the declared test source at Wave 0; no source declared = no user tests.
2. User executable tests are immutable gold — edit or skip only with consent + a ledger row.
3. Declarative AC always routes to translate-or-command-check; "run the .feature file" is banned.
4. State-mutating user tests consent in every mode; auto runs only provably-isolated ones.
5. A red user test escalates untouched after the heal loop — never skipped to pass.
