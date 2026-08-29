# PR: Cost governor extension — adaptive execution foundation + docs

**Branch:** `feat/cost-governor-extension` (17 commits, base `main` @ `81a333e`)

## Title

Adaptive execution foundation, live slop governor, resume fast-path, docs refresh

## Summary

First slice of the Mugiwara adaptive-execution plan. Makes the Cost Governor
first-class and fast: live stop-slop with per-crew attribution, a deterministic
execution-posture matrix, read-only resume commands, and a full docs refresh.
Backward-compatible — no state-schema change; existing missions default to
inline.

## What changed

- **Resume fast-path (§10)** — `continue`/`status` dispatch before config
  bootstrap; no `.mugiwara/config` created by read-only commands; exit 2 lists
  missions/members immediately.
- **Stop-Slop live wiring (§3.3)** — `computeLiveSlop()` runs existing detectors
  over mission state; `mugiwara cost` + report show slop per crew member
  (healing→Brook, context→all).
- **Adaptive execution (Phases A–E)** — three independent decisions (control
  mode / execution posture / Cost Governor); `src/posture.ts` deterministic
  `selectPosture()` (reason + evidence refs, never opaque score); boundary-based
  posture switching; adaptation report section; posture evals (positive +
  forbidden transitions); 12-platform conformance green. Conservative: inline
  stays default.
- **De-brand** — removed all `ponytail`/`caveman` references (8 files), kept the
  compression/minimal-code capability.
- **Config** — `coverage_new=85` / `coverage_modified=90` defaults; `sign`
  attestation key (renamed from `sign_backend`); documented `investigation_*`
  keys.
- **Docs** — newcomer-first README rewrite; full docs audit (phantom
  `archive --merge` removed, lane token counts synced to actual LANE_BASE,
  `sign`/`enforce`/`investigation_*` documented, signed-attestation corrected).

## Per-flow-stage evidence

| Stage | Evidence |
|---|---|
| §10 resume fast-path | `src/cli.ts` hoist; `test/cli.test.ts` read-only tests (3af8e8d) |
| Phase A de-brand + contract | grep-clean `caveman|ponytail`; execution-model.md three-decision model (08beb12) |
| Slop live wiring | `mugiwara cost` → `Slop: 1 — Brook:1`; 4 fixtures (d76c012) |
| Phase B posture matrix | `src/posture.ts` 8 branches + reason; 8 unit tests (5c3ce14) |
| Phase C boundary switching | execution SKILL posture-switch + halt contract (3897f97) |
| Phase D team | multi-actor ownership/interface decls + handoff (ce2b004) |
| Phase E report + eval | adaptation section; posture evals; conformance goldens (1279c0e, 67efc79) |
| Docs + config | README rewrite; coverage/sign/investigation config (70c626f, 4d7470b, 115cd9c) |

## Tests

- `bun run gate` **PASS** (typecheck, 774 tests, build, validate-content,
  lane-base, check-doc-links, run-evals 60, retrieval rank-1 95.9%, benchmark,
  verify-install, 12-platform conformance, coverage-gate).
- cli.ts coverage 91.39% (≥90), slop 95.14%, reporting 96.62%, mission 94.79%.

## Checks

- De-brand: `grep -ril "caveman\|ponytail"` clean.
- Backward-compatible: no state-schema change; old missions default inline.

## Verdict

**GO** (see `flows/06-closure.md`). Backward-compatible, all gates green, one
documented default change (coverage_modified 80→90) tracked.
