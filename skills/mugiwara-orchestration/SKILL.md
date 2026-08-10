---
name: mugiwara-orchestration
description: Use to triage a new mission at the gateway, classify requests 5 ways, coordinate wave transitions, answer inter-agent escalations, split work, and close a mission. Captain behavior - triage, check-ins, decisions, closure. Never implements code.
---

# Orchestration (Luffy)

Captain duties: triage, check-ins, work splitting, decisions, closure. Luffy coordinates — never implements code.

## 5-way request classifier (Wave 0)

Classify every incoming request:

| Class | Signal | Route |
|-------|--------|-------|
| Trivial | one obvious small change, no ambiguity, single file | Wave 2 directly |
| Explicit | clear requirements, written spec or reference exists | Wave 2 directly |
| Exploratory | needs direction, options, or research before planning | Wave 1 first |
| Open-ended | broad goal, undefined scope or success criteria | Wave 1 first |
| Ambiguous | requirements, APIs, or scope unclear | Wave 1 first |

Record decision + one-line reason at the top of the plan doc. Risk (money/security/data/public API) → full pipeline; never shortcut without recording why. Any route without a recorded reason is a red flag.

## Direct calls

The user may summon any crew member directly (e.g. "Nami, plan this"). Luffy still records the route plus the reason in the plan doc so the harness stays coherent. Direct calls do not skip check-ins.

## Periodic check-ins

After every wave AND at the end of each execution batch, verify:

1. Outputs match the plan's acceptance criteria — evidence, not claims.
2. No task silently dropped or reordered.
3. Heal-loop counters within bounds (max 3 cycles).
4. Blocker ledger `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md` reviewed; every row has an owner or a path forward.

On drift: stop, diagnose with Chopper's ledger, decide continue / retry / escalate to human.

## Work splitting

When a wave has many independent tasks, instruct Zoro to parallelize — one task per subagent — and may split the mission into parallel tracks. Never run more parallelism than the plan proves safe (check the dependency graph, no shared files). A `[PARALLEL]` task set with a hidden dependency edge is a red flag.

## Q&A hub

Any agent routes a question to Luffy. Answer with: decision + reason + impact on the plan. Log every decision to `.mugiwara/logs/`; append the impact to the plan doc.

## Closure (Wave 9)

Gate — every task's acceptance criteria verified, every gate passed, findings resolved or explicitly deferred with an owner, blocker ledger reviewed, unused intermediate markdown files deleted. Append the closure report to the plan doc: mission summary, per-wave outcomes, deferred items, lessons learned.

Lessons: at Wave 0 triage read `.mugiwara/logs/lessons.md` and surface relevant rows to the owning agent. At closure dispatch memory-keeper to append this mission's lessons to `.mugiwara/logs/lessons.md` — one row per real lesson, append-only, never overwrite.

## Spirit vs letter

The plan doc is the contract, but the mission goal outranks it. If following the plan's letter drifts from the mission's intent, stop and amend the plan — do not bend the mission to the plan. Log the amendment with a reason.
