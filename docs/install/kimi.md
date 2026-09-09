# Kimi Code Install

You run Kimi Code and want the crew through its own marketplace manifest, not a file copy. The CLI refuses `--target kimi` on purpose and tells you so; install happens on the host side, while state commands still run through npx.

Example: install the plugin from the repo URL on the host (`/plugins install https://github.com/ionivetech/mugiwara`, untested on this host, verify the exact syntax on Kimi's plugin page before running), then ask what crew members are available. The roster answers back.

## Install

1. In Kimi Code, install the mugiwara plugin from the repo URL through the host marketplace flow.
2. Confirm the refusal below if you try the CLI path, which proves marketplace-only routing is intact.

```bash
mugiwara install --target kimi --yes
```

```text
mugiwara: kimi installs through its marketplace manifest, not --target.
```

*Verbatim output from a real CLI run.*

## Verify, update, remove

Ask what crew members are available; a correct install answers with the roster. Kimi resolves through the host plugin manifest with content pointers, per the [harness matrix](../reference/harness-matrix.md). State commands are crew-wide: the orchestration router (`status`, `continue`, `cost`, `archive`, `clean`, `handoff`, `sign`, `lesson`, `migrate`) runs through `mugiwara ...` or `npx -y @ionivetech/mugiwara@latest ...` in every harness, and bare `archive`/`handoff`/`sign` list missions to pick (exit 2) instead of guessing. Only Claude Code and opencode add a `/mugiwara` slash-command wrapper; the router itself is orchestration, loaded everywhere. Without the CLI the crew still runs the pipeline but resume, budget tracking, and the closure gate stay off. Removal happens on the host side through Kimi's own uninstall flow.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.
