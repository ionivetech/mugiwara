---
name: mugiwara-planning
description: Use for turning an approved spec into an implementation plan — interview-first, full context scan, scaled Quick/Standard/Full plans, parallel-proof waves.
gate_artifact: plan.md Waves/Task index — planning evidence
---

# Planning

## Skip when

- Lane 0 direct work: no plan needed for a typo or single-file fix.
- A plan already exists and is approved — execute, don't re-plan.

Classify the mission by size first — after the route decision — then write the plan at the matching level. Quality bar: a zero-context senior engineer executes every task without asking one question. Rule: never plan above or below the measured size (file count + days from the spec) — a 40-file spec is never Quick.

## Classify mission size

| Level | When | Required sections |
|-------|------|-------------------|
| **Quick** | 1 task, ≤2 files, well-understood (typo, bugfix) | Goals, Wave table, Detail task, Acceptance |
| **Standard** | 1 wave, 2-8 tasks, light dependency | Goals, Architecture overview, Context scan, Implementation graph, Wave table, Detail task, Anti-pattern, Acceptance |
| **Full** | multi-wave, parallel, risk involved | All of Standard + Flow detail, Key decisions, Project structure, Risk & rollback, Definition of Done |
| **Very large** | est. >2 days work, multi-PR scope | Lane 3 + MUST split (`## Mission split`) |

## Interview-first & mode

Batch blocking ambiguities into ONE question round; never assume silently. Mode gates per config. Full detail: `references/plan-template.md`.

## Full context scan

Scan the whole codebase the mission touches before writing: structure, entry points, existing patterns, tests, tooling. If the mission needs it, scan everything — a plan written without the real code is fiction. Ground every file path and step in what exists; confirm tooling, do not assume. Trust-sort sources (high/medium/low): `references/plan-template.md`. Rule: every file path in the plan must be verified to exist in the scan — an unverified path fails the plan.

**User AC mapping (per `mugiwara-testcases`).** In the context scan, read the declared test source (none = no user tests) and map each user AC to ≥1 per-task criterion: executable user test → the project test command scoped to that file; declarative AC → "translate to a project test file + run" or a literal command check. Cross-cutting user ACs (an e2e flow spanning tasks) become plan-level criteria re-run at the checkpoint against the whole diff; never invent an integration test as a criterion — user tests are the only integration-class criteria.

## Zero-question standard

A senior principal's plan leaves nothing to the executor's judgment. Every task specifies: exact file paths (never "the component"), the exact commands to run (TDD steps with the test command), an acceptance criterion that is a literal command or file check ("works correctly" is banned), and the dependency edge. If you cannot write it that specifically, scan again before the task goes in. Rule: a stranger must read each task once and run the acceptance verbatim.

## CODEOWNERS per area

Map every task to a codebase area before parallelizing. Each area (e.g. `src/auth/`, `api/`, `docs/`) lists the task(s) that own it; two tasks in the SAME area are never `[PARALLEL]`, disjoint areas are the only parallel proof. Route review per area from the same table. Rule: every task in the task index appears in exactly one area row of its wave — an unowned file is a planning defect.

| Area | Owner task(s) |
|------|---------------|
| <path prefix> | T1, T2 |

## Plan tables (wave + task index)

Before the detail blocks, add two markdown tables so the executor can read the shape at a glance and parallelize safely:

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 3 | <what this wave delivers> | T1-T3 | <the command-verifiable exit check> |

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | <title> | <paths> | S | — | <one-line check> |

## Unified task template

```
**Task N: <title>** `[PARALLEL]` | `[SEQUENTIAL, depends-on: Task M (file: <path>)]`
- Files: create/modify <exact paths>
- Interfaces: consumes <file> from Task M → produces <file> for Task N
- Size: XS | S | M | L | XL  (XL = 8+ files → split)
- Break: none | <split condition when this task may exceed 8 files or diverge>
- Steps: [ ] <TDD: failing test → run → implement → run → commit>
- Acceptance: <command-verifiable>
- Risk: none | <rollback plan>
```

**Task size = commit granularity.** The executor commits per LOGICAL task, not per micro-step. Size tasks as meaningful units of work (a feature, a fix, a refactor), not keystrokes — a "fix typo" or "rename variable" task folds into its neighboring logical task, never standalone. A plan full of XS tasks is a history-littering plan; merge them up before writing. Rule: one task = one commit, no exceptions.

## Waves

Group tasks into waves; each wave ends in a verified, reviewable state. `[PARALLEL]` ONLY when tasks share no file AND no interface dependency AND no shared CODEOWNERS area (state the proof); otherwise `[SEQUENTIAL, depends-on: Task M (file: <path>)].` Never mark parallel on assumption. Per-wave gate: acceptance checks run with evidence; a wave starts only when its dependencies are proven done.

**Rollback per wave.** Every wave names its rollback point — a tag at the last proven-good commit — in the wave table. Rule: wave N starts only when wave N-1's rollback point is recorded; a failed wave gate means revert (`git revert <wave-N-tag>`), fix, re-run the gate. A wave with no named rollback point is a planning defect.

## Implementation graph

Every edge names its file: `consumes <file> from Task M → produces <file> for Task N`; flag cross-file risk edges (two tasks reading the same file — never parallel). Tasks carrying `Break:` split mid-execution when files exceed 8 or concerns diverge — re-index the tail.

## Acceptance vs Definition of Done

- **Acceptance** = "did we build the right thing?" — per task, command-verifiable. **Definition of Done** = "finished to standard?" — correctness, quality, integration, docs, ship-readiness; checked at the final wave.

## Anti-patterns

Each with its failure mode and the fix: `references/anti-patterns.md`.

- "TBD", "add appropriate error handling", or "similar to Task N" in a step.
- No Files paths, or an Acceptance like "works correctly" (uncheckable).
- Assumed tooling not confirmed in the context scan, or silent reordering/dropping tasks.
- `[PARALLEL]` without file- AND interface-disjoint proof.
- Missing file-level dependency edges (no `(file: path)`), or a task with no Break point spanning 8+ files.
- Gold-plating (speculative features) or a high-risk task with no rollback plan.

Any anti-pattern fails the quality bar — fix the plan before handoff. Never ship a plan with a known hole. "Vague plan, the executor will figure it out" → wave stalls or ships wrong; "skip the context scan" → fiction; "trust me, they're parallel" → race.

## Full-level skeleton

Full plan at `.mugiwara/missions/<mission>/plan.md`: `# <mission>`, `## Key decisions`, `## Architecture overview`, `## Project structure`, `## Waves`, `## CODEOWNERS`, `## Implementation graph`, `## Task index`, `## Detail tasks`, `## Risk & rollback`, `## Mission split`. Route reasons, check-ins, closure go to `logs/`/`results/`.

## Mission split (very large) — Lane 3

Very-large missions (>2 days, multi-PR) split into sub-missions, never one giant plan. Each sub-mission: own PR, done-criteria, continuation pointer, and its own wave table; every sub-mission ends mergeable. Continuation flows through `.mugiwara/missions/<mission>/continue.json | continue-<member>.json` — next sub-mission resumes from the pointer, never restarts. The planner writes the split before any task detail.

## Handoff

STOP after writing. The plan is written to `.mugiwara/missions/<mission>/plan.md` and it is clean — no agent names, no coordination log, no closure (that lives in `logs/` and `results/`). **Return to the orchestrator.** Present a 2-3 line summary (waves, task count, key risks) and hand off for the GO decision. The orchestrator decides: approve → executor, revise → back to you, or escalate.

Never hand to the executor without a GO. In `guided` mode, the orchestrator asks the user before delegating. In `semi`/`auto`, the orchestrator may auto-go unless the task carries high risk (deploy, migration, DB, public API). You do not decide — you present, the orchestrator routes.

## Red flags
- Shipping a plan with a known anti-pattern (TBD, "works correctly", assumed tooling).
- Marking [PARALLEL] without file- AND interface-disjoint proof.
- Missing file-level dependency edges or a Break point on an 8+ file task.
- Handing the plan to the executor without a GO.
