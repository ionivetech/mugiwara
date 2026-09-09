# GitHub Copilot Install

You run Copilot and want the crew where the agent already looks: project rules plus markdown agents, with native worker dispatch for audits. Install copies full bodies into `.github/` and Copilot reads them from there.

Example: one CLI command writes 111 files under `.github/`. Ask what crew members are available and the roster answers back, and a Jinbe security audit dispatches as an isolated subagent on this host.

## Install

1. Run `npx @ionivetech/mugiwara@latest install --target copilot --yes` in your project. Drop `--yes` for the interactive wizard.
2. Confirm `.github/` holds the skill and agent files, plus `.mugiwara/config` and the install manifest.

```bash
npx @ionivetech/mugiwara@latest install --target copilot --yes
```

```text
-> GitHub Copilot (project)
   written 111, skipped 0, backed up 0
OK mugiwara 0.9.2 installed [...]
```

*Anchor lines from a real run; manifest path and notes trimmed.*

## Verify, update, remove

Ask what crew members are available; a correct install answers with the roster. `mugiwara list --check` reports missing files as a health pass. Update with the update command naming project, target, and confirmation; uninstall removes exactly what the manifest recorded. Copilot is tier 2 with native worker dispatch, so auditor and reviewer agents run isolated here while skills load as rules files per task. A host-native plugin-install path is untested on this host; the CLI path above is the verified one.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.
