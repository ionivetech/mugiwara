# How do I install it?

Pick your harness below for the smallest install: all 21 skills and 14 agents behind your prompts, with a manifest scoping update and uninstall to exactly what install wrote.

Example: an OpenCode user adds one plugin line and restarts; a Codex user runs one CLI command. Both ask for the roster and receive the same crew.

| Harness | How the crew loads | Install page |
|---|---|---|
| Claude Code | native plugin plus session hook | [claude](claude.md) |
| opencode | plugin line in `opencode.json`, restart | [opencode](opencode.md) |
| Windsurf, Cline, Kilo | CLI copies rules plus references | [cli](cli.md) |
| Codex | CLI writes 91 stub files to `.codex/mugiwara/` | [codex](codex.md) |
| Gemini CLI | CLI writes stub files to `.gemini/mugiwara/` | [gemini](gemini.md) |
| Copilot | CLI writes 111 stub files to `.github/` | [copilot](copilot.md) |
| Antigravity | CLI writes 125 stub files to `.agents/` | [antigravity](antigravity.md) |
| Pi | host marketplace manifest plus content pointers | [pi](pi.md) |
| Cursor | host marketplace manifest plus content pointers | [cursor](cursor.md) |
| Kimi Code | host marketplace manifest plus content pointers | [kimi](kimi.md) |

Three loading paths cover all ten rows. Native plugins (Claude Code, opencode) register paths with no copying. CLI targets receive full bodies or stubs with references under `.mugiwara/refs/`. Marketplace hosts (Pi, Cursor, Kimi) resolve via manifest; the CLI still serves state commands through npx. State commands (`status`, `continue`, `cost`, `archive`, `clean`, `handoff`, `sign`, `lesson`, `migrate`) route identically everywhere; bare `archive`/`handoff`/`sign` list missions (exit 2). Only Claude Code and opencode surface the `/mugiwara` slash command. Tier behavior: [harness matrix](../reference/harness-matrix.md).

Scope is project by default and user-wide with `--global`. Every CLI install writes a default `.mugiwara/config` for mode, branch, and commit style, plus a manifest recording each path. Pass `--target all` for every supported host at once, or name targets with commas. Drop `--yes` for the interactive wizard covering scope, targets, and confirmation. Prefer a global binary via `npm i -g @ionivetech/mugiwara` for direct `savepoint`/`archive`/`continue` calls; without it the crew falls back to `npx`, `.mugiwara/bin/`, then direct file ops — state and resume keep working. Full degradation to inline-only happens only when every rung fails.

## After install

Host requirement: Node.js 20.11+. Verify by asking for the roster. `mugiwara list` shows installations; `list --check` reports missing/stale files. Update backs up differences; uninstall removes exactly what install wrote. Configure via the [config page](../concepts/config.md). Report failures at the [tracker](https://github.com/ionivetech/mugiwara/issues).

Open your harness page above and run its verify step.
