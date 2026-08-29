# Posture Routing (Flow 0/2)

Posture is independent of control mode. Luffy records it; Nami proposes the
resolved posture; it is chosen deterministically — never opaque scoring.

## Initial posture (Flow 0)

At triage, alongside route + lane + risk, record the initial execution posture +
rationale + evidence refs. Ordinary work defaults to `inline-sequential` (a
no-op route — no posture change).

Deterministic matrix: `src/posture.ts` `selectPosture(input)` → `{ posture,
reason, evidence_refs }`. Inputs: lane, risk, independent_tasks, order_dependent,
context_pressure, team_members, phases, plan_lines, governor verdict.

| Trigger | Posture |
|---------|---------|
| ordinary / none | `inline-sequential` (default) |
| ≥2 independent tasks, no shared files/interfaces | `parallel-workers` |
| context pressure + ordered tasks | `context-relief` |
| >3 phases or >1500 plan lines | `phase-isolated` |
| >1 team member | `team-scoped` |
| governor stop | safe pause (keep inline, emit state + continue) |

Governor stop never silently changes mode or crew roles; it pauses and records.

## Plan posture (Flow 2)

Nami declares dependencies, write-conflict groups, explicit `[PARALLEL]`
eligibility (file- AND interface-disjoint), member ownership, phase/sub-plan
trigger, acceptance evidence. Luffy records the resolved posture.
