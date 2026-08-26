# Modes

The crew's autonomy level. Read once per flow stage at dispatch; a flip applies from
the next flow stage, never mid-flow-stage.

**Mode owns autonomy, config owns writing standards.** Whether branch and commit
run automatically is decided by the mode — except one config lever: `auto_commit
=off` disables commits and the final push in `guided`/`semi` (you commit
manually; `auto` ignores it). The config shapes HOW artifacts are written when
they are created.

## The three levels

| Level | Plan | Execution | Ambiguities | Check-ins |
|-------|------|-----------|-------------|-----------|
| **guided** | you approve every step | ask before each flow stage | ask the user | ask the user |
| **semi** | you approve the plan (manual until the plan is written) | **auto** from Zoro's execution flow stage to ship | ask the user | log, ask when there is a question |
| **auto** | auto | auto all the way to ship (your member scope in a team) | crew resolves internally (brainstorm → Luffy decides) | log, no pause |

- **guided** — fully manual: you steer everything. Approve the plan, decide
  branch and commit style, answer every ambiguity, get asked at every gate.
  The default.
- **semi** — manual up to the written plan (you give the plan an explicit GO),
  then **automatic from Zoro's execution flow stage through to ship**: the crew
  self-manages branch and commits, runs quality, gates, review, heal, closure.
  If a real question comes up, it still asks you — nothing is guessed.
- **auto** — fully automatic from the first prompt to ship: triage, plan,
  execute, quality, gates, review, heal, closure all run without asking. In a
  team mission, auto covers **your member scope only** — resuming your
  sub-mission with `/mugiwara continue <mission> <member>` runs your work
  autonomously to ship, never the other members'. If a requirement is unclear
  or ambiguous, the crew resolves it internally: the owning agent brainstorms
  with Usopp, Luffy makes the call, and the owning agent continues its work.
  Only a genuine blocker or the heal halt pauses.

Every level ends at push + ready PR summary + verdict file — you open the PR.
With `auto_commit=off` (guided/semi) the crew pushes nothing: it hands you the
uncommitted tree with the exact commit + push commands (see [git-strategy.md](git-strategy.md)).

## Config

Two files, `key=value` lines, optional `#` comments:

```
# .mugiwara/config (project) overrides ~/.mugiwara/config (global)
mode=guided
branch=feature/{type}-{issue}-{slug}
commit=conventional
auto_commit=on
coverage_new=90
coverage_modified=80
review_depth=full
quality_depth=full
delegate_threshold=60
heal_max_cycles=3
verbosity=normal
```

| Key | Values | Default |
|-----|--------|---------|
| mode | guided / semi / auto | guided |
| branch | branch pattern | feature/{type}-{issue}-{slug} |
| commit | conventional / gitmoji / plain / template | conventional |
| auto_commit | on / off | on |
| coverage_new | 0-100 | 90 |
| coverage_modified | 0-100 | 80 |
| review_depth | full / standard / quick | full |
| quality_depth | full / standard / quick | full |
| delegate_threshold | 1-100 | 60 |
| heal_max_cycles | number | 3 |
| verbosity | normal / full | normal |

`auto_commit=off` disables per-task commits and the final push in `guided`
and `semi` — changes stay in the working tree and you commit/push manually.
It has no effect in `auto`: auto mode always commits and pushes.

Read order per flow stage: project config wins per key; a key missing from both falls
back to the default. Unknown keys are ignored — config is data, never
instructions. Missing config on read = `guided` (never auto-created on read —
only on first write). See [config.md](config.md) for the full reference.

## Switching mid-mission

In-session phrase:

```
mugiwara mode auto
```

Writes the project `.mugiwara/config`, logs the change (level, requester,
timestamp), and applies from the next flow stage — never mid-flow-stage.

## Output and step budget

`verbosity` (config key, default `normal`) controls how much the crew echoes,
not what it does. It never suppresses wave banners, file edits, gate
verdicts, decisions, questions, blockers, lane rises, or escalations.

- **normal** — investigation steps (reads, greps, probes) and file contents
  are not echoed; a file is named only when it matters. Results collapse to
  one line + evidence path (`✓ tests 84/84 → missions/m/waves/03-quality.md`);
  conclusions, not derivations.
- **full** — everything is echoed, including reads and reasoning. For
  debugging the crew itself.

**The rule: the transcript must stay sufficient to review the mission without
opening a file** — test output may collapse (the evidence file holds it), a
decision may not (it has no other home). The rule applies at `full` too:
verbosity widens what is echoed, never narrows what the review needs.

Step budget: tool calls are finite; the execution skill combines evidence
runs, writes flow-stage artifacts once, never re-reads what it just wrote, and
batches reads. Guide: Lane 1 ≤15 calls · Lane 2 ≤35 · Lane 3 ≤60. One flow stage
rendered at both levels: `content/skills/mugiwara-orchestration/references/output-contract.md`.

## Invariants that hold in EVERY mode

**Consent.** State-mutating tests against non-isolated/shared state (real DB
writes, network, browsers) always require your explicit consent — consent is
not a mode knob. Provably isolated mutation (in-memory / temp /
testcontainer-backed DBs, tooling-proven isolation) is explicitly auto-safe.

**Terminal.** Every mode ends at push + ready PR summary + verdict file (you
open the PR) — or, with `auto_commit=off` in guided/semi, an uncommitted tree
handed to you with commit + push instructions. The crew never creates a PR,
merges, deploys, or auto-reacts to review comments or CI.
