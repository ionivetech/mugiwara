# Spec bridge — seamless-pipeline (Flow 0 → Flow 2)

Lane 3 Explicit mission; Flow 1 skipped. This bridge carries the user's spec into Nami.

## Goal
Eliminate the fourth defect shape: instructions the model cannot follow and references to deleted or never-built things (N1–N9), and gate the three new questions so a fifth batch must be a genuinely new shape.

## Acceptance (from spec)
- N1 `mugiwara initiative conflict-check` runs, exits 1 on shared file; 7 initiative tests pass.
- N2 zero ANSI escapes in model-facing instructions; banner is a markdown heading.
- N3 `quick` accepted for both depth keys; `lean` aliases to it; `bogus` falls back to `full`.
- N4 a `mugiwara <cmd>` in prose with no CLI case fails the gate.
- N5 flow summary line specified; required in 7 skills' red flags.
- N6 enum values compared docs↔code in both directions.
- N7 `mugiwara lessons import` works idempotently, or the promise is removed (decision: see plan).
- N8 no `/mugiwara mode` slash form; both in-session phrases marked.
- N9 `--target cursor` names the marketplace path; README splits 9 + 3.
- One mutation per fix; each turns the selftest red.
- Full acceptance: `bun run gate && bun scripts/gate-selftest.ts && bun scripts/conformance.ts`, validate-content with all three checks, `bun test`.

## Constraints
- Work in numerical order (1.1 → 5.2); VERIFY after each task; STOP on VERIFY failure.
- FIND blocks are literal; absent FIND → STOP, do not guess.
- Do not refactor anything not named in the spec.
- Regression state listed in the spec must not be redone or broken.
- `verbosity=quiet` stays removed.
- Option choices: 1.1 Option A (restore command); 1.3 decision deferred to execution (default Option B unless shareable-lessons story proves needed — record choice in decisions before implementing).
