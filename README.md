# Mugiwara

The Straw Hat crew of AI agents and skills. One install gives your AI coding
agent a complete multi-agent workflow: brainstorm → plan → execute → checkpoint
→ quality → gates → review → security → heal → closure.

- **Agents** = the crew (10): Luffy orchestrates, Nami plans, Zoro executes,
  Chopper audits, Sanji checks quality, Franky guards the gates, Robin reviews,
  Jinbe secures, Brook heals, Usopp brainstorms.
- **Skills** = their techniques (12): each agent calls its skills; shared
  skills (frontend, security) are used by several crew members.
- **No runtime**: Mugiwara ships markdown. Your AI agent (Claude Code,
  opencode, Copilot, Gemini, Codex, Windsurf, Cline, Kilo, Antigravity)
  runs the crew with its own subagent machinery.

## Install

Requires Node.js >= 20.

```bash
# interactive wizard (scope, target agent, project type)
npx @ionivetech/mugiwara@latest

# examples
npx @ionivetech/mugiwara@latest --global --target claude --type general --yes
npx @ionivetech/mugiwara@latest --project ./my-app --target opencode,copilot --type frontend --yes

# mac/linux
curl -fsSL https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.sh | bash

# windows (PowerShell)
irm https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.ps1 | iex
```

## Commands

| Command | Effect |
|---------|--------|
| `mugiwara install` | wizard install (default) |
| `mugiwara update` | replace files, backing up differences |
| `mugiwara uninstall` | remove exactly what the manifest recorded |
| `mugiwara list` | show installations |

Flags: `--global`, `--project <dir>`, `--target <ids|all>`,
`--type <frontend|backend|fullstack|general>`, `--yes`, `--force`, `--dry-run`.

`--type frontend|fullstack` includes the anti-slop frontend skill; other types skip it.

## The workflow

Every mission starts with **Luffy's triage**: vague idea → brainstorm with Usopp
first; clear requirements → straight to Nami's plan. Nami writes a wave-structured
plan (tasks marked parallel/sequential with acceptance criteria), Zoro executes it
through subagents, Chopper audits with evidence, Sanji cooks the checks (asking
before integration tests), Franky enforces coverage/build gates, Robin and Jinbe
review code and security in parallel, Brook heals failures (max 3 cycles), and
Luffy closes the mission with a report.

Mission artifacts land in the crew workspace: specs in `.mugiwara/spec/`, plans
in `.mugiwara/plans/`, execution results in `.mugiwara/results/`, and reviews in
`.mugiwara/review/`.

## Targets

| Target | Scope | Installs as |
|--------|-------|-------------|
| Claude Code | global + project | native skills + agents |
| opencode | global + project | native skills + agents |
| GitHub Copilot | global + project | instructions + agents |
| Gemini CLI | project | `.gemini/mugiwara/` + GEMINI.md pointer |
| Codex | project | `.codex/mugiwara/` + AGENTS.md pointer |
| Windsurf / Cline / Kilo / Antigravity | project | rules files |

## Development

```bash
npm test                # node:test suites
node scripts/validate-content.mjs   # content schema lint
```

Zero runtime dependencies. MIT.

## Plugin install

Mugiwara also ships as a Claude Code plugin + marketplace (works for GitHub
Copilot CLI too — it reads the same `.claude-plugin/` manifests).

```bash
# Claude Code
/plugin marketplace add ionivetech/mugiwara
/plugin install mugiwara

# GitHub Copilot CLI
copilot plugin marketplace add ionivetech/mugiwara
copilot plugin install mugiwara
```

The plugin bundles the 10 agents + 12 skills as copies at the repo root
(`agents/`, `skills/`) plus a SessionStart hook. Regenerate the copies from
`content/` with `.claude-plugin/sync.sh`.
