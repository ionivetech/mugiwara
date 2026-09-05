# Runbook: Troubleshooting common failures

**When to use this:** a `mugiwara` command errors and the message names the fix — or not.
**Time:** ~2 min per symptom.
**You need:** the failing command plus its full output.

## Steps
1. Read the full error — most messages print the exact fix line.
2. Match it in the table below and apply the fix.
3. Re-run the command; if the message changed, match again from the top.

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| `refusing to add member 'jane-doe' … Run: mugiwara migrate --to-team jane-doe` | solo mission (`state.json`) asked for a handle | `mugiwara migrate --to-team jane-doe` |
| `has a resume point but no state file` | orphan resume point | `mugiwara savepoint`, or `rm .mugiwara/missions/m/continue-jane-doe.json` |
| `closure blocked — mission "crew1" is not finished` | assignee below Flow 9 | finish every handle, or `mugiwara archive crew1 --force` knowing resume points die |
| `has state but no sub-mission in plan.md` | handle started without a roster row | `mugiwara join crew1 eleanor-vance --area <area>`, or fix the handle spelling |
| `mugiwara: cursor installs through its marketplace manifest, not --target.` | marketplace harness | install through the marketplace, see `docs/reference/harness-matrix.md` |
| `savepoint: not a git repository` | ran outside git | `git init`, commit, retry |
| `blame: not a git repository (…)` | `mugiwara blame` needs git history | run inside the repo |
| `invalid member name "x"` | spaces or reserved word | slug such as `grace-hopper` |
| `✗ in-flight mission(s): demo. Use --force to archive them anyway.` | `mugiwara clean --all` sees live state | finish first, or add `--force` |
| `No mission state on disk.` | nothing recorded here | check branch, or start at Flow 0 |
| session banner never appears | crew replies without dispatch header | expect `## <emoji> Flow N — Crew (Role)` at each stage start; missing means inline-only, no state |

## What you end up with
Either a green re-run or a narrower error — iterate the table until the command
prints its normal `✓` / resume / status output. When two symptoms overlap,
fix state corruption before roster issues: a corrupt state file hides the roster.
