---
name: using-mugiwara
description: Use at session start or on any task — explains how the crew works, classifies missions, routes to the right specialist. Front door to the Straw Hat crew.
---

# Using Mugiwara (Front Door)

## Skip when

- Lane 0 direct work: typo, rename, or single-file fix under 20 LOC.
- User explicitly declined the crew for this request.

Mugiwara is a governed engineering team in your coding agent. 15 specialists — triage, brainstorm, plan, execute, audit, quality, gates, review, security, heal — with evidence at every step and cost tracking. Runs inline in the main conversation.

## How it works

1. The crew auto-activates for non-trivial requests. You do NOT need to call `using-mugiwara` at session start — it's an optional router.
2. The pipeline: Luffy triage → Usopp brainstorm → Nami plan → Zoro execute → Chopper audit → Sanji quality → Franky gates → Robin/Jinbe review → Brook heal → Luffy closure.
3. Every wave runs inline in the main thread. Subagents only for [PARALLEL] task batches.
4. Evidence over claims — no wave passes on assertion. Checks must be re-run.
5. Autonomy modes: `/mugiwara guided|semi|auto`. Flip applies next wave.
6. Workspace: `.mugiwara/` at repo root — plans, results, issues, logs, state.

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
| Skeptic | Adversarial verifier (read-only) |
| Resume | Continuity — rebuild from state.json |

## What to do

1. If the user asks how mugiwara works — summarize in 3 lines.
2. If the user gives a task — classify: Trivial / Explicit / Exploratory / Open-ended / Ambiguous.
3. Route:
   - Clear, small → Nami (plan) or Zoro (execute).
   - Vague, needs direction → Usopp (brainstorm).
   - Anything else → Luffy (full triage + check-ins).
   - Review → Robin. Security → Jinbe. Audit → Chopper. Heal → Brook.
4. Record the route in `.mugiwara/logs/`.

Full pipeline: see skills/mugiwara-workflow.
