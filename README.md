# Mugiwara

[![npm version](https://img.shields.io/npm/v/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara) [![License: MIT](https://img.shields.io/github/license/ionivetech/mugiwara)](https://github.com/ionivetech/mugiwara/blob/main/LICENSE)

**Your AI agent already writes the code. Mugiwara makes it reviewable.**

Mugiwara wraps your agent in named roles that leave evidence at every gate.
The typo is free. The auth migration gets nine stages.

![Mugiwara banner](assets/banner.png)

## The problem

An AI agent can write 400 lines in five minutes and say tests pass.
Nothing remains to open, read, or attach to a PR.
Review becomes a formality, and a formality launders the change through a human name.
The risk is not slowness. The risk is a change nobody can reconstruct three weeks later when it breaks at midnight.

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

That file is the product. The branch holds the code, the report holds the reason every gate believed it.
A reviewer opens one page, sees the verdict, the evidence, and the single loose end with its name on it.

## The process fits the work

The lane is computed from git diff, never guessed, and it only ever rises.
A one-line fix never pays for a nine-stage pipeline. A payments migration never ships on a handshake.

| Your change | Lane | What runs |
|---|---|---|
| Typo, one file | Direct | nothing runs, the fix lands directly |
| Small bug | Lean | execute, then quality |
| Feature | Standard | plan, execute, audit, quality, review |
| Auth, payments, migrations | Full | all nine stages plus a security review |

Lanes protect both ends: small work stays fast, dangerous work cannot dodge scrutiny.
The routing decision is computed state, visible in `mugiwara status`, not a vibe the agent reports about itself.

## Install

One crew, ten doors. Pick your harness, follow its page, end at the same roster question as proof.

| Harness | How the crew loads | Install page |
|---|---|---|
| Claude Code | native plugin plus session hook | [claude](docs/install/claude.md) |
| opencode | plugin line in `opencode.json`, restart | [opencode](docs/install/opencode.md) |
| CLI copy | installer copies rules into Windsurf, Cline, or Kilo dirs | [cli](docs/install/cli.md) |
| Codex | full bodies as rules under `.codex/mugiwara/` | [codex](docs/install/codex.md) |
| Gemini CLI | full bodies as rules under `.gemini/mugiwara/` | [gemini](docs/install/gemini.md) |
| Copilot | full bodies as rules under `.github/` | [copilot](docs/install/copilot.md) |
| Antigravity | stub pointers under `.agents/`, bodies in `.mugiwara/refs/` | [antigravity](docs/install/antigravity.md) |
| Pi | host marketplace manifest plus content pointers | [pi](docs/install/pi.md) |
| Cursor | host marketplace manifest plus content pointers | [cursor](docs/install/cursor.md) |
| Kimi Code | host marketplace manifest plus content pointers | [kimi](docs/install/kimi.md) |

Every target needs Node.js 20.11 or newer for the CLI state commands.
Without the CLI the crew still runs the pipeline, but resume, budget tracking, and the closure gate stay off, and the crew says so at Flow 0.

## First run in 60 seconds

```bash
npx @ionivetech/mugiwara@latest install --target claude --yes
mugiwara --version
```

```text
-> Claude Code (project)
   written 111, skipped 0, backed up 0
   [...]
OK mugiwara 0.9.2 installed (manifest: .mugiwara/manifest.json)
mugiwara 0.9.2
```

*Output trimmed to the anchor lines; the full run adds a config note and a hooks note.*

Then ask for something real:

```
> move auth to short-lived tokens
> add pagination to the users endpoint
> fix the typo in the header comment
```

You choose none of the routing. The first request lands in triage, the lane is computed from the diff, and the crew announces the plan before it touches code.
Sixty seconds in, your skepticism has something concrete to bite: a manifest on disk, a version string, a plan with named owners.

## What Mugiwara does

- Lane sizing: the process scales to the diff, computed from git diff, and `mugiwara status` prints the lane with blockers and token budget on demand.
- Evidence gates: a stage passes only when its check ran, and `mugiwara continue <mission>` prints the exact resume point instead of restarting.
- Team split: one shared plan, per-person state files, conflicts flagged before merge, solo state migrates with `mugiwara migrate --to-team`.
- Cost ledger: every mission reports tokens against budget, and `mugiwara cost --ledger` shows spend, avoided work, and the trail in human plus JSON form.
- Twelve platforms: the same 21 skills and 14 agents on Claude Code, opencode, Copilot, Gemini, and more, with 318 of 318 reference pointers resolving across 9 targets in CI.

Full index: [Every feature](docs/concepts/features.md).

## When not to use Mugiwara

- Throwaway prototype deleted tonight: the trail outlives the code, so skip the crew.
- Nobody watching chat for hours: the crew runs inline, where you can interrupt it, and unattended marathons fit a subagent harness better.
- No reviewer, no PR, no future reader: with no audience, the trail is overhead, and overhead without a reader is waste.
- Your team already trusts raw agent chat for sensitive paths: Mugiwara slows those paths on purpose, and that trade is the whole point.

Mugiwara is for teams who review. If nobody reads the report, install nothing.

## What is measured, and what is not

| Claim | Status |
|---|---|
| Retrieval routing rank-1 | 95.9 percent, 216 probes (170 positive, 82 negative, 293 terms), in CI |
| Reference pointers resolve | 318 of 318 across 9 targets, in CI |
| Skill index cover | 21 skills indexed, in CI |
| Outcome vs other approaches | not measured |

Numbers here come from `.metrics/latest.json`, refreshed by `bun run gate`. Nothing in this table is an estimate, and the last row stays empty until a comparison study exists.

## Docs

Start: [Getting started](docs/getting-started.md). How work runs: [Workflow](docs/concepts/workflow.md), [Lanes](docs/concepts/lanes.md), [Modes](docs/concepts/modes.md), [Cost](docs/concepts/cost.md). Who does what: [Agents](docs/concepts/agents.md). Setup: [Install](docs/install/index.md). Team runs: [Solo](docs/runbooks/solo-mission.md), [Team](docs/runbooks/team-mission.md). Proof: [Harness matrix](docs/reference/harness-matrix.md), [Compliance matrix](docs/reference/compliance-matrix.md). Stuck: [Troubleshooting](docs/runbooks/troubleshooting.md). Issues: [tracker](https://github.com/ionivetech/mugiwara/issues).

MIT. See LICENSE.

## Start here

Run the 60-second install above, then open [Getting started](docs/getting-started.md) and hand the crew one real task.
