# Dispatch & batching detail

Full detail behind `content/skills/mugiwara-execution/SKILL.md` — the output
rule, the worker prompt format, and the per-flow stage report table.

## Task batching

Run task work tightly: do the steps without narrating each command or micro-step. Surface ONE per-task result + evidence per task (or per batch) — status, evidence link (`[path](relative/path)`), deviations — in a compact line or table. The checkpoint audits evidence, not commentary; save the blow-by-blow.

**Output rule.** Do NOT stream every tool call to the main thread. After each task batch, emit ONLY:

```
T1: ✅ | built + tested | bun run test -- installer
T2: ✅ | 7 pointers rewritten | grep refs/ → clean
T3: ✅ | 38/38 tests | bun run test
```

Full logs go to `.mugiwara/missions/<mission>/flows/01-execution.md`. The main thread shows the summary table only. Tool calls visible below the banner are noise — batch them, squash the output. **Slop guard (all crews):** before dispatch read `heal_cycle`/`heal_halt` + `repeated_reads` (context-registry) — `heal_cycle≥max` halt/escalate, `repeated_reads≥thr` skip re-read/compress — trail `slop-governor` — Full checklist: `_shared/references/cost-governor.md` §§21-24,20,31-32.

## Delegation format (parallel workers only)

Sequential work runs inline — no delegation. For every `[PARALLEL]` worker you dispatch, the prompt includes all six fields:

- TASK — the task body, verbatim from the plan.
- EXPECTED OUTCOME — what "done" looks like, concrete and checkable.
- REQUIRED TOOLS — commands and files the subagent will need.
- MUST DO — the steps in order, including the TDD failing-test-first step.
- MUST NOT DO — boundaries: files not to touch, configs not to weaken, no silent workarounds.
- CONTEXT — interfaces consumed/produced, related tasks, mission workspace paths.

A delegation prompt shorter than ~30 lines is too short — beef it up. Thin prompts cause thin results.

## Report table

After each flow stage: compact task table (status, evidence pointer, deviations) shown inline in the conversation. Format:

```
| # | Task | Status | Evidence link |
|---|------|--------|--------------|
| T1 | <title> | ✅/❌ | <command or file> |
```
Evidence cells are clickable markdown links `[path](relative/path)`.
