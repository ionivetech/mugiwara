# Mugiwara

[![npm version](https://img.shields.io/npm/v/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![npm downloads](https://img.shields.io/npm/dm/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![License: MIT](https://img.shields.io/github/license/ionivetech/mugiwara)](https://github.com/ionivetech/mugiwara/blob/main/LICENSE)

**Ship quality code, not just fast code.** Mugiwara gives your AI agent a
governed engineering team — 14 specialists who plan, build, audit, review, and
heal — with evidence at every step. No runtime, no API keys, no servers. Just
markdown your agent already knows how to read.

Works on Claude Code, opencode, Copilot, Gemini, and 8 more platforms.

## Why this exists

AI agents are fast. They're also **unverified.** No audit trail. No review. No
"who checked this?" when something breaks. Mugiwara wraps your agent in a team
structure with role boundaries, evidence gates, and cost tracking — the same
discipline you'd expect from a senior engineering team. Zero runtime overhead:
every agent, every skill, every rule is static markdown.

→ [Full pitch: why mugiwara vs just asking your agent](docs/comparison.md)

## 30-second try

```bash
# opencode — add to opencode.json, then restart
{ "plugin": ["@ionivetech/mugiwara"] }

# Claude Code
/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara

# Any platform via npm
npx @ionivetech/mugiwara@latest install --target all --yes
```

Then ask something non-trivial. The crew auto-activates:

```
> add role-based access control: admin, editor, viewer
```

A ~$0.03 mission (Standard lane, ~10k tokens) produces a branch with test-first
commits, an audit report, a security review, and a ready PR summary — visible
at every step in your chat. See it work: [docs/getting-started.md](docs/getting-started.md).

## How it works

You ask. The crew routes automatically. **No agent names to memorize, no
pipeline config to write.** The work is sized from your git diff (typo = instant
fix; auth migration = full 9-wave pipeline).

| You say | What happens |
|---------|-------------|
| `add search bar to products page` | Luffy triages → Nami plans 3 tasks → Zoro executes TDD → Chopper audits → Sanji runs tests → Franky gates coverage → Robin reviews → code pushed, PR summary ready |
| `Brook, fix the failing login test` | Healer reads failure ledger, root-cause fixes, proves fix ≤3 cycles. No pipeline overhead |
| `Jinbe, audit auth middleware` | Security specialist runs STRIDE + OWASP. Read-only — never touches code |
| `/mugiwara semi` | Switches to semi-autonomous mode: auto branch + commit, plan still needs your GO |

- **Full pipeline** when the task is big or direction is unclear — Luffy figures it out
- **Direct agent** when you know exactly what you need — just say the name
- **Slash commands** when you want to drive:`/mugiwara-plan`, `/mugiwara-review`, `/mugiwara-security`, `/mugiwara-ship`

[Full workflow walkthrough →](docs/workflow.md)

## The crew

14 specialists. Each has a role boundary (read-only, no-network), a temperature,
and a step limit. Call them by name or let the pipeline auto-route.

| Agent | Role | Permission |
|-------|------|:---:|
| `luffy-orchestrator` | Captain — triage, check-ins, closure | — |
| `nami-planner` | Planner — interviews, full scan, scaled plans | — |
| `zoro-execution` | Executor — TDD per task, evidence per commit | **no-network** |
| `chopper-checkpoint` | Auditor — re-runs criteria, failure ledger | **read-only** |
| `sanji-quality` | Quality — format, lint, test | — |
| `franky-gates` | Gates — coverage, build, DoD verdict | — |
| `robin-reviewer` | Reviewer — breaking-change map | **read-only** |
| `jinbe-security` | Security — STRIDE, OWASP, secret scan | **read-only** |
| `brook-healing` | Healer — reads ledger, root-cause fixes ≤3 cycles | — |
| `usopp-brainstorm` | Critical friend — interrogates, researches | — |
| `skeptic-verifier` | Adversarial verifier — doubts, never validates | **read-only** |
| `eval-runner` | Harness tester — task suites | — |
| `resume-coordinator` | Resumer — rebuilds from state.json | — |
| `memory-keeper` | Institutional memory — past lessons | — |

> The names are One Piece characters — just code names for specialist roles.
> Agents are identified by their function (Orchestrator, Planner, Auditor, etc.),
> not by their theme. The theme makes them memorable; the boundaries make them
> safe.

→ [Agent details: summoning, boundaries, parameters](docs/agents.md)

## How much it costs

Mugiwara itself is free. The token cost depends on your mission lane:

| Lane | Waves | Typical tokens | ~Cost (Claude Sonnet) |
|------|:-----:|:--------------:|:---------------------:|
| Direct (typo) | 0 | ~0 | $0 |
| Lean (small bug) | 2 | ~4k | ~$0.01 |
| Standard (feature) | 5–7 | ~10k | ~$0.03 |
| Full (architecture) | 9–11 | ~20k | ~$0.06 |

Cost is tracked in `.mugiwara/state.json` and surfaced in every mission report.
Pipeline never costs more than the work it verifies.

→ [Full cost model and token budget](docs/cost.md)

## Install

**10-second native plugins** — zero dependency install:

| Platform | Command |
|----------|---------|
| **Claude Code** | `/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara` |
| **OpenCode** | Add `{ "plugin": ["@ionivetech/mugiwara"] }` to `opencode.json` |
| **Gemini CLI** | `gemini extensions install https://github.com/ionivetech/mugiwara` |
| **Codex** | `codex plugin marketplace add ionivetech/mugiwara && codex plugin add mugiwara@mugiwara` |
| **Copilot** | `copilot plugin install https://github.com/ionivetech/mugiwara` |
| **Cursor** | `/add-plugin mugiwara` |
| **Windsurf / Cline / Kilo** | `npx @ionivetech/mugiwara@latest install --target <id> --yes` |
| **Antigravity** | `agy plugin install https://github.com/ionivetech/mugiwara` |
| **Kimi** | `/plugins install https://github.com/ionivetech/mugiwara` |
| **Pi** | `pi install git:github.com/ionivetech/mugiwara` |

All platforms get the full crew — 14 agents, 26 skills. No per-platform feature gaps.

→ [Per-platform guides with update/verify/troubleshooting](docs/install.md)

## Update

```bash
# npm-based (opencode, CLI targets)
npm update @ionivetech/mugiwara

# marketplace-based (Claude, Codex)
/plugin update mugiwara

# GitHub-based (Copilot, Gemini, Cursor, Antigravity, Kimi)
# Reinstall with the same install command — pulls latest release
```

→ [Full update reference per platform](docs/install.md)

## CLI

```bash
mugiwara install                                  # wizard (interactive)
npx @ionivetech/mugiwara@latest install --yes     # non-interactive (project + all)
mugiwara update --target <id> --yes               # overwrite to latest
mugiwara uninstall                                # remove installed files
mugiwara list                                     # show installations
mugiwara list --check                             # health check (missing files)
mugiwara reset --keep-logs                        # wipe state, keep lessons
```

## Configuration

Switch mode any time: `/mugiwara guided | semi | auto`. Or edit `.mugiwara/config`:

| Key | Default | What |
|-----|---------|------|
| `mode` | guided | guided / semi / auto |
| `branch` | `feature/{type}-{issue}-{slug}` | Branch naming |
| `commit` | conventional | conventional / gitmoji / plain |
| `base` | main | PR target branch |

→ [All config keys](docs/config.md) · [Mode details](docs/modes.md)

## Docs

Getting started & concepts: **[Getting started](docs/getting-started.md)** · [What mugiwara replaces](docs/comparison.md) · [Execution model](docs/execution-model.md) · [Git strategy](docs/git-strategy.md)

Crew & techniques: **[Agents](docs/agents.md)** · [Skills](docs/skills.md) · [Workflow](docs/workflow.md) · [Lanes](docs/lanes.md) · [Modes](docs/modes.md)

Operations: [Config](docs/config.md) · [Audit trail](docs/audit-trail.md) · [Cost](docs/cost.md) · [Harness matrix](docs/harness-matrix.md) · [Compliance](docs/compliance-matrix.md) · [Troubleshooting](docs/troubleshooting.md)

Deep dives: [Agent anatomy](docs/agent-anatomy.md) · [Skill anatomy](docs/skill-anatomy.md) · [Developer onboarding](docs/developer-onboarding.md)

Install per platform: **[Install overview](docs/install.md)** · [Claude](docs/install-claude.md) · [opencode](docs/install-opencode.md) · [Gemini](docs/install-gemini.md) · [Codex](docs/install-codex.md) · [Copilot](docs/install-copilot.md) · [CLI targets](docs/install-cli.md)

Roadmap: [ROADMAP.md](ROADMAP.md)

## License

MIT. Copyright (c) 2026 ionivetech.
