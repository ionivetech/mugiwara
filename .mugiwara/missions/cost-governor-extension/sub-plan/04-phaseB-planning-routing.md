# Sub-plan 04 — Phase B: Planning & Routing Integration

Phase: B
Goal: Luffy + Nami produce a reviewable adaptive execution design before Flow 3 —
record initial posture with evidence, make parallel eligibility + write
conflicts explicit, and select posture deterministically (reason + evidence refs,
not opaque scoring).

## Tasks

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | Deterministic posture selection matrix | `src/posture.ts` (new) | M | — | rules → posture + reason + evidence refs |
| T2 | Triage records initial posture | orchestration skill / triage-escalation ref | S | T1 | Flow 0 records posture + reason |
| T3 | Planning: explicit parallel eligibility + write conflicts | planning skill + references | S | — | dependency map bans speculative parallel |
| T4 | Sub-plan vs sub-mission decision explicit | planning/workspace refs | S | — | clearly distinguished |

## Detail

### T1 — `src/posture.ts` (deterministic matrix)
Pure function `selectPosture(input)` — no random, no model judgement:
- Inputs: `lane`, `risk`, `independent_tasks`, `context_pressure`,
  `team_members`, `phases`, `plan_lines`, `governor` (normal|avoid|stop).
- Rules (first match):
  - `governor === 'stop'` → keep posture but mark `pause` (safe stop, record)
  - `team_members > 1` → `team-scoped`
  - `phases > 3 || plan_lines > 1500` → `phase-isolated`
  - `context_pressure && order_dependent` → `context-relief`
  - `independent_tasks >= 2 && governor !== 'stop'` → `parallel-workers`
  - else → `inline-sequential`
- Returns `{ posture, reason, evidence_refs }` — every branch carries a concrete
  reason + which evidence it read (e.g. "Nami dependency map", "state context
  metrics"). No opaque score.
- Default for ordinary work = `inline-sequential` (no-op route).

### T2 — triage records initial posture
Orchestration skill: Flow 0 records route + lane + risk + initial posture +
rationale (evidence refs). Default inline for ordinary work.

### T3 — planning explicit dependency map
Planning skill + `large-campaign-subplan.md`: dependency/wave plan makes
parallel eligibility + write-conflict groups explicit; prohibit speculative
parallelization (only `[PARALLEL]` with file- AND interface-disjoint proof).

### T4 — sub-plan vs sub-mission
Make the distinction explicit: phase isolation = one mission; true sub-mission =
separate, independently mergeable unit with own branch/done/continue.

## Acceptance
- `src/posture.ts` unit tests cover every branch + reason string.
- `bun run typecheck` + tests green; docs drift clean.
- No behavior change to modes/gates (Phase B is routing/planning only).
