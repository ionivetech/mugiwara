# Sub-plan 06 — Phase D: Team & Large-Campaign Integration

Phase: D
Goal: Scale adaptation without collapsing team boundaries or trail quality.

## Tasks

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | Member ownership + interface declarations; no cross-member Auto exec | `references/multi-actor.md` | S | — | ownership map; Auto never runs another member's scope |
| T2 | Standardized handoff fields | `references/multi-actor.md` | S | T1 | done/branch/dependency/continue/blockers explicit |
| T3 | Base drift + merge/interface collision → escalation | `references/multi-actor.md` | S | T1 | routing/escalation, never silent cross-scope edit |
| T4 | Phase-local posture in sub-plan (already in planning ref) | — | — | Phase B | confirm |

## Detail

Extend `references/multi-actor.md` with:
- **Ownership + interfaces**: each member declares owned files/interfaces in the
  shared plan; a member/worker never receives another member's scope — in Auto
  mode this is a hard boundary, never silently crossed.
- **Standardized handoff**: done-criteria, branch/base status, dependency status,
  continuation pointer (`continue-<member>.json`), unresolved blocker refs.
- **Base drift / merge / interface collision**: routing/escalation events — never
  a silent retry or automatic cross-scope edit.

Phase-local posture in `sub-plan/NN-phaseNN-*.md` is already defined (Phase B
planning ref). This sub-plan confirms the linkage.

## Acceptance
- multi-actor.md documents ownership/interface declarations, standardized
  handoff, and base-drift escalation.
- docs drift clean; typecheck + tests green.
