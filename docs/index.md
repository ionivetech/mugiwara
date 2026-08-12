# Mugiwara Docs

The Straw Hat crew of AI agents and skills. These docs cover what the crew is,
how to adopt it, and how each harness installs it. The crew is markdown plus a
small Node CLI (`mugiwara`) — no daemons, nothing to host. It ships **15
agents** and **32 skills**, and the workflow **auto-activates** at session
start — a non-trivial request runs the pipeline by itself, with
`/using-mugiwara` as an optional explicit router. Work is **sized to a lane**
before it runs: small fixes skip the pipeline, sensitive changes run the full
nine waves, and every wave passes only on **evidence**, never on a spoken
claim.

## Start here

| Doc | What it covers |
|-----|----------------|
| [Getting started](getting-started.md) | Install, first mission, what you see in the chat |
| [Adoption guide](reference/adoption-guide.md) | Pick the harness, pick the mode, fit the crew to your workflow |
| [Modes](concepts/modes.md) | guided / semi / auto — the autonomy levels, what each asks you |
| [Config](concepts/config.md) | Full reference for `.mugiwara/config` keys and commit styles |
| [Auto-PR](concepts/pr-summary.md) | What the crew hands off at closure: push + a ready-to-paste PR summary (it never creates a PR) |
| [The crew](concepts/agents.md) | All 14 agents and when to summon each |
| [The techniques](concepts/skills.md) | All 32 skills and what each enforces |
| [The wave pipeline](concepts/workflow.md) | How a mission flows Wave 0 → Wave 9 |
| [Execution model](concepts/execution-model.md) | Inline-by-default: why the crew runs in your main conversation |
| [Lanes & sizing](concepts/lanes.md) | How Luffy sizes work at triage: Lane 0–4, escalation, budget |
| [Enforcement](reference/enforcement.md) | Skip gates, evidence over claims, and capability tiers |
| [Git discipline](concepts/git-strategy.md) | Commits, branches, save-points — and why the executor commits |

## Install by harness

| Harness | Guide |
|---------|-------|
| Claude Code | [install/claude.md](install/claude.md) |
| opencode | [install/opencode.md](install/opencode.md) |
| GitHub Copilot | [install/copilot.md](install/copilot.md) |
| Gemini CLI | [install/gemini.md](install/gemini.md) |
| Codex | [install/codex.md](install/codex.md) |
| Cursor | [install/cursor.md](install/cursor.md) |
| Windsurf | [install/cli.md](install/cli.md) |
| Cline / Kilo / Antigravity | [install/cli.md](install/cli.md) |

## Reference

| Doc | What it covers |
|-----|----------------|
| [Skill anatomy](reference/skill-anatomy.md) | How a mugiwara skill file is structured |
| [Agent anatomy](reference/agent-anatomy.md) | How a mugiwara agent file is structured |
| [Troubleshooting](troubleshooting.md) | Common problems and how to fix them |
| [Developer onboarding](reference/developer-onboarding.md) | Repo layout, validation, tests, contributing |

## Resources

- GitHub: <https://github.com/ionivetech/mugiwara>
- npm: <https://www.npmjs.com/package/@ionivetech/mugiwara>
- License: MIT
