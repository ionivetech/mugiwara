# How do I use it with opencode?

OpenCode discovers crew from repo paths instead of copied files, so install means registering paths and restarting. This page registers the plugin, explains the three runtime duties, and maps general actions to OpenCode tools.

Example: you add `"plugin": ["@ionivetech/mugiwara"]` to `opencode.json` and restart. Typing `/mugiwara` shows the crew router, and asking for available crew members lists all 11 agents plus skills. Nothing injects at session start; skills load on demand through the native skill tool.

## Install

```json
{ "$schema": "https://opencode.ai/config.json", "plugin": ["@ionivetech/mugiwara"] }
```

Global config lives under the user config dir, project config under `.opencode/`. Pin versions with a suffix such as `@^0.5.0`.

## How it works

The config hook registers skills and agents paths so OpenCode discovers the full crew without copying files. The chat hook intercepts `/mugiwara` commands and mode switches into `.mugiwara/config`. The file installer copies slash commands for crew routing, resume, review, and security into the commands dir. Runtime permissions generate only for internal subagent-only agents; user-facing crew stays rules-based, since write scope is convention rather than mechanism here.

## Modes and upkeep

Switch autonomy at runtime with `/mugiwara guided`, `/mugiwara semi`, `/mugiwara auto`, or bare `/mugiwara` for the current mode. Verify through the router or the roster question. Upgrade by clearing the resolved plugin cache and reinstalling, since package updates never touch OpenCode's pinned copy. Uninstall by removing the plugin line and restarting. Action mapping: todos via todowrite, subagents via task, skills via skill, files via read, edit, write, shell via bash, search via grep and glob, URLs via webfetch. Report persistent failures at the repository issue tracker.
