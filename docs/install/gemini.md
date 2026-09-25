# Gemini CLI Install

You run Gemini CLI and want the crew as extensions it loads per task. Install writes stub pointers into your project and tells you the one line that points the agent at them.

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

Ask what crew members are available; a correct install answers with the roster. `mugiwara list --check` reports missing and stale files as a health pass. Update with the update command naming project, target, and confirmation. Gemini is tier 3, so the main thread embodies each persona from markdown and reads the full body on demand. A host-native extensions-install path is untested here; the CLI path above is verified. The crew-wide state router (`status`, `continue`, `cost`, `archive`, `clean`, `handoff`, `sign`, `lesson`, `migrate`) runs through `mugiwara ...` or `npx -y @ionivetech/mugiwara@latest ...`.

Set mode and branch in `.mugiwara/config` per the [config page](../concepts/config.md), then open [Getting started](../getting-started.md) and hand the crew one real task.

## Clean uninstall

`mugiwara uninstall [--global]` removes exactly what the manifest recorded (check with `mugiwara list --check`). Remove by hand what the manifest never owned: `.gemini/mugiwara/` rule files, `.mugiwara/refs/` rule bodies, and the pointer line in `GEMINI.md` if your file pre-existed the install. `.mugiwara/config` and the `.gitignore` block are yours and stay unless you remove them. Verify: the roster question no longer lists the crew.
