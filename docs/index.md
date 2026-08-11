# Mugiwara Docs

The Straw Hat crew of AI agents and skills. These docs cover what the crew is,
how to adopt it, and how each harness installs it. The crew is pure markdown —
no runtime, no daemons, nothing to host. It ships **15 agents** and **32
skills**, and the workflow **auto-activates** at session start — a non-trivial
request runs the pipeline by itself, with `/using-mugiwara` as an optional
explicit router.

## Start here

| Doc | What it covers |
|-----|----------------|
| [Getting started](getting-started.md) | Install, first mission, what you see in the chat |
| [Adoption guide](adoption-guide.md) | Pick the harness, pick the mode, fit the crew to your workflow |
| [Modes](modes.md) | guided / semi / auto — the autonomy levels, what each asks you |
| [Config](config.md) | Full reference for `.mugiwara/config` keys and commit styles |
| [The crew](agents.md) | All 15 agents and when to summon each |
| [The techniques](skills.md) | All 32 skills and what each enforces |
| [The wave pipeline](workflow.md) | How a mission flows Wave 0 → Wave 9 |
| [Execution model](execution-model.md) | Inline-by-default: why the crew runs in your main conversation |
| [Git discipline](git-strategy.md) | Commits, branches, save-points — and why the executor commits |

## Install by harness

| Harness | Guide |
|---------|-------|
| Claude Code | [claude-setup.md](claude-setup.md) |
| opencode | [opencode-setup.md](opencode-setup.md) |
| GitHub Copilot | [copilot-setup.md](copilot-setup.md) |
| Gemini CLI | [gemini-setup.md](gemini-setup.md) |
| Codex | [codex-setup.md](codex-setup.md) |
| Cursor | [cursor-setup.md](cursor-setup.md) |
| Windsurf | [windsurf-setup.md](windsurf-setup.md) |
| Cline / Kilo / Antigravity | [rule-based-setup.md](rule-based-setup.md) |

## Reference

| Doc | What it covers |
|-----|----------------|
| [Skill anatomy](skill-anatomy.md) | How a mugiwara skill file is structured |
| [Agent anatomy](agent-anatomy.md) | How a mugiwara agent file is structured |
| [Developer onboarding](developer-onboarding.md) | Repo layout, validation, tests, contributing |

## Resources

- GitHub: <https://github.com/ionivetech/mugiwara>
- npm: <https://www.npmjs.com/package/@ionivetech/mugiwara>
- License: MIT
