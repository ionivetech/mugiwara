# Runbook: Troubleshooting common failures

A command failed and the message is your starting point. Match it below, apply the fix, re-run.

**When to use this:** a `mugiwara` command errors and you need the fix for that message.
**Time:** ~2 min per symptom.
**You need:** the failing command plus its full output.

## Steps
1. Read the full error. Most messages print the exact fix line. With nothing on
   disk, even the error tells you the next move:
   ```bash
   mugiwara continue
   ```
   ```
   No mission in flight. Start one with Flow 0 triage (mugiwara-orchestration).
   ```
2. Match it in the table below and apply the fix.
3. Re-run the command; if the message changed, match again from the top.

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| `refusing to add member 'jane-doe' … Run: mugiwara migrate --to-team jane-doe` | solo mission (`state.json`) asked for a handle | `mugiwara migrate --to-team jane-doe` |
| `has a resume point but no state file` | orphan resume point | `mugiwara savepoint`, or `rm .mugiwara/missions/m/continue-jane-doe.json` |
| `closure blocked` naming an unfinished mission | assignee below Flow 9 | finish every handle, or archive with `--force` knowing resume points die |
| `has state but no sub-mission in plan.md` | handle started without a roster row | `mugiwara join crew1 eleanor-vance --area <area>`, or fix the handle spelling |
| `savepoint: not a git repository` | ran outside git | `git init`, commit, retry |
| `handoff --path` outside git (…)` | provenance needs git history | run inside the repo |
| `no mugiwara provenance note` from `handoff --path` | notes are not fetched by clone or pull | `git fetch origin 'refs/notes/mugiwara:refs/notes/mugiwara'` |
| `closure integrity gate failed` from `mugiwara archive` | missing file link, secret-shaped string, or bad evidence path | fix the flagged file and re-archive. There is no bypass flag |
| `invalid member name "x"` | spaces or reserved word | slug such as `grace-hopper` |
| `conflict (not overwritten; run update to replace with backup)` from install | target file differs from what install writes | `mugiwara update`, which backs up first |
| `No mission state on disk.` | nothing recorded here | check branch, or start at Flow 0 |
| session banner never appears | crew replies without dispatch header | expect a Flow N header line at each stage start; missing means inline-only, no state |

## What you end up with
Either a green re-run or a narrower error. Iterate the table until the command
prints its normal output. When two symptoms overlap,
fix state corruption before roster issues: a corrupt state file hides the roster.
