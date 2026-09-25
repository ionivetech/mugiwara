# Cursor Install

You run Cursor and want the crew behind a slash command, not a file copy. The CLI refuses `--target cursor` on purpose and tells you so; install happens on the host side, while state commands still run through npx.

Example: add the plugin on the host (`/add-plugin mugiwara`, untested on this host, verify the exact syntax on Cursor's plugin page before running), then ask what crew members are available. The roster answers back.

## Install

1. In Cursor, add the mugiwara plugin through the host marketplace flow.
2. Confirm the refusal below if you try the CLI path, which proves marketplace-only routing is intact.

```bash
mugiwara install --target cursor --yes
```

```text
mugiwara: cursor installs through its marketplace manifest, not --target.
```

*Verbatim output from a real CLI run.*

## Verify, update, remove

Ask what crew members are available; a correct install answers with the roster. Cursor resolves through the host plugin manifest with content pointers, per the [harness matrix](../reference/harness-matrix.md). The crew-wide state router (`status`, `continue`, `cost`, `archive`, `clean`, `handoff`, `sign`, `lesson`, `migrate`) runs through `mugiwara ...` or `npx -y @ionivetech/mugiwara@latest ...`; bare `archive`/`handoff`/`sign` list missions to pick (exit 2). Only Claude Code and opencode add the `/mugiwara` wrapper. Without the CLI a project install keeps state and resume through the fallback ladder (binary → npx → `.mugiwara/bin/` → file ops). Removal happens through Cursor's own uninstall flow.

## Clean uninstall

Marketplace install: remove the mugiwara extension through Cursor's own extension-removal flow, then reload the window and verify the roster question no longer lists the crew. If a stale pinned copy survives the reload, clear Cursor's plugin cache directory and repeat. If you also ran a CLI install for state commands, run `mugiwara uninstall` (or remove `.mugiwara/refs/` and the per-target rules files listed by `mugiwara list --check`). `.mugiwara/config` and the `.gitignore` block are yours and stay unless you remove them.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.
