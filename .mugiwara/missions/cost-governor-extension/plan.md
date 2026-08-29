# Mugiwara 2.0 — Adaptive Execution (master plan)

Mission: `cost-governor-extension`
Mode: auto (per `.mugiwara/config`)

This is a **large campaign** (>3 phases). Master plan is an index; phase detail
lives in `sub-plan/`. Sequence per parent plan §9: §10 → A → B → C → D → E.

## Mission split (index)

| Sub-plan | Phase | Focus | Deliverable |
|----------|-------|-------|-------------|
| `01-phase10-resume-fastpath` | §10 | continue/status read-only, skip config bootstrap | ✅ cli.ts + 2 skills (3af8e8d) |
| `02-phaseA-contract-debrand` | A | posture vocabulary, terminology cleanup, de-brand, plan template, posture schema docs | ✅ docs + skills + 8 file de-brand (08beb12) |
| `03-phaseA-slop-live-wiring` | A/§3.3 | wire slop detectors live, per-crew attribution, surface in report | ✅ savepoint + reporting.ts (d76c012) |
| `04-phaseB-planning-routing` | B | triage posture, dependency map, selection matrix | ✅ orchestration + posture.ts (5c3ce14) |
| `05-phaseC-adaptive-execution` | C | boundary posture switching, worker dispatch, context-relief | ✅ execution skill, no schema ripple (3897f97) |
| `06-phaseD-team-campaign` | D | member ownership, phase-local posture, handoff, base drift | ✅ multi-actor.md (ce2b004) |
| `07-phaseE-reporting-ship` | E | adaptation report, fixtures/evals, benchmarks, conformance, release | ✅ reporting + eval + adoption note (64b1d76) |

## Dependency graph

```
§10 ──► A(de-brand/contract) ──► B ──► C ──► D ──► E
           └──► slop wiring (can ride with A/B, before C)
```
C must not ship before B proves resume/state integrity. E last (needs all
posture behaviour to exist before benchmarking).

## Execution posture (this mission)

- Control mode: auto
- Initial model: inline-sequential (each phase sequential; parallel only within
  a phase where tasks are file-disjoint)
- Re-evaluate at: each phase boundary
- Cost-aware: defer any non-goal; keep governor honest boundary (recommend/record, not force)

## Definition of Done

- Each sub-plan ends mergeable: gates green (`bun run gate`), evidence fresh.
- Backwards-compatible: old missions default to inline semantics.
- No Control Plane / Trust Layer (parent plan §8).
- `grep -ril "caveman\|ponytail" src/ scripts/ content/ docs/` empty.

## How to start

1. Run sub-plan `01-phase10-resume-fastpath`.
2. On phase completion: savepoint + commit, then next sub-plan.
3. Resume via `mugiwara continue cost-governor-extension`.

## Key decisions (why this approach)

- Anchor to parent plan; only phases a human can ship are executed.
- Reuse existing mechanics (inline / `[PARALLEL]` / sub-plan / `(mission,member)`)
  — postures formalize, not replace.
- Reuse slop engine — wire, don't rebuild.
