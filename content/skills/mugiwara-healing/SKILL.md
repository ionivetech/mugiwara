---
name: mugiwara-healing
description: Use when an execution flow stage failed, earlier flow stages produced failures, broken things to fix — reads blocker ledger, stop-the-line triage, root-cause fixes, prove-it before fixing. Max 3 cycles.
gate_artifact: flows/05-healing.md — root-cause + guard test evidence
---

# Healing (Brook)

## Skip when

- No failures recorded: blocker ledger empty, all gates and reviews passed.
- User explicitly accepts a failure as-is and recorded the decision.
- Failure reproduces only outside a clean checkout — proven `env`, not code.

Fix what failed, minimally, and prove it. One clean retry per cycle; `heal_halt` at 3.

## Read the ledger first

Inputs: `.mugiwara/missions/<mission>/blockers.md` rows + quality report, gate verdict, review findings, security report. Every row is one healing unit; rows are appended by any agent that hit a blocker — never skip a row. Row fields: flow stage, task, symptom, attempted, help-needed. Full taxonomy: `references/failure-taxonomy.md`.

## Stop-the-line triage (per failure)

1. PRESERVE evidence — save the failing output/state verbatim before touching anything.
2. Reproduce — re-run the failure; confirm it is real and current.
3. Localize — layer map (config/test/code/env); `git bisect` when the regression window is unclear.
4. Reduce — shrink to the minimal case that still fails.
5. Diagnose before touching code — read the full error (line, file, code), ask what changed recently (`git diff`, new deps, config), chase the bad value upstream to its origin. Grep every caller before patching — a fix aimed only at the visible symptom leaves its siblings broken.

Never push past a failing test — a red test stops the line until green or escalated.

## Root-cause, not symptom

Fix at the shared function, not the caller that surfaced. One fix = smallest diff resolving the finding. No drive-by refactors. Test one theory at a time: state it, try the smallest change that could confirm it, check. A failed theory → a new one; never pile a second fix on top of the first.

## Prove-It (red → green)

Before fixing a bug: write the failing test that reproduces it, watch it fail, then fix until green. Red → code → green, in that order. A fix with no reproducing test is unproven. Every code fix ships with the failed check now passing — run it, capture output.

## Two-or-three-signal foundation check

Two or three different fixes that each uncover a fresh dependency elsewhere = symptom-patching. Stop, lay out the pattern to Luffy and the human, argue about the architecture before attempting another fix.

## Triage matrix

Full taxonomy: `references/failure-taxonomy.md`.

| Failure | Action |
|---------|--------|
| lint/format error | auto-fix (formatter when supported), re-run |
| type error / simple test fail | minimal diff at ROOT CAUSE — grep all callers before patching; never fix only the symptom path |
| flaky / env failure | mark `env`, do not patch code, note for rerun |
| blocker security/review finding | smallest safe diff; add or extend the test that catches it |
| architectural finding / high-risk change | DO NOT auto-fix — prepare fix/rollback plan, escalate to Luffy → human |

Env rule: `env` must reproduce on a clean checkout in the same environment, or fail only on one OS/CI. "Probably env" is not proof — it stays a code failure until proven otherwise.

## Cycle counter (`heal_halt`)

Read `heal_halt` from `.mugiwara/missions/<mission>/state.json | <member>.json` — savepoint writes it as `heal_cycle ≥ heal_max_cycles`, config default 3. After this flow stage, flow returns to Flow 4 (Chopper) for re-audit. **When `heal_halt` reads `true`, STOP and escalate to the user with full history — a halt, not a red flag.** Red flags are prose; the counter is state. Never re-run past `heal_max_cycles`.

## Worker subagents

Brook runs inline for triage + ledger reading; parallel fixes use disposable WORKER subagents. Full protocol: `references/workers.md` — heal-worker grouping (independent rows in parallel), 5-field worker prompt, validation workers (reviewer/security/re-run), then back to Flow 4. Workers are NOT crew members.

## Output

Write `.mugiwara/missions/<mission>/flows/05-healing.md`: fixed list (finding → commit → evidence), escalated list (finding → plan → owner), updated ledger. After healing: update the ledger — mark each healed row with evidence; keep unfixed rows for escalation. Then back to Flow 4 (Chopper) for re-audit.

## Red flags

- Patching the symptom path instead of the root cause (fix at the shared function, not the one caller that surfaced).
- A fix shipped without a reproducing test (Prove-It skipped).
- A test or config deleted or weakened to silence a failure.
- A drive-by refactor riding along with a fix.
- A code failure marked `env` without clean-checkout proof.
- A ledger row processed with no evidence recorded.
- The same failure healing past 3 cycles without escalation.
- Several failed fixes on one failure without taking the architecture question to Luffy.

All mean: the fix is not real. Stop, find the root cause, or escalate with full history.
