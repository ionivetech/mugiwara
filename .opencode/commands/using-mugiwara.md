---
description: Mugiwara crew reference — how it works, crew overview, pipeline summary. Documentation only.
---
Mugiwara Reference: $ARGUMENTS

`mugiwara-orchestration` auto-loads as gatekeeper for every task — no need to call this command.

## How it works

- 11 agents: Luffy (triage), Usopp (brainstorm), Nami (plan), Zoro (execute), Chopper (audit), Sanji (quality), Franky (gates), Robin (review), Jinbe (security), Brook (heal), Resume (+3 internal: Skeptic, Eval Runner, Memory)
- 26 skills — one per crew role + domain skills (frontend, backend, git, security)
- 9-wave pipeline runs inline in the main conversation
- Evidence over claims at every wave
- Autonomy modes: guided, semi, auto

## When to use this command

Use `/using-mugiwara` when you want the crew overview or pipeline summary. For task routing and classification, `mugiwara-orchestration` auto-loads as gatekeeper — you do not need to call this first.

See skills/mugiwara-workflow for the full pipeline.
