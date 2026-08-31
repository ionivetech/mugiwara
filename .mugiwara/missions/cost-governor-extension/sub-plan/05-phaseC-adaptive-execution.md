# Sub-plan 05 — Phase C: Boundary-Based Adaptive Execution

Phase: C
Goal: Apply posture decisions at safe workflow boundaries with the inline-first
model intact. The machinery already exists ([PARALLEL] dispatch, context-pressure
worker dispatch, continue.json, halt→state+continue). Phase C makes posture
switching explicit and recorded — no new dispatch engine, no schema ripple.

## Tasks

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | Posture switching protocol at boundaries | `content/skills/mugiwara-execution/SKILL.md` | S | Phase B | boundary re-eval, record retain/switch/avoid/pause |
| T2 | Reinforce halt contract (state + continue) | execution skill | S | T1 | on halt, emit state + continue with next action |
| T3 | Context-relief as documented posture (not new dispatch) | execution-model.md (done in A) | — | — | reuse existing context-pressure dispatch |

## Detail

### T1 — posture switching (execution skill)
Add compact section: re-evaluate posture only at a flow-stage / task-batch
boundary, never mid-task. Consume lane/risk/governor/context evidence →
retain / switch / avoid / pause; record decision + reason + evidence ref in
`decisions.md`. A switch never changes control mode or crew roles. Worker
dispatch only for Nami-declared independent tasks (`[PARALLEL]` file- AND
interface-disjoint proof).

### T2 — halt contract
Reinforce: on halt (governor stop / heal halt), emit state + continue with the
exact next action before the final response — posture verification step included.

### T3 — context-relief
Already covered: execution-model.md context-pressure → one worker at a time,
order preserved. No new dispatch machinery.

## Acceptance
- Execution skill documents boundary posture switching + halt contract.
- typecheck + tests green; docs drift clean.
- No state schema change; old missions default inline.
