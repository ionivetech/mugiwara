# Cursor Install

Mugiwara installs through Cursor's plugin marketplace.

## Prerequisites

- [Cursor](https://cursor.com) installed

## Install

```
/add-plugin mugiwara
```

## How it works

Cursor reads `.cursor-plugin/plugin.json` and auto-discovers skills from
`content/skills/`.

## Verify

Ask:

```
what mugiwara crew members are available?
```

## Update

Re-run:

```
/add-plugin mugiwara
```

## Uninstall

```
/remove-plugin mugiwara
```

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [docs/config.md](config.md).
