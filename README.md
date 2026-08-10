# Mugiwara

[![npm version](https://img.shields.io/npm/v/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![License: MIT](https://img.shields.io/github/license/ionivetech/mugiwara)](https://github.com/ionivetech/mugiwara/blob/main/LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/@ionivetech%2fmugiwara)](https://www.npmjs.com/package/@ionivetech/mugiwara)
[![CI](https://img.shields.io/github/actions/workflow/status/ionivetech/mugiwara/ci.yml?branch=main&label=ci)](https://github.com/ionivetech/mugiwara/actions)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-3178c6)](https://github.com/ionivetech/mugiwara)
[![Bun](https://img.shields.io/badge/bundler-Bun-black)](https://bun.sh)
[![GitHub](https://img.shields.io/badge/GitHub-ionivetech%2Fmugiwara-181717?logo=github)](https://github.com/ionivetech/mugiwara)

The Straw Hat crew of AI agents and skills. One install gives your AI coding
agent a complete multi-agent workflow: brainstorm → plan → execute → checkpoint
→ quality → gates → review → security → heal → closure.

Mugiwara ships **ten specialist agents** — each a named crew member with a
narrow job (Luffy orchestrates, Nami plans, Zoro executes, Brook heals) — and
**twelve skills** they call as their techniques. Your existing AI agent
(Claude Code, opencode, GitHub Copilot, Gemini CLI, Codex, Windsurf, Cline,
Kilo Code, or Antigravity) runs the crew with its own subagent machinery. There
is **no runtime**: Mugiwara is markdown, installed as native skills and agents
(or rules files) for whatever tool you use.

## Table of contents

- [Features](#features--what-you-get)
- [How it works](#how-it-works)
- [Install](#install)
- [Commands and flags](#commands-and-flags)
- [Targets](#targets)
- [Claude Code plugin install](#claude-code-plugin-install)
- [Usage example](#usage-example)
- [Development](#development)
- [Content schema](#content-schema)
- [License](#license)
- [Links](#links)

## Features / What you get

### The crew — 10 agents

Each agent is a focused specialist. Agents are dispatched by your AI tool's
subagent machinery and may call the crew's shared skills.

| Agent | Crew member | Role |
|-------|-------------|------|
| `luffy-orchestrator` | Luffy | Main gateway: 5-way triage, background check-ins, work splitting, decision log, closure |
| `usopp-brainstorm` | Usopp | Critical brainstorming friend: facts over hype, options + trade-offs, no over-engineering |
| `nami-planner` | Nami | Interview-first planner: full-context scan, wave structure, anti-patterns, parallel-safe plans |
| `zoro-execution` | Zoro | Execute plans: todo list first, parallel/sequential subagent dispatch, evidence per task |
| `chopper-checkpoint` | Chopper | Verify-everything audit of wave results; writes the failure ledger (never fixes code) |
| `sanji-quality` | Sanji | Discover the stack, then format/lint/test; integration tests only with consent |
| `franky-gates` | Franky | Binary gates: coverage ≥90/80, build exit 0, Definition of Done |
| `robin-reviewer` | Robin | Doubt-driven diff review: breaking-change first, five-axis, severity-tagged findings |
| `jinbe-security` | Jinbe | Security review: OWASP, secrets, injection, auth, dependencies, untrusted-data doctrine |
| `brook-healing` | Brook | Reads the blocker ledger, Stop-the-Line root-cause fixes, ≤3 heal cycles |

### The techniques — 14 skills

| Skill | Purpose |
|-------|---------|
| `mugiwara-workflow` | The harness entry point: gateway triage, wave pipeline, workspace layout, blocker protocol, cleanup |
| `mugiwara-orchestration` | Luffy's captain behavior: 5-way classifier, check-ins, work splitting, decision log, closure |
| `mugiwara-brainstorm` | Usopp's critical sparring: interrogate, research facts, cut over-engineering, recommend |
| `mugiwara-planning` | Interview-first, full-context scan, wave plans with parallel/sequential markers + anti-patterns |
| `mugiwara-execution` | Todo list, parallel batches + sequential chains, 6-field subagent delegation, one task one commit |
| `mugiwara-checkpoint` | Verify-everything audit of every acceptance criterion; failure rows to the blocker ledger |
| `mugiwara-quality` | Discover the project's real tooling; formatter, linter, unit + consent-gated integration tests |
| `mugiwara-gates` | Coverage ≥90% new / ≥80% modified files, build validation, Definition of Done |
| `mugiwara-review` | Doubt-driven review: breaking-change analysis, five-axis, severity-tagged findings |
| `mugiwara-security` | OWASP-driven security review, untrusted-data doctrine, severity by exploitability × impact |
| `mugiwara-healing` | Reads the ledger, Stop-the-Line + Prove-It root-cause fixes, rollback prep |
| `mugiwara-frontend` | Anti-slop frontend: audit-first redesigns, design-system extraction, slop list |
| `mugiwara-git` | Atomic commits, save-points, multi-commit splitting, bisect/blame debugging |
| `mugiwara-ship` | GO/NO-GO ship gate: pre-launch checklist, feature flags, rollback plan |

### No runtime

Mugiwara ships markdown only — zero runtime dependencies, zero daemons, zero
plugins to keep updated in your editor. Your AI agent loads the crew as native
skills/agents and runs them with machinery it already has.

### Frontend anti-slop gating

`--type frontend` or `--type fullstack` includes `mugiwara-frontend` in the
install; `backend` and `general` skip it. The skill enforces audit-first
redesigns, extracts the design system from the reference, and bans generic
AI-slop patterns — framework-agnostic.

## How it works

Every mission starts at the **Luffy gateway** — he classifies the request
(trivial / explicit / exploratory / open-ended / ambiguous) and routes it:
exploratory ideas go to Usopp's brainstorm, clear work goes straight to Nami's
planning. You can also summon any crew member directly. From there the mission
runs as a **wave pipeline** owned by one crew member per wave.

| Wave | Owner | Skill | Output |
|------|-------|-------|--------|
| 0 Triage | Luffy | `mugiwara-orchestration` | 5-way route decision + reason |
| 1 Brainstorm | Usopp | `mugiwara-brainstorm` | refined direction, options, recommendation |
| 2 Planning | Nami | `mugiwara-planning` | plan doc: waves, tasks, acceptance criteria |
| 3 Execution | Zoro | `mugiwara-execution` | implemented tasks with evidence |
| 4 Checkpoint | Chopper | `mugiwara-checkpoint` | audit report + failure ledger |
| 5 Quality | Sanji | `mugiwara-quality` | formatter/linter/test results |
| 6 Gates | Franky | `mugiwara-gates` | coverage + build verdict |
| 7 Review | Robin ∥ Jinbe | `mugiwara-review` + `mugiwara-security` | severity-tagged findings (parallel) |
| 8 Healing | Brook | `mugiwara-healing` | fixes; loops back to Wave 4, max 3 cycles |
| 9 Closure | Luffy | `mugiwara-orchestration` | closure report appended to the plan |

Two rules hold the pipeline together:

- **Evidence over claims.** No wave passes on assertion — the owning agent runs
  the checks and shows output. A wave that cannot produce evidence is a failed
  wave. ("Subagents lie. No evidence = not complete.")
- **The plan is the source of truth.** From Wave 2 on, everything lives in
  `.mugiwara/plans/<date>-<mission>.md`. No wave is skipped without the reason
  recorded there.

### The `.mugiwara/` workspace

Every mission works inside `.mugiwara/` at the repo root:

```
.mugiwara/
├── spec/          # brainstorm output: YYYY-MM-DD-<mission>.md
├── plans/         # plan docs — single source of truth from Wave 2
├── results/       # wave results: audits, test output, gate verdicts, todos
├── review/        # review + security findings
├── issues/        # blocker + failure ledger: YYYY-MM-DD-<mission>-blockers.md
└── logs/          # Luffy's decision log
```

**Blocker protocol:** any crew member that hits a blocker appends a row
(`wave | task | symptom | attempted | help needed`) to
`.mugiwara/issues/<mission>-blockers.md` and escalates — never a silent
workaround. Brook reads the ledger in Wave 8 and heals what it lists.

**Cleanup:** at closure, Luffy deletes the superseded intermediate markdown
files (consumed results, review, and issues reports). The plan doc and closure
report stay.

The owning agent creates the folder it needs on first write. Mission artifacts
never land outside `.mugiwara/`.

## Install

Requires **Node.js >= 20.11**. Bun is optional — you only need it to build
from source.

```bash
# interactive wizard (scope, target agent, project type)
npx @ionivetech/mugiwara@latest

# non-interactive: global Claude Code install, general type, no prompts
npx @ionivetech/mugiwara@latest --global --target claude --type general --yes

# non-interactive: project install for opencode + GitHub Copilot, frontend type
npx @ionivetech/mugiwara@latest --project ./my-app --target opencode,copilot --type frontend --yes

# mac/linux — curl installer
curl -fsSL https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.sh | bash

# windows — PowerShell installer
irm https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.ps1 | iex
```

The `install.sh` / `install.ps1` scripts check your Node version, then run the
same CLI (`npx -y @ionivetech/mugiwara@latest`), forwarding any flags you pass.

### Requirements

| Dependency | Required for | Version |
|------------|--------------|---------|
| Node.js | running the CLI and the built artifact | >= 20.11 |
| Bun | building from source, running tests | optional |

## Commands and flags

### Commands

| Command | Effect |
|---------|--------|
| `mugiwara install` | Install the crew (default; wizard when flags are missing) |
| `mugiwara update` | Replace installed files, backing up differences to `.mugiwara/backup/<timestamp>/` first (project root, or `~` for global) |
| `mugiwara uninstall` | Remove exactly what the install manifest recorded |
| `mugiwara list` | Show installations (project + global manifests) |
| `mugiwara --help` | Print usage and flags |
| `mugiwara --version` | Print the package version |

### Flags

| Flag | Meaning |
|------|---------|
| `--global` | Install user-wide (writes to your home directory) |
| `--project <dir>` | Install into a project directory (default: current directory) |
| `--target <ids\|all>` | Comma-separated target IDs, or `all`. Valid: `claude, opencode, copilot, gemini, codex, windsurf, cline, kilo, antigravity` |
| `--type <t>` | Project type: `frontend`, `backend`, `fullstack`, `general`. `frontend`/`fullstack` include `mugiwara-frontend` |
| `--yes`, `-y` | Non-interactive. Requires `--global` or `--project`, `--target`, and `--type` |
| `--force` | Overwrite files that differ (conflicting files are backed up first) |
| `--dry-run` | Print the actions without writing anything |

```bash
# non-interactive install requires all three, or it errors out
npx @ionivetech/mugiwara@latest --project ./app --target claude --type frontend --yes

# preview what an install would write, without touching the disk
npx @ionivetech/mugiwara@latest --global --target all --type general --yes --dry-run

# global installs skip targets that only support project scope (with a note)
npx @ionivetech/mugiwara@latest --global --target all --type general --yes
```

### Install manifest

Every install writes `.mugiwara/manifest.json` (in the project dir, or `~` for
global). The manifest records the version, scope, type, targets, and the exact
list of written files — which is what `update` and `uninstall` use to operate
safely.

## Targets

All nine supported targets. **Native** targets get first-class skills and
agents; the rest get markdown rule files the tool picks up from a conventions
directory. Targets marked *project only* are skipped (with a note) when you
install with `--global`.

| Target | Scope | Installs as |
|--------|-------|-------------|
| Claude Code | global + project | Native skills (`SKILL.md`) + agents in `.claude/skills` / `.claude/agents` (`~/.claude` globally) |
| opencode | global + project | Native skills + agents in `.opencode/skills` / `.opencode/agents` (`~/.config/opencode` globally) |
| GitHub Copilot | global + project | Skills as `.instructions.md` files + agents in `instructions/` / `agents/` (`.github` project, `~/.copilot` global) |
| Gemini CLI | project only | Markdown rules in `.gemini/mugiwara/` + `GEMINI.md` pointer |
| Codex | project only | Markdown rules in `.codex/mugiwara/` + `AGENTS.md` pointer |
| Windsurf | project only | Rules files in `.devin/rules` |
| Cline | project only | Rules files in `.clinerules` |
| Kilo Code | project only | Rules files in `.kilo/rules` + `kilo.jsonc` pointer |
| Antigravity | project only | Rules files in `.agents/rules` |

For rule-based targets, skills land as `mugiwara-*.md` and agents as
`agent-<name>.md`. Targets with a bootstrap file (`Gemini`, `Codex`, `Kilo`)
create it if it doesn't exist and otherwise tell you the line to add, so your
tool points at the crew.

## Claude Code plugin install

Mugiwara also ships as a **Claude Code plugin** with a marketplace — the
primary target. The plugin bundles the 10 agents + 14 skills as copies at the
repo root (`agents/`, `skills/`) plus a `SessionStart` hook that announces the
crew. Regenerate the copies from `content/` with `.claude-plugin/sync.sh`.

```bash
# Claude Code (fully supported)
/plugin marketplace add ionivetech/mugiwara
/plugin install mugiwara
```

GitHub Copilot CLI can read the same `.claude-plugin/` marketplace and consume
the skills as native Copilot skills:

```bash
# GitHub Copilot CLI (skills + marketplace readable)
copilot plugin marketplace add ionivetech/mugiwara
copilot plugin install mugiwara
```

> **Copilot caveat.** The agents are **Claude-native `.md` files** — they will
> not auto-discover in Copilot and may need `.agent.md` conversion to work as
> Copilot plugin agents. Skills install and function; agents are best consumed
> through the regular CLI install path (which writes Copilot-native
> `.instructions.md` skills and `.md` agents).

## Usage example

Say you ask your agent for *"add dark mode to the settings page."*

1. **Wave 0 — Luffy (triage).** Not a trivial one-liner, but requirements are
   mostly clear. Luffy routes straight to Wave 2 — no brainstorm needed.
2. **Wave 2 — Nami (plan).** Writes `.mugiwara/plans/2026-08-10-dark-mode.md`:
   three waves (theme tokens → UI wiring → settings toggle), each task with an
   acceptance criterion. Because it touches UI, she marks every task to apply
   `mugiwara-frontend` in the same pass.
3. **Wave 3 — Zoro (execute).** Batches the independent tasks, dispatches
   subagents with the plan's acceptance criteria, and shows evidence (diff +
   test output) for each before moving on.
4. **Wave 4 — Chopper (checkpoint).** Re-reads the plan, re-runs the criteria,
   finds one miss — the toggle doesn't persist to `localStorage` — and writes
   the failure ledger. Auditor only; does not fix it.
5. **Wave 5 — Sanji (quality).** Runs the formatter, linter, and unit tests,
   asking before any integration tests.
6. **Wave 6 — Franky (gates).** Enforces coverage ≥90% on the new files. The
   toggle component is untested → verdict: FAIL.
7. **Wave 7 — Robin ∥ Jinbe (review + security, parallel).** Robin flags the
   duplication between the two theme-context files; Jinbe notes the toggle
   value is read with no schema guard — low severity, but real.
8. **Wave 8 — Brook (heal).** Root-cause fixes: persistence, the missing
   tests, the duplication, the schema guard. Loops back to Wave 4 (≤3 cycles).
9. **Wave 9 — Luffy (closure).** Appends the closure report to the plan:
   what shipped, what was deferred, where the evidence lives.

Your human never drives the sequence — they just answer Nami's clarifying
questions up front and review Brook's rollback note if a fix is risky.

## Development

### Prerequisites

- **Bun** — the build and test toolchain
- **Node.js >= 20.11** — the built artifact runs on plain Node

```bash
bun install              # install dev dependencies
bun run build            # bundle src/cli.ts → dist/mugiwara.js (Bun, ESM, node target)
bun run test             # vitest suites
bun run typecheck        # tsc --noEmit
bun run validate         # node scripts/validate-content.mjs — content schema lint
node dist/mugiwara.js --version   # smoke-test the built CLI
```

`bun run build` runs automatically on `npm pack` / `npm publish` (via
`prepack`).

### Project layout

```
mugiwara/
├── src/                 # TypeScript: CLI, installer, target adapters
│   └── targets/         # one adapter per AI agent (claude, opencode, gemini, ...)
├── test/                # vitest suites
├── content/             # single source of truth for the crew
│   ├── skills/          # 14 skills (one dir per skill, SKILL.md inside)
│   └── agents/          # 10 agents (<name>.md)
├── scripts/             # install.sh, install.ps1, validate-content.mjs
├── hooks/               # Claude Code SessionStart hook (hooks.json + session-start.js)
├── .claude-plugin/      # Claude plugin + marketplace metadata; sync.sh copies
├── agents/              # plugin copies of content/agents/ (generated by sync.sh)
├── skills/              # plugin copies of content/skills/ (generated by sync.sh)
├── dist/                # bundled CLI output (generated, gitignored)
├── docs/                # specs, plans, research
└── package.json
```

### Adding a skill

1. Create `content/skills/<name>/SKILL.md` — flat frontmatter (`name`,
   `description`), body ≤ 120 lines.
2. Reference it from at least one agent's `skills` field in
   `content/agents/*.md`.
3. Run `bun run validate` to confirm it passes the schema.
4. Re-sync the plugin copies with `.claude-plugin/sync.sh`.

### Adding an agent

1. Create `content/agents/<name>.md` with a `skills` field listing the skills
   it calls.
2. Run `bun run validate`.
3. Re-sync with `.claude-plugin/sync.sh`.

## Content schema

Every skill and agent is a single markdown file with **flat frontmatter** — no
nested fields:

```yaml
---
name: mugiwara-example
description: Use when <trigger condition> — <what it does, how it behaves>.
---

<body>
```

| Rule | Detail |
|------|--------|
| Naming | `name` must equal the directory (skills) or file (agents) name |
| Description | `description` 20–500 characters for skills, ≥20 for agents |
| Trigger phrasing | Descriptions start with "Use when …" (skills) or "Dispatch when …" (agents) so your AI tool auto-selects the right one |
| Skill body | ≤ 120 lines |
| Agent `skills` | Every agent must list the skills it calls, comma-separated; each must exist |
| References | Every skill except `mugiwara-workflow` must be referenced by at least one agent |
| Uniqueness | No duplicate `name` across skills and agents |

Run `bun run validate` before opening a PR — it checks all of this and exits
non-zero on any violation.

## License

MIT. Copyright (c) 2026 ionive. See [LICENSE](LICENSE).

## Links

- GitHub: <https://github.com/ionivetech/mugiwara>
- npm: <https://www.npmjs.com/package/@ionivetech/mugiwara>
