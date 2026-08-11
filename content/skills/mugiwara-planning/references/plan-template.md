# Plan Template

Scaled plan skeleton. Nami picks Quick/Standard/Full based on mission size.

## Quick (1 task, ≤2 files)

```markdown
# <mission> — <goal>

## Key decisions
<why this approach>

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 3 | <what> | T1 | <command-verifiable exit check> |

## Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | <title> | <paths> | S | — | <one-line check> |

## Detail: T1 — <title>
- Files: <exact paths>
- Steps: [ ] <test → impl → verify>
- Acceptance: <command>
- Risk: none
```

## Standard (1 wave, 2-8 tasks)

Add: Architecture overview, Context scan, Implementation graph, Acceptance per task.

## Full (multi-wave, parallel, risk)

Add all of Standard + Key decisions, Project structure, Risk & rollback, Definition of Done.

## Anti-patterns to avoid

- "TBD" or "add appropriate error handling" in a step.
- No file paths, or Acceptance like "works correctly" (uncheckable).
- `[PARALLEL]` without file- AND interface-disjoint proof.
- High-risk task with no rollback plan.
- Vague plan expecting the executor to figure it out.
