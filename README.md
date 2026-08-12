# Mugiwara

[![npm version](https://img.shields.io/npm/v/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![License: MIT](https://img.shields.io/github/license/ionivetech/mugiwara)](https://github.com/ionivetech/mugiwara/blob/main/LICENSE)

Your coding agent becomes a governed engineering team. 14 specialists — triage,
plan, build, audit, review, heal — with evidence at every step, cost tracking,
and a process that sizes itself to your work. Pure markdown, zero runtime.

## Quick start

```bash
# Claude Code
/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara@mugiwara

# opencode — add to opencode.json
{ "plugin": ["@ionivetech/mugiwara"] }

# Gemini CLI
gemini extensions install https://github.com/ionivetech/mugiwara

# Any platform via npm
npx @ionivetech/mugiwara@latest install --project . --target all --yes
```

Then just ask. The crew auto-activates — no agent names to remember.

## What it looks like

You ask:

```
> add search bar to the products page
```

The crew runs:

```
Wave 0  Luffy   triage → 5 files, no sensitive paths → Lane 2 Standard
Wave 2  Nami    plan   → 1 execution wave, 3 tasks with dependency edges
Wave 3  Zoro    execute→ T1: search endpoint (test red→green, commit)
                         T2: search service (test red→green, commit)
                         T3: search component (test red→green, commit)
Wave 4  Chopper audit  → re-runs all 3 criteria, checks commits → PASS
Wave 5  Sanji   quality → prettier: clean, eslint: 0, 412 tests: PASS
Wave 6  Franky  gates  → coverage new 94%, modified 87%, build green → PASS
Wave 7  Robin   review → breaking-change map: 0 breaks, 1 minor naming finding
Wave 7  Jinbe   security→ no auth/payment surface touched → skip
Wave 9  Luffy   closure→ mission report + push branch + ready PR summary

done. branch pushed. paste the PR summary and open.
```

Each wave is a compact checkpoint report in your conversation. You see
everything. Nothing hides behind a subagent click. If a wave fails, Brook reads
all failures at once, fixes them, and all verification waves re-run.

Now a bigger one:

```
> add role-based access control to the API: admin, editor, viewer roles
```

Auth path detected → auto-escalate to Lane 3 (Full):

```
Wave 0  Luffy   triage → auth/ + migration/ touched → lane 3 full
Wave 2  Nami    plan   → 2 execution waves, 5 tasks, parallel-safe graph
Wave 3a Zoro    execute→ T1 migration + T2 middleware + T3 3 parallel endpoint guards
Wave 4  Chopper audit  → T3-C: viewer can still POST /api/settings → 1 ledger row
Wave 5  Sanji   quality → 2 integration tests fail after middleware change → 2 rows
Wave 6  Franky  gates  → coverage 91% / 85%, build green, DoD blocked (3 open rows)
Wave 7  Robin   review → 1 major: error message format inconsistent → 1 row
Wave 7  Jinbe   security→ STRIDE: PASS. 0 high. deny-by-default enforced.
Wave 8  Brook   heal   → reads 4 ledger rows → 3 parallel heal workers → fix all
Wave 4  Chopper re-audit→ PASS (cycle 2)
Wave 5  Sanji   re-qual → PASS
Wave 6  Franky  re-gate → PASS
Wave 7  Robin   re-rev  → PASS
Wave 3b Zoro    execute→ T4 admin dashboard RBAC UI + T5 integration tests
Wave 4  Chopper audit  → PASS
Wave 9  Luffy   closure→ state.json + mission report + push + PR summary

1 heal cycle. 4 failures from 3 different waves — all fixed at once.
```

At closure you get a mission report:

```
.mugiwara/reports/2026-08-11-rbac.md

Lane full · Mode guided · Actor you · Branch feature/feat-rbac

What changed: 12 files, +340/-82
Gates: Audit PASS · Quality PASS · Coverage 91%/85% · Security PASS
State: 12/12 tasks · 0 blockers · 1 heal cycle · 18.5k/20k tokens
```

One file. Any reviewer reads it in 30 seconds. That's the governance trail.

## Capabilities

| Capability | What it does |
|-----------|-------------|
| **14 specialist agents** | Luffy triages, Nami plans, Zoro builds TDD, Chopper audits, Sanji checks quality, Franky enforces gates, Robin maps breaking changes, Jinbe runs STRIDE, Brook heals failures. Each with role boundaries: auditors read-only, executor no-network. |
| **Lane sizing** | Process scaled to work size — computed from `git diff` by `scripts/lane.sh`. Typo = 0 waves. Auth migration = full 9-wave pipeline. Sensitive paths auto-escalate. |
| **9-wave gated pipeline** | Triage → Plan → Execute → Audit → Quality → Gates → Review+Security → Heal → Closure. Each wave gated by evidence. Pipeline runs inline — you watch everything. |
| **Evidence trail** | No wave passes on a claim. `scripts/evidence.sh` captures command output. Chopper re-runs criteria. Mission report at closure — one file any reviewer reads in 30 seconds. |
| **State on disk** | `state.json` written at every wave boundary by `scripts/savepoint.sh`. Lane, files, blockers, token budget — all computed, zero model judgement. Resume reads one file. |
| **Token budget** | Budget per lane. Warns at 1.5×, pauses at 3×. You decide: continue, split, or reduce. Cost surfaced in mission report — governance, not a kill switch. |
| **Self-healing** | Brook reads entire blocker ledger after all verification waves. Groups failures, spawns parallel heal workers for independent fixes. Max 3 cycles. |
| **Deterministic tooling** | `savepoint.sh` (state), `lane.sh` (sizing), `evidence.sh` (output capture), `mission-report.sh` (report). Scripts compute what models shouldn't remember. |
| **Configurable gates** | Coverage thresholds in `.mugiwara/config`: `coverage_new=90`, `coverage_modified=80`. Raise for strict repos, lower for legacy. |
| **3 autonomy modes** | Guided (ask everything), semi (auto branch/commit, plan needs GO), auto (hands-off except high-risk). All modes end at push + PR summary — no auto-merge. |
| **3-layer skills** | 26 skills: trigger description (~150 chars) → body (≤120 lines) → 23 reference files (on demand). 5.2k char index budget — loaded every session. |
| **Multi-actor safe** | Two engineers, one repo. Reset refuses without `--force`. Branch-scoped state. Shared lessons ledger. |
| **Compliance matrix** | Rule compliance per model/tier/harness. Published with failures — Gemini tier 2 ≠ Claude tier 1. Documented, not hidden. |
| **12 harnesses** | Claude Code, opencode, Copilot, Gemini, Codex, Cursor, Kimi, pi, Windsurf, Cline, Kilo, Antigravity. 70+ more via skills.sh. Pure markdown, zero runtime. |

## Why this instead of just asking my agent?

Your agent alone has no governance. It forgets context, skips verification, and
burns tokens on small fixes the same way it does on architecture changes. There's
no audit trail — when someone asks "what did the agent do?", you have nothing to
show.

Mugiwara wraps your agent in a team structure with defined roles, evidence gates,
and cost tracking. The same discipline you'd expect from a senior engineering
team — in your chat window, running inline, visible at every step.

## The crew

14 agents, 26 skills. The front door is the `using-mugiwara` skill — type `/using-mugiwara` or load it from any platform. Each agent has a permission boundary.

| Agent | Role | Permission |
|-------|------|------------|
| Luffy | Captain — triage, lane sizing, check-ins, closure | — |
| Nami | Planner — interviews, scans codebase, writes scaled plans | — |
| Zoro | Executor — TDD per task, commits per logical unit | **no-network** |
| Chopper | Auditor — re-runs criteria, writes failure ledger, never fixes | **read-only** |
| Sanji | Quality — format, lint, test. Never weakens configs | — |
| Franky | Gates — coverage (configurable thresholds), build, DoD | — |
| Robin | Reviewer — breaking-change map, five-axis, severity tagging | **read-only** |
| Jinbe | Security — STRIDE, OWASP, secret scan, dependency audit | **read-only** |
| Brook | Healer — reads ledger, parallel heal workers, max 3 cycles | — |
| Skeptic | Adversarial verifier — doubts everything, never validates | **read-only** |
| Usopp | Brainstorm — interrogates ideas, researches, recommends | — |
| Resume | Continuity — rebuilds from state.json, never restarts | — |
| Memory | Cross-mission lessons — read at start, write at closure | — |

See [all 14 agents](docs/agents.md) and [all 26 skills](docs/skills.md).

## Install

Mugiwara installs as a native plugin on every platform. Full details in the per-platform guides.

| Platform | Guide |
|----------|-------|
| **Claude Code** | [`/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara@mugiwara`](docs/install-claude.md) |
| **OpenCode** | [`{ "plugin": ["@ionivetech/mugiwara"] }`](docs/install-opencode.md) |
| **Gemini CLI** | [`gemini extensions install https://github.com/ionivetech/mugiwara`](docs/install-gemini.md) |
| **Codex** | [`codex plugin marketplace add ionivetech/mugiwara && codex plugin add mugiwara@mugiwara`](docs/install-codex.md) |
| **Copilot** | [`copilot plugin install https://github.com/ionivetech/mugiwara`](docs/install-copilot.md) |
| **Cursor** | [`/add-plugin mugiwara`](docs/install-cursor.md) |
| **Antigravity** | [`agy plugin install https://github.com/ionivetech/mugiwara`](docs/install-antigravity.md) |
| **Kimi** | [`/plugins install https://github.com/ionivetech/mugiwara`](docs/install-kimi.md) |
| **Pi** | [`pi install git:github.com/ionivetech/mugiwara`](docs/install-pi.md) |
| **Windsurf / Cline / Kilo** | [`npx @ionivetech/mugiwara install --target <id> --yes`](docs/install-cli.md) |

→ **[Full install guide with troubleshooting](docs/install.md)**

### Claude Code

```bash
/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara@mugiwara
```

Update: `/plugin update mugiwara`
Uninstall: `/plugin uninstall mugiwara`

### OpenCode

Add to `opencode.json`:

```json
{ "plugin": ["@ionivetech/mugiwara"] }
```

Update: replace the plugin entry version, or `npm update @ionivetech/mugiwara`
Uninstall: remove the plugin entry from `opencode.json`.

Restart opencode after install.

### Gemini CLI

```bash
gemini extensions install https://github.com/ionivetech/mugiwara
```

Update: `gemini extensions update mugiwara`
Uninstall: `gemini extensions remove mugiwara`

### Codex

```bash
codex plugin marketplace add ionivetech/mugiwara && codex plugin add mugiwara@mugiwara
```

Update: `codex plugin update mugiwara`
Uninstall: `codex plugin remove mugiwara`

### GitHub Copilot

```bash
copilot plugin install https://github.com/ionivetech/mugiwara
```

Update: reinstall with the same command.
Uninstall: `copilot plugin uninstall mugiwara`

### Cursor

```
/add-plugin mugiwara
```

Update: re-run `/add-plugin mugiwara`.
Uninstall: `/remove-plugin mugiwara`

### Antigravity

```bash
agy plugin install https://github.com/ionivetech/mugiwara
```

Update: reinstall with the same command.
Uninstall: `agy plugin uninstall mugiwara`

### Kimi

```
/plugins install https://github.com/ionivetech/mugiwara
```

Update: reinstall.
Uninstall: `/plugins remove mugiwara`

### Pi

```bash
pi install git:github.com/ionivetech/mugiwara
```

### Windsurf · Cline · Kilo · Codex CLI

```bash
npx @ionivetech/mugiwara@latest install --project . --target all --yes
```

Substitute `all` with a specific target: `windsurf`, `cline`, `kilo`, `codex`, etc.

Update: `npx @ionivetech/mugiwara@latest update --project . --target <id> --yes`
Uninstall: `npx @ionivetech/mugiwara@latest uninstall --project .`

Or install globally first for shorter commands:

```bash
npm i -g @ionivetech/mugiwara
mugiwara install --project . --target <id> --yes
mugiwara update --project . --target <id> --yes
mugiwara uninstall --project .
```

### Any agent (skills only)

```bash
npx skills add ionivetech/mugiwara   # 70+ agents via skills.sh
```

### One-liner

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.sh | bash
# Windows
irm https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.ps1 | iex
```

Requires **Node.js >= 20.11**.

## Configuration

`.mugiwara/config` (project) overrides `~/.mugiwara/config` (global).

| Key | Default | Meaning |
|-----|---------|---------|
| `mode` | guided | Autonomy: guided / semi / auto |
| `branch` | `feature/{type}-{issue}-{slug}` | Branch naming |
| `commit` | conventional | conventional / gitmoji / plain |
| `base` | main | PR target branch |
| `coverage_new` | 90 | Coverage threshold for new files |
| `coverage_modified` | 80 | Coverage threshold for modified files |

[Full config →](docs/config.md)

## CLI

```bash
mugiwara install                                  # wizard (interactive)
npx @ionivetech/mugiwara@latest install --yes     # non-interactive (project + all)
mugiwara update --project . --target <id> --yes   # replace existing files
mugiwara uninstall --project .                    # remove what manifest recorded
mugiwara list                                     # show installations
mugiwara list --check                             # health check (missing files)
mugiwara reset --keep-logs                        # wipe mission state, keep lessons
mugiwara reset --force                            # override multi-actor guard
```

## When not to use mugiwara

- **Autonomous marathon runs** — the agent disappears for hours. Use superpowers.
- **Deep per-skill reference encyclopedia** — use agent-skills.
- **A deployable runtime** — use LangGraph / CrewAI.
- **One large instruction with no ceremony** — use a mega-prompt.

Mugiwara is for visibility, governance, and cost awareness. If those don't
matter to you, this is the wrong tool.

## Docs

| Doc | What it covers |
|-----|---------------|
| [Getting started](docs/getting-started.md) | First mission, lane 0-3 examples, setup walkthrough |
| [Install](docs/install.md) | Per-platform guides: Claude Code, OpenCode, Gemini, Codex, Copilot, Cursor, Antigravity, Kimi, Pi, CLI |
| [Workflow](docs/workflow.md) | Full 9-wave pipeline with heal loop detail |
| [Agents](docs/agents.md) | 14 crew members, roles, permissions, how to summon |
| [Skills](docs/skills.md) | 26 techniques, 3-layer disclosure model |
| [Lanes](docs/lanes.md) | Deterministic lane sizing — computed from git diff |
| [Audit trail](docs/audit-trail.md) | 15 artifact types, how to read as reviewer |
| [Cost model](docs/cost.md) | Index/body/references layers, cost per lane |
| [Harness matrix](docs/harness-matrix.md) | Tier 1/2/3 — what differs per harness |
| [Config](docs/config.md) | All `.mugiwara/config` keys with defaults |
| [Modes](docs/modes.md) | Guided / semi / auto autonomy levels |
| [Compliance matrix](docs/compliance-matrix.md) | Rule compliance per model — published with failures |
| [Comparison](docs/comparison.md) | Positioning. When to use mugiwara vs something else. |
| [Roadmap](ROADMAP.md) | Now — Next — Then — After |

## License

MIT. Copyright (c) 2026 ionive.
