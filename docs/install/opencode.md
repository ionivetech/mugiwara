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
   (21 skills + 11 agents (+3 internal)) without any file copying.

2. **Chat message hook** — intercepts `/mugiwara` commands and
   natural-language mode switches, writing `.mugiwara/config`.

3. **Commands** — the file-based installer copies slash commands
   (`/mugiwara`, `/mugiwara-continue`, `/mugiwara-review`,
   `/mugiwara-security`) to `.opencode/commands/`.

Mugiwara stays silent at session start: nothing is injected until a mugiwara
skill or agent is used. Skills load on-demand via OpenCode's native `skill`
tool. Agents appear
as subagents with full config (color, temperature, step limits). Runtime
permissions are generated for internal subagent-only agents only
(skeptic-verifier, eval-runner, memory-keeper); user-facing crew agents get
no permission — write-scope is rules-based (see the
[harness matrix](../reference/harness-matrix.md)).

## Mode switching

Switch autonomy mode at runtime:

```
/mugiwara guided    # human decides every GO
/mugiwara semi      # auto branch + commit, plan needs GO
/mugiwara auto      # hands-off except high-risk
/mugiwara           # show current mode
```

## Verify

Ask your agent:

```
what mugiwara crew members are available?
```

Or type `/mugiwara` to see the crew router.

## Update

OpenCode pins the resolved version in its own package cache — `npm update`
does **not** touch it. To upgrade to a newer release:

```bash
# global install (most common)
rm -rf ~/.cache/opencode/packages/@ionivetech/mugiwara@latest \
       ~/.cache/opencode/packages/@ionivetech/mugiwara
opencode plugin @ionivetech/mugiwara -g
```

Drop `-g` for a project-level install. Then restart OpenCode.

## Uninstall

Remove `"@ionivetech/mugiwara"` from the `plugin` array in `opencode.json`,
then restart OpenCode.

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode --print-logs`
2. Verify the plugin line in `opencode.json`
3. Ensure you're on a recent OpenCode version

### Server error on startup

Clear the stale plugin cache and reinstall:

```bash
rm -rf ~/.cache/opencode/packages/@ionivetech/mugiwara@latest \
       ~/.cache/opencode/packages/@ionivetech/mugiwara
opencode plugin @ionivetech/mugiwara -g
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
`~/.mugiwara/config` (global). See [config.md](../concepts/config.md).
