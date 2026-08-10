# GitHub Copilot Setup

## Install via the marketplace

```bash
copilot plugin marketplace add ionivetech/mugiwara
copilot plugin install mugiwara
```

## Install via CLI

```bash
npx @ionivetech/mugiwara@latest --project ./my-app --target copilot --yes
```

## What you get

- 25 skills as `.instructions.md` files in `.github/` (project) or
  `~/.copilot/` (global).
- Agents as markdown files in `instructions/` / `agents/`.

## Copilot caveat

Copilot CLI reads the Claude marketplace for skills, but the agents are
Claude-native `.md` files and do not auto-discover in Copilot. Skills install
and function; for full agent support use the CLI install path, which writes
Copilot-native `.instructions.md` skills and `.md` agents.
