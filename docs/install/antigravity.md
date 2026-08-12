# Antigravity Install

Mugiwara installs as an Antigravity plugin from this repo.

## Prerequisites

- [Antigravity](https://antigravity.google) installed

## Install

```bash
agy plugin install https://github.com/ionivetech/mugiwara
```

## How it works

Antigravity reads `.agents/plugins/marketplace.json` and installs the plugin
from the repo root. Skills and agents are auto-discovered.

## Verify

Ask:

```
what mugiwara crew members are available?
```

## Update

Reinstall with the same command:

```bash
agy plugin install https://github.com/ionivetech/mugiwara
```

## Uninstall

```bash
agy plugin uninstall mugiwara
```

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [config.md](../concepts/config.md).
