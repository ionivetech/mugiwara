# How do I install the CLI?

Windsurf, Cline, and Kilo expose no native plugin system, so files must land in each platform's config directory by copy. The mugiwara CLI installer performs that copy, records it in a manifest, and updates or removes exactly what it wrote.

Example: a Windsurf user runs the installer with target windsurf and confirmation skipped. Rule stubs land in the Windsurf rules dir, full skill bodies land under `.mugiwara/refs/` for on-demand loading, and the manifest records every path for later update or uninstall.

## Install

Run `npx @ionivetech/mugiwara@latest install --target <id> --yes` with id windsurf, cline, or kilo. Prefer a global binary via `npm i -g @ionivetech/mugiwara`, then `mugiwara install --target <id> --yes`. Drop `--yes` for the interactive wizard covering scope, targets, and confirmation. Combine targets with commas or pass `all`.

## What gets written

Windsurf receives rule stubs under its rules dir, Cline under its rules dir, Kilo under its rules dir plus a bootstrap file. All three share full skill bodies under `.mugiwara/refs/`, since tier 3 targets keep rule files small through pointers plus routing. Global installs write under the home dir equivalents.

## Verify, update, remove

Ask the agent what crew members are available; a correct install answers with the roster. Update with the update command naming project, target, and confirmation. Uninstall removes exactly what the manifest recorded. List shows installations, list with check runs a health pass over missing files, and reset wipes mission state while optionally keeping lessons.

## Configure and run

Point `.mugiwara/config` at desired mode, branch, and commit style; the concepts config page documents every key. Mission runtime commands work from any harness: status, archive, clean, continue, cost, run, savepoint, join, migrate, lesson. Status reads state files with no model turn involved; continue exits nonzero when the user must pick from listed options.
