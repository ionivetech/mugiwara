# How do I install it?

Your editor is open and the crew is not in it. You want the smallest install that puts all 20 skills and 14 agents behind your prompts, with a manifest so update and uninstall touch exactly what install wrote. Pick your harness below and follow its page.

Example: an OpenCode user adds one plugin line to `opencode.json` and restarts, while a Codex user runs one CLI command that writes 91 files under `.codex/mugiwara/`. Both then ask "what mugiwara crew members are available" and receive the same roster. Same crew, different doors.

| Harness | How the crew loads | Install page |
|---|---|---|
| Claude Code | native plugin plus session hook | [claude](claude.md) |
| opencode | plugin line in `opencode.json`, restart | [opencode](opencode.md) |
| Windsurf, Cline, Kilo | CLI copies rules plus references | [cli](cli.md) |
| Codex | CLI writes 91 full-body files to `.codex/mugiwara/` | [codex](codex.md) |
| Gemini CLI | CLI writes full-body files to `.gemini/mugiwara/` | [gemini](gemini.md) |
| Copilot | CLI writes 111 full-body files to `.github/` | [copilot](copilot.md) |
| Antigravity | CLI writes 125 stub files to `.agents/` | [antigravity](antigravity.md) |
| Pi | host marketplace manifest plus content pointers | [pi](pi.md) |
| Cursor | host marketplace manifest plus content pointers | [cursor](cursor.md) |
| Kimi Code | host marketplace manifest plus content pointers | [kimi](kimi.md) |

Three loading paths cover all ten rows. Native plugins (Claude Code, opencode) register paths and discover the crew with no copying. CLI targets (Codex, Gemini, Copilot, Antigravity, plus Windsurf, Cline, Kilo on the cli page) receive full bodies or stub pointers with references under `.mugiwara/refs/`. Marketplace hosts (Pi, Cursor, Kimi) resolve through the host manifest, and the CLI still provides state commands through npx. Tier behavior behind these paths lives on the [harness matrix](../reference/harness-matrix.md).

Scope is project by default and user-wide with `--global`. Every CLI install writes a default `.mugiwara/config` for mode, branch, and commit style, plus a manifest recording each path. Pass `--target all` for every supported host at once, or name targets with commas. Drop `--yes` for the interactive wizard covering scope, targets, and confirmation. Prefer a global binary via `npm i -g @ionivetech/mugiwara` so the crew can call `mugiwara savepoint`, `archive`, and `continue`; without it the crew warns at Flow 0 and degrades to inline-only with no resume and no closure gate.

## After install

Host requirement is Node.js 20.11 or newer. Verify on any platform by asking for the roster: a correct install answers with the crew list. `mugiwara list` shows recorded installations with version and file counts, and `mugiwara list --check` reports missing files as a health pass. Update replaces installed files with backups of differences, and uninstall removes exactly what the manifest recorded. Set mode, branch, and commit style in `.mugiwara/config` per the [config page](../concepts/config.md). Report failures at the [tracker](https://github.com/ionivetech/mugiwara/issues).

Open your harness page above and run its verify step.
