# How do I install it?

Every platform gets the whole crew: 11 agents plus 3 internal, 21 skills. The only difference is delivery: native plugin, extension, or CLI copy. Pick your platform below and follow its page; every page ends with the same roster question as proof.

Example: an OpenCode user adds the plugin line to `opencode.json` and restarts, while a Cursor user runs one slash command. Both then ask "what mugiwara crew members are available" and receive the same roster. Same crew, different doors.

## Native plugins

Claude Code: marketplace add plus plugin install, with session hook. Full steps: [claude](claude.md). OpenCode: plugin line in `opencode.json`, restart. Full steps: [opencode](opencode.md). GitHub Copilot: plugin install from the repo URL. Full steps: [copilot](copilot.md). Codex: marketplace add plus plugin add. Full steps: [codex](codex.md). Cursor: add-plugin command. Full steps: [cursor](cursor.md). Kimi Code: plugins install from the repo URL. Full steps: [kimi](kimi.md). Antigravity: plugin install from the repo URL. Full steps: [antigravity](antigravity.md). Gemini CLI: extension install from the repo URL. Full steps: [gemini](gemini.md). Pi: package install from git URL. Full steps: [pi](pi.md).

## CLI copy

Windsurf, Cline, and Kilo have no native plugin system, so the CLI copies stubs plus references into each platform dir. Full steps: [cli](cli.md).

## After install

Host requirement is Node.js 20.11 or newer. Verify on any platform by asking for the roster. Configure mode, branch, and commit style in `.mugiwara/config` per the [config page](../concepts/config.md). Issues go to the repository tracker.
