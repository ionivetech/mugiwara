# Gemini CLI Install

You run Gemini CLI and want the crew as extensions it loads per task. Install copies full skill bodies plus agent markdown into your project and tells you the one line that points the agent at them.

Example: one CLI command writes the crew under `.gemini/mugiwara/` and prints a note asking you to reference the workflow file from `GEMINI.md`. Ask what crew members are available and the roster answers back.

## Install

1. Run `npx @ionivetech/mugiwara@latest install --target gemini --yes` in your project. Drop `--yes` for the interactive wizard.
2. Add the printed line to `GEMINI.md` so the agent finds `.gemini/mugiwara/mugiwara-workflow.md` and runs the pipeline inline in the main conversation.
3. Confirm `.gemini/mugiwara/` holds the skill and agent files.

```bash
npx @ionivetech/mugiwara@latest install --target gemini --yes
```

```text
-> Gemini CLI (project)
   written 91, skipped 0, backed up 0
OK mugiwara 0.9.2 installed [...]
```

*Anchor lines from a real run; manifest path and the GEMINI.md note trimmed.*

## Verify, update, remove

Ask what crew members are available; a correct install answers with the roster. `mugiwara list --check` reports missing files as a health pass. Update with the update command naming project, target, and confirmation; uninstall removes exactly what the manifest recorded. Gemini is tier 2, so skills load as rules files the model selects per task, with references under `.mugiwara/refs/`. A host-native extensions-install path is untested on this host; the CLI path above is the verified one.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.
