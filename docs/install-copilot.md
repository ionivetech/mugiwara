# GitHub Copilot Install

Mugiwara installs as a Copilot plugin directly from the GitHub repo.

## Prerequisites

- [GitHub Copilot](https://docs.github.com/en/copilot) extension installed

## Install

```bash
copilot plugin install https://github.com/ionivetech/mugiwara
```

## How it works

Copilot clones the repo and auto-discovers skills from `content/skills/`
and agents from `content/agents/`.

## Verify

Ask:

```
what mugiwara crew members are available?
```

## Update

Reinstall with the same command:

```bash
copilot plugin install https://github.com/ionivetech/mugiwara
```

## Uninstall

```bash
copilot plugin uninstall mugiwara
```

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [docs/config.md](config.md).
