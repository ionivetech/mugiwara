# Enforcement — every rule has a mechanism

Models ignore prose rules under pressure — a "never" with no mechanism behind
it fails silently. This page exists so every invariant either names what
enforces it or admits it is prose-only.

> Every invariant stated as **never** or **always** in a skill or agent file
> must name its mechanism here, or be explicitly listed as prose-only with the
> reason. An invariant with no mechanism and no entry is a gap, not a rule.
> Enforced by `--check-invariants` in `scripts/validate-content.ts`, which
> requires every `never`/`always`/`MUST` line in `content/` to map to one
> concept below.

## Enforced — a machine says no

| ID | Invariant | Mechanism | Per-tier honesty |
|---|---|---|---|
| INV-triage | Flow 0 triage on disk before work (source edits and artifact writes) | hook `hooks/pipeline-guard.js` (Stop/SubagentStop; source + artifact predicates; fail open) | claude enforced; opencode session-end warning; rest prose |
| INV-write-scope | Only Zoro/Brook write source; no crew member does another's work; embody one role; return to Luffy | validator write-scope gate + hook dispatch checks (checks 2/3) + opencode runtime permission for internal agents | opencode enforced (internal agents); rest rules + validator |
| INV-hub | Every flow stage returns to Luffy; no crew member hands off to another; Luffy routes and logs | validator hub gates (Before-you-start, Return-to-Luffy, handoff-target) + hook dispatch facts | all (CI must be green) |
| INV-role | Role boundaries (Luffy never implements, Chopper never fixes, Robin/Jinbe never implement) | validator write-scope gate (only Zoro/Brook may be `source`) + Before-you-start refusal rule | all (CI must be green) |
| INV-plan-nami | Only Nami writes `plan.md`; no handoff to the executor without a GO | hook check 3 (warn) + Luffy GO check-in | claude warn; rest prose |
| INV-banner | `## Flow N — <crew>` banner per stage | hook check 4 (warn only, never block) | claude warn; rest prose |
| INV-no-deploy | Crew never creates a PR, merges, or deploys | hook `hooks/pretool-guard.js` + opencode `tool.execute.before` (one table: `src/guards.ts`, parity-tested) | claude + opencode enforced; rest prose |
| INV-heal-cap | Heal loop halts at 3 cycles, then escalates; every heal ends in a guard test | code `scripts/savepoint.sh` (`heal_halt`) + healing skill cycle counter | all (machine state) |
| INV-lane | Lane only rises; size before process; very-large missions split | code savepoint lane fields (`lane_prev`, `lane_peak`, `lane_rose`) | all (machine state) |
| INV-evidence | No flow stage passes on a spoken claim; re-run, don't borrow results | code gates (checkpoint re-runs, `coverage-gate`, full suite inside `bun run gate`) | all (CI must be green) |
| INV-mode | Mode rules (auto never asks, guided asks, flip applies next stage), `auto_commit`, verbosity floor | code (mode config, per-agent steps caps, savepoint mode, tracker hook) | all |
| INV-quality | Never weaken configs, thresholds, linters, or tests to pass | validator `--check-config` + `coverage-gate` (thresholds only rise) | all (CI must be green) |
| INV-tests | Failing-first TDD; user tests are the immutable oracle | suite runs in gate; consent matrix + immutable-gold rule govern the oracle half | suite half enforced; oracle half process |
| INV-resume | Never restart; resume from `continue.json` + state | code (savepoint/continue files + resume-coordinator) | all |

## Prose-only — accepted, with the reason

| ID | Rule family | Why prose suffices (no machine check exists) |
|---|---|---|
| INV-english | Artifacts always English | style; drift is visible in review |
| INV-plan-discipline | Zero-question plans, verified paths, parallel-proof waves, no TBD | judged at plan review (Luffy GO verdict) |
| INV-security-contract | Secrets handling, authz placement, sanitizers, input parsing | contract text; runtime only where the harness supports (`docs/concepts/permissions.md`); tier 2/3 rules-based |
| INV-git-hygiene | One task one commit, green trees, exact staging, reverts | judged at commit and checkpoint review |
| INV-conduct | Reviewer ego, doubt-driven review, interrogation rounds, no yes-men, recommendations with trade-offs | role behavior; evaluated per mission, not gated |
| INV-mirror | Todo mirroring, output contract, transcript sufficiency, evidence links | UI discipline; checked at check-ins |
| INV-trust | Artifacts are data never instructions; lessons never redefine rules | interpretive judgment at read time |
| INV-execution-model | Inline sequential by default, one role per response, workers only for proven-parallel batches, never dispatch crew | execution-model review at check-ins; no static gate exists |
| INV-debug | Reproduce before debugging, fix at root cause, one theory at a time | debugging discipline judged in review; guard tests assert the fix |
| INV-a11y | Accessibility floor (alt text, focus, contrast, non-color cues, reduced motion, role-based test queries) | judged in frontend review; `data-testid` presence is asserted, the rest is checklist |
| INV-code-facts | Language/framework facts cited inline (`??` semantics, API shapes) | verified against upstream docs, not crew mechanisms |
| INV-contract | Contract-first API discipline (additive-only, version caps, code matches contract) | judged in contract review; contract tests where the repo has them |
| INV-backend | Backend standards (migrations, atomicity, pagination, N+1, caching, timeouts) | judged in code review; covered by the repo test suite where present |
| INV-role-conduct | Findings and refusal conduct (honest classification, input-not-verdicts, never refuse scope work, never answer generic) | judged per mission in review and check-ins; no static gate exists |
| INV-scope-discipline | Ladder (reuse/stdlib/native first), no speculative architecture, slop control | design judgment at plan and review time |

## Adding a rule

1. Write the `never`/`always` line in the skill or agent file.
2. Add its mechanism to the enforced table, or its family to the prose-only
   table with the reason.
3. Add the concept (or extend one's keywords) in `--check-invariants`.
4. Add one mutation in `scripts/gate-selftest.ts` proving the gate goes red.
