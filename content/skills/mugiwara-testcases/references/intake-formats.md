# Test Intake Formats

Single home for the ATDD contract. Referenced by `mugiwara-quality` and `mugiwara-gates`.

## Format 1: Executable tests (user test files)

```
Path: tests/acceptance/invitation-flow.test.ts
Type: integration
Commands: npm run test:acceptance -- invitation-flow
```

Imported as immutable gold. Never edit, never skip. Run failing first, green at end.

## Format 2: Declarative acceptance (Gherkin/markdown AC)

```gherkin
Feature: Invitation flow
  Scenario: User accepts invitation
    Given an invitation exists for "user@example.com"
    When the user clicks the invitation link
    Then the user is redirected to onboarding
    And the invitation status changes to "accepted"
```

The crew translates this to a project test file. Write the test, watch it fail, implement, re-run green.

## Format 3: Command-verifiable

```
Acceptance: curl -X POST /api/invite -d '{"email":"test@ex.com"}' | jq .status
Expected: "sent"
```

Run directly. No translation needed.

## Rules

- No declared test source → no user tests for the mission.
- Executable user tests = immutable gold. Change requires user consent + ledger row.
- Declarative AC tests are model-written → extra Chopper scrutiny (can encode the bug).
- Cross-cutting user ACs (e2e flow spanning tasks) → plan-level criteria, re-run at checkpoint against whole diff.
