---
name: mugiwara-workflow
description: Use at start of any non-trivial mission — Luffy triage gateway, full pipeline: brainstorm/plan/execute/checkpoint/quality/gates/review/heal/closure waves.
---

# Mugiwara Workflow

## Skip when

- Lane 0 direct work: typo, rename, or single-file fix under 20 LOC.
- User explicitly declined the harness for this request.

The Straw Hat harness: Wave 0 triage + Waves 1-9, with an optional adversarial pass at Wave 4.5. Waves are phases of the mission, not files — Nami writes them into the plan doc, Zoro executes them. The main thread runs the harness and embodies each crew role inline (Execution model below); the harness always starts through Luffy unless the user summons a crew member directly.

## Execution model (every harness)

**Inline by default.** The main/primary agent runs the pipeline and plays each crew role itself using that member's skill. Every wave's work is performed in the main conversation so the user sees the process live — no hidden subagent jumps, no click-to-expand. The crew members are personas + skills the main thread embodies, not mandatory dispatch targets.

**Visible wave transitions.** Every wave opens with a main-thread banner `## Wave N — <crew> (<skill>)` and closes with the handoff line `→ Wave N+1 — <crew>` (Wave 9: `→ closure`). No wave starts without its banner; the conversation names who runs now and who takes over next so the user always sees the chain live.

**Checkpoint-report presentation.** The banner marks a stage boundary; no wave passes silently. At each boundary the owning crew reports inline — one compact per-crew report: what ran, the result, the evidence pointer. No narration of every tool call. Each wave closes with a short progress summary (done / in-flight / blocked + next handoff). On failure or risk, PAUSE: report the problem and get a continue / retry / escalate decision before proceeding.

1. For each wave, the main thread loads the owning crew member's skill (e.g. `mugiwara-checkpoint` for Wave 4) and performs that role inline: triage, planning, execution, audit, quality, gates, review, closure — all in the main thread.
2. Dispatch a subagent ONLY when the work is genuinely parallel or background: an independent `[PARALLEL]` task batch (Zoro's WORKER subagents, Wave 3), parallel fixes (Brook, Wave 8), or a long-running check that would stall the conversation. Subagent results return to the main thread as a report; the main thread summarizes the outcome inline with evidence pointers.
3. Crew members NEVER dispatch another crew member. A crew role that must split work returns the split plan to the main thread, which spawns the workers.
4. Escalation = "blocked" + ledger row returned to the main thread, which routes it to Luffy/Brook. Never a nested crew dispatch.

Why: crew-inside-crew nesting hides work behind subagent expansion and bloats context. Inline roles keep every wave visible as it happens. Subagents exist to parallelize, not to hide. In any harness — Claude Code, opencode, Codex, Cursor, Gemini — subagent internals sit behind a click; the only way the user sees the process is to run it in the main conversation.

## Workspace layout

Every mission creates and works inside `.mugiwara/` at the repo root:

```
.mugiwara/
├── config         # runtime mode config: mode/branch/commit/pr key=value (gitignored; project overrides global)
├── state.json     # computed mission state at every wave boundary (scripts/savepoint.sh)
├── spec/          # brainstorm output: YYYY-MM-DD-<mission>.md
├── plans/         # plan doc: YYYY-MM-DD-<mission>.md — CLEAN, Nami-only, source of truth from Wave 2
├── results/       # wave results: audit/quality/gate reports, todos, closure report
├── reports/       # human-readable mission reports: YYYY-MM-DD-<mission>.md
├── review/        # review + security findings
├── issues/        # blocker log: YYYY-MM-DD-<mission>-blockers.md
└── logs/          # Luffy's decision + check-in log: YYYY-MM-DD-<mission>.md (deleted at cleanup)
```

The plan doc stays clean: it holds ONLY Nami's execution plan (waves, tasks,
criteria, risks). Who did what, route decisions, and check-in verdicts go to
`logs/`; the closure report goes to `results/`. Nothing non-plan pollutes the plan doc.

The owning agent creates the folder it needs on first write. No mission artifacts go outside `.mugiwara/`.

## Resume

At session start, after context loss, or on any "where were we?" — embody `resume-coordinator` inline (mugiwara-resume) BEFORE Wave 0 triage. Rebuild the picture from disk (plan, todos, trace, blockers) and report the resume point. Resume before any wave; never start over. Disk state is truth.

## Wave 0 — Luffy Triage (always first)

Front door: embody `using-mugiwara` inline (the router) — it routes to the right crew member and records the route. For a full triage embody `luffy-orchestrator` inline. NEVER start directly with brainstorming or planning. Luffy classifies every request 5 ways (Trivial / Explicit / Exploratory / Open-ended / Ambiguous) and routes: Trivial and Explicit → Wave 2 directly; Exploratory, Open-ended, and Ambiguous → Wave 1 brainstorm first. Alongside the class, Luffy sizes the mission and picks a lane (0 Direct / 1 Lean / 2 Standard / 3 Full / 4 Spike) — small work skips the pipeline, sensitive work never sneaks through the lean path. The user may summon any crew member directly — Luffy still records the route.

Alongside triage, read the mode config per mode config: `.mugiwara/config` (project) then `~/.mugiwara/config` (global); a key missing from both = `guided`. Lazy-create the project config on first WRITE only, never auto-create on read.

## Waves

| Wave | Owner | Skill | Output |
|------|-------|-------|--------|
| 0 Triage | Luffy | mugiwara-orchestration | route decision + reason |
| 1 Brainstorm | Usopp | mugiwara-brainstorm | refined direction, options, recommendation |
| 2 Planning | Nami | mugiwara-planning | plan doc: waves/tasks/criteria, parallel markers |
| 3 Execution | Zoro | mugiwara-execution | implemented tasks with evidence |
| 4 Checkpoint | Chopper | mugiwara-checkpoint | audit report + failure ledger |
| 4.5 Adversarial | Skeptic | mugiwara-claim-audit | findings report + failure ledger |
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

At closure (Wave 9), after the terminal step, run cleanup per `mugiwara-ship`: delete consumed intermediates — superseded results, review, issues, the decision log in `logs/`, and consumed spec. Keep the plan doc, closure report, PR verdict, mission report, `config`, `state.json`, and cross-mission state (`logs/lessons.md`, `backup/`, `manifest.json`). List candidates before deleting.

## Rules

1. Evidence over claims: no wave passes on assertion. The owning agent runs the checks and shows output.
2. No wave skipped without the reason recorded in the decision log (`.mugiwara/logs/`) — name the wave, owner, and reason at the moment of omission.
3. Heal loop is bounded: Wave 8 → Wave 4, max 3 cycles. After that, escalate to the human with full history.
4. Any agent may consult Luffy mid-flight (embody `luffy-orchestrator` inline) for decisions and escalations.
5. Wave 7 runs Robin and Jinbe in parallel over the same diff.
6. The plan doc is the single source of truth from Wave 2 onward.
7. Frontend tasks in Wave 3 must apply `mugiwara-frontend`.
8. On session start or context loss — resume via `resume-coordinator` before any wave; never start over.
9. Push branch + hand verdict file to the user, who opens the PR; crew never merges, never deploys.

## Iron Law

EVIDENCE OVER CLAIMS. No wave passes on assertion — the owning agent runs the checks and shows output. "Done", "passes", and "fixed" must be proved by running the check command in the same turn; no stale results, no guesses, no worker's word for it.

## Red flags

- A wave passes on a spoken claim with no command output.
- Heal loop beyond 3 cycles with the same failure still open.
- Wave skipped with no reason recorded in the decision log.
- Execution before triage (Wave 0).
- Mission artifacts outside `.mugiwara/`.
- Wave order drifts (e.g. quality before checkpoint).
- Blocker worked around silently with no ledger row.

All mean: stop, diagnose with Chopper's ledger, decide continue/retry/escalate.
