---
description: Front-door router: explain how mugiwara works, classify a mission, or route to the right crew member
---
Using Mugiwara: $ARGUMENTS

Mugiwara crew available. The workflow auto-activates for non-trivial requests.

## How it works

- 15 agents: Luffy (triage), Usopp (brainstorm), Nami (plan), Zoro (execute), Chopper (audit), Sanji (quality), Franky (gates), Robin (review), Jinbe (security), Brook (heal), Skeptic (verify), Eval Runner, Resume, Memory
- 26 skills — one per crew role + domain skills (frontend, backend, git, security)
- 9-wave pipeline runs inline in the main conversation
- Evidence over claims at every wave
- Autonomy modes: guided, semi, auto

## What to do

1. If the user asks how mugiwara works — summarize in 3 lines.
2. If the user gives a task — classify (Trivial/Explicit/Exploratory/Open-ended/Ambiguous) and route:
   - Clear, small → route to nami-planner or zoro-execution directly.
   - Vague, needs direction → route to usopp-brainstorm.
   - Anything else → route to luffy-orchestrator (full triage).
   - Specialized: review → robin-reviewer, security → jinbe-security, etc.
3. Record the route in `.mugiwara/logs/`.

Skills: mugiwara-workflow, mugiwara-orchestration. See skills/mugiwara-workflow for the full pipeline.
