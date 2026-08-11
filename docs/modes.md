# Modes

The crew's autonomy level. Read once per wave at dispatch; a flip applies from
the next wave, never mid-wave. Single source of truth: the `mugiwara-mode`
skill.

**Mode owns autonomy, config owns writing standards.** Whether branch, commit,
and PR run automatically is decided by one lever: the mode. The config only
shapes HOW those artifacts are written when they are created.

## The three levels

| Level | Plan GO | Branch/commit | PR | Ambiguities | Check-ins |
|-------|---------|---------------|----|-------------|-----------|
| **guided** | ask the user | ask the user | ask (you open the PR) | ask the user | ask the user |
| **semi** | present plan for user GO | auto | ask (you open the PR) | self-answer + log | log, no pause |
| **auto** | gated auto-GO | auto | auto-create (per `mugiwara-pr`) | self-answer + log | log, no pause |

- **guided** — you steer everything: approve the plan, decide branch and
  commit style, answer every ambiguity, get asked at every gate. You also open
  the PR. The default.
- **semi** — the crew self-manages branch, commits, and ambiguities (logging
  each decision), but you still give the plan an explicit GO and open the PR.
- **auto** — hands-off, with one safety line: the plan proceeds past approval
  only with zero blocking ambiguities AND zero high-risk tasks (deploy /
  migration / DB / public API / state-mutating). The PR is auto-created at the
  terminal (forge-detect → `gh`/`glab`/Bitbucket REST → URL fallback).

## Config

Two files, six keys, `key=value` lines, optional `#` comments:

```
# .mugiwara/config (project) overrides ~/.mugiwara/config (global)
mode=guided
branch=feature/{type}-{issue}-{slug}
commit=conventional
base=main
pr-title={type}: {summary}
pr-template=.mugiwara/pr-template.md
```

| Key | Values | Default |
|-----|--------|---------|
| mode | guided / semi / auto | guided |
| branch | branch pattern | feature/{type}-{issue}-{slug} |
| commit | conventional / gitmoji / plain | conventional |
| base | branch name | main |
| pr-title | title template | {type}: {summary} |
| pr-template | file path | (none) |

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

**Terminal.** guided/semi end at push + ready PR + verdict file (you open the
PR); auto ends at an auto-created PR (per `mugiwara-pr`). No mode merges,
deploys, or auto-reacts to review comments or CI.
