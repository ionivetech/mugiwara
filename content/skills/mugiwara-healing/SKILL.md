---
name: mugiwara-healing
description: Use when an execution flow stage failed, earlier flow stages left failures, blockers in the ledger need fixing, or a bug or crash recurs intermittently: debug, root cause, reproduce-localize-reduce-guard, prove it first.
gate_artifact: flows/05-healing.md — root-cause + guard test evidence
---

# Healing (Brook)

## Skip when
- No failures recorded: the blocker ledger is empty and all gates and reviews passed.
- The user accepted a failure as-is and the decision is recorded.
- The failure reproduces only outside a clean checkout: proven `env`, not code.

Fix what failed, minimally, and prove it. Stage number and owner: stage table (`mugiwara-orchestration`, stages.md), which also defines the fix-loop cap `heal_max_cycles` and the per-row attempt limit.

## Read the ledger first
Inputs: `.mugiwara/missions/<mission>/blockers.md` rows plus the quality report, gate verdict, review findings, and security report. Every row is one healing unit; never skip one. Row format and categories: `references/failure-taxonomy.md`.

## Stop-the-line triage (per failure)
Every fix follows `reproduce → localize → reduce → guard`; the guard step is the Prove-It test.
1. Preserve evidence: save the failing output and state verbatim before touching anything.
2. Reproduce: re-run the failure and confirm it is real and current.
3. Localize: map the layer (config, test, code, env); `git bisect` when the regression window is unclear.
4. Reduce: shrink to the minimal case that still fails.
5. Diagnose before editing: read the full error, ask what changed recently (`git diff`, new dependencies, config), chase the bad value to its origin. Grep every caller before patching; a fix aimed only at the visible symptom leaves its siblings broken.

Never push past a failing test: a red test stops the line until it is green or escalated.

## Root cause, not symptom
Fix at the shared function, not the caller that surfaced. One fix is the smallest diff that resolves the finding; no drive-by refactors. Test one theory at a time: state it, try the smallest change that could confirm it, check. A failed theory gets a new theory, never a second fix piled on the first.

## Prove-It (red, then green)
Before fixing a bug, write the failing test that reproduces it and watch it fail; then fix until green. A fix with no reproducing test is unproven. Run the originally failed check and capture its passing output.

## Foundation check
Two or three different fixes that each uncover a fresh dependency elsewhere mean symptom-patching. Stop, lay the pattern out to Luffy and the user, and settle the architecture question before another fix.

## Triage matrix
| Failure | Action |
|---------|--------|
| lint or format error | auto-fix with the formatter where supported, re-run |
| type error or simple test failure | minimal diff at the root cause; grep all callers first |
| flaky | 3-run rule per `mugiwara-checkpoint`: mixed results are quarantined with an owner, never a pass, never a code patch |
| env (proven) | mark `env`, do not patch code, note for re-run |
| blocking security or review finding | smallest safe diff; add or extend the test that catches it |
| architectural finding or high-risk change | do not auto-fix; prepare a fix and rollback plan, escalate to Luffy and the user |

`env` must reproduce on a clean checkout in the same environment, or fail only on one OS or CI. "Probably env" stays a code failure until proven.

## Fix-loop counter
Read `heal_halt` from `.mugiwara/missions/<mission>/state.json | <member>.json`. Savepoint sets it when `heal_cycle` reaches `heal_max_cycles`. When it reads `true`, STOP and escalate to the user with the full history, in the stop-handoff shape of `_shared/references/cost-governor.md` (facts, dead ends, next step and owner). A halt is state, not a red flag. Never start a round past `heal_max_cycles`. A single row gets at most 2 attempts, then it escalates (finding, plan, owner) while the other rows continue. After this stage the work returns to Chopper for a re-check.

## Root-cause hunt
For a bug with an unknown cause or an intermittent failure, walk the four phases (reproduce, localize, reduce, fix and guard) before any fix: `references/root-cause.md`.

## Worker subagents
Brook runs inline for triage and ledger reading; parallel fixes use disposable workers. Validation workers are off by default: Chopper re-runs the checks and Robin and Jinbe review the same diff next, so a worker here pays about 132k tokens for a verdict the next two stages produce. Dispatch one only on its trigger: a sensitive path (security worker), or a second attempt on the same row (reviewer worker). Log the decision either way. Protocol: `references/workers.md`. Workers are not crew members.

## Output
Write `.mugiwara/missions/<mission>/flows/05-healing.md`: fixed list (finding, commit, evidence), escalated list (finding, plan, owner), updated ledger. Mark each healed row with its evidence and keep unfixed rows for escalation. Recommend Chopper for the re-check; Luffy decides. Log each round in `decisions.md` under the heading `## Flow 8 — healing`; savepoint counts those headings.

## Red flags
- A stage closed without its one-line summary, or padded with prose.
- The symptom patched instead of the root cause.
- A fix shipped without a reproducing test.
- A test or config deleted or weakened to silence a failure.
- A drive-by refactor riding along with a fix.
- A code failure marked `env` without clean-checkout proof.
- A ledger row processed with no evidence recorded.
- The same failure fixed past `heal_max_cycles` without escalation.
- Several failed fixes on one failure without taking the architecture question to Luffy.

All mean: the fix is not real. Stop, find the root cause, or escalate with the full history.
