# Mugiwara

[![npm version](https://img.shields.io/npm/v/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![npm downloads](https://img.shields.io/npm/dm/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![License: MIT](https://img.shields.io/github/license/ionivetech/mugiwara)](https://github.com/ionivetech/mugiwara/blob/main/LICENSE)

**Ship quality code, not just fast code.** Mugiwara gives your AI agent a
governed engineering team — 12 specialists who plan, build, audit, review, and
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

## What Mugiwara does

### Pipeline that scales to the work

Every request is triaged and sized automatically from `git diff`. A typo skips
the pipeline. An auth migration runs all 9 waves. No config, no flags — the
crew decides.

```
Triage → Brainstorm → Plan → Execute → Audit → Quality → Gates → Review+Security → Heal → Closure
```

→ [Wave pipeline details](docs/concepts/workflow.md) · [Lane sizing](docs/concepts/lanes.md)

### Sonar-style code analysis

Sanji runs duplication detection, cyclomatic/cognitive complexity scoring, and
maintainability rating (A–E). Robin adds qualitative code attribute review
(consistency, intentionality, adaptability). Franky enforces per-condition
quality gates: vulnerabilities=0, bugs=0, duplications<3%, coverage≥threshold.

### Security audit (STRIDE + OWASP + SCA)

Jinbe runs STRIDE threat modeling first, then OWASP Top 10 mapping, secret
scanning, injection checks, dependency auditing, security hotspot review, and
SCA license compliance. Read-only — findings go to the healer, never touched
silently.

→ [Security skill details](docs/concepts/skills.md)

### Team collaboration on large initiatives

Nami plans initiatives with sub-mission breakdown — assignee, branch,
dependencies. One shared plan doc tracks status per sub-mission:
`[ ]` pending → `[~]` in-progress → `[x]` done. Run `mugiwara initiative status`
to see the dashboard. When all sub-missions are done, the initiative closes.

→ [Planning skill details](docs/concepts/skills.md)

### Autonomy modes — you decide how much to hand off

| Mode | What the crew does without asking |
|------|-----------------------------------|
| **guided** | Nothing. Every decision comes to you. |
| **semi** | Auto branch + commit + push. Plans still need your GO. |
| **auto** | Hands-off. Plans auto-GO when safe. Flip mid-session: `/mugiwara auto`. |

You set review and quality depth independently: `review_depth=full|standard|quick`,
`quality_depth=full|standard|quick`. Full = everything. Quick = just the essentials.
Skip a wave entirely via Luffy decision, not config.

→ [Mode details](docs/concepts/modes.md) · [Config reference](docs/concepts/config.md)

### Onboarding in 10 questions

First time? Run `/mugiwara onboard`. 10 questions — project type, language,
team size, git workflow, autonomy mode, review depth, coverage threshold. No
network. Answers write `.mugiwara/config` and `.mugiwara/onboard.json`.
Re-onboard any time with the same command.

### Evidence trail on disk

Every mission leaves a `.mugiwara/` workspace at the repo root — plans, audit
reports, quality reports, review findings, blocker ledger, mission reports. A
reviewer can read 30 seconds of markdown and know exactly what changed, who
checked it, and why it was trusted.

→ [Audit trail details](docs/concepts/audit-trail.md)

## 30-second try

```bash
# opencode — add to opencode.json, then restart
{ "plugin": ["@ionivetech/mugiwara"] }

# Claude Code
/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara

# Any platform via npm
npx @ionivetech/mugiwara@latest install --target all --yes
```

First run: `/mugiwara onboard` for guided setup. Then ask something non-trivial:

```
> add role-based access control: admin, editor, viewer
> audit the auth middleware for security gaps
> review the last PR for breaking changes
> split this feature across the team: payment gateway, ledger, fraud detection
```

A Standard lane mission (~10k tokens) produces a branch with test-first
commits, an audit report, a security review, and a ready PR summary — visible
at every step in your chat.

→ [Full walkthrough](docs/getting-started.md)

## How it works

You ask. The crew routes automatically. **No agent names to memorize, no
pipeline config to write.**

| You say | What happens |
|---------|-------------|
| `add search bar to products page` | Luffy triages → Nami plans 3 tasks → Zoro executes TDD → Chopper audits → Sanji runs format+lint+test+duplication+complexity → Franky gates all conditions → Robin reviews → code pushed, PR summary ready |
| `split payment system: gateway, ledger, fraud` | Nami interviews team → writes initiative plan with sub-missions + assignees → each dev works in own branch → `mugiwara initiative status` shows progress → all done → initiative closure |
| `Brook, fix the failing login test` | Healer reads failure ledger, root-cause fixes, proves fix ≤3 cycles |
| `Jinbe, audit auth middleware` | STRIDE + OWASP + hotspot review. Read-only — never touches code |
| `/mugiwara auto` | Switches to full autonomy from the next wave |

- **Full pipeline** when the task is big or direction is unclear
- **Direct agent** when you know exactly what you need — say the name
- **Slash commands** when you want to drive: `/mugiwara-plan`, `/mugiwara-review`, `/mugiwara-security`, `/mugiwara-ship`, `/mugiwara onboard`

→ [Full workflow walkthrough](docs/concepts/workflow.md)

## The crew

12 user-facing specialists (+3 internal). Each has role boundaries — auditors
and reviewers are read-only. Call them by name or let the pipeline auto-route.

| Agent | Role | Permission |
|-------|------|:---:|
| `luffy-orchestrator` | Captain — triage, check-ins, closure | — |
| `usopp-brainstorm` | Critical friend — interrogates, researches, recommends | — |
| `nami-planner` | Planner — interviews, full scan, scaled plans, team initiatives | — |
| `zoro-execution` | Executor — TDD per task, evidence per commit | — |
| `chopper-checkpoint` | Auditor — re-runs criteria, failure ledger | **read-only** |
| `sanji-quality` | Quality — format, lint, test, duplication, complexity, maintainability, code attributes | — |
| `franky-gates` | Gates — coverage, build, DoD, per-condition sonar gate | — |
| `robin-reviewer` | Reviewer — breaking-change map, reliability rating, code attribute deep review | **read-only** |
| `jinbe-security` | Security — STRIDE, OWASP, hotspots, SCA license, secret scan, responsibility | **read-only** |
| `brook-healing` | Healer — reads ledger, root-cause fixes ≤3 cycles | — |
| `onboarding-guide` | Onboarding wizard — 10Q guided setup, writes config | — |
| `resume-coordinator` | Resumer — rebuilds state from `.mugiwara/`, continues never restarts | — |

**Internal agents** (dispatch-only):

| Agent | Role | Used by |
|-------|------|---------|
| `skeptic-verifier` | Adversarial verifier — doubts every claim | Wave 4.5, high-stakes missions |
| `eval-runner` | Harness tester — task suites, judge rubric | `bun scripts/run-evals.ts` |
| `memory-keeper` | Lessons ledger — surface at start, capture at closure | Wave 0 (read), Wave 9 (write) |

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
pauses at 3×.

→ [Full cost model](docs/concepts/cost.md)

## Configuration

Switch mode any time: `/mugiwara guided | semi | auto`. Or edit `.mugiwara/config`:

| Key | Default | What |
|-----|---------|------|
| `mode` | guided | guided / semi / auto |
| `branch` | `feature/{type}-{issue}-{slug}` | Branch naming |
| `commit` | conventional | conventional / gitmoji / plain |
| `base` | main | PR target branch |
| `coverage_new` | 90 | Coverage threshold for new files (%) |
| `coverage_modified` | 80 | Coverage threshold for modified files (%) |
| `review_depth` | full | full / standard / quick — Robin's review depth |
| `quality_depth` | full | full / standard / quick — Sanji's check depth |

Set via `/mugiwara onboard` or edit directly. Unknown keys ignored. Project
config (`.mugiwara/config`) overrides global (`~/.mugiwara/config`).

→ [All config keys](docs/concepts/config.md) · [Mode details](docs/concepts/modes.md)

## Quick reference

| Need | Command / Doc |
|------|---------------|
| First-time setup | `/mugiwara onboard` |
| Plan a feature | `/mugiwara-plan` or just describe it |
| Review a PR diff | `/mugiwara-review` or "review this PR" |
| Security audit | `/mugiwara-security` or "Jinbe, audit X" |
| Ship gate check | `/mugiwara-ship` |
| See initiative progress | `mugiwara initiative status <plan>` |
| Resume a mission | `/mugiwara resume plan <name>` |
| Switch mode | `/mugiwara guided\|semi\|auto` |
| Check gate locally | `bun run gate` |
| All docs | [docs/](docs/) |

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
npx @ionivetech/mugiwara@latest install --target all --yes
```

Targets: `windsurf`, `cline`, `kilo`, `codex`.

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

All platforms get the full crew — 12 agents, 26 skills (+3 internal agents).
No per-platform feature gaps.

→ [Per-platform guides](docs/install/index.md)

## Update

```bash
npm update @ionivetech/mugiwara                           # npm-based
/plugin update mugiwara                                   # marketplace-based
# Reinstall with same install command                     # GitHub-based
```

→ [Full update reference](docs/install/index.md)

## CLI

```bash
mugiwara install                              # wizard (interactive)
mugiwara install --target all --yes           # non-interactive
mugiwara update --target <id> --yes           # overwrite to latest
mugiwara uninstall                            # remove installed files
mugiwara list                                 # show installations
mugiwara list --check                         # health check
mugiwara reset --keep-logs                    # wipe state, keep lessons
```

## Docs

**Start here:** [Getting started](docs/getting-started.md) · [What mugiwara replaces](docs/concepts/comparison.md)

**Concepts:** [Workflow](docs/concepts/workflow.md) · [Lanes](docs/concepts/lanes.md) · [Modes](docs/concepts/modes.md) · [Execution model](docs/concepts/execution-model.md) · [Git strategy](docs/concepts/git-strategy.md) · [Config](docs/concepts/config.md) · [Cost](docs/concepts/cost.md) · [Audit trail](docs/concepts/audit-trail.md)

**Crew:** [Agents](docs/concepts/agents.md) · [Skills](docs/concepts/skills.md)

**Reference:** [Agent anatomy](docs/reference/agent-anatomy.md) · [Skill anatomy](docs/reference/skill-anatomy.md) · [Harness matrix](docs/reference/harness-matrix.md) · [Compliance matrix](docs/reference/compliance-matrix.md) · [Developer onboarding](docs/reference/developer-onboarding.md)

**Install per platform:** [Overview](docs/install/index.md) · [Claude](docs/install/claude.md) · [opencode](docs/install/opencode.md) · [Gemini](docs/install/gemini.md) · [Codex](docs/install/codex.md) · [Copilot](docs/install/copilot.md) · [CLI targets](docs/install/cli.md)

**Troubleshooting:** [Common problems](docs/troubleshooting.md)

**Roadmap:** [ROADMAP.md](ROADMAP.md)

## License

MIT. Copyright (c) 2026 ionivetech.
