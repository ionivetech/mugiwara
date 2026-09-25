# Pi Install

You run Pi and want the crew through its own marketplace manifest, not a file copy. The CLI refuses `--target pi` on purpose and tells you so; install happens on the host side, while state commands still run through npx.

Example: register the repo URL in Pi's package install flow, then ask what crew members are available. The roster answers back with the same crew every other harness serves.

## Install

1. In Pi, install the package from the repo URL (`pi install` with the `github.com/ionivetech/mugiwara` git source, untested on this host, verify the exact syntax on Pi's plugin page before running).
2. Confirm the refusal below if you try the CLI path, which proves marketplace-only routing is intact.

```bash
mugiwara install --target pi --yes
```

```text
mugiwara: pi installs through its marketplace manifest, not --target.
```

*Verbatim output from a real CLI run.*

## Verify, update, remove

Ask what crew members are available; a correct install answers with the roster. Pi resolves through the host plugin manifest with content pointers, per the [harness matrix](../reference/harness-matrix.md). The crew-wide state router (`status`, `continue`, `cost`, `archive`, `clean`, `handoff`, `sign`, `lesson`, `migrate`) runs through `mugiwara ...` or `npx -y @ionivetech/mugiwara@latest ...`; bare `archive`/`handoff`/`sign` list missions to pick (exit 2). Only Claude Code and opencode add the `/mugiwara` wrapper. Without the CLI a project install keeps state and resume through the ladder (binary → npx → `.mugiwara/bin/` → file ops).

## Clean uninstall

Marketplace install: remove the mugiwara extension through Pi's own extension-removal flow, restart Pi, and verify the roster question no longer lists the crew. If a stale pinned copy survives, clear Pi's plugin cache and repeat. If you also ran a CLI install, run `mugiwara uninstall` (or remove `.mugiwara/refs/` and the per-target rules files `mugiwara list --check` shows). `.mugiwara/config` and the `.gitignore` block are yours and stay unless you remove them.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.
