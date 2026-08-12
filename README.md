# Mugiwara

[![npm version](https://img.shields.io/npm/v/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![License: MIT](https://img.shields.io/github/license/ionivetech/mugiwara)](https://github.com/ionivetech/mugiwara/blob/main/LICENSE)

**Your agent becomes a governed engineering team.** 14 specialists, 26
techniques, evidence at every step, and a pipeline that sizes itself to the
work. Works on Claude Code, opencode, Copilot, Gemini, and 8 more platforms.

## Quick start

```bash
# Claude Code
/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara

# opencode — add to opencode.json
{ "plugin": ["@ionivetech/mugiwara"] }

# Gemini CLI
gemini extensions install https://github.com/ionivetech/mugiwara

# Any platform via npm
npx @ionivetech/mugiwara@latest install --target all --yes
```

Then ask. The crew auto-activates for non-trivial work. No agent names to remember.

## What you get

| Layer | Count | What | Detail |
|-------|:-----:|------|--------|
| **Agents** | 14 | Specialists with role boundaries (read-only, no-network) and tuned parameters | [docs/agents.md](docs/agents.md) |
| **Skills** | 26 | Portable playbooks — the "how to" each agent follows | [docs/skills.md](docs/skills.md) |
| **Pipeline** | 9-wave | Triage → Brainstorm → Plan → Execute → Audit → Quality → Gates → Review+Security → Heal → Closure | [docs/workflow.md](docs/workflow.md) |
| **Lanes** | 5 sizes | Work auto-sized from git diff. Typo = 0 waves. Auth migration = full pipeline. | [docs/lanes.md](docs/lanes.md) |
| **Autonomy** | 3 modes | Guided (human steers everything) / Semi / Auto (hands-off) | [docs/modes.md](docs/modes.md) |
| **Evidence** | `.mugiwara/` | Reports, plans, audit ledger, mission trail — on disk, reviewer reads in 30s | [docs/audit-trail.md](docs/audit-trail.md) |

## Two ways to use

### 1. Full pipeline — for feature work

```
> add search bar to the products page
```

Luffy triages → Nami plans → Zoro executes test-first → Chopper audits → Sanji checks quality → Franky gates coverage → Robin reviews → Jinbe scans security → Luffy closes. Every wave runs inline in your chat, visible at every step. See [docs/workflow.md](docs/workflow.md).

### 2. Direct agent — for quick actions

Call any crew member by name for a focused task without running the full pipeline:

```
Brook, heal the failing tests
Jinbe, audit the auth middleware
Robin, review the last diff
Nami, plan this feature
Usopp, challenge this design
```

Each agent carries its own boundaries — reviewers are read-only, executor has no-network, healer loops ≤3 cycles. Full agent list: [docs/agents.md](docs/agents.md).

**Which to use?** Unknown scope → Luffy (pipeline auto-routes). Clear small task → agent directly. Pipeline never blocks direct calls — Luffy records the route either way.

## The crew

| Agent | Role | Permission | When to call |
|-------|------|:---:|---------|
| `luffy-orchestrator` | Captain — triage, lane sizing, check-ins, closure | — | mission start, direction unclear |
| `usopp-brainstorm` | Critical friend — interrogates, researches, recommends | — | vague ideas, needs direction |
| `nami-planner` | Planner — interviews, full scan, scaled plans | — | turning idea into plan |
| `zoro-execution` | Executor — TDD per task, evidence per commit | **no-network** | executing approved plan |
| `chopper-checkpoint` | Auditor — re-runs criteria, failure ledger | **read-only** | verifying wave results |
| `sanji-quality` | Quality — format, lint, test | — | checking code quality |
| `franky-gates` | Gates — coverage, build, DoD verdict | — | enforcing quality bar |
| `robin-reviewer` | Reviewer — breaking-change map, severity-tagged | **read-only** | reviewing any diff |
| `jinbe-security` | Security — STRIDE, OWASP, secret scan | **read-only** | security audit |
| `brook-healing` | Healer — reads ledger, root-cause fixes, ≤3 cycles | — | any wave had failures |
| `skeptic-verifier` | Adversarial verifier — doubts, never validates | **read-only** | high-stakes verdicts |
| `eval-runner` | Harness tester — task suites, judge comparison | — | verifying mugiwara itself |
| `resume-coordinator` | Resumer — rebuilds from `state.json` | — | context loss, mid-mission resume |
| `memory-keeper` | Institutional memory — past lessons | — | mission start + closure |

→ [Agent details: summoning, boundaries, parameters](docs/agents.md)

## Skills at a glance

**Core pipeline** (agent-loaded — not called directly):
`mugiwara-orchestration` `mugiwara-brainstorm` `mugiwara-planning`
`mugiwara-execution` `mugiwara-checkpoint` `mugiwara-quality`
`mugiwara-gates` `mugiwara-review` `mugiwara-security` `mugiwara-healing`

**Mission control** (can be called standalone):
`using-mugiwara` — front door router `mugiwara-git` — atomic commits `mugiwara-pr` — push + PR summary
`mugiwara-ship` — GO/NO-GO gate `mugiwara-resume` — session recovery `mugiwara-lessons` — institutional memory
`mugiwara-sunset` — deprecation/migration `mugiwara-testcases` — user test intake

**Engineering** (standalone):
`mugiwara-root-cause` — 4-phase debugging `mugiwara-contract-first` — API contracts
`mugiwara-claim-audit` — adversarial verification `mugiwara-context-budget` — token management

**Domain** (standalone):
`mugiwara-frontend` — anti-slop UI `mugiwara-backend` — server code `mugiwara-agent-security` — agent-layer threats

→ [Full skill catalogue with descriptions](docs/skills.md)

## Install

| Platform | Install | Update | Uninstall |
|----------|---------|--------|-----------|
| **Claude Code** | `/plugin marketplace add ionivetech/mugiwara` then `/plugin install mugiwara` | `/plugin update mugiwara` | `/plugin uninstall mugiwara` |
| **OpenCode** | `{ "plugin": ["@ionivetech/mugiwara"] }` in `opencode.json` | `npm update @ionivetech/mugiwara` | Remove from `plugin` array |
| **Gemini CLI** | `gemini extensions install https://github.com/ionivetech/mugiwara` | `gemini extensions update mugiwara` | `gemini extensions remove mugiwara` |
| **Codex** | `codex plugin marketplace add ionivetech/mugiwara` then `codex plugin add mugiwara@mugiwara` | `codex plugin update mugiwara` | `codex plugin remove mugiwara` |
| **Copilot** | `copilot plugin install https://github.com/ionivetech/mugiwara` | Reinstall same command | `copilot plugin uninstall mugiwara` |
| **Cursor** | `/add-plugin mugiwara` | Re-run `/add-plugin mugiwara` | `/remove-plugin mugiwara` |
| **Antigravity** | `agy plugin install https://github.com/ionivetech/mugiwara` | Reinstall same command | `agy plugin uninstall mugiwara` |
| **Kimi** | `/plugins install https://github.com/ionivetech/mugiwara` | Reinstall | `/plugins remove mugiwara` |
| **Pi** | `pi install git:github.com/ionivetech/mugiwara` | — | — |
| **CLI targets** | `npx @ionivetech/mugiwara@latest install --target <id> --yes` | `npx @ionivetech/mugiwara@latest update --target <id> --yes` | `npx @ionivetech/mugiwara@latest uninstall` |

CLI targets: `windsurf`, `cline`, `kilo`, `codex`. Or `all` for everything.

→ [Per-platform install guides with troubleshooting](docs/install.md)

## Update

**npm-based platforms** (openode, CLI targets):
```bash
npm update @ionivetech/mugiwara
# or with npx
npx @ionivetech/mugiwara@latest update --target <id> --yes
```

**Marketplace-based platforms** (Claude, Codex):
```
/plugin update mugiwara
```

**GitHub-based platforms** (Copilot, Gemini, Antigravity, Kimi, Cursor): reinstall with the same command — downloads latest from GitHub.

**Post-update:** restart your agent. For file-based installs (CLI targets), run `mugiwara update` to overwrite skill/agent files.

## CLI

```bash
mugiwara install                                  # wizard (interactive)
npx @ionivetech/mugiwara@latest install --yes     # non-interactive (project + all)
mugiwara update --target <id> --yes               # overwrite to latest
mugiwara uninstall                                # remove + clean cache
mugiwara list                                     # show installations
mugiwara list --check                             # health check (missing files)
mugiwara reset --keep-logs                        # wipe state, keep lessons
```

## Configuration

Two files, key=value lines. Project (`.mugiwara/config`) overrides global (`~/.mugiwara/config`).

| Key | Default | Meaning |
|-----|---------|---------|
| `mode` | guided | Autonomy: guided / semi / auto |
| `branch` | `feature/{type}-{issue}-{slug}` | Branch naming |
| `commit` | conventional | conventional / gitmoji / plain |
| `base` | main | PR target branch |

Switch mode mid-session: `/mugiwara guided|semi|auto`. Or edit `.mugiwara/config` directly.

→ [All config keys](docs/config.md) · [Mode details](docs/modes.md)

## Docs

| Topic | Doc |
|-------|-----|
| First mission | [Getting started](docs/getting-started.md) |
| All 14 agents | [Agents](docs/agents.md) |
| All 26 skills | [Skills](docs/skills.md) |
| 9-wave pipeline | [Workflow](docs/workflow.md) |
| Lane sizing | [Lanes](docs/lanes.md) |
| Autonomy modes | [Modes](docs/modes.md) |
| Evidence trail | [Audit trail](docs/audit-trail.md) |
| Install per platform | [Install](docs/install.md) |
| Config reference | [Config](docs/config.md) |
| Cost model | [Cost](docs/cost.md) |
| Platform differences | [Harness matrix](docs/harness-matrix.md) |
| Rule compliance | [Compliance matrix](docs/compliance-matrix.md) |
| Git strategy | [Git strategy](docs/git-strategy.md) |
| Execution model | [Execution model](docs/execution-model.md) |
| Agent deep dive | [Agent anatomy](docs/agent-anatomy.md) |
| Skill deep dive | [Skill anatomy](docs/skill-anatomy.md) |
| When to use vs not | [Comparison](docs/comparison.md) |
| Troubleshooting | [Troubleshooting](docs/troubleshooting.md) |
| Roadmap | [ROADMAP.md](ROADMAP.md) |

## When not to use mugiwara

- **One-line fix** — the pipeline is overkill. Lane 0 detects this and skips.
- **Autonomous marathon runs** — the agent disappears for hours.
- **A deployable runtime** — use LangGraph / CrewAI.
- **One large instruction with no ceremony** — use a mega-prompt.

Mugiwara is for visibility, governance, and a disciplined process. If those
don't matter, this is the wrong tool.

## License

MIT. Copyright (c) 2026 ionive.
