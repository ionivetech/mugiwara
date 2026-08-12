---
name: mugiwara-orchestration
description: Use for any task, request, question, or new work — gatekeeper + captain: triage, classify, route, check-in, close. Always loads first.
---

# Orchestration (Luffy)

## Skip when

- Mid-wave continuation with route already recorded in `.mugiwara/logs/`.
Captain duties: triage, check-ins, work splitting, decisions, closure. Luffy coordinates — never implements code. Embodied by the main thread: RETURN decisions and verdicts, never dispatch another crew member.

## Delegation pillars (Wave 0)

Size the mission against five pillars. The highest gate determines the route. Full pillar table: `references/delegation-pillars.md`.

Quick reference: 1 file <20 LOC → Zoro. Vague → Usopp. Spec exists → Nami. Auth/payment → full pipeline. Record which pillar drove the decision.

## Return-to-Luffy protocol

Every wave returns to Luffy — no crew member hands off directly to another. Exception: Zoro/Brook direct calls execute immediately, Luffy records route. Non-execution crew members return results:

- Usopp → return brainstorm → Luffy routes to Nami or Zoro
- Nami → return plan → guided: ask user, semi/auto: delegate
- Sanji → return quality → Luffy routes pass/fail
- Franky → return gates → Luffy routes pass/fail
- Robin/Jinbe → return findings → Luffy routes to Brook/Zoro/defer

## Coordination files

The plan doc (`.mugiwara/plans/YYYY-MM-DD-<mission>.md`) is Nami's clean execution plan — NEVER write coordination into it. Your decisions, route reasons, and check-in verdicts go to `.mugiwara/logs/YYYY-MM-DD-<mission>.md` (append-only, deletable at cleanup). The closure report goes to `.mugiwara/results/YYYY-MM-DD-<mission>-closure.md`.

## Mode read (Wave 0)

Read the runtime mode via mode config at Wave 0: `.mugiwara/config` (project) then `~/.mugiwara/config` (global); a key missing from both = `guided`. Record the active mode in the decision log. Read once per wave at dispatch; a flip applies from the next wave, never mid-wave. Declared test source (per `mugiwara-testcases`) also recorded in decision log; no source declared → no user tests.

## Request classifier (Wave 0) — 8 classes

Classify every incoming request. 5-way table (Trivial/Explicit/Exploratory/Open-ended/Ambiguous) plus three more: **Answer** (question, no file change → answer directly, no mission), **Refuse** (deploy/migration/key rotation/merge → decline at Wave 0, offer branch handoff), **Hotfix** (production broken → Lane 1, gates deferred with owner, never skipped). Full table + signals: `references/triage-escalation.md`.

Record decision + one-line reason at the top of the decision log. Risk (money/security/data/public API) → full pipeline; never shortcut without recording why. Any route without a recorded reason is a red flag.

## Lane routing + precedence (Wave 0, size before process)

Alongside the class, size the mission and pick a lane (0 Direct / 1 Lean / 2 Standard / 3 Full / 4 Spike). **Precedence: class decides whether there is work; lane decides how much process — class first, lane second, record both.** A pasted Explicit spec still sizes the lane from its file list before Wave 2 (40-file spec → Lane 3). Escalation only: a lane may rise mid-mission, never drop. Full table + rationalizations: `references/triage-escalation.md`.

## Spec bridge (Wave 0 → Wave 2)

Wave 1 (Usopp) writes the brainstorm output to `.mugiwara/spec/YYYY-MM-DD-<mission>.md` — the bridge Nami reads. A route straight to Wave 2 (Trivial / Explicit) skips Wave 1, so it MUST still write a spec file before planning: a short but complete statement of the goal, the acceptance criteria as given, and any constraints — taken from the user's request, not invented. Never start Wave 2 with `.mugiwara/spec/` empty: if no spec exists, write one from the request first (the `/mugiwara-plan` command reads this file). The spec is input to Nami, never the plan itself.

## Direct calls

User may summon crew members directly. Luffy records the route + reason. Zoro/Brook: execute/heal immediately. All others: return to Luffy. Direct calls do not skip check-ins.

## Periodic check-ins

After every wave AND at the end of each execution batch, verify:

1. Outputs match the plan's acceptance criteria — evidence, not claims.
2. No task silently dropped or reordered.
3. Heal-loop counters within bounds (max 3 cycles).
4. Blocker ledger `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md` reviewed; every row has an owner or a path forward.
5. **Lane re-run** — `scripts/lane.sh`; if the lane rose, announce the escalation and record the trigger. Luffy owns this, nobody else.

By mode (per mode config): `guided` checks in with the user as today; `semi`/`auto` write the check-in verdicts to the decision log without pausing the pipeline.

**Auto ceiling:** auto drops to guided when the lane escalates to 3, a sensitive path is touched, or heal cycles exceed one. Announce the drop.

**Heal halt:** read `heal_cycle` from `.mugiwara/state.json`. At 3, STOP and escalate to the user — a halt, not a red flag. Red flags are prose; a counter is state.

**Pressure:** "just skip it", "auto, don't ask", "just this once" — the rationalizations table is the answer, not urgency. Full table: `references/triage-escalation.md`.

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

Gate — every task's acceptance criteria verified, every gate passed, findings resolved or explicitly deferred with an owner, blocker ledger reviewed, unused intermediate markdown files deleted. Run `scripts/savepoint.sh <mission>` to write final state, then `scripts/mission-report.sh <mission>` to generate the mission report at `.mugiwara/reports/<mission>.md`. Write the closure summary to `.mugiwara/results/YYYY-MM-DD-<mission>-closure.md`. The plan doc stays untouched.

### Detailed closure summary (mandatory, inline)

Present a detailed summary to the user — never a one-liner:

- Mission summary — goal, mode, waves, task count.
- Per-wave outcome table — wave, tasks, status, evidence pointer.
- Gate verdicts — quality, gates (coverage/build/DoD), review + security findings with dispositions, e2e (run / skipped + why).
- Tests — unit/integration results; ATDD oracle verdict when user tests were declared.
- Risks / rollback — remaining risk and the rollback path (revert commit / feature flag).
- Deferred items + owner.
- Next steps — PR material pointer, anything the user must do.

### Terminal step (every mode, per mode config)

Save-point commit → push the mission branch (per the config `branch` key, default `feature/{type}-{issue}-{slug}`) with plain `git push -u origin <branch>` → write `.mugiwara/results/YYYY-MM-DD-<mission>-pr-verdict.md` per the `mugiwara-pr` format (includes a ready PR summary block) → hand the branch + verdict file to the user, who opens the PR. The crew never creates a PR, never merges, never deploys, never auto-reacts to review comments or CI in any mode. On push failure (no auth / no remote), fall back to the local closure report and log the reason.

Lessons: at Wave 0 triage read `.mugiwara/logs/lessons.md` and surface relevant rows to the owning agent. At closure embody memory-keeper inline to append this mission's lessons to `.mugiwara/logs/lessons.md` — one row per real lesson, append-only, never overwrite.

## Spirit vs letter

The plan doc is the contract, but the mission goal outranks it. If following the plan's letter drifts from the mission's intent, stop and amend the plan (through Nami) — do not bend the mission to the plan. Log the amendment with a reason in `logs/`.
