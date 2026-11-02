---
name: mugiwara-planning
description: Use for turning an approved spec into an implementation plan — interview-first, full context scan, scaled Quick/Standard/Full plans, parallel-proof waves.
gate_artifact: plan.md Waves/Task index — planning evidence
---

# Planning (Nami)

## Skip when
- Direct work under 20 lines in one file: no plan needed for a typo or single-file fix.
- A plan already exists and is approved: execute, do not re-plan.

Size the mission first, after the route decision, then write the plan at the matching level. Quality bar: a zero-context senior engineer executes every task without asking one question. Never plan above or below the measured size (file count and days from the spec): a 40-file spec is never Quick. Stage number and owner: stage table (`mugiwara-orchestration`, stages.md).

## Mission size
| Level | When | Required sections |
|-------|------|-------------------|
| **Quick** | 1 task, 2 files or fewer, well understood | Goals, wave table, task, acceptance |
| **Standard** | 1 wave, 2-8 tasks, light dependency | Goals, Non-goals, Architecture overview, Context scan, Implementation graph, wave table, tasks, Anti-patterns, Acceptance |
| **Full** | several waves, parallel work, risk | Standard plus Key decisions, Project structure, Risk and rollback, Definition of Done |
| **Very large** | over 2 days of work, multi-PR | Full plus a split into sub-missions (`## Mission split`) |

## Interview first
Batch every blocking ambiguity into ONE question round; never assume silently. What each mode asks: stage table (`mugiwara-orchestration`, stages.md). Detail and templates: `references/plan-template.md`.

## Full context scan
Scan the whole codebase the mission touches before writing: structure, entry points, patterns, tests, tooling. Ground every file path in what exists and confirm tooling; an unverified path fails the plan. Trust-sort sources: `references/plan-template.md`.

## Zero-question standard
Every task names exact file paths (never "the component"), the commands to run, a "done when" that is a literal command or file check ("works correctly" is banned), and its dependency edge. If you cannot write it that specifically, scan again. A stranger must be able to read each task once and run its check verbatim.

## CODEOWNERS per area
Map every task to a codebase area before parallelizing. Two tasks in the same area are never `[PARALLEL]`; disjoint areas are the only parallel proof. Every task appears in exactly one area row of its wave; an unowned file is a planning defect.

| Area | Owner task(s) |
|------|---------------|
| <path prefix> | T1, T2 |

## Sub-missions (team only)
When triage recorded a roster, turn the area table into a sub-mission table using the exact roster names (they become the `<member>.json` state files). One area maps to one sub-mission, each mergeable alone. Run `mugiwara plan conflict-check .mugiwara/missions/<mission>/plan.md` before asking for the go; a file in two sub-missions is a planning defect. Solo missions skip this. Full rule: `references/sub-missions.md`.

## Plan tables
Before the task details, add a wave table and a task index so the executor sees the shape at a glance. Task numbers follow run order; parallel tasks share a wave. A wave is an ordered group of tasks Zoro runs together.

| Wave | Focus | Tasks | Passes when |
|------|-------|-------|-------------|
| 1 | <what this wave delivers> | T1-T3 | <command and one example of correct output> |

| # | Task | Files | Size | Depends-on | Unblocks | Done when |
|---|------|-------|------|------------|----------|-----------|
| T1 | <title> | <paths> | S | none | T2, T3 | <one-line check> |

## Task template
```
**Task N: <title>** `[PARALLEL]` | `[SEQUENTIAL, depends-on: Task M (file: <path>)]`
- Files: create or modify <exact paths>
- Interfaces: consumes <symbol> from Task M, produces <symbol> for Task N, one input/output example
- Size: XS | S | M | L | XL (XL = 8+ files, split it)
- Effort: <same scale + one-line why>
- Break: none | <split condition if this task may pass 8 files>
- Steps: [ ] <failing test, run, implement, run, commit>
- Done when: <command and expected output>
- Risk: none | <rollback plan>
```
**Task size is commit granularity.** One task is one commit and one logical unit of work. Fold "fix typo" or "rename variable" into a neighboring task.

## Waves
Each wave ends in a verified, reviewable state and names its rollback point (a tag at the last good commit). `[PARALLEL]` only when tasks share no file, no interface, and no CODEOWNERS area, with the proof stated; otherwise `[SEQUENTIAL, depends-on: ...]`. A wave starts only when the previous wave's rollback point is recorded; a failed wave gate means revert, fix, re-run.

## Implementation graph
Draw layers, not edge lists: each layer waits on the one above, each node carries its files, each arrow its reason; name the critical path. Flag cross-file risk edges. Shape and example: `references/plan-template.md`.

## Acceptance vs Definition of Done
Acceptance asks "did we build the right thing?" per task. Definition of Done asks "is it finished to standard?" at the last wave: `_shared/references/definition-of-done.md`. The release verdict belongs to `mugiwara-ship`.

## Anti-patterns
"TBD", "add appropriate error handling", "similar to Task N"; no file paths; assumed tooling; `[PARALLEL]` without proof; no dependency edges; gold-plating; a high-risk task without rollback. Any anti-pattern fails the bar: fix the plan before handoff. Each with its fix: `references/anti-patterns.md`.

## Full-level layout
`plan.md` sections: Key decisions, Architecture overview, Non-goals, Project structure, Waves, CODEOWNERS, Implementation graph, Task index, Detail tasks, Baseline, Execution posture, Risk and rollback, Pre-mortem, Mission split. Route reasons and check-ins go to `decisions.md`; the closing text goes to `flows/06-closure.md`.

## Very large missions
Over 2 days or multi-PR: split into sub-missions, each with its own PR, done-criteria, continuation pointer, and wave table, each ending mergeable. Continuation flows through `continue.json | continue-<member>.json`. Write the split before any task detail. Past 3 phases or 1500 lines: `references/large-campaign-subplan.md`.

## Handoff
Stop after writing. `plan.md` is clean: no agent names, no log, no closing text. Add a pre-mortem paragraph (the most likely cause of failure and the task that counters it). Return to Luffy with a 2-3 line summary (waves, task count, key risks); Luffy runs the go decision and routes to Zoro. Never hand the plan to the executor without a go, except where `auto` mode resolves it (stage table, stages.md).

## Red flags
- A plan with a known anti-pattern.
- `[PARALLEL]` without file-disjoint and interface-disjoint proof.
- Missing dependency edges, or no Break point on an 8+ file task.
- A task without a "done when".
- The plan handed to the executor without a go.
