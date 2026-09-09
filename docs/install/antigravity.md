# Antigravity Install

You run Antigravity and want the crew without paying full-file load on every glob. Install writes small stub pointers and keeps the full bodies under `.mugiwara/refs/` for on-demand loading.

Example: one CLI command writes 125 stub files under `.agents/`. Ask what crew members are available and the roster answers back, opening each reference only when the task needs it.

## Install

1. Run `npx @ionivetech/mugiwara@latest install --target antigravity --yes` in your project. Drop `--yes` for the interactive wizard.
2. Confirm `.agents/` holds the stubs and `.mugiwara/refs/` holds the full bodies, plus `.mugiwara/config` and the install manifest.

```bash
npx @ionivetech/mugiwara@latest install --target antigravity --yes
```

```text
-> Antigravity (project)
   written 125, skipped 0, backed up 0
OK mugiwara 0.9.2 installed [...]
```

*Anchor lines from a real run; manifest path and notes trimmed.*

## Verify, update, remove

Ask what crew members are available; a correct install answers with the roster. `mugiwara list --check` reports missing files as a health pass. Update with the update command naming project, target, and confirmation; uninstall removes exactly what the manifest recorded. Antigravity is tier 3, so the main thread embodies each persona from markdown and reads the full body on demand. A host-native plugin-install path is untested on this host; the CLI path above is the verified one.

State commands are crew-wide: the orchestration router (`status`, `continue`, `cost`, `archive`, `clean`, `handoff`, `sign`, `lesson`, `migrate`) runs through `mugiwara ...` or `npx -y @ionivetech/mugiwara@latest ...`, and bare `archive`/`handoff`/`sign` list missions to pick (exit 2) instead of guessing. Only Claude Code and opencode add a `/mugiwara` slash-command wrapper; the router itself is orchestration, loaded everywhere.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.
