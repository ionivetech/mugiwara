# The Crew — 11 Agents (+3 Internal)

Every agent is a focused specialist. The main thread embodies each role inline
using its skill; you can also summon any member directly.

| Agent | Crew member | Role | Summon for |
|-------|-------------|------|------------|
| `luffy-orchestrator` | Luffy | Captain — 5-way triage, check-ins, decisions, closure | mission start, wave boundaries, escalations |
| `usopp-brainstorm` | Usopp | Critical friend — interrogates, researches, no rubber-stamps | vague ideas, direction, options |
| `nami-planner` | Nami | Planner — interview-first, full-context scan, scaled plans | turning an idea into an execution plan |
| `zoro-execution` | Zoro | Executor — inline sequential tasks, parallel worker batches, evidence per task | executing an approved plan |
| `chopper-checkpoint` | Chopper | Auditor — verify-everything, deduped re-runs, failure ledger | auditing a wave's results |
| `sanji-quality` | Sanji | Quality — discover real tooling, format/lint/test | after checkpoint passes |
| `franky-gates` | Franky | Gates — coverage, build, DoD, binary verdicts | after quality checks |
| `robin-reviewer` | Robin | Reviewer — doubt-driven diff review, breaking-change map | after gates pass |
| `jinbe-security` | Jinbe | Security — STRIDE, OWASP, secrets, injection | security audit of a diff |
| `brook-healing` | Brook | Healer — reads the ledger, root-cause fixes, ≤3 cycles | any wave produced failures |
| `resume-coordinator` | Resume | Resumer — rebuilds state from `.mugiwara/`, continues never restarts | context loss, new session mid-mission |

**Internal agents** (dispatch-only, not user-facing):

| Agent | Role | Used by |
|-------|------|---------|
| `skeptic-verifier` | Adversarial verifier — doubts every claim | Wave 4.5, high-stakes missions |
| `eval-runner` | Harness tester — task suites, judge rubric | `bun scripts/run-evals.ts` |
| `memory-keeper` | Lessons ledger — surface + capture | Wave 0 (read), Wave 9 (write) |

## How to summon

Say a crew member's name in your request:

```
> Chopper, audit the last wave against the plan
> Nami, plan this out
```

Luffy still records the route and its reason, and direct calls do not skip
check-ins. The harness stays coherent either way.

## Who never does what

- **Luffy** never implements code.
- **Chopper** never fixes findings — reports them.
- **Robin/Jinbe** never implement — findings to Brook.
- Crew members never dispatch each other. Workers are subagents, never crew.

## The crew ships whole

Every install gets all 11 agents (+3 internal) and all 26 skills. No project-type selection —
the harness routes each task to the right specialist.

See [skills.md](skills.md) for the 26 techniques, or
[workflow.md](workflow.md) for the pipeline.
