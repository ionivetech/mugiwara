# OpenCode Install

Mugiwara installs through OpenCode's native npm plugin system.

## Prerequisites

- [OpenCode](https://opencode.ai) installed
- Node.js >= 20.11

## Install

Add to `opencode.json` (global at `~/.config/opencode/opencode.json` or
project-level at `.opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@ionivetech/mugiwara"]
}
```

Restart OpenCode.

### Pinning a version

```json
{ "plugin": ["@ionivetech/mugiwara@^0.5.0"] }
```

## How it works

The plugin (`mugiwara.mjs`) does three things:

1. **Config hook** — registers `content/skills/` as a skills path and
   `content/agents/` as agents so OpenCode discovers the full crew
   (26 skills + 15 agents) without any file copying.

2. **System transform hook** — injects the crew announce header and active
   autonomy mode into every session's system prompt.

3. **Chat message hook** — intercepts `/mugiwara-mode` commands and
   natural-language mode switches, writing `.mugiwara/config`.

Skills are loaded on-demand via OpenCode's native `skill` tool. Agents appear
as subagents with full config (color, temperature, permissions, step limits).

## Verify

Ask your agent:

```
what mugiwara crew members are available?
```

Or type `/mugiwara` to see the crew router.

## Update

```bash
npm update @ionivetech/mugiwara
```

Or bump the version constraint in `opencode.json` and restart.

## Uninstall

Remove `"@ionivetech/mugiwara"` from the `plugin` array in `opencode.json`,
then restart OpenCode.

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode --print-logs`
2. Verify the plugin line in `opencode.json`
3. Ensure you're on a recent OpenCode version

### Server error on startup

Fixed in v0.5.3. Ensure you're on the latest:

```bash
npm update @ionivetech/mugiwara
```

If it persists, file at https://github.com/ionivetech/mugiwara/issues.

### Skills not found

1. Use the `skill` tool to list available skills
2. Check the plugin loaded (see "Plugin not loading")
3. Each skill needs a `SKILL.md` with valid YAML frontmatter (`name`, `description`)

### Windows

Some Windows OpenCode builds have Bun path issues with npm packages. If the
plugin won't install, try:

```powershell
npm install @ionivetech/mugiwara --prefix "$HOME\.config\opencode"
```

Then use the local path in `opencode.json`:

```json
{ "plugin": ["~/.config/opencode/node_modules/@ionivetech/mugiwara"] }
```

## Tool mapping

Mugiwara skills reference general actions. On OpenCode these map to:

| Action | OpenCode tool |
|--------|---------------|
| Create a todo | `todowrite` |
| Dispatch a subagent | `task` with `subagent_type` |
| Invoke a skill | `skill` |
| Read a file | `read` |
| Edit a file | `edit` or `write` |
| Run a shell command | `bash` |
| Search code | `grep`, `glob` |
| Fetch a URL | `webfetch` |

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [docs/config.md](config.md).

Switch autonomy mode at runtime: `/mugiwara-mode guided|semi|auto`
