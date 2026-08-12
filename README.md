# Mugiwara

[![npm version](https://img.shields.io/npm/v/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![npm downloads](https://img.shields.io/npm/dm/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![License: MIT](https://img.shields.io/github/license/ionivetech/mugiwara)](https://github.com/ionivetech/mugiwara/blob/main/LICENSE)

**Ship quality code, not just fast code.** Mugiwara gives your AI agent a
governed engineering team — 11 specialists who plan, build, audit, review, and
heal — with evidence at every step. No runtime, no API keys, no servers. Just
markdown your agent already knows how to read.

Works on Claude Code, opencode, Copilot, Gemini, and 8 more platforms.

## Why this exists

AI agents are fast. They're also **unverified.** No audit trail. No review. No
"who checked this?" when something breaks. Mugiwara wraps your agent in a team
structure with role boundaries, evidence gates, and cost tracking — the same
discipline you'd expect from a senior engineering team. Zero runtime overhead:
every agent, every skill, every rule is static markdown.

→ [Full pitch: why mugiwara vs just asking your agent](docs/concepts/comparison.md)

## Capabilities

| Feature | What you get |
|---------|-------------|
| **Zero runtime** | Pure markdown. No servers, no API keys, no dependencies beyond your agent. |
| **11 specialist agents** | Each with tuned temperature, step limits, and role boundaries. Read-only auditors. +3 internal agents for eval/lessons/verification. |
| **26 skills** | Portable playbooks: TDD execution, STRIDE security, 4-phase debugging, contract-first API design |
| **Deterministic lane sizing** | Work auto-sized from `git diff`. Typo = instant fix. Auth migration = full 9-wave pipeline. |
| **9-wave gated pipeline** | Triage → Brainstorm → Plan → Execute → Audit → Quality → Gates → Review+Security → Heal → Closure |
| **Evidence trail** | `.mugiwara/` workspace on disk: plans, audit reports, blocker ledger, mission reports. Reviewer reads in 30s. |
| **Self-healing** | Brook reads all failures at once, fixes root causes, re-runs verification. ≤3 cycles. |
| **3 autonomy modes** | Guided (human steers) / Semi (auto branch+commit) / Auto (hands-off). Switch mid-session. |
| **12 platforms** | Native plugins for Claude Code, opencode, Copilot, Gemini, Codex, Cursor, Kimi, Pi, Antigravity. CLI for Windsurf, Cline, Kilo. |
| **Cost aware** | Token budget per lane. Warn at 1.5×, pause at 3×. Cost surfaced in every mission report. |
| **Multi-actor safe** | Two engineers, one repo. Reset refuses without `--force`. Branch-scoped state. |
| **Compliance matrix** | Rule compliance per model published with failures. Gemini tier 2 ≠ Claude tier 1. Documented, not hidden. |

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

A Standard lane mission (~10k tokens) produces a branch with test-first
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

[Full workflow walkthrough →](docs/concepts/workflow.md)

## The crew

11 specialists. Each has a role boundary (read-only for auditors/reviewers), a
temperature, and a step limit. Call them by name or let the pipeline auto-route.

| Agent | Role | Permission |
|-------|------|:---:|
| `luffy-orchestrator` | Captain — triage, check-ins, closure | — |
| `nami-planner` | Planner — interviews, full scan, scaled plans | — |
| `zoro-execution` | Executor — TDD per task, evidence per commit | — |
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

→ [Agent details: summoning, boundaries, parameters](docs/concepts/agents.md)

## How much it costs

Mugiwara itself is free. Token usage depends on mission lane:

| Lane | Waves | Typical tokens |
|------|:-----:|:--------------:|
| Direct (typo) | 0 | ~0 |
| Lean (small bug) | 2 | ~4k |
| Standard (feature) | 5–7 | ~10k |
| Full (architecture) | 9–11 | ~20k |

Usage tracked in `.mugiwara/state.json` per mission. Budget warns at 1.5×,
pauses at 3×. See [cost model](docs/concepts/cost.md) for per-model pricing reference.

→ [Full cost model and token budget](docs/concepts/cost.md)

## Install

<details open>
<summary><b>Native plugins</b> — one-command install</summary>

| Platform | Command |
|----------|---------|
| **Claude Code** | `/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara` |
| **OpenCode** | Add `{ "plugin": ["@ionivetech/mugiwara"] }` to `opencode.json` |
| **Gemini CLI** | `gemini extensions install https://github.com/ionivetech/mugiwara` |
| **Codex** | `codex plugin marketplace add ionivetech/mugiwara && codex plugin add mugiwara@mugiwara` |
| **Copilot** | `copilot plugin install https://github.com/ionivetech/mugiwara` |
| **Cursor** | `/add-plugin mugiwara` |
| **Antigravity** | `agy plugin install https://github.com/ionivetech/mugiwara` |
| **Kimi** | `/plugins install https://github.com/ionivetech/mugiwara` |
| **Pi** | `pi install git:github.com/ionivetech/mugiwara` |

</details>

<details>
<summary><b>CLI install</b> — Windsurf, Cline, Kilo, and more</summary>

```bash
npx @ionivetech/mugiwara@latest install --target <id> --yes
# or all targets
npx @ionivetech/mugiwara@latest install --target all --yes
```

Targets: `windsurf`, `cline`, `kilo`, `codex`. See [install/cli](docs/install/cli.md) for interactive wizard.

</details>

<details>
<summary><b>Global CLI</b> — shorter commands after first install</summary>

```bash
npm i -g @ionivetech/mugiwara
mugiwara install --target all --yes
mugiwara update --target all --yes
mugiwara uninstall
```

</details>

All platforms get the full crew — 11 agents, 26 skills (+3 internal agents). No per-platform feature gaps.

→ [Per-platform guides with update/verify/troubleshooting](docs/install/index.md)

## Update

```bash
# npm-based (opencode, CLI targets)
npm update @ionivetech/mugiwara

# marketplace-based (Claude, Codex)
/plugin update mugiwara

# GitHub-based (Copilot, Gemini, Cursor, Antigravity, Kimi)
# Reinstall with the same install command — pulls latest release
```

→ [Full update reference per platform](docs/install/index.md)

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

→ [All config keys](docs/concepts/config.md) · [Mode details](docs/concepts/modes.md)

## Docs

Getting started & concepts: **[Getting started](docs/getting-started.md)** · [What mugiwara replaces](docs/concepts/comparison.md) · [Execution model](docs/concepts/execution-model.md) · [Git strategy](docs/concepts/git-strategy.md)

Crew & techniques: **[Agents](docs/concepts/agents.md)** · [Skills](docs/concepts/skills.md) · [Workflow](docs/concepts/workflow.md) · [Lanes](docs/concepts/lanes.md) · [Modes](docs/concepts/modes.md)

Operations: [Config](docs/concepts/config.md) · [Audit trail](docs/concepts/audit-trail.md) · [Cost](docs/concepts/cost.md) · [Harness matrix](docs/reference/harness-matrix.md) · [Compliance](docs/reference/compliance-matrix.md) · [Troubleshooting](docs/troubleshooting.md)

Deep dives: [Agent anatomy](docs/reference/agent-anatomy.md) · [Skill anatomy](docs/reference/skill-anatomy.md) · [Developer onboarding](docs/reference/developer-onboarding.md)

Install per platform: **[Install overview](docs/install/index.md)** · [Claude](docs/install/claude.md) · [opencode](docs/install/opencode.md) · [Gemini](docs/install/gemini.md) · [Codex](docs/install/codex.md) · [Copilot](docs/install/copilot.md) · [CLI targets](docs/install/cli.md)

Roadmap: [ROADMAP.md](ROADMAP.md)

## License

MIT. Copyright (c) 2026 ionivetech.
