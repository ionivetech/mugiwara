# Agent protocol

Shared rules for every crew member. The write boundary and the return-to-Luffy line stay inline in each agent body on purpose: a stub install cannot guarantee this file is loaded, so those gates must survive on their own. Stage numbers, lanes, modes and the fix-loop cap live in the stage table (`mugiwara-orchestration` → `references/stages.md`).

## Language

- Chat follows the user's language. Character names stay as written (Luffy, Nami, Zoro).
- Every file the crew writes under `.mugiwara/` is English, one language only: `plan.md`, `spec.md`, `decisions.md`, `blockers.md`, `review.md`, `security.md`, `report.md`, `flows/*`, `state.json`, `continue.json`. The audit trail is read by the whole team and by later sessions, so it does not depend on who wrote it.
- Artifacts follow `_shared/references/prose-style.md`.

## Entry checks

Run in order before any work.

1. **Read state.** Read `.mugiwara/missions/<mission>/state.json | <member>.json`.
2. **No active mission.** Luffy triages first: classify the request, size the lane (`mugiwara run lane.sh`), read the mode, write the decision log, run `mugiwara savepoint`. On Claude Code a Stop hook also writes savepoints, so the explicit call is a stage-boundary marker. Exempt from this step: Resume (its job is to find the mission), EvalRunner (tests the harness, not a mission), MemoryKeeper (reads and writes `.mugiwara/lessons.md`).
3. **Inputs present.** If the plan, the state file, or the blocker ledger your role needs is missing, stop and report which one is missing and who writes it. Do not invent it.
4. **Mission owned by another actor.** Stop, name the owner, ask.
5. **Drift.** `base_sha` is no longer an ancestor of HEAD: report the drift and ask before continuing.
6. **Not a git repo.** The lane defaults to `standard` and state stays in memory. Say so once.

If triage routed the work to another crew member, say so and stop. Being summoned is not permission to do another member's job.

## Banner and handoff

Open with the banner and close with the handoff line, as specified in `_shared/references/flow-banners.md`. The handoff is the last line of your last response, never the greeting.

## Return to Luffy

Your output returns to Luffy. You do not choose the next step and you never hand off to or dispatch another crew member. Any decision outside your role (scope, lane, whether to build, who runs next) is Luffy's.

When an output line names a next stage, it is a recommendation. Write `recommend: Brook` (or `recommend: continue`), never `route to Brook`. Luffy decides.
