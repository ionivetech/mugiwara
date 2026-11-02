# Dispatch, batching, resume, phases

Detail behind `mugiwara-execution/SKILL.md`: output rule, worker prompt, report table, batch resume, user tests, and large-campaign layout.

## Task batching and output rule

Run task work tightly: do the steps without narrating each command. Surface one result per task (or per batch): status, evidence link (`[path](relative/path)`), deviations. The checkpoint audits evidence, not commentary. Do not stream every tool call to the main thread. After each task batch, show only:

```
T1: done | built + tested | installer tests pass
T2: done | 7 pointers rewritten | grep for old path: no matches
T3: done | 38/38 tests | full test command
```

Full logs go to `.mugiwara/missions/<mission>/flows/01-execution.md`.

Before dispatching workers, read `heal_cycle`, `heal_halt`, and `repeated_reads` from state: at `heal_halt` stop and escalate; above the repeated-read threshold, skip the re-read or compress it. Details: `_shared/references/cost-governor.md`.

## Worker prompt (parallel workers only)

Sequential work runs inline. Every `[PARALLEL]` worker prompt carries six fields:

- TASK: the task body, verbatim from the plan.
- EXPECTED OUTCOME: what "done" looks like, concrete and checkable.
- REQUIRED TOOLS: commands and files the worker needs.
- MUST DO: the steps in order, including the TDD failing-test-first step.
- MUST NOT DO: files not to touch, configs not to weaken, no silent workarounds.
- CONTEXT: interfaces consumed and produced, related tasks, mission paths.

A prompt shorter than about 30 lines is usually too thin. Thin prompts give thin results.

Workers append their own section (`## <skill> (<task id>)`) to `flows/01-execution.md`. Never overwrite the file.

## Report table

After each stage, show a compact table inline:

```
| # | Task | Status | Evidence |
|---|------|--------|----------|
| T1 | <title> | done / failed | [path](relative/path) |
```

## Batch resume

- Before starting: if `.mugiwara/missions/<mission>/continue.json | continue-<member>.json` exists, resume from its `next_action`. Never re-run completed tasks; verify against the `[x]` marks in `flows/todos.md`.
- After each batch: update `next_action` to the next task.
- A `[PARALLEL]` batch stays inside one sub-mission and never crosses a boundary.
- State proves what is done; continue says what is next (see `mugiwara-orchestration` → `references/resume.md`).

## TDD and user tests

Full TDD: `references/tdd.md`. A test's proof comes from when it runs: a test that passes on its first run proves nothing.

1. User-supplied executable tests are the oracle: run them failing first, green at the end. Never edit or skip them; a change needs the user's consent and a ledger row.
2. A declarative user acceptance criterion becomes a project test file: write it, watch it fail for the intended reason, implement, re-run green. These tests are model-written and can encode the bug, so the checkpoint re-runs them with extra scrutiny.

## Large campaigns (more than 3 phases or a plan over 1500 lines)

- Each phase writes to `flows/phase-NN/`: `01-execution.md`, `02-audit.md`, `03-quality.md`, `04-gates.md`.
- The top-level `flows/` holds only a pointer until archive merges the phases.
- `flows/todos.md` has one `## Phase NN` section per phase.
- Never overwrite a flat `flows/01-execution.md` across phases. Layout of the plan side: `mugiwara-planning`.
