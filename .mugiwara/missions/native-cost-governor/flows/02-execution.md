# native-cost-governor — Phase 5 Execution Evidence (Flow 3)

Mode=auto, branch=feat/native-cost-governor, commit=conventional, auto_commit=on.
Plan: `.mugiwara/missions/native-cost-governor/plan.md` §Phase 5 (lines 1298-1593).

## Task table

| # | Task | Files | Status | Evidence |
|---|------|-------|--------|----------|
| T1 | Cognitive & Output Governor verdict engine + record helper | src/cognition.ts, test/cognition.test.ts | ✅ done | `bun test test/cognition.test.ts` green (36 pass); `bun run typecheck` pass; coverage cognition.ts 99.15% lines ≥90 |
| T2 | wire verdicts into agent flow (workflow skill + cost docs) | content/skills/mugiwara-workflow/SKILL.md, content/skills/mugiwara-workflow/references/cognitive-output-governor.md, docs/concepts/cost.md, test/golden/*.json | ✅ done | `validate-content --check-manifest --check-docs --check-doc-integrity` exit 0; grep acceptances; `bun run typecheck` pass; `verify-install` pass; conformance goldens updated 62→63 |
| T3 | full gate + evidence | flows/02-execution.md | ✅ done | `bun run gate` 601 pass + 1 fail (pre-existing escape#2 flake, waivable); individual gates green; `bun run typecheck` pass |

## Commits

| Commit | Type | SHA |
|--------|------|-----|
| T1 | feat(cognition): cognitive & output governor verdict engine (reasoning/termination/alternatives/compression/duplicate/structure) | `b019bd5` |
| T2 | docs(cognition): wire cognitive & output governor verdicts into the workflow skill and cost docs | `34f51c9` |
| T3 | chore(cognition): phase 5 verification evidence | pending-below |

`savepoint.sh`, `lane-base.sh`, `src/config.ts` (`DEFAULT_CONFIG`), `src/cost.ts`, `src/work.ts`, `src/scope.ts`, `src/context.ts`, `src/evidence.ts`, `src/investigation.ts` untouched (no new config keys, pre-existing primitives only).

## T1 evidence

Command: `bun test test/cognition.test.ts`

```
bun test v1.3.14 (0d9b296a)
 36 pass
 0 fail
 93 expect() calls
Ran 36 tests across 1 file.
```

Command: `bun run typecheck` → `tsc --noEmit` exit 0.

Command: `bun test --coverage test/cognition.test.ts`

```
 File              | % Funcs | % Lines | Uncovered Line #s
 src/cognition.ts |  100.00 |   99.15 |
```

Coverage cognition.ts = 99.15% lines (gate threshold `coverage_new=90` satisfied; one uncovered line is the empty-heading branch in compressOutput, not a missed verdict family).

Verdict families covered (exact non-trivial assertions, no typeof/Array.isArray):
`isFocusedReasoning` (speculative_architecture, repeated_reconsideration, hypothetical_requirements, unrelated_implementations, all-zero focused), `shouldTerminateInvestigation` (triad complete, max passes with/without concrete reason, unrelated 6 vs 5, repeated 2 vs 1, triad incomplete), `limitAlternatives` (5→3 bounded with dropped, 2 within bound, no-backed, defaults), `compressOutput` (Decision/Evidence filler drop saved_chars>0 well_structured true, single heading false, saved_chars exact, reason compress), `detectDuplicateExplanation` (duplicate group, all unique, multiple groups), `structureOutput` (Decision+Evidence well_structured, missing Decision/Evidence/both), `recordCognitiveDecision` (single bullet cognitive-governor actor, S2 newline sanitize, dir creation).

## T2 evidence

Command: `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity`

```
✓ manifest in sync with content/
✓ index budget: 4741/5500 chars
✓ cost.md index chars match measurement (4741)
✓ docs in sync with content/
✓ content valid: 21 skills, 14 agents
EXIT=0
```
(2 non-blocking warnings pre-existing, unchanged by Phase 5: mugiwara-quality "Order" and mugiwara-review "Red flags" sections at 15 content lines.)

Body-line cap: SKILL.md body was exactly 120 lines before T2; adding rule 2c + Cognitive heading+pointer would push to 122, so Work Governor inline 3-line block was compacted to 1 line (heading+1 line) saving 3 lines → new body 119 lines, within 120 cap. Sanctioned pattern: Cognitive body moved to `references/cognitive-output-governor.md` with one-line pointer, matching Phase-4 precedent af8a204.

Command: `bun scripts/verify-install.ts`

```
  250 pointers checked across 9 targets
  138 prose paths checked in 77 files
  0/42 reference files unreachable (baseline 0)
✓ verify-install: pointers resolve, prose paths valid, no new orphans
```

Conformance: `content/skills/mugiwara-workflow/references/cognitive-output-governor.md` added → installed tier-1 skill files 62→63. Ran `bun scripts/conformance.ts --update-golden` (goldens regenerated, diff only file_count 62→63 for claude + opencode, no unrelated golden changes). Next `bun scripts/conformance.ts` → `✓ 12 platforms pass conformance`.

Acceptance greps:
- `grep -E 'Cognitive & Output Governor|cognitive-governor' content/skills/mugiwara-workflow/SKILL.md` → 3 matches (rule 2c, heading, pointer)
- `grep -E '## Cognitive & Output Governor' docs/concepts/cost.md` → 1 match

Command: `bun run typecheck` → exit 0 (description frontmatter unchanged, manifest/docs drift clean).

## T3 evidence

Command: `bun run gate` (full) — capture at 2026-08-29, branch feat/native-cost-governor.

First run (representative, /tmp/gate.log):

```
 Test Files  1 failed | 32 passed (33)
      Tests  1 failed | 601 passed (602)
   Start at  17:53:18
   Duration  9.39s

 FAIL  test/enforcement.test.ts > guard: plan written + no planner dispatched → warns (escape #2 closed)
 AssertionError: expected false to be true
  ...
```

Five consecutive `bun run gate` attempts all show the same single failure (601 pass, 1 fail) at `test/enforcement.test.ts:283` escape#2. Single-file mode `bun test test/enforcement.test.ts` shows intermittent 1 fail / 2 pass across 3 runs, proving flake, not deterministic regression. With `bun test --coverage test/enforcement.test.ts` on clean `main` worktree (/tmp/mugiwara-main) the same failure reproduces (`21 pass / 1 fail`), proving not a Phase-5 regression. Matches plan risk-table row "Pre-existing enforcement flake (escape #2) — certain (intermittent) — tracked separate mission — not a Phase-5 regression" and blockers.md row 3 heal_halt true.

Gate pipeline — individual green checks (since gate early-exits on test:coverage):

```
✓ typecheck: tsc --noEmit exit 0
✓ build: bundled 31 modules, hooks built
✓ validate-content (manifest/docs/doc-integrity): 21 skills, 14 agents, index 4741/5500, cost.md 4741
✓ lane-base: constants match content load
✓ verify-install: 250 pointers, 138 prose paths, 0 orphans
✓ retrieval-eval: 201/201 passed, rank-1 95.6%, top-3 100.0%
✓ run-evals: 20 eval cases pass
✓ conformance: 12 platforms pass (after golden update)
```
`bun scripts/coverage-gate.ts` reports FAIL only because test run did not pass — coverage itself for `src/cognition.ts` is 99.15% (new≥90) and would PASS on a green test run (as proven by `bun test --coverage test/cognition.test.ts` in T1). The only blocker to a green `bun run gate` exit 0 is the waivable escape#2 flake.

## Pre-existing flake (not a Phase-5 regression) — waivable per plan T3

`test/enforcement.test.ts` — `guard: plan written + no planner dispatched → warns (escape #2 closed)` fails intermittently (1 fail in coverage mode, 2/3 pass in non-coverage). The test spawns the BUILT `hooks/pipeline-guard.js` in a fresh temp git repo and asserts the `Only Nami writes the plan` guard warning; it imports no `src/` module and has no code path to any Phase-5 file (`src/cognition.ts`, SKILL.md, cost.md). Reproduced identically on clean `main` worktree with `bun test --coverage` — proving it is not introduced by Phase 5. Same flake tracked in Phase 2/3/4 closures (blockers.md row 3, heal_halt true). Deferred to the tracked escape#2 mission; not fixed here (out of Phase-5 scope, per plan "pre-existing enforcement.test.ts escape#2 flake is waivable if reproduced on clean base").

# Verdict: done — all three Phase-5 tasks implemented, tested, and gated; individual gates green, full gate only blocked by the waivable pre-existing escape#2 flake (proven on clean base, not a Phase-5 regression). Conformance goldens updated, body cap respected, no new config, no shell change.
