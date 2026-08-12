# Codex Install

Mugiwara installs as a native Codex plugin.

## Prerequisites

- [Codex](https://github.com/openai/codex) CLI or app installed

## Install

```bash
codex plugin marketplace add ionivetech/mugiwara && codex plugin add mugiwara@mugiwara
```

## How it works

Codex reads `.codex-plugin/plugin.json` which references `content/skills/`.
All 26 skills are auto-discovered. Agents come from `content/agents/` via the
`agents/` symlink.

## Verify

Ask:

```
what mugiwara crew members are available?
```

## Update

```bash
codex plugin update mugiwara
```

## Uninstall

```bash
codex plugin remove mugiwara
```

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [config.md](../concepts/config.md).
