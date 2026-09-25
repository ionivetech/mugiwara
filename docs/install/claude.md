# How do I use it with claude?

Claude Code reads crew files natively, so install means registering the marketplace plugin once. No copying, no path registration by hand.

Example: run `/plugin marketplace add ionivetech/mugiwara` then `/plugin install mugiwara`. Ask what crew members are available; the full roster of 11 agents plus 21 skills answers back, and the session hook announces the crew at every start.

## Details

The plugin symlinks skills and agents into `content/`, auto-discovering everything, while the SessionStart hook injects the announce header. Update with `/plugin update mugiwara`, remove with `/plugin uninstall mugiwara`. Set mode with `/mugiwara-mode guided|semi|auto` or pin it in `.mugiwara/config`; every key is documented on the [config page](../concepts/config.md). The `/mugiwara` state router is the crew-wide orchestration capability — its canonical table lives in the orchestration skill (`mugiwara-orchestration/references/state-router.md`), the same one every other harness loads; this host only adds the slash wrapper. Claude Code is tier 1, so auditor and reviewer deny-scopes from [permissions](../concepts/permissions.md) attach to the agent invocation context when you want them.

## Clean uninstall

Plugin install: `/plugin uninstall mugiwara`, then remove the marketplace checkout at `~/.claude/plugins/marketplaces/mugiwara` (plus `cache/` if a stale version persists), restart Claude Code, and verify the roster question no longer lists the crew. CLI install: `mugiwara uninstall [--global]` deletes the installed files and unmerges the hook entries from `settings.json` (your other settings stay). `.mugiwara/config` is yours and stays unless you remove it.
