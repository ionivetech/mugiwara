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

Ask what crew members are available; a correct install answers with the roster. Cursor resolves through the host plugin manifest with content pointers, per the [harness matrix](../reference/harness-matrix.md). Run state commands (`status`, `continue`, `cost`) via `npx @ionivetech/mugiwara@latest` with no install step needed. Without the CLI the crew still runs the pipeline but resume, budget tracking, and the closure gate stay off. Removal happens on the host side through Cursor's own uninstall flow.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.
