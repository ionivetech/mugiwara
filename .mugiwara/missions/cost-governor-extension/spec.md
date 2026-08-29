# Spec: Mugiwara 2.0 — Adaptive Execution (full Phases A–E + §10 + governor wiring)

## Parent plan

Implements the full **Mugiwara 2.0 — Workflow Optimization & Adaptive Execution
Plan** (baseline `81a333e`, `feat/workflow-subplan` merged, 2026-08-29). Core
framework: three independent decisions per mission — **control mode** (human
involvement), **execution model/posture** (topology), **Cost Governor**
(economic limits + verdicts). Goal is adaptive execution: Luffy chooses and
records an execution posture at each flow boundary from mission evidence, lane,
risk, dependency topology, context pressure, and governor verdicts — without
changing mode semantics or crew role ownership.

Explicitly deferred by the parent plan: a **Control Plane and Trust Layer**
(plan §8) — no remote orchestration, identity/attestation, central authority,
policy daemon. This mission leaves clean seams for it but builds none of it.

## Goal

Deliver the plan's entire delivery roadmap (§10 + Phases A–E), together with
the slop live-wiring (§3.3) and the Phase A de-brand, as a single large
campaign. Sequencing follows plan §9: §10 → A → B → C → D → E.

## Scope — full roadmap

### §10 resume fast-path
- `src/cli.ts` — hoist `continue`/`status` (read-only) above the `ensureConfig`
  bootstrap (cli.ts:33-39). No config created by read-only commands; exit 2
  lists missions/members immediately.
- `mugiwara-resume/SKILL.md` — CLI first, before model planning; exit 2 = hard stop.
- `mugiwara-orchestration/SKILL.md` — classify `continue`/`status` as control
  commands, bypass Flow 0 until deterministic lookup completes.
- No state-schema/selection/actor/mode/Cost Governor change.

### Phase A — Contract and info architecture
- Establish terminology: control mode / execution model-posture / Cost Governor;
  remove "auto" used to mean topology or cost policy.
- Posture vocabulary, triggers, invariants, artifact ownership → workflow, mode,
  execution-model, cost, plan-template, workspace-layout, team/sub-plan docs.
- Minimal posture schema + compatibility/default rules; which values immutable
  per flow, re-evaluated per boundary, or user-controlled.
- Decision-record format linking to existing Cost Governor rows (no duplication).
- Examples: solo Standard, semi-mode parallel, auto-mode team scope,
  budget/circuit-breaker pause, phase-isolated campaign.
- **De-brand**: `ponytail:`/`caveman` refs → `note:` (8 files) + neutral rewrite
  of cost.md:83-84. Keep the terse/lazy capability.

### Phase B — Planning and routing integration
- Triage records initial posture with evidence + a no-op/default route for
  ordinary inline work.
- Nami dependency/wave plan: explicit parallel eligibility + write-conflict
  groups; prohibit speculative parallelization.
- Sub-plan vs true sub-mission decisions explicit and mutually clear.
- Deterministic posture selection matrix from lane/risk/governor verdicts —
  produces reason + evidence refs, not opaque scoring.
- Preserve Guided/Semi/Auto gates exactly; same posture differs only in
  approval/ambiguity handling.

### Phase C — Boundary-based adaptive execution
- Consume governor verdicts at defined boundaries → retain/switch/avoid/pause,
  recorded via existing audit trail.
- Worker dispatch only for Nami-declared independent tasks passing Work
  Governor value/overhead/budget constraints.
- context-relief dispatch preserving sequential order + state continuity.
- Flow 4/5/6 checks stay deduplicated + diff-scoped; posture optimization must
  not cut evidence quality.
- Audit/review/security outputs route to Brook/Luffy only; no role gains
  implementation authority from a posture switch.
- On halt: emit state + continue with exact next action + posture verification.

### Phase D — Team and large-campaign integration
- Plan-level ownership + interface declarations for `(mission, member)`; no
  cross-member Auto execution.
- Phase-local posture in `sub-plan/`; archive preserves phase decision trail.
- Standardized handoff between sub-missions/members (done criteria, branch/base,
  dependency, continuation pointer, blockers).
- Base drift + merge/interface collision → routing/escalation events, never
  silent retries or cross-scope edits.

### Phase E — Reporting, evaluation, ship
- Report rendering summarizes adaptation from trail: posture timeline,
  reason/evidence, avoided work, dispatch overhead, pause/escalation, outcome.
- Deterministic fixtures/evals for every permitted + forbidden transition, all
  3 modes, recovery, team scope, lane rise, budget warn/stop, context pressure,
  heal halt, large-campaign archive.
- Cost Governor benchmarks extended with posture expectations + ratchet; a cost
  decrease fails if evidence/correctness/security/scope/quality falls.
- Cross-platform conformance (12 harnesses); degrade to inline where worker
  tooling absent, artifacts + mode semantics identical.
- Migration/release notes; downgrade/rollback to `inline-sequential`.

### Governor wiring (§3.3) — slop live + per-crew
- Wire existing slop detectors at flow boundary/savepoint; populate
  `slopMetrics.interventions` (reporting.ts:88) so ledger stops reading 0.
- Per-crew attribution: investigation→Usopp/Nami, code+scope→Zoro, retry+healing→Brook,
  context→all; verdicts as `slop-governor` trail rows with owning role.
- Surface per-role slop in report. Preserve "recommend/record, not force".

## Large-campaign handling
>3 phases + full roadmap → master plan is an index; `sub-plan/` owns phase
detail; `flows/phase-NN/` owns evidence; archive `--merge` folds trail. Per
`references/large-campaign-subplan.md`.

## Reuse (do NOT rebuild)
- Slop engine (`src/slop.ts`), `recordSlopDecision`, benchmark slop gate,
  `slopMetrics.interventions` field.
- Existing inline-first / `[PARALLEL]` / `sub-plan` / `(mission,member)`
  mechanics — postures formalize, not replace them.
- Per plan §2.3: no shadow budgets, no forked policy engines.

## Exit criteria (condensed from plan §7)
- Crew semantics, modes, inline-default, missions, team/sub-plan, safety,
  observability, compatibility, quality proof — all per plan §7 acceptance matrix.
- `bun run gate` green; benchmarks ratcheted; 12-platform conformance passes.

## Non-goals
- Control Plane / Trust Layer (plan §8). No central authority, identity,
  remote service, crypto delegation, auto-approval, telemetry service.
- No changing mode semantics, crew roles, or the governor's honest boundary.

## Risks / open questions
- Large surface: sequencing A→B→C→D→E mandatory; each phase independently
  testable; no ship of C before B proves resume/state integrity.
- context-relief (C) is the riskiest new dispatch — phase-isolated behind
  evidence + tests.
- B/C + E all touch state schema, fixtures, benchmarks — versioned,
  backwards-compatible optional fields; old missions default to inline.

## Decision trail
- Scope expanded: full Phases A–E + §10 + slop wiring + de-brand as one large
  campaign (sub-plan). Bare mission name per workspace-layout.md:17. (2026-08-29)
