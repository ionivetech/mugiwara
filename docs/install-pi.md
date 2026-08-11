# Pi Install

Mugiwara installs as a Pi package.

## Prerequisites

- [Pi](https://github.com/pi) CLI installed

## Install

```bash
pi install git:github.com/ionivetech/mugiwara
```

## How it works

Pi reads `package.json` `pi` field (`skills: ["./content/skills"]`) and
loads all 26 skills. The Pi extension (`pi-extension/`) registers runtime
hooks if present.

## Verify

Ask:

```
what mugiwara crew members are available?
```

## Update

Reinstall with the same command:

```bash
pi install git:github.com/ionivetech/mugiwara
```

## Uninstall

```bash
pi remove mugiwara
```

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [docs/config.md](config.md).
