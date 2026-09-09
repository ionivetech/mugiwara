# Codex Install

You run Codex and want the crew as rules it reads per task, not a plugin to babysit. Install copies full skill bodies plus agent markdown into your project, and Codex picks them up from there.

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

Ask what crew members are available; a correct install answers with the roster. `mugiwara list --check` reports missing files as a health pass. Update with the update command naming project, target, and confirmation; uninstall removes exactly what the manifest recorded. Codex is tier 2, so skills load as rules files the model selects per task, with references under `.mugiwara/refs/`. A host-native `codex plugin add` path is untested on this host; the CLI path above is the verified one.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.
