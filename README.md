# Mugiwara

[![npm version](https://img.shields.io/npm/v/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara) [![License: MIT](https://img.shields.io/github/license/ionivetech/mugiwara)](https://github.com/ionivetech/mugiwara/blob/main/LICENSE)

**Your AI agent already writes the code. Mugiwara makes it reviewable.**

Mugiwara wraps your agent in named roles that leave evidence at every gate.
The typo is free. The auth migration gets nine stages.

## The problem

An AI agent can write 400 lines in five minutes and say tests pass.
Nothing remains to open, read, or attach to a PR.
Review becomes a formality, and a formality launders the change through a human name.

## What you get back

Every mission closes with one file. Your reviewer reads this, not the chat log:

```markdown
# Mission: invitation-accepted-flow
2026-09-03, farid, branch feature/MKR-412, lane full, mode guided
Verdict: GO, all gates passed. 1 finding deferred with an owner.
Changed: 11 files, +340 / -82. Sensitive: src/auth/invitation.ts, migrations/004.sql
Gates: checkpoint PASS, quality PASS, coverage PASS (new 94 percent, modified 87 percent), security PASS (0 high)
Cost: 8,781 of 12,000 tokens (73 percent). 1 heal cycle.
Left unverified: mobile deep-link fallback on old clients.
```

*Sample built from test/fixtures/report-sample.md.*

## The process fits the work

The lane is computed from git diff, never guessed, and it only ever rises.

| Your change | Lane | What runs |
|---|---|---|
| Typo, one file | Direct | nothing runs, the fix lands directly |
| Small bug | Lean | execute, then quality |
| Feature | Standard | plan, execute, audit, quality, review |
| Auth, payments, migrations | Full | all nine stages plus a security review |

## First run in 60 seconds

```bash
npx @ionivetech/mugiwara@latest install --target claude --yes
mugiwara --version
```

```text
mugiwara 0.9.2
```

Then ask for something real:

```
> move auth to short-lived tokens
> add pagination to the users endpoint
> fix the typo in the header comment
```

You choose none of the routing. The lane is computed from the diff.

## What Mugiwara does

- Lane sizing: the process scales to the diff, computed from git diff, never guessed.
- Evidence gates: a stage passes only when its check ran, with the output attached.
- Team split: one shared plan, per-person state, conflicts flagged before merge.
- Resume: a dead session continues from the exact stage, never from zero.
- Twelve platforms: the same crew on Claude Code, opencode, Copilot, Gemini, and more.

Full index: [Every feature](docs/concepts/features.md).

## When not to use Mugiwara

- Throwaway prototype deleted tonight: the trail outlives the code, so skip the crew.
- Nobody watching chat for hours: the crew runs inline, where you can interrupt it.
- No reviewer, no PR, no future reader: with no audience, the trail is overhead.

## What is measured, and what is not

| Claim | Status |
|---|---|
| Retrieval routing rank-1 | 95.9 percent, 216 probes, offline, in CI |
| Reference pointers resolve | 318 of 318 across 9 targets, in CI |
| Lane constants match content load | verified, in CI |
| Outcome vs other approaches | not measured |

Numbers here come from bun run gate. Nothing in this table is an estimate.

## Docs

Start: [Getting started](docs/getting-started.md). How work runs: [Workflow](docs/concepts/workflow.md), [Lanes](docs/concepts/lanes.md), [Modes](docs/concepts/modes.md), [Cost](docs/concepts/cost.md). Who does what: [Agents](docs/concepts/agents.md). Setup: [Install](docs/install/index.md). Team runs: [Solo](docs/runbooks/solo-mission.md), [Team](docs/runbooks/team-mission.md). Proof: [Harness matrix](docs/reference/harness-matrix.md), [Compliance matrix](docs/reference/compliance-matrix.md). Stuck: [Troubleshooting](docs/runbooks/troubleshooting.md).

MIT. See LICENSE.
