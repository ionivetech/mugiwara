# Decisions — cost-governor-extension

## Flow 1 — brainstorming (Usopp)

outcome: Combined three workstreams into one mission anchored to the parent
Mugiwara 2.0 plan: (A) §10 resume fast-path, (B) stop-slop live wiring per
§3.3 (wire governor slop verdicts into the workflow contract), (C) Phase A
de-brand of ponytail/caveman refs. One mission because B+C touch overlapping
files (reporting.ts, benchmark-governor.ts) and share the goal of a
first-class, fast, clean governor. This is the plan's first slice; Phases B–E
(execution posture/topology) and the Control Plane are explicitly deferred.

decision: Combine into one mission `cost-governor-extension`, spec.md written
with parent-plan context. Bare mission name per workspace-layout.md:17.
actor: AI: deepseek-v4-flash

## Flow 1 — brainstorming (Usopp) — part B rationale

outcome: Stop-Slop governor is defined but unwired — detectors have zero live
callers; ledger `slop_interventions` always 0. Wire existing engine at flow
boundary/savepoint + per-crew attribution + surface. Reuse engine, no new
taxonomy/engine/CLI. Serves plan §3.3.
actor: AI: deepseek-v4-flash

## Flow 1 — brainstorming (Usopp) — part C rationale

outcome: Remove all caveman/ponytail brand references (code comments + docs),
keep the terse/lazy capability. 8 files, `ponytail:` → `note:`, neutral rewrite
of cost.md:83-84 comparison. Serves plan Phase A vocabulary cleanup.
actor: AI: deepseek-v4-flash

## Flow 1 — brainstorming (Usopp) — scope expansion

outcome: User directed full scope — implement the entire Mugiwara 2.0 delivery
roadmap (§10 + Phases A–E) plus slop live-wiring (§3.3) and Phase A de-brand,
as one large campaign. This supersedes the earlier narrow §10-only scope.
Sequencing per plan §9: §10 → A → B → C → D → E. Large-campaign trigger met
(>3 phases) → sub-plan structure.
actor: AI: deepseek-v4-flash

## Flow 3 — §10 resume fast-path (Zoro)
outcome: DONE — cli.ts hoists continue/status before config bootstrap; cli.test.ts
updated to new read-only contract (status no longer writes config); resume +
orchestration skills mark continue/status as control commands. Verified: fresh
project status exit 0 no config, continue exit 2. 61 tests pass, typecheck clean.
commit: 3af8e8d
actor: AI: deepseek-v4-flash

## Flow 3 — Phase A contract + de-brand (Zoro)
outcome: DONE — de-branded all ponytail/caveman refs (8 files → note:), neutral
rewrite cost.md:83-84; three-decision + posture vocabulary in execution-model.md;
posture/dependency/cost sections in plan-template.md; control-commands as a
reference + 1-line pointer (orchestration SKILL re-trimmed to 119 body lines,
removed redundant Q&A hub). grep clean, typecheck clean, 722 tests pass
(2 config.test.ts fails are pre-existing on main).
commit: 08beb12
actor: AI: deepseek-v4-flash

## Flow 3 — Phase A/§3.3 slop live wiring (Zoro)
outcome: DONE — computeLiveSlop in slop.ts runs existing detectors over
state (heal_cycle) + registry (repeated reads), feeds ledger
slopMetrics.interventions (was always 0). costCmd passes slopSummary + prints
per-role (Brook/all); report Cost section shows slop count. 4 fixture tests.
E2E: sloppy mission heal_cycle=4 → "Slop: 1 — Brook:1". typecheck clean, 96 tests.
commit: d76c012
actor: AI: deepseek-v4-flash

## Flow 3 — Phase B planning/routing (Zoro)
outcome: DONE — src/posture.ts selectPosture() deterministic matrix (8 branches,
reason + evidence refs, no opaque score). Orchestration triage records initial
posture + posture-routing ref; planning large-campaign ref: phase isolation vs
true sub-mission + write-conflict explicitness. 8 posture tests, typecheck clean,
docs clean. Modes/gates unchanged.
commit: 5c3ce14
actor: AI: deepseek-v4-flash

## Flow 3 — Phase C boundary adaptive execution (Zoro)
outcome: DONE — execution skill: posture switching only at flow/task-batch
boundaries (retain/switch/avoid/pause), recorded in decisions.md; halt emits
state + continue with next action incl. posture verification. Reused existing
[PARALLEL] + context-pressure dispatch; no new engine, no state schema change
(avoids fixture/benchmark/conformance ripple). body 120, docs clean.
commit: 3897f97
actor: AI: deepseek-v4-flash

## Flow 3 — Phase D team/large-campaign (Zoro)
outcome: DONE — multi-actor.md: member ownership + interface declarations
(auto never crosses another member's scope), standardized handoff fields, base
drift + merge/interface collision as routing/escalation events. Phase-local
posture linked from planning ref (B). docs clean.
commit: ce2b004
actor: AI: deepseek-v4-flash

## Flow 3 — Phase E reporting/ship (Zoro)
outcome: DONE — summarizeAdaptation/renderAdaptationSection surface posture rows
from decisions.md trail into report (wired after Cost section); posture-selection
eval case; adoption.md three-decision model + rollback to inline-sequential.
benchmark (slop floors) pass, 56 evals pass, 736 tests pass (2 pre-existing
config.test.ts fails on main).
commit: 64b1d76
actor: AI: deepseek-v4-flash

## Flow 3 — docs refresh (Zoro)
outcome: DONE — README + workflow/modes/features/getting-started/glossary updated
to surface adaptive execution, three-decision model, and live slop governor.
Honest scope: only the genuinely-stale concept docs + README touched; install /
harness / security etc. left valid. Gates green (docs drift, links, typecheck).
commit: acce8ae
actor: AI: deepseek-v4-flash

## Flow 3 — README restructure (Zoro)
outcome: DONE — README rewritten newcomer-first (30s intro, quick start up top,
how-it-works cards, new-in-2.0 section), cost-governor.md hub links
three-decision model. Audited docs coverage: ~90% now reflects latest features;
remaining stale = none critical. Gates green.
commit: 813fa33
actor: AI: deepseek-v4-flash

## Flow 3 — Phase E completion (Zoro)
outcome: DONE (remaining exit criteria) — added 4 posture eval cases (phase-
isolated/context-relief/team-scoped + forbidden mid-task-switch negative); moved
posture-routing.md to shared references/ (tier-1) fixing a verify-install G1 +
conformance broken-pointer; regenerated test/golden file counts (69->71).
Conformance 12/12, 60 evals, benchmark, 738 tests, typecheck all green.
commit: 1279c0e
actor: AI: deepseek-v4-flash

## Flow 3 — Phase E complete, full gate green (Zoro)
outcome: DONE — full `bun run gate` passes end-to-end (exit 0). Fixed posture eval
triggers for rank-1 retrieval (95.9%, 216/216), moved posture-routing to shared
ref, regenerated conformance goldens (12/12), added cli coverage to 80.41%.
All gates: typecheck, 745 tests, build, validate-content, lane-base, check-doc-
links, run-evals (60), retrieval-eval, benchmark-governor, verify-install, 12-
platform conformance, coverage-gate. Phase E exit criteria now met.
commit: 67efc79
actor: AI: deepseek-v4-flash
