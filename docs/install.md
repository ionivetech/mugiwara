# Install

You use one AI coding tool and want to know the shortest working install, and what you actually get on that tool. Platforms differ a lot: four load the full crew natively (Claude Code, opencode, Codex, Cursor) and the rest get small pointer files. This page says which is which.

Example: on Claude Code you register a plugin with two slash commands. On Codex a CLI command writes native skills and custom agents into your project. Both then answer "which crew members are available?" with the same roster. Only Claude Code and opencode can also enforce guards at runtime (see the [harness matrix](reference/harness-matrix.md)).

Requirements: git and Node.js 20.11 or newer. Bash runs the lane and savepoint scripts. On Windows, Git for Windows ships bash. Set `MUGIWARA_BASH` when yours lives elsewhere.

## Install on a first-class platform

First-class targets are Claude Code, opencode, Codex and Cursor, each with native files and a conformance test.

Status as of 2026-11-01. Claude Code and opencode: tested end to end. Codex and Cursor: install verified by smoke only (`bun run smoke` checks files in a temp repo, not the host). Marketplace commands (`/plugin marketplace add`, `/plugin install`): unverified.

**Claude Code.** Run these two slash commands inside Claude Code:

```text
/plugin marketplace add ionivetech/mugiwara
/plugin install mugiwara
```

**opencode.** Add the plugin to `opencode.json` and restart opencode:

```json
{ "$schema": "https://opencode.ai/config.json", "plugin": ["@ionivetech/mugiwara"] }
```

**Codex.** The CLI writes native Codex files: 14 skills to `.agents/skills/<name>/SKILL.md` (references beside each skill) and 13 custom agents to `.codex/agents/<name>.toml` (`name`, `description`, `developer_instructions`). `--global` writes `~/.agents/skills` and `~/.codex/agents`.

```bash
npx -y @ionivetech/mugiwara@latest install --target codex --yes
```

Enforced vs rules: Codex has no hooks, runtime write-scope or irreversible-command guard; roles and workflow are prose. On 2026-10-19, a fresh risky-task run created a full-lane mission and ran focused tests, but its review worker failed because the harness used ephemeral mode; no archived report was produced. That harness default is fixed, pending another end-to-end run. Independent review remains unverified. Layout: [skills](https://developers.openai.com/codex/skills), [subagents](https://developers.openai.com/codex/subagents), [plugins](https://developers.openai.com/codex/plugins/build). Plugin agent bundling is undocumented, so its manifest ships skills only.

**Cursor.** The CLI writes native Cursor files: skills to `.cursor/skills/<name>/SKILL.md` and 14 subagents to `.cursor/agents/<name>.md` (`name`, `description`, `model: inherit`). `--global` writes `~/.cursor/skills` and `~/.cursor/agents`.

```bash
npx -y @ionivetech/mugiwara@latest install --target cursor --yes
```

Enforced vs rules: no hooks, and `readonly: true` is not used because it would also block `.mugiwara/**` artifacts, so write boundaries are prose. Status: layout verified against Cursor docs ([skills](https://cursor.com/docs/context/skills), [subagents](https://cursor.com/docs/subagents), [plugins](https://cursor.com/docs/plugins)); not run in a real Cursor. Unverified: the `.cursor-plugin/plugin.json` custom-path field names, plugin-bundled agents and the marketplace schema (docs gave none). Cursor also reads `.agents/skills/` and `.codex/*`, so installing both Codex and Cursor into one project may show duplicate skills (ASSUMPTION, untested).

## Other platforms (community, best effort)

These are community targets, best effort. They work through a generic rules-file install with no first-class guarantees. For each one, the install is the same command with a different id:

```bash
npx -y @ionivetech/mugiwara@latest install --target <id> --yes
```

The ids are `copilot`, `gemini`, `windsurf`, `cline`, `kilo` and `antigravity`. Gemini CLI also needs the printed line added to `GEMINI.md`. Kimi Code and Pi install through their own plugin manifests (untested here) and the CLI refuses them as targets.

Pin a version instead of `@latest` when you need repeatable installs, for example `@ionivetech/mugiwara@1.0.5`. Prefer `npm i -g @ionivetech/mugiwara` if you want the `mugiwara` command on your PATH. Without it the crew falls back to `npx`, then `.mugiwara/bin/`, then direct file edits, and state and resume keep working.

<details>
<summary>Every platform: what the CLI install writes today (v1.0.5, empty repo)</summary>

| Platform | Tier | Standing | Files written | Where |
|---|---|---|---|---|
| Claude Code | 1 | first-class | 117 | `.claude/` plus hooks in `settings.json` |
| opencode | 1 | first-class | 100 | `.opencode/` |
| Codex | 1 | first-class | see `install --dry-run` | `.agents/skills/`, `.codex/agents/*.toml` |
| Cursor | 1 | first-class | see `install --dry-run` | `.cursor/skills/`, `.cursor/agents/` |
| GitHub Copilot | 2 | community | 131 | `.github/`, `.mugiwara/refs/` |
| Gemini CLI | 3 | community | 132 | `.gemini/mugiwara/`, `GEMINI.md` line |
| Windsurf | 3 | community | 131 | `.devin/rules/` |
| Cline | 3 | community | 131 | `.clinerules/` |
| Kilo Code | 3 | community | 132 | `.kilo/`, `kilo.jsonc` |
| Antigravity | 3 | community | 131 | `.agents/` |
| Kimi Code | marketplace | community | none | manifest only, CLI refuses |
| Pi | marketplace | community | none | manifest only, CLI refuses |

</details>

File counts are from real installs into an empty repo with v1.0.5 and move as content changes. Run `mugiwara install --dry-run --target <id>` to see yours. Tier 3 targets keep rule files small and read the full playbook from `.mugiwara/refs/` on demand. Every install also writes `.mugiwara/config` and a manifest of the files it wrote.

## Verify

Ask the agent "which crew members are available?". A correct install answers with the roster of 11 agents (+2 internal). Then run `mugiwara list --check`, which reports missing or stale files.

## Update and remove

On Claude Code, update with `/plugin update mugiwara` and remove with `/plugin uninstall mugiwara`, then delete the marketplace checkout under `~/.claude/plugins/marketplaces/mugiwara` if a stale copy remains and restart.

On opencode, removing the plugin line is not enough, because opencode keeps a pinned copy. Remove the line from `opencode.json`, delete `~/.cache/opencode/packages/@ionivetech/`, restart, and check that `/mugiwara` is unknown. To update, delete that cache directory and restart.

For CLI installs, `mugiwara update --target <id> --yes` replaces files (backing up differences first), and `mugiwara uninstall [--global]` removes exactly the files the manifest recorded. By hand, remove what the manifest never owned: the pointer line in `GEMINI.md` or `kilo.jsonc` if your file existed before the install, and `.mugiwara/refs/`. `.mugiwara/config` and the `.gitignore` block are yours and stay.

Switch autonomy by saying `mugiwara mode guided`, `semi` or `auto` in chat, or pin it in `.mugiwara/config`, see [config](concepts/config.md). Next, [get started](getting-started.md) with one small task.
