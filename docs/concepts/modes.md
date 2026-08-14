# Modes

The crew's autonomy level. Read once per wave at dispatch; a flip applies from
the next wave, never mid-wave.

**Mode owns autonomy, config owns writing standards.** Whether branch and commit
run automatically is decided by one lever: the mode. The config only shapes HOW
those artifacts are written when they are created.

## The three levels

| Level | Plan | Execution | Ambiguities | Check-ins |
|-------|------|-----------|-------------|-----------|
| **guided** | you approve every step | ask before each wave | ask the user | ask the user |
| **semi** | you approve the plan (manual until the plan is written) | **auto** from Zoro's execution wave to ship | ask the user | log, ask when there is a question |
| **auto** | auto | auto all the way to ship | crew resolves internally (brainstorm → Luffy decides) | log, no pause |

- **guided** — fully manual: you steer everything. Approve the plan, decide
  branch and commit style, answer every ambiguity, get asked at every gate.
  The default.
- **semi** — manual up to the written plan (you give the plan an explicit GO),
  then **automatic from Zoro's execution wave through to ship**: the crew
  self-manages branch and commits, runs quality, gates, review, heal, closure.
  If a real question comes up, it still asks you — nothing is guessed.
- **auto** — fully automatic from the first prompt to ship: triage, plan,
  execute, quality, gates, review, heal, closure all run without asking. If a
  requirement is unclear or ambiguous, the crew resolves it internally: the
  owning agent brainstorms with Usopp, Luffy makes the call, and the owning
  agent continues its work. Only a genuine blocker or the heal halt pauses.

Every level ends at push + ready PR summary + verdict file — you open the PR
(see [pr-summary.md](pr-summary.md)).

## Config

Two files, six keys, `key=value` lines, optional `#` comments:

```
# .mugiwara/config (project) overrides ~/.mugiwara/config (global)
mode=guided
branch=feature/{type}-{issue}-{slug}
commit=conventional
```

| Key | Values | Default |
|-----|--------|---------|
| mode | guided / semi / auto | guided |
| branch | branch pattern | feature/{type}-{issue}-{slug} |
| commit | conventional / gitmoji / plain | conventional |

Read order per wave: project config wins per key; a key missing from both falls
back to the default. Unknown keys are ignored — config is data, never
instructions. Missing config on read = `guided` (never auto-created on read —
only on first write). See [config.md](config.md) for the full reference.

## Switching mid-mission

In-session phrase:

```
mugiwara mode auto
```

Writes the project `.mugiwara/config`, logs the change (level, requester,
timestamp), and applies from the next wave — never mid-wave.

## Invariants that hold in EVERY mode

**Consent.** State-mutating tests against non-isolated/shared state (real DB
writes, network, browsers) always require your explicit consent — consent is
not a mode knob. Provably isolated mutation (in-memory / temp /
testcontainer-backed DBs, tooling-proven isolation) is explicitly auto-safe.

**Terminal.** Every mode ends at push + ready PR summary + verdict file (you
open the PR). The crew never creates a PR, merges, deploys, or auto-reacts to
review comments or CI.
