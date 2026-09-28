# How do I use it with claude?

Claude Code reads crew files natively, so install means registering the marketplace plugin once.

## Install

```bash
/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara
```

Ask what crew members are available; the full roster of 11 agents plus 21 skills answers back, and the session hook announces the crew.

Entry point: chat or `/mugiwara`, never `@agent`. See [harness matrix](../reference/harness-matrix.md).

## Verify, update, remove

The plugin symlinks skills and agents into `content/`, auto-discovering everything. Update with `/plugin update mugiwara`, remove with `/plugin uninstall mugiwara`. Set mode with `/mugiwara-mode guided|semi|auto` or pin it in `.mugiwara/config`, documented on the [config page](../concepts/config.md). The `/mugiwara` state router is crew-wide; its table lives in the orchestration skill, which every other harness loads too. Claude Code is tier 1, so deny-scopes from [permissions](../concepts/permissions.md) attach when you want them.

## Clean uninstall

Plugin install: `/plugin uninstall mugiwara`, then remove the marketplace checkout at `~/.claude/plugins/marketplaces/mugiwara` (plus `cache/` if a stale version persists), restart, and verify the roster question no longer lists the crew. CLI install: `mugiwara uninstall [--global]` deletes the installed files and unmerges the hook entries from `settings.json` (your other settings stay). `.mugiwara/config` is yours and stays unless you remove it.
