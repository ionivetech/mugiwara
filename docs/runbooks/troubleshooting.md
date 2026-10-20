# Runbook: Troubleshooting common failures

The crew did not start, a report came out thin, or a command failed with a message you do not recognize. Find the symptom below, apply the fix, and run it again.

**When to use this:** something did not happen, or a `mugiwara` command errors.
**Time:** about 2 minutes per symptom.
**You need:** the failing command or the chat reply, and its full output.

## Steps

1. Read the whole message. Most print the fix. With nothing on disk, even the empty state tells you the next move:
   ```bash
   mugiwara continue
   ```
   ```
   No mission in flight. Start one with Flow 0 triage (mugiwara-orchestration).
   ```
2. If the crew did not do what you expected, check these first.
   - **The crew did not engage.** A plain request with no `/mugiwara` usually gets your agent's normal behavior, with no skill call, no mission and no report. `/mugiwara <small fix>` often ends with the crew saying it is a one-line fix and skipping the pipeline. Both are by design. Run `/mugiwara <request>, use the full crew` when you want it.
   - **The report is a few hand-written lines.** The global CLI is missing, so the crew fell back to shell scripts and never ran `archive`. Run `npm i -g @ionivetech/mugiwara`, then `mugiwara archive <mission>`.
   - **The crew keeps waiting for you.** Guided mode asks at each decision. Reply, set `mode=auto` in `.mugiwara/config`, or say `mugiwara mode auto` in the chat.
   - **A hook warns about triage.** The Stop hook saw changed code with no mission to size it. Default `enforce=warn` prints:
     ```
     ⚠ Mugiwara: this session changed source or mission artifacts but no mission was started to size the work. Start the mugiwara workflow first (it also records trivial work), or set enforce=off in .mugiwara/config to stop this check.
     ```
     Start the work with `/mugiwara <request>`. With `enforce=block` the hook stops the turn instead of warning, and the stop is counted in `mugiwara cost` as a forced continuation.
   - **The turn was blocked after `/mugiwara`.** The stop hook compared the real diff with what happened: the change is risky and no mission was recorded. Let the crew continue and run the process. It blocks at most twice per session, then warns. Only `enforce=off` disables it.
   - **`mugiwara archive` refused to close.** On the full lane or a sensitive path, the ledger shows no independent run of Robin and Jinbe. The message names the missing check. Run it as a separate agent and archive again, or set `independent_review=off`, or use `--force` (the report then says `Checked inline`). Hosts without the Claude Code ledger are not blocked.
   - **A hook warns that the review was not independent.** The Stop hook found a full-lane or sensitive-path mission with `review.md` or `security.md` and no recorded subagent dispatch, so the review ran inline. Causes: `independent_review=off`, a host that cannot dispatch, or the crew skipped the dispatch. Re-run review on Claude Code with `independent_review=on`, or accept the inline review and do the extra checking yourself. It warns and does not block.
   - **A command was blocked.** The guard refuses merges, deploys, pushes to a protected branch and other irreversible commands on Claude Code. A real refusal for `git push origin main`:
     ```
     {"decision":"block","reason":"Mugiwara: refusing to pushing to a protected branch, because the crew never creates a PR, merges or deploys; a human does. Run it yourself, or set enforce=off in .mugiwara/config."}
     ```
     Run that command in your own terminal. Turn the guard off only if you accept that nothing will stop the next one.
   - **A savepoint rejects a name.** Mission and member names allow letters, digits, dot, dash and underscore, and may not start with a dash:
     ```
     savepoint: invalid mission name "bad name" (allowlist: [a-zA-Z0-9._-])
     savepoint: invalid member name "-x" (allowlist: [a-zA-Z0-9._-])
     ```
     *Real output from the installed `.mugiwara/bin/savepoint.sh`.* In the shell script, put the mission first and the flags after it: `savepoint.sh <mission> --flow 2`. A flag before the mission is rejected as an unknown flag.
3. For a message from a command, find it in the table and apply the fix.
4. Run the command again. If the message changed, match it again from the top.

Some fixes ask you to run a state step by hand. A savepoint is the state snapshot the crew normally writes at every stage boundary, so you run `mugiwara savepoint` yourself only when repairing state.

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| `refusing to add member 'jane-doe'` | a solo mission (`state.json`) was given a handle | `mugiwara migrate --to-team jane-doe` |
| `has a resume point but no state file` | an orphaned resume file | `mugiwara savepoint <mission> [handle] <flow>`, or delete `.mugiwara/missions/<m>/continue-<handle>.json` |
| `closure blocked`, naming an unfinished mission | someone is still below the last stage | finish every handle, or `archive --force` and accept that resume points are lost |
| `has state but no sub-mission in plan.md` | a handle started without a roster row | `mugiwara join <mission> <handle> --area <area>`, or fix the spelling |
| `savepoint: not a git repository` | ran outside a git repo | `git init`, make one commit, retry |
| `closure integrity gate failed` from `mugiwara archive` | a missing file link, a secret-shaped string, or a bad evidence path | fix the flagged file and archive again. There is no bypass flag |
| `invalid member name "x"` | spaces, a leading dash or a reserved word | use a slug such as `grace-hopper` |
| `conflict (not overwritten; run update to replace with backup)` from install | the target file differs from what install writes | `mugiwara update`, which backs up first |
| `No mission state on disk.` | nothing recorded in this checkout | check the branch, or start with `/mugiwara <request>` |
| `multiple missions on disk … specify <mission>` | the short form cannot tell which mission | pass the mission: `mugiwara savepoint --flow 2 <mission>` |
| no crew banner in the chat | the crew is not loaded in this session | ask "which crew members are available?". If it cannot answer, reinstall: see [install](../install.md) |
| `no per-commit note` from `handoff --path` | git notes are not fetched by clone | see [signing and provenance](../optional/signing.md) |

## What you end up with

Either a clean re-run or a narrower error. When two symptoms overlap, fix a corrupt state file before roster issues, because a corrupt file hides the roster.
