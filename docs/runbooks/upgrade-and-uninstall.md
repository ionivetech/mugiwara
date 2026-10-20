# Runbook: Upgrade, clean up, uninstall

A new release landed, or you want the crew out of a repo, and you do not want to lose a mission that is still in flight. This page covers the five commands that change what is installed or what is on disk, and what each one leaves alone.

**When to use this:** you update the package, tidy up old missions, or remove Mugiwara from a repo.
**Time:** 5 minutes.
**You need:** the global CLI, and a clean `git status` so you can see what changed.

## Upgrade

1. Update the package, then check what is installed against what the CLI would write.
   ```bash
   mugiwara list --check
   ```
   ```
   project: v1.0.5 targets=claude files=115 missing=0 stale=0 installed=2026-10-19T05:04:33.716Z
   ```
   `missing` counts installed files that are gone, `stale` counts files that no longer match.
2. Read `UPGRADING.md` at the repo root of the package. Start with its "What to do" list: a release says there what you must change and what you can leave. It also lists what stays the same on purpose.
3. Refresh the installed copies.
   ```bash
   mugiwara update --target claude --yes
   ```
   ```
   -> Claude Code (project)
      written 5, skipped 93, backed up 1
      note: existing command kept: <project>/.claude/commands/mugiwara-review.md
      note: existing command kept: <project>/.claude/commands/mugiwara-continue.md
      note: existing command kept: <project>/.claude/commands/mugiwara.md
      note: existing command kept: <project>/.claude/commands/mugiwara-security.md

   OK mugiwara 1.0.5 installed (manifest: <project>/.mugiwara/manifest.json)
   ```
   *Real output, shortened. In this run one agent file had a local edit and one was deleted. Update wrote the missing file, replaced the edited one, and kept a copy of the edit under `.mugiwara/backup/<timestamp>-claude/`. Command files that already exist are kept as they are, so your own changes to `/mugiwara` survive an update.*
4. Run `mugiwara list --check` again. It should report `missing=0 stale=0`.

## What happens to missions in flight

Nothing. `update` does not touch `.mugiwara/missions/`, `.mugiwara/config` or your lessons file. The files under `flows/NN-*.md` keep their names on purpose, so a mission started before the upgrade resumes the same way. Check with `mugiwara continue`, see [resume after a crash](resume-after-crash.md).

If your `features=` line in `.mugiwara/config` names an old skill, it still works as an alias for the new one. You can rename at your own pace.

## Tidy up old missions

5. Fold every closed mission into its report in one go.
   ```bash
   mugiwara clean
   ```
   ```
   closure integrity warnings (non-blocking):
     ✗ [evidence] mission declares no evidence — closing with zero recorded checks
   cleaned rbac → missions/rbac/report.md
   index updated: index.md
   ```
   `clean` skips missions that still have live state. `--include-live` includes them, but it still refuses until you add `--force`:
   ```
   ✗ in-flight mission(s): live1. Use --force to archive them anyway.
   ```
   Archiving a live mission throws away its resume point. `--stale <date>` also picks up missions untouched since that date.

## Wipe mission state

6. Start over without losing what the team learned:
   ```bash
   mugiwara reset --keep-logs
   ```
   ```
   ✗ Active mission for '<git author>'. Use --force to override.
   ```
   *Masked: the real message prints your git name and email. `reset` refuses while you have a mission in flight, and it exits with code 0 even so, so a script will not notice.* With `--force`:
   ```
   removed: missions
   kept: lessons.md, config, manifest.json
   ```
   Plain `reset --force` also removes `lessons.md`. Reset deletes mission folders, including reports you never committed. Commit what you want to keep first.

## Uninstall

7. Remove the installed files with the manifest as the list.
   ```bash
   mugiwara uninstall --yes
   ```
   ```
   Will remove 115 files (targets: claude).
      unwired mugiwara hooks from <project>/.claude/settings.json
      note: .gitignore stripped mugiwara block
   OK removed 115 files
   ```
   Without `--yes` it asks `Proceed? [y/N]` first.
8. Check `.claude/settings.json`. In a throwaway repo (v1.0.5) one `PreToolUse` entry for `pretool-guard.js` was still there after uninstall, pointing at a file that no longer exists. Delete that entry by hand. Your own settings stay as they were.
9. Decide what to do with `.mugiwara/`. Uninstall leaves `config`, `lessons.md`, `missions/` and `backup/`. Your reports are yours, so keep them or delete the folder.

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| `mugiwara: command not found` | the global CLI is not installed | `npm i -g @ionivetech/mugiwara`, or run `npx -y @ionivetech/mugiwara@latest <command>` |
| `✗ in-flight mission(s)` from `clean` | a mission still has live state | finish it, or pass `--force` and lose its resume point |
| a hook entry still points at `.claude/hooks/` after uninstall | uninstall left one `PreToolUse` entry behind | delete that entry from `.claude/settings.json` |

## What you end up with

An installed crew that matches the package, or a repo without it. Missions in flight keep their names, state and resume points. Reports stay on disk until you remove them.
