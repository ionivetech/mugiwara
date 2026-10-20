# Output contract

The exact shape of a stage at both verbosity levels, plus the handoff block. Banner and handoff form: `_shared/references/flow-banners.md`. Stage names and actions: stage table (stages.md).

## Always visible

At every verbosity these stay on screen, because they are the audit surface:

- the opening line
- file edits: path plus a one-line summary
- gate verdicts with the evidence path
- decisions, questions, blockers, escalations, and a lane change in plain words
- the handoff line

## Collapse table

| Before | After |
|---|---|
| 200 lines of test output | `✓ 84/84 tests → flows/03-quality.md` |
| Read, grep, and probe calls plus file contents | not echoed at `normal`; name a file only when it matters |
| Step-by-step reasoning | the conclusion |
| Per-task bookkeeping | one summary line per stage |
| Raw diff | `+42/-8` and a one-line summary |

## `normal` (default)

    ## ⚔️ Zoro · building (2/5)
    ✎ src/auth/invitation.ts   +42/-8   token validation and redirect guard
    ✎ src/routes/index.ts      +6/-0    route registration
    ✓ 84/84 tests, lint clean → flows/03-quality.md
    → Chopper checks the result

A quiet pass is the opening line, the edits, one result line, and the handoff. Reads, greps, probes, file contents, and narration are not echoed.

## `full`

Same opening line and handoff. Between them the raw transcript: every command, read, and reasoning step. Use it to debug the crew or audit exactly how a result was reached.

## Safety rule

The transcript must stay sufficient to review the mission without opening a file. Test output may collapse because the evidence file holds it. A decision may not, because it has no other home. Verbosity widens what is echoed and never narrows what review needs.

## Decision-boundary block (guided and semi)

At a decision boundary (plan go, route choice, failure, closing) the stage adds four labeled blocks before its summary line. Labels may be localized; command literals stay exact. Routine progress needs no blocks.

    ## 🧭 Nami · planning (2/5)
    **Result** Plan ready for `<mission>`: 2 tasks in 2 waves, evidence in `.mugiwara/missions/<mission>/plan.md`. Main risk: the bootstrap recovery step.
    **Next** Zoro starts T1 (strengthen the handoff contract and add its regression tests) after your go. T2 depends on T1, so nothing runs in parallel.
    **Choices**
    - `go` starts the build with wave 1, then T2.
    - `review <path>` opens the named artifact; nothing is built until you answer.
    - `revise <section>` returns to Nami to amend the plan.
    - `pause` saves the checkpoint and leaves the tree clean.
    **New session** Run `/mugiwara continue <mission>`; it resumes at the saved plan with the go pending.
    ✓ 2 tasks planned → .mugiwara/missions/<mission>/plan.md
    → Zoro builds it

In `semi` these choices are the plan go. In `auto` keep the result, next action, and resume facts, say that continuation is automatic, and ask nothing.
