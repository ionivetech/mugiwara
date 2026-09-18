# Codex Install

You run Codex and want the crew as rules it reads per task, not a plugin to babysit. Install writes stub pointers into your project and keeps full bodies under `.mugiwara/refs/` for on-demand loading.

Example: one CLI command writes 91 files under `.codex/mugiwara/`. Ask what crew members are available and the roster answers back with the same crew every other harness serves.

## Install

1. Run `npx @ionivetech/mugiwara@latest install --target codex --yes` in your project. Drop `--yes` for the interactive wizard covering scope, targets, and confirmation.
2. Confirm `.codex/mugiwara/` holds the skill and agent files, plus `.mugiwara/config` and the install manifest.

```bash
npx @ionivetech/mugiwara@latest install --target codex --yes
```

```text
-> Codex (project)
   written 91, skipped 0, backed up 0
OK mugiwara 0.9.2 installed [...]
```

*Anchor lines from a real run; manifest path and notes trimmed.*

## Verify, update, remove

Ask what crew members are available; a correct install answers with the roster. `mugiwara list --check` reports missing and stale files as a health pass. Update with the update command naming project, target, and confirmation; uninstall removes exactly what the manifest recorded. Codex is tier 3, so the main thread embodies each persona from markdown and reads the full body on demand. A host-native `codex plugin add` path is untested on this host; the CLI path above is the verified one.

State commands are crew-wide: the orchestration router (`status`, `continue`, `cost`, `archive`, `clean`, `handoff`, `sign`, `lesson`, `migrate`) runs through `mugiwara ...` or `npx -y @ionivetech/mugiwara@latest ...`, and bare `archive`/`handoff`/`sign` list missions to pick (exit 2) instead of guessing. Only Claude Code and opencode add a `/mugiwara` slash-command wrapper; the router itself is orchestration, loaded everywhere.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.
