---
name: mugiwara-planning
description: Use when turning an approved idea or spec into an execution plan. Classifies mission size, interviews first, scans full context, writes scaled Quick/Standard/Full plans with the unified task template, parallel-proof waves, per-task acceptance, and risk/rollback.
---

# Planning (Nami)

Classify the mission by size first — after Luffy's route — then write the plan at the matching level. Quality bar: an engineer with zero project context can execute Task 1 without asking questions.

## Classify mission size

| Level | When | Required sections |
|-------|------|-------------------|
| **Quick** | 1 task, ≤2 files, well-understood (typo, bugfix) | Goals, Wave table, Detail task, Acceptance |
| **Standard** | 1 wave, 2-8 tasks, light dependency | Goals, Architecture overview, Context scan, Implementation graph, Wave table, Detail task, Anti-pattern, Acceptance |
| **Full** | multi-wave, parallel, risk involved | All of Standard + Flow detail, Key decisions, Project structure, Risk & rollback, Definition of Done, Decision-log pointer |

Pick the smallest level that fits. Oversized plan wastes effort; undersized plan hides risk.

## Interview-first

Batch ALL blocking ambiguities into ONE question round before writing. If a major decision appears mid-plan, stop and ask then — never assume silently. Unanswered question goes back to Luffy, never forward to Zoro.

## Full context scan

Scan the whole codebase the mission touches before writing: structure, entry points, existing patterns, tests, tooling. If the mission needs it, scan everything — a plan written without the real code is fiction. Ground every file path and step in what exists; confirm tooling, do not assume.

## Unified task template

```
**Task N: <title>** `[PARALLEL]` | `[SEQUENTIAL, depends-on: Task M]`
- Files: create/modify <exact paths>
- Interfaces: consumes → produces
- Size: XS | S | M | L | XL  (XL = 8+ files → split)
- Steps: [ ] <TDD: failing test → run → implement → run → commit>
- Acceptance: <command-verifiable>
- Risk: none | <rollback plan>
```

Every task uses this template at every level. A task touching deploy, data migration, secrets, or public API carries a `Risk` line; high-risk tasks get a rollback plan before execution. XL (8+ files) splits into smaller tasks first.

## Waves

Group tasks into waves; each wave ends in a verified, reviewable state. Build the dependency graph from each task's Interfaces: X consumes what Y produces → X depends on Y.

- `[PARALLEL]` ONLY when tasks share no file AND no interface dependency.
- State the proof in the wave header: disjoint files + no common consumed/produced interface.
- Otherwise `[SEQUENTIAL, depends-on: Task M]`. Never mark parallel on assumption.

## Per-wave gate

Each wave ends in a verified, reviewable state: acceptance checks run, evidence captured. A wave starts only when its dependencies are proven done.

## Acceptance vs Definition of Done

- **Acceptance** = "did we build the right thing?" — per task, command-verifiable.
- **Definition of Done** = "is it finished to our standard?" — standing bar: correctness, quality, integration, docs, ship-readiness. Checked at the final wave.

## Anti-patterns

- "TBD", "add appropriate error handling", or "similar to Task N" in a step.
- No Files paths, or an Acceptance like "works correctly" (uncheckable).
- Assumed tooling not confirmed in the context scan.
- Silent reordering or dropping tasks.
- `[PARALLEL]` without file- AND interface-disjoint proof.
- Missing dependency edges between tasks touching each other's outputs.
- Gold-plating: speculative features, premature abstraction.
- High-risk task with no rollback plan.

Any anti-pattern fails the quality bar — fix the plan before handoff. Never ship a plan with a known hole.

## Common rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "Plan can be vague, executor will figure it out" | Zero-context executor stops, asks, or guesses — wave stalls or ships wrong. |
| "Skipping the context scan saves time" | Plan grounded in imagined code is fiction; rework costs more than the scan. |
| "These two tasks are parallel, trust me" | Shared file or interface = race or conflict. Proof required. |
| "Rollback is someone else's problem" | No rollback on a risky task = data loss or downtime with no way back. |

## Full-level skeleton

```
# <mission> — <goal>                                 → .mugiwara/plans/YYYY-MM-DD-<mission>.md
## Key decisions       (why this way)
## Architecture overview
## Project structure
## Implementation graph  (consumes → produces)
## Waves               (table: wave | tasks | gate; parallel proof in header)
## Detail tasks        (unified template, one block per task)
## Risk & rollback
## Definition of Done
## Decision log        (pointer → .mugiwara/logs/YYYY-MM-DD-<mission>.md)
```

## Handoff

Plan reviewed by the user → hand to Zoro (`mugiwara-execution`).
