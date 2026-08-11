# Claude Code Install

Mugiwara is a full Claude Code native plugin with agents, skills, and a
session-start hook.

## Prerequisites

- [Claude Code](https://claude.ai/code) installed
- Node.js >= 20.11

## Install

```bash
/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara@mugiwara
```

## How it works

Claude Code clones the repo and reads from:

- `skills/` and `agents/` — symlinks to `content/skills/` and
  `content/agents/`. Claude Code auto-discovers all 26 skills and 15 agents.
- `hooks/hooks.json` — defines a SessionStart hook that runs
  `hooks/session-start.ts`, injecting the crew announce header at every
  session start.

The hook announces: "Mugiwara crew available. The workflow auto-activates
for non-trivial requests..."

## Verify

Ask:

```
what mugiwara crew members are available?
```

Or start any task — the crew auto-activates at session start.

## Update

```
/plugin update mugiwara
```

## Uninstall

```
/plugin uninstall mugiwara
```

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [docs/config.md](config.md).

Switch autonomy mode with `/mugiwara-mode guided|semi|auto`.

## Troubleshooting

### Plugin not showing up

1. Verify marketplace is registered: `/plugin marketplace list`
2. If not, re-run the marketplace add command
3. Check Claude Code is up to date

### Skills not found

1. Check that `skills/` and `agents/` symlinks resolve correctly
2. Reinstall: `/plugin uninstall mugiwara` then reinstall

### Hook not running

The session-start hook requires Claude Code plugin hook support. Ensure
you're on a recent Claude Code version.
