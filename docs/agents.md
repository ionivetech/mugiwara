# The Crew — 15 Agents

Every agent is a focused specialist. The main thread embodies each role inline
using its skill; you can also summon any member directly. "Dispatch" below
means "route the mission to this role."

| Agent | Crew member | Role | Summon for |
|-------|-------------|------|------------|
| `using-mugiwara` | Front Door | Router — classifies and routes, never implements | "how do I use mugiwara?", any new mission |
| `luffy-orchestrator` | Luffy | Captain — 5-way triage, check-ins, decisions, closure | mission start, wave boundaries, escalations |
| `usopp-brainstorm` | Usopp | Critical friend — interrogates, researches, no rubber-stamps | vague ideas, direction, options |
| `nami-planner` | Nami | Planner — interview-first, full-context scan, scaled plans | turning an idea into an execution plan |
| `zoro-execution` | Zoro | Executor — inline sequential tasks, parallel worker batches, evidence per task | executing an approved plan |
| `chopper-checkpoint` | Chopper | Auditor — verify-everything, deduped re-runs, failure ledger | auditing a wave's results |
| `sanji-quality` | Sanji | Quality — discover real tooling, format/lint/test | after checkpoint passes |
| `franky-gates` | Franky | Gates — coverage, build, Definition of Done, binary verdicts | after quality checks |
| `robin-reviewer` | Robin | Reviewer — doubt-driven diff review, breaking-change map first | after gates pass |
| `jinbe-security` | Jinbe | Security — STRIDE, OWASP, secrets, injection, dependencies | security audit of a diff |
| `brook-healing` | Brook | Healer — reads the ledger, root-cause fixes, ≤3 cycles | any wave produced failures |
| `skeptic-verifier` | Skeptic | Adversarial verifier — doubts every output, does NOT validate | high-stakes verdicts, plans, reviews |
| `eval-runner` | Eval Runner | Harness tester — task suites, judge-agent comparison | verifying mugiwara itself works |
| `resume-coordinator` | Resume Coordinator | Resumer — rebuilds state from `.mugiwara/`, continues never restarts | context loss, new session mid-mission |
| `memory-keeper` | Memory Keeper | Institutional memory — surfaces past lessons, captures new ones | mission start + closure |

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
- **Skeptic** never validates — doubts.
- **Robin/Jinbe** never implement — findings to Brook.
- Crew members never dispatch each other. Workers are subagents, never crew.

## The crew ships whole

Every install gets all 15 agents and all 32 skills. No project-type selection —
the harness routes each task to the right specialist.

See [skills.md](skills.md) for the 25 techniques, or
[workflow.md](workflow.md) for the pipeline.
