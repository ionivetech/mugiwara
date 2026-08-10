---
name: mugiwara-workflow
description: Use at the start of any non-trivial mission to run the Mugiwara crew harness - Luffy triage gateway first, then brainstorm, planning, execution, checkpoint, quality, gates, review, healing, and closure waves.
---

# Mugiwara Workflow

The Straw Hat harness: Wave 0 triage + Waves 1-9, with an optional adversarial pass at Wave 4.5. Waves are phases of the mission, not files — Nami writes them into the plan doc, Zoro executes them. The main thread runs the harness and dispatches each crew member one at a time (Dispatch protocol below); the harness always starts through Luffy unless the user summons a crew member directly.

## Dispatch protocol (every harness)

1. The main/primary agent runs the pipeline. Dispatch ONE crew member at a time with the host's native task/subagent mechanism — each as a TOP-LEVEL task, so its work is visible. Wait for the report before dispatching the next.
2. Crew members NEVER dispatch another crew member. Each returns its report/output to the main thread; the main thread routes the next wave (re-dispatch Luffy for the check-in at each boundary).
3. Exceptions: Zoro (Wave 3) and Brook (Wave 8) spawn their own WORKER subagents — host-native, not crew members — for parallel task execution and parallel fixes. Chopper, Robin, and Jinbe may spawn check subagents. Workers are fine nested; crew members are not.
4. Escalation from a crew member = "blocked" + ledger row returned to the main thread, which routes it to Luffy/Brook. Never a nested crew dispatch.

Deep crew-inside-crew nesting hides work and bloats context. Every crew member's name is visible in the CLI as its task runs.

## Workspace layout

Every mission creates and works inside `.mugiwara/` at the repo root:

```
.mugiwara/
├── config         # runtime mode config: mode/branch/commit/pr key=value (gitignored; project overrides global)
├── spec/          # brainstorm output: YYYY-MM-DD-<mission>.md
├── plans/         # plan doc: YYYY-MM-DD-<mission>.md — CLEAN, Nami-only, source of truth from Wave 2. No agent names, no log, no closure.
├── results/       # wave results: audit/quality/gate reports, todos, closure report
├── review/        # review + security findings
├── issues/        # blocker log: YYYY-MM-DD-<mission>-blockers.md
└── logs/          # Luffy's decision + check-in log: YYYY-MM-DD-<mission>.md (deleted at cleanup)
```

The plan doc stays clean: it holds ONLY Nami's execution plan (waves, tasks,
criteria, risks). Who did what, route decisions, and check-in verdicts go to
`logs/`; the closure report goes to `results/`. Nothing non-plan pollutes the plan doc.

The owning agent creates the folder it needs on first write. No mission artifacts go outside `.mugiwara/`.

## Resume

At session start, after context loss, or on any "where were we?" — dispatch `resume-coordinator` (mugiwara-resume) BEFORE Wave 0 triage. It rebuilds the picture from disk (plan, todos, trace, blockers) and reports the resume point. Resume before any wave; never start over. Disk state is truth.

## Wave 0 — Luffy Triage (always first)

Front door: dispatch `using-mugiwara` (easy to remember) — it routes to the right crew member and records the route. For a full triage dispatch `luffy-orchestrator`. NEVER start directly with brainstorming or planning. Luffy classifies every request 5 ways (Trivial / Explicit / Exploratory / Open-ended / Ambiguous) and routes: Trivial and Explicit → Wave 2 directly; Exploratory, Open-ended, and Ambiguous → Wave 1 brainstorm first. The user may summon any crew member directly — Luffy still records the route.

Alongside triage, read the mode config per `mugiwara-mode`: `.mugiwara/config` (project) then `~/.mugiwara/config` (global); a key missing from both = `guided`. Lazy-create the project config on first WRITE only, never auto-create on read.

## Waves

| Wave | Owner | Skill | Output |
|------|-------|-------|--------|
| 0 Triage | Luffy | mugiwara-orchestration | route decision + reason |
| 1 Brainstorm | Usopp | mugiwara-brainstorm | refined direction, options, recommendation |
| 2 Planning | Nami | mugiwara-planning | plan doc: waves/tasks/criteria, parallel markers |
| 3 Execution | Zoro | mugiwara-execution | implemented tasks with evidence |
| 4 Checkpoint | Chopper | mugiwara-checkpoint | audit report + failure ledger |
| 4.5 Adversarial | Skeptic | mugiwara-dynamic-workflow | findings report + failure ledger |
| 5 Quality | Sanji | mugiwara-quality | formatter/linter/test results |
| 6 Gates | Franky | mugiwara-gates | coverage + build verdict |
| 7 Review | Robin ∥ Jinbe | mugiwara-review + mugiwara-security | severity-tagged findings |
| 8 Healing | Brook | mugiwara-healing | fixes, then loop back to Wave 4 |
| 9 Closure | Luffy | mugiwara-orchestration | closure report + push mission branch + PR verdict file handed to user, who opens the PR (terminal gate in every mode) |

Wave 4.5 is optional — Luffy invokes Skeptic after Chopper on high-stakes missions (verdicts, plans, reviews), or parallel to Wave 7 review when he calls for it. Skip means recorded without a pass.

## Blockers

Any agent that hits a blocker APPENDS a row to `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md`:

`| <wave> | <task> | <symptom> | <attempted> | <help-needed> |`

Never silently work around a blocker. Brook reads this ledger at Wave 8 to decide what to heal; Luffy reviews it at every check-in.

## Cleanup

At closure (Wave 9), delete unused intermediate markdown files in `.mugiwara/` — superseded results, review, issues reports, and the per-mission decision log in `logs/`. Keep the plan doc and the closure report.

## Rules

1. Evidence over claims: no wave passes on assertion. The owning agent runs the checks and shows output.
2. No wave skipped without the reason recorded in the decision log (`.mugiwara/logs/`).
3. Heal loop is bounded: Wave 8 → Wave 4, max 3 cycles. After that, escalate to the human with full history.
4. Any agent may consult Luffy mid-flight (re-dispatch `luffy-orchestrator`) for decisions and escalations.
5. Wave 7 runs Robin and Jinbe in parallel.
6. The plan doc (`.mugiwara/plans/YYYY-MM-DD-<mission>.md`) is the single source of truth from Wave 2 onward.
7. Frontend-touching tasks in Wave 3 must apply `mugiwara-frontend` in the same pass.
8. One agent may hold many skills (e.g. Usopp holds `mugiwara-brainstorm` + `mugiwara-frontend`; the crew is 11 members); dispatch the agent, not the skill.
9. On session start, context loss, or "where were we?" — resume before any wave via `resume-coordinator` (mugiwara-resume); never start over.
10. The crew never merges and never deploys — push the branch + hand the verdict file to the user, who opens the PR; PR review is the terminal gate in every mode.

## Iron Law

EVIDENCE OVER CLAIMS. No wave passes on assertion — the owning agent runs the checks and shows output. A wave that cannot produce evidence is a failed wave.

## Verification gate (every completion claim)

A claim is only as strong as the evidence produced in the same turn that made it. "Done", "passes", and "fixed" each name a command that would prove them — run that command, read its full output, then speak. A result from an earlier run, a guess, or a worker's word for it is not proof; re-run it and diff the work against the tree before reporting. Trust is not a substitute for verification.

## Red flags

- A wave "passes" on a spoken claim with no command output or file to point at.
- Heal loop beyond 3 cycles with the same failure still open.
- A wave skipped with no reason recorded in the decision log.
- Execution starts before triage (Wave 0), or planning before brainstorm when triage routed to Wave 1.
- Mission artifacts landing outside `.mugiwara/`.
- Wave order drifts from the table (e.g. quality before checkpoint).
- A blocker worked around silently with no ledger row.

All mean: stop the pipeline, diagnose with Chopper's ledger, decide continue / retry / escalate.
