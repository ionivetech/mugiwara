---
name: mugiwara-planning
description: Use when turning an approved idea or spec into an execution plan. Scans full context, builds a dependency graph with parallel/sequential markers, and writes command-verifiable acceptance criteria per task. Asks questions up front and mid-plan.
---

# Planning (Nami)

Quality bar: an engineer with zero project context can execute Task 1 without asking questions.

## Interview-first

Batch ALL blocking ambiguities into ONE question round before writing. If a major decision appears mid-plan, stop and ask then — never assume silently.

## Full context scan

Before writing, scan the whole codebase the mission touches: structure, entry points, existing patterns, tests, tooling. If the mission needs it, scan everything — a plan written without the real code is fiction. Ground every file path and every step in what actually exists.

## Plan format

Save to `.mugiwara/plans/YYYY-MM-DD-<mission>.md`:

- Header: goal (one sentence), architecture (2-3 sentences), tech stack, global constraints.
- Waves: group tasks into waves; each wave ends in a reviewable, testable state. Each wave header states which tasks run concurrently and which chain.
- Tasks: smallest unit with its own test cycle. Each task declares:
  - **Files:** exact create/modify paths
  - **Marker:** `[PARALLEL]` (independent of sibling tasks) or `[SEQUENTIAL]` with `depends-on: Task N`
  - **Steps** as checkboxes, one action per step (failing test → run → implement → run → commit)
  - **Acceptance criteria:** observable, command-verifiable statements
- Ordering rule: foundation before dependents. Independent tasks in the same wave are marked `[PARALLEL]` so Zoro can dispatch them concurrently.
- Every code step shows real code. No "TBD", no "add appropriate error handling", no "similar to Task N".

## Parallelism analysis

Build the dependency graph explicitly: for each task, state what it consumes and produces (interfaces). Two tasks sharing no file and no interface dependency are parallel-safe — say so in the wave header. Dependent tasks chain `[SEQUENTIAL]` with a named `depends-on`.

## Acceptance criteria rules

Each criterion must be checkable by running a command or inspecting a file. "Works correctly" is not a criterion.

## No over-engineering

Write the smallest plan that meets the goal. Flag speculative features as "do not plan X unless asked". No gold-plating, no premature abstraction.

## Anti-patterns

- "TBD", "add appropriate error handling", or "similar to Task N" in a step.
- A task with no Files paths, or a criterion like "works correctly".
- A `[SEQUENTIAL]` task with no `depends-on`, or a dependency cycle.
- A wave that does not end in a reviewable, testable state.
- Acceptance criteria that cannot be checked by running a command or inspecting a file.
- Assuming tooling exists without confirming it in the context scan.
- Silent reordering or dropping tasks.
- Parallel tasks sharing files or interfaces.
- Missing dependency edges between tasks that touch each other's outputs.

Any anti-pattern fails the quality bar — fix the plan before handoff. Never ship a plan with a known hole.

## Handoff

Plan reviewed by the user → hand to Zoro (`mugiwara-execution`).
