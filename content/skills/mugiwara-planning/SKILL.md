---
name: mugiwara-planning
description: Use when turning an approved idea or spec into an execution plan. Produces wave-structured plans with parallel/sequential markers, dependency order, and acceptance criteria per task. Asks questions up front and mid-plan.
---

# Planning (Nami)

Quality bar: an engineer with zero project context can execute Task 1 without asking questions.

## Before writing

Batch all blocking ambiguities into ONE question round before starting. If a major decision appears mid-plan, stop and ask then — never assume silently.

## Plan format

Save to `.mugiwara/plans/YYYY-MM-DD-<mission>.md`:

- Header: goal (one sentence), architecture (2-3 sentences), tech stack, global constraints.
- Waves: group tasks into waves; each wave ends in a reviewable, testable state.
- Tasks: smallest unit with its own test cycle. Each task declares:
  - **Files:** exact create/modify paths
  - **Marker:** `[PARALLEL]` (independent of sibling tasks) or `[SEQUENTIAL]` with `depends-on: Task N`
  - **Steps** as checkboxes, one action per step (failing test → run → implement → run → commit)
  - **Acceptance criteria:** observable, command-verifiable statements
- Ordering rule: foundation before dependents. Independent tasks in the same wave are marked `[PARALLEL]` so Zoro can dispatch them concurrently.
- Every code step shows real code. No "TBD", no "add appropriate error handling", no "similar to Task N".

## Parallelization analysis

Build the dependency graph explicitly: for each task, state what it consumes and produces (interfaces). Two tasks sharing no file and no interface dependency are parallel-safe — say so in the wave header: which tasks run concurrently, which chain.

## Acceptance criteria rules

Each criterion must be checkable by running a command or inspecting a file. "Works correctly" is not a criterion.

## Handoff

Plan reviewed by the user → hand to Zoro (`mugiwara-execution`).
