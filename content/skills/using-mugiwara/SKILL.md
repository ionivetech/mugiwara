---
name: using-mugiwara
description: How Mugiwara works — crew overview, pipeline summary. Documentation reference. Trigger: "how does mugiwara work", "what is mugiwara", "which crew member", "crew overview", "mugiwara how".
---
# Using Mugiwara (Reference)

## Skip when

- `mugiwara-orchestration` is the gatekeeper — it auto-loads for task routing and classification. This skill is a documentation reference only.

Mugiwara is a governed engineering team in your coding agent. 12 specialists — triage, brainstorm, plan, execute, audit, quality, gates, review, security, heal — with evidence at every step and cost tracking. Runs inline in the main conversation.

## How it works

1. `mugiwara-orchestration` auto-loads as gatekeeper for every task — classify, route, check-in, close.
2. The pipeline: Luffy triage → Usopp brainstorm → Nami plan → Zoro execute → Chopper audit → Sanji quality → Franky gates → Robin/Jinbe review → Brook heal → Luffy closure.
3. Every wave runs inline in the main thread. Subagents only for [PARALLEL] task batches.
4. Evidence over claims — no wave passes on assertion. Checks must be re-run.
5. Autonomy modes: `/mugiwara guided|semi|auto`. Flip applies next wave.
6. Workspace: `.mugiwara/` at repo root — plans, results, issues, logs, state.
7. The main thread embodies the active role — it is never "plain Claude"
   mid-mission. Shortcuts skip waves, never roles. Write-scope in each agent's
   frontmatter: artifacts agents delegate source edits to Zoro, never attempt
   them.

## Crew

| Agent | Role |
|-------|------|
| Luffy | Captain — triage, check-ins, closure |
| Usopp | Brainstorm — research, explore, recommend |
| Nami | Planner — interview, scan, write scaled plans |
| Zoro | Executor — TDD per task, commit per logical unit |
| Chopper | Auditor — re-run criteria, failure ledger (read-only) |
| Sanji | Quality — format, lint, test |
| Franky | Gates — coverage, build, DoD |
| Robin | Reviewer — breaking-change map (read-only) |
| Jinbe | Security — STRIDE, OWASP, secret scan (read-only) |
| Brook | Healer — reads ledger, fixes failures |
| Resume | Continuity — rebuild from the mission state |

For task routing and classification, `mugiwara-orchestration` auto-loads as gatekeeper.
This skill is documentation — load manually with `/using-mugiwara` or similar trigger phrases.
Full pipeline: see skills/mugiwara-workflow.
First time? Run `/mugiwara onboard` for guided setup. See `content/agents/onboarding-guide.md`.

## Red flags

- Stating an agent or skill count that drifts from content/.
- Claiming feature parity that contradicts the harness matrix.
- Answering routing questions instead of deferring to mugiwara-orchestration.
