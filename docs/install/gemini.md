# Gemini CLI Install

Mugiwara installs as a Gemini CLI extension.

## Prerequisites

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed

## Install

```bash
gemini extensions install https://github.com/ionivetech/mugiwara
```

## How it works

Gemini reads `gemini-extension.json` (which points to `GEMINI.md` as the
context file) and auto-discovers skills from `content/skills/`. The
`GEMINI.md` file describes the crew and workflow bootstrap.

## Verify

Ask:

```
what mugiwara crew members are available?
```

## Update

```bash
gemini extensions update mugiwara
```

## Uninstall

```bash
gemini extensions remove mugiwara
```

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [config.md](../concepts/config.md).
