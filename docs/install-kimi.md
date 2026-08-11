# Kimi Code Install

Mugiwara installs through Kimi Code's plugin system.

## Prerequisites

- [Kimi Code](https://kimi.moonshot.cn) installed

## Install

```
/plugins install https://github.com/ionivetech/mugiwara
```

## How it works

Kimi Code reads `.kimi-plugin/plugin.json` and auto-discovers skills from
`content/skills/`.

## Verify

Ask:

```
what mugiwara crew members are available?
```

## Update

Reinstall:

```
/plugins install https://github.com/ionivetech/mugiwara
```

## Uninstall

```
/plugins remove mugiwara
```

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [docs/config.md](config.md).
