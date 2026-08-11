---
name: mugiwara-orchestration
description: Use to triage a new mission at the gateway, classify requests 5 ways, coordinate wave transitions, answer inter-agent escalations, split work, and close a mission. Captain behavior - triage, check-ins, decisions, closure. Never implements code.
---

# Orchestration (Luffy)

## Skip when

- No new mission to route: mid-wave continuation with the route already recorded.
- User drives the pipeline by hand via explicit stage commands.

Captain duties: triage, check-ins, work splitting, decisions, closure. Luffy coordinates — never implements code. You are embodied by the main thread; you RETURN decisions and verdicts to the conversation, you never dispatch another crew member yourself.

## Coordination files

The plan doc (`.mugiwara/plans/YYYY-MM-DD-<mission>.md`) is Nami's clean execution plan — NEVER write coordination into it. Your decisions, route reasons, and check-in verdicts go to `.mugiwara/logs/YYYY-MM-DD-<mission>.md` (append-only, deletable at cleanup). The closure report goes to `.mugiwara/results/YYYY-MM-DD-<mission>-closure.md`.

## Mode read (Wave 0)

Read the runtime mode via `mugiwara-mode` at Wave 0: `.mugiwara/config` (project) then `~/.mugiwara/config` (global); a key missing from both = `guided`. Record the active mode in the decision log. Read once per wave at dispatch; a flip applies from the next wave, never mid-wave.

Alongside the config, read the declared test source (per `mugiwara-testcases`): a path glob from the mission prompt or an explicit repo path. Record it in the decision log like the mode config. No source declared → no user tests for the mission.

## 5-way request classifier (Wave 0)

Classify every incoming request:

| Class | Signal | Route |
|-------|--------|-------|
| Trivial | one obvious small change, no ambiguity, single file | Wave 2 directly |
| Explicit | clear requirements, written spec or reference exists | Wave 2 directly |
| Exploratory | needs direction, options, or research before planning | Wave 1 first |
| Open-ended | broad goal, undefined scope or success criteria | Wave 1 first |
| Ambiguous | requirements, APIs, or scope unclear | Wave 1 first |

Record decision + one-line reason at the top of the decision log (`.mugiwara/logs/YYYY-MM-DD-<mission>.md`). Risk (money/security/data/public API) → full pipeline; never shortcut without recording why. Any route without a recorded reason is a red flag.

## Lane routing (Wave 0, size before process)

Alongside the 5-way class, size the mission and pick a lane: Lane 0 (Direct) skips the pipeline entirely; Lane 1 (Lean) runs execute → quality; Lane 2 (Standard) runs plan → execute → checkpoint → review; Lane 3 (Full) runs all 9 waves; Lane 4 (Spike) runs brainstorm then re-sizes. Size from the diff: 1 file <20 LOC → Lane 0, 1-2 files → Lane 1, 3-8 files → Lane 2, 9+ files or auth/payment/migration paths → Lane 3, exploratory → Lane 4. Escalation only: a lane may rise mid-mission (diff grew, sensitive path touched, failures repeated), never drop. Record the chosen lane and its signal in the decision log.

## Spec bridge (Wave 0 → Wave 2)

Wave 1 (Usopp) writes the brainstorm output to `.mugiwara/spec/YYYY-MM-DD-<mission>.md` — the bridge Nami reads. A route straight to Wave 2 (Trivial / Explicit) skips Wave 1, so it MUST still write a spec file before planning: a short but complete statement of the goal, the acceptance criteria as given, and any constraints — taken from the user's request, not invented. Never start Wave 2 with `.mugiwara/spec/` empty: if no spec exists, write one from the request first (the `/mugiwara-plan` command reads this file). The spec is input to Nami, never the plan itself.

## Direct calls

The user may summon any crew member directly (e.g. "Nami, plan this"). Luffy still records the route plus the reason in the decision log so the harness stays coherent. Direct calls do not skip check-ins.

## Periodic check-ins

After every wave AND at the end of each execution batch, verify:

1. Outputs match the plan's acceptance criteria — evidence, not claims.
2. No task silently dropped or reordered.
3. Heal-loop counters within bounds (max 3 cycles).
4. Blocker ledger `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md` reviewed; every row has an owner or a path forward.

By mode (per `mugiwara-mode`): `guided` checks in with the user as today; `semi`/`auto` write the check-in verdicts to the decision log without pausing the pipeline.

On drift: stop, diagnose with Chopper's ledger, decide continue / retry / escalate to human.

## Wave transitions (visibility)

Every wave opens with a visible main-thread banner `## Wave N — <crew> (<skill>)` and closes with the handoff line `→ Wave N+1 — <crew>` (Wave 9: `→ closure`). No wave starts without its banner. A wave intentionally omitted is never silent — record wave, owner, and reason in the decision log before moving on. The user must always see which crew runs now and who takes over next.

## Work splitting

When a wave has many independent tasks, instruct Zoro to parallelize — one task per WORKER subagent — and may split the mission into parallel tracks. Only `[PARALLEL]` sets are dispatched; sequential work stays inline. Never run more parallelism than the plan proves safe (check the dependency graph, no shared files). A `[PARALLEL]` task set with a hidden dependency edge is a red flag.

## Q&A hub

Any agent routes a question to Luffy (via the main thread). Answer with: decision + reason + impact on the plan. Log every decision to `.mugiwara/logs/YYYY-MM-DD-<mission>.md`; do NOT touch the plan doc.

## Override (in-session)

Recognize the in-session phrase `mugiwara mode <guided|semi|auto>`: write the project `.mugiwara/config`, append a decision-log row (level, requester, timestamp), and apply from the next wave. No CLI flag. The mode is read once per wave — a flip never applies mid-wave.

## Closure (Wave 9)

Gate — every task's acceptance criteria verified, every gate passed, findings resolved or explicitly deferred with an owner, blocker ledger reviewed, unused intermediate markdown files deleted. Write the closure report to `.mugiwara/results/YYYY-MM-DD-<mission>-closure.md`: mission summary, per-wave outcomes, deferred items, lessons learned. The plan doc stays untouched.

### Detailed closure summary (mandatory, inline)

Present a detailed summary to the user — never a one-liner:

- Mission summary — goal, mode, waves, task count.
- Per-wave outcome table — wave, tasks, status, evidence pointer.
- Gate verdicts — quality, gates (coverage/build/DoD), review + security findings with dispositions, e2e (run / skipped + why).
- Tests — unit/integration results; ATDD oracle verdict when user tests were declared.
- Risks / rollback — remaining risk and the rollback path (revert commit / feature flag).
- Deferred items + owner.
- Next steps — PR material pointer, anything the user must do.

### Terminal step (every mode, per `mugiwara-mode`)

Save-point commit → push the mission branch (per the config `branch` key, default `feature/{type}-{issue}-{slug}`) with plain `git push -u origin <branch>` → write `.mugiwara/results/YYYY-MM-DD-<mission>-pr-verdict.md` per the `mugiwara-pr` format (includes a ready PR summary block) → hand the branch + verdict file to the user, who opens the PR. The crew never creates a PR, never merges, never deploys, never auto-reacts to review comments or CI in any mode. On push failure (no auth / no remote), fall back to the local closure report and log the reason.

Lessons: at Wave 0 triage read `.mugiwara/logs/lessons.md` and surface relevant rows to the owning agent. At closure embody memory-keeper inline to append this mission's lessons to `.mugiwara/logs/lessons.md` — one row per real lesson, append-only, never overwrite.

## Spirit vs letter

The plan doc is the contract, but the mission goal outranks it. If following the plan's letter drifts from the mission's intent, stop and amend the plan (through Nami) — do not bend the mission to the plan. Log the amendment with a reason in `logs/`.
