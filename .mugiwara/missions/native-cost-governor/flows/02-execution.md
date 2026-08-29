# native-cost-governor — Phase 4 Execution Evidence (Flow 3)

Mode=auto, branch=feat/native-cost-governor, commit=conventional, auto_commit=on.
Plan: `.mugiwara/missions/native-cost-governor/plan.md` §Phase 4 (lines 1000-1294).

## Task table

| # | Task | Files | Status | Evidence |
|---|------|-------|--------|----------|
| T1 | Scope & Code Governor verdict engine + record helper | src/scope.ts, test/scope.test.ts | ✅ done | `bun test test/scope.test.ts` green; `bun run typecheck` pass; coverage scope.ts 100% lines ≥90 |
| T2 | wire verdicts into agent flow (workflow skill + cost docs) | content/skills/mugiwara-workflow/SKILL.md, docs/concepts/cost.md | ✅ done | `validate-content` exit 0; grep acceptances; `bun run typecheck` pass |
| T3 | full gate + evidence | flows/02-execution.md | ✅ done | `bun run gate` exit 0 |

## Commits

| Commit | Type | SHA |
|--------|------|-----|
| T1 | feat(scope): scope & code governor verdict engine (drift/reuse/abstraction/dependency/sufficient/waste/surface) | `0ae9dd7` |
| T2 | docs(scope): wire scope & code governor verdicts into the workflow skill and cost docs (amended with gate-driven path-shape fix) | `eb8229d` |
| T3 | chore(scope): phase 4 verification evidence | pending-below |

`savepoint.sh`, `lane-base.sh`, `DEFAULT_CONFIG`, `src/cost.ts`, `src/work.ts`,
`src/context.ts`, `src/config.ts`, `src/investigation.ts`, `plan.md`,
`decisions.md`, `state.json` untouched.

## T1 evidence

Command: `bun test test/scope.test.ts`

```
bun test v1.3.14 (0d9b296a)
 41 pass
 0 fail
 82 expect() calls
Ran 41 tests across 1 file.
```

Command: `bun run typecheck` → `tsc --noEmit` exit 0.

Command: `bun test --coverage test/scope.test.ts`

```
File          | % Funcs | % Lines | Uncovered Line #s
 src/scope.ts |  100.00 |  100.00 |
```

Coverage scope.ts = 100% lines (gate threshold `coverage_new=90` satisfied).

Verdict families covered (exact non-trivial assertions, no typeof/Array.isArray):
`detectScopeDrift` (scope_score 0/0.5/2÷3, outside files named), 
`checkExistingCodeReuse` (reuse:true only when existing AND viable; "not viable" /
"no existing" reasons), `evaluateAbstraction` (speculative + single-use refuse,
use_count echo), `evaluateDependency` (§16 four-condition gate, first-failing-clause
reason), `minimumSufficientCheck` (under/over/sufficient exact), `detectCodeWaste`
(waste_types exact list incl. "generated code"), `measureChangeSurface`
(loc_changed=120, surface echo, proportionality), `recordScopeDecision` (single
bullet, scope-governor actor, S2 newline sanitize, dir creation).

## T2 evidence

Command: `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity`

```
✓ manifest in sync with content/
✓ index budget: 4741/5500 chars
✓ docs in sync with content/
✓ content valid: 21 skills, 14 agents
EXIT=0
```
(2 non-blocking warnings pre-existing, unchanged by Phase 4: mugiwara-quality
"Order" and mugiwara-review "Red flags" sections at 15 content lines.)

Acceptance greps:
- `grep -cE 'Scope & Code Governor|scope-governor' content/skills/mugiwara-workflow/SKILL.md` → 3
- `grep -c '## Scope & Code Governor' docs/concepts/cost.md` → 1

Command: `bun run typecheck` → exit 0.

Gate-driven fix (in T2 scope): the first `bun run gate` rejected
`` `.mugiwara/.../decisions.md` `` in SKILL.md line 103 — `...` is not a declared
runtime path shape in `scripts/verify-install.ts`. Fixed to
`` `.mugiwara/missions/<mission>/decisions.md` `` (the accepted `<mission>`
placeholder shape) and amended into the T2 commit so each commit stays gate-green.

## T3 evidence

Command: `bun run gate` → exit 0 (green capture at 2026-08-29).

```
 Test Files  32 passed (32)
      Tests  566 passed (566)
✓ index budget: 4741/5500 chars
✓ content valid: 21 skills, 14 agents
Retrieval eval: 201/201 passed, rank-1 95.6%, top-3 100.0%, neg 100.0%, ns 100.0%
✓ verify-install: pointers resolve, prose paths valid, no new orphans
✓ 12 platforms pass conformance
coverage-gate: PASS
```

Gate pipeline (all pass): build-hooks:check, typecheck, test:coverage, build,
validate-content (manifest/docs/doc-integrity), lane-base, check-doc-links,
verify-pack, run-evals, retrieval-eval, verify-install, conformance, coverage-gate.
coverage-gate: `new>=90 modified>=80` — PASS (scope.ts 100% new; no modified
files below threshold).

## Pre-existing flake (not a Phase-4 regression) — reported, not waived

`test/enforcement.test.ts` — `guard: plan written + no planner dispatched → warns
(escape #2 closed)` fails intermittently. Observed during T3 gate runs; one green
full-gate capture achieved. The test spawns the BUILT `hooks/pipeline-guard.js`
in a fresh temp git repo and asserts the `Only Nami writes the plan` guard warning;
it imports no `src/` module and has no code path to any Phase-4 file. Reproduced
identically (`21 pass / 1 fail`) on the clean pre-Phase-4 base commit `3490284` in
an isolated git worktree — proving it is not introduced by Phase 4. Matches the
plan's risk-table row ("Pre-existing enforcement flake (escape #2) ... certain
(intermittent) ... tracked separate mission ... not a Phase-4 regression").
Deferred to the tracked escape#2 mission; not fixed here (out of Phase-4 scope).

# Verdict: done — all three Phase-4 tasks implemented, tested, and gated;
`bun run gate` exits 0. Known pre-existing enforcement escape#2 flake reported
(not a Phase-4 regression), tracked separately.
