# Triage & Escalation — full reference

Full classifier, lane routing, precedence, pressure rationalizations, auto
ceiling, escalation owners, and heal bounds. The SKILL.md body carries one-line
pointers; this file is the detail.

## Request classifier (Wave 0) — 8 classes

Classify EVERY incoming request. Record decision + one-line reason at the top
of the decision log. Any route without a recorded reason is a red flag.

| Class | Signal | Route |
|-------|--------|-------|
| Trivial | one obvious small change, no ambiguity, single file | Wave 2 directly |
| Explicit | clear requirements, written spec or reference exists | Wave 2 directly |
| Exploratory | needs direction, options, or research before planning | Wave 1 first |
| Open-ended | broad goal, undefined scope or success criteria | Wave 1 first |
| Ambiguous | requirements, APIs, or scope unclear | Wave 1 first |
| **Answer** | question, explanation, code reading — no file change | **Answer directly. No mission, no workspace, no banner.** |
| **Refuse** | deploy, prod migration, key rotation, merge | **Decline at Wave 0, state why, offer the branch-handoff path.** |
| **Hotfix** | production broken | Lane 1, gates deferred with an owner, never skipped |

Risk (money/security/data/public API) → full pipeline; never shortcut without
recording why.

## Precedence — class first, lane second

The classifier and lane routing decide different things. Written explicitly:

> **Class decides whether there is work. Lane decides how much process the work
> gets.** Class first, lane second. Record both in the decision log.

When they seem to disagree (e.g. Trivial class vs Lane 0 skip), resolve by the
rule above: class says "work exists", lane says "how much ceremony". A Trivial
class on a Lane 3-sensitive path still runs the pipeline (sensitive paths
override class route — see lane escalation).

## Explicit class still sizes the lane

A pasted spec routes to Wave 2 (Explicit) — but planning is NOT skipped on
faith. Before routing to Wave 2, size the lane from the spec's file list: count
the files the spec implies. A 40-file spec sizes to Lane 3 even though the class
is Explicit. A 2-file spec stays Lane 1. Never let a spec's existence substitute
for sizing its size.

## Lane routing (Wave 0, size before process)

| Lane | Runs | Size signal |
|------|------|-------------|
| 0 Direct | skips pipeline | 1 file <20 LOC |
| 1 Lean | execute → quality | 1-2 files |
| 2 Standard | plan → execute → checkpoint → review | 3-8 files |
| 3 Full | all 9 waves | 9+ files or auth/payment/migration paths |
| 4 Spike | brainstorm then re-sizes | exploratory |

Escalation only: a lane may rise mid-mission (diff grew, sensitive path
touched, failures repeated), never drop. Record the chosen lane and its signal
in the decision log.

## Rationalizations (pressure resistance)

Moved to the SKILL.md body — pressure resistance must fire mid-argument, before
the agent opens a reference. See `## Rationalizations (pressure resistance)`
in `SKILL.md`.

## Auto mode ceiling

`auto` never covers: the lane ROSE to 3 mid-mission (`lane_rose` in
`state.json`), a sensitive path touched (auth/payment/billing/crypto/secrets/
migration — see `scripts/lane.sh`), or heal cycles exceeding one. On any of
those, auto drops to guided — announce the drop and ask.

Sized at 3 at triage is NOT a drop: a mission that starts full (9+ files, no
sensitive path) stays auto. Escalation and sensitivity are the triggers, not
the lane number itself. `auto` on an auth change still drops — sensitivity
overrides the lane number.

## Lane-escalation owner (who checks, when)

A lane may rise mid-mission (diff grew, sensitive path touched, failures
repeated). The owner is Luffy, at every per-wave check-in:

1. Re-run `scripts/lane.sh` at each wave boundary.
2. If the lane rose → announce the escalation, record the trigger in the
   decision log, and re-plan the remaining waves (through Nami) to match.
3. `savepoint.sh` writes `lane` each wave — compare against the previous value
   and flag a rise (see state fields).

Nobody else owns this. Chopper audits what was done, not what lane should have
been; Luffy owns the lane decision.

## Heal bound — halt, not a red flag

Read `heal_cycle` from `.mugiwara/state.json` (written by savepoint.sh). At 3,
STOP and escalate to the user with full history. This is a halt, not a red
flag: red flags are prose, a counter is state. Nothing re-runs Wave 8 past 3
cycles.
