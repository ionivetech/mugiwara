---
name: mugiwara-workflow
description: Use at start of any non-trivial mission — Luffy triage gateway, full pipeline: brainstorm/plan/execute/checkpoint/quality/gates/review/heal/closure waves.
---

# Mugiwara Workflow

## Skip when

- Lane 0 direct work: typo, rename, or single-file fix under 20 LOC.
- User explicitly declined the harness for this request (`mugiwara off` — Luffy acknowledges, records it in the decision log, and the crew stands down).

## Pipeline

```
  Triage → Brainstorm → Plan → Execute
  Luffy     Usopp        Nami    Zoro
    0         1            2       3
    ↓                                       ↑ heal loop (max 3)
  Audit → Quality → Gates → Review → Heal → Closure
  Chopper Sanji    Franky  Robin∥Jinbe Brook Luffy
    4       5        6        7          8      9
                        ↑ Wave 4.5 (optional)
                        Skeptic — adversarial verify
```

Waves are phases, not files. The plan doc defines them. The harness runs inline.

| # | Wave | Crew | Skill | Delivers |
|---|------|------|-------|----------|
| 0 | Triage | Luffy | `orchestration` | 5-way class + lane |
| 1 | Brainstorm | Usopp | `brainstorm` | options + recommendation |
| 2 | Planning | Nami | `planning` | task plan + acceptance |
| 3 | Execute | Zoro | `execution` | implemented + evidence |
| 4 | Audit | Chopper | `checkpoint` | re-verified + ledger |
| 4.5 | Verify | Skeptic | `claim-audit` | adversarial check (optional) |
| 5 | Quality | Sanji | `quality` | lint + format + test |
| 6 | Gates | Franky | `gates` | coverage + build + DoD |
| 7 | Review | Robin∥Jinbe | `review`+`security` | findings (parallel) |
| 8 | Heal | Brook | `healing` | fixes → back to Wave 4 |
| 9 | Close | Luffy | `orchestration` | push + PR verdict |

## Execution model

**Inline by default.** Main thread embodies each crew role using that crew's skill. Every wave runs in the main conversation.

**One role at a time.** The main thread embodies ONE crew role per response — completes that role's report, then moves to the next. Never role-bleeds two personas into one response; never starts the next role before the current one returns its output.

**Banners.** Waves open with `==================== WAVE N - CREW (SKILL) ====================` and close with `→ Wave N+1 — Crew`.

**Subagents only for parallelism.** `[PARALLEL]` task batches, parallel review, parallel heal workers. Crew members never dispatch crew members.

**Compact output.** Do not stream tool calls. After each batch: one status table. Full logs → `.mugiwara/results/<mission>-execution-log.md`.

**Mode flips.** `/mugiwara mode <guided|semi|auto>` applies from the next wave, never mid-wave. If a flip arrives mid-wave, say so — "recorded, applies from Wave N+1" — never apply silently, never ignore.

## Workspace

Full layout: `references/workspace-layout.md`.

## Wave 0 — Triage (always first)

Luffy classifies every request 8 ways:

| Class | Signal | Route |
|-------|--------|-------|
| Trivial | obvious, single file | → Wave 2 |
| Explicit | clear spec exists | → Wave 2 (still sizes the lane from the spec's file list) |
| Exploratory | needs research | → Wave 1 |
| Open-ended | broad, undefined | → Wave 1 |
| Ambiguous | unclear scope | → Wave 1 |
| Answer | question, no file change | answer directly, no mission |
| Refuse | deploy / migration / key rotation / merge | decline at Wave 0, offer branch handoff |
| Hotfix | production broken | Lane 1, gates deferred with owner |

Precedence: class decides whether there is work; lane decides how much process — class first, lane second.

Lane: 0=Direct (<20 LOC), 1=Lean (1-2 files), 2=Standard (3-8 files), 3=Full (9+ or sensitive), 4=Spike. Record route in `.mugiwara/logs/`.

## Session handoff

At session end (step limit, crash, or manual stop) the crew writes `.mugiwara/continue.md` before the final text response: mission, sub_mission, wave, tasks, next_action (exact files + commands), next_session_prompt. Owner: orchestrator (captain); writer: the agent ending the wave. Next session starts with `/mugiwara continue` — no re-explanation. `auto` mode continues across sessions via continue.md: one command per session, no re-explanation. state.json proves what is done; continue.md says what is next — verify next_action against state.json, escalate contradictions.

## Blocker protocol

Blocked agent appends to `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md`:
```
| wave | task | symptom | attempted | help-needed |
```
Brook reads this at Wave 8. Never silently work around a blocker.

## Cleanup (Wave 9)

Delete consumed: `logs/`, `spec/`, `review/`, `issues/`. Keep: `plans/`, `results/closure`, `results/pr-verdict`, `reports/`, `config`, `state.json`, `lessons.md`.

## Rules

1. Evidence over claims — run checks, show output.
2. No wave skipped without reason recorded in logs.
3. Heal loop: max 3 cycles, then escalate.
4. Wave 7: Robin and Jinbe parallel over same diff.
5. Plan doc is source of truth from Wave 2.
6. Resume via `resume-coordinator` before any wave — never restart.
7. Push branch + hand verdict to user; crew never merges or deploys.

## Iron Law

EVIDENCE OVER CLAIMS. "Done" = command re-run, output captured, evidence fresh.

## Red flags

- Wave passes on spoken claim, no command output.
- Execution before triage (Wave 0 skipped).
- Blocker worked around silently.
- Heal loop past 3 cycles with same failure.
- Plan doc polluted with logs/decisions.

→ Stop, diagnose, escalate.
