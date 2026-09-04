# PR verdict — enforcement-gaps

## Title

`fix: close 8 enforcement gaps (Flow 0 hole, terminal prohibition, 11 harnesses, visibility, hooks tests, invariant gate)`

## Summary

Invariants that existed only as prose on 1 of 12 harnesses now carry
mechanisms: Luffy entry protocol + gate, artifact-aware guard, PreToolUse
irreversible-command guard (claude + opencode), banner warnings, 18 hook
tests, opencode port with parity-tested shared predicates, and a
`--check-invariants` gate so the next `never` ships with a mechanism.

## What changed (11 commits, wave-tagged)

- `6d965bb` E1: `## Before you start` for luffy-orchestrator (+routing rule)
- `d546176` E2: entry-protocol gate covers all 14 agents
- `9820a56` E8: rule 8 points at the decision log
- `7be4b9f` E3: guard fires on artifact work (session-scoped, fail open)
- `304ed08` E4: `hooks/pretool-guard` + 3 registrations (13 deny / 8 allow)
- `1792f90` E4 docs: ship `## Never`, threat model, matrix row
- `f848ae0` E7: `test/hooks.test.ts` (15, zero overlap)
- `2220ba1` E6: banner warning (exit 0 always)
- `cf09b72` E5: opencode port (`src/guards.ts`, tool deny + idle warn)
- `23d01d6` 5.2: `enforcement.md` + `--check-invariants` (26 concepts)
- `1e363f4` 5.1: 6 selftest mutations (+2 fixes: `a0102eb` LOC,
  `4117321` guards unit tests, `a065cdf` symlink R1)
- post-closure: savepoint counts `flows/todos.md` mirror first (provenance
  read 0/N on finished missions) + mirror test + E7 mutation

## Per-flow-stage evidence

Flow 0 triage → Flow 2 plan → Flow 3 execution log
(`flows/01-execution.md`) → Flow 4 audit PASS (`flows/02-audit.md`) →
Flow 5 quality A, suite 864/864 (`flows/03-quality.md`) → Flow 6 gates
(`flows/04-gates.md`) → Flow 7 review B→A + security PASS
(`review.md`, `security.md`).

## Tests

- New: hooks 15 + guards 3 + plugin 5 E-cases. Full suite 864+3 green.
- `gate-selftest`: 111/111. Validator 4 flags, verify-install,
  doc-links, build-hooks:check, typecheck, build, conformance 12/12: green.
- Secrets scan: clean. `npm audit`: 0.

## Checks (honest reds)

1. `bun run test:coverage`: RED — pre-existing env (savepoint timeouts
   under instrumentation), proven on clean `main` worktree. No data faked;
   coverage rows UNKNOWN.
2. Diff size 1171 LOC vs ≤400 cap — single 11-commit PR recommended
   (each ≤288, independently reviewable); needs explicit waiver.

## Verdict

**GO (hand-over)** pending the two human decisions above. Crew does not
open the PR, merge, or deploy. Rollback: revert to any
`enforcement-gaps-waveN` tag or drop the branch.
