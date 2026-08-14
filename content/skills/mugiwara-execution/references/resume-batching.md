# Resume Batching (extracted detail)

Detail blocks moved out of `mugiwara-execution/SKILL.md` body (line cap) plus
the batch-resume protocol.

## TDD discipline

Full TDD discipline: `references/tdd.md` — RED-GREEN-REFACTOR, test pyramid,
rationalizations, red flags.

The test's proof value comes from WHEN it runs, not that it exists. A test
that passes on first run has proven nothing.

## User tests as the oracle (per `mugiwara-testcases`)

1. User-supplied executable tests are the oracle: run them failing first,
   green at the end. Never edit or skip them — immutable gold; a change
   requires user consent + a ledger row.
2. Declarative user AC → write the project test file first, watch it fail for
   the intended reason, implement, re-run green. These tests are model-written,
   so the checkpoint re-runs them and they get extra scrutiny — they can encode
   the bug.

## Batch-resume protocol

- Before starting a wave: if `.mugiwara/continue/<mission>/[member].json` exists, resume from its
  next_action — never re-run completed tasks; verify against todos `[x]` marks.
- After each batch: update `.mugiwara/continue/<mission>/[member].json` next_action to the next task.
- `[PARALLEL]` batches stay per sub-mission — a batch never crosses a
  sub-mission boundary.
- continue is the handoff contract: state proves what is done,
  continue says what is next (see `mugiwara-resume`).
