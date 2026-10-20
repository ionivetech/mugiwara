# Runbook: Resume after a crash, context loss or machine switch

The session died and the plan lives on disk, not in your context. Rebuild the picture from saved state instead of starting over.

**When to use this:** the session ended, the context filled up, you changed laptop, or you switched branch.
**Time:** about 2 minutes when state is intact.
**You need:** the repo checked out (the same branch if possible) and the crew installed.

Outputs are from a real v1.0.5 run.

## Steps

1. One mission, one handle: print the exact resume point.
   ```bash
   mugiwara continue crew1 jane-doe
   ```
   ```
   Resumed: crew1 [jane-doe], Flow 2, 0/0 tasks — next_action: verify this flow stage against the plan, then continue per plan (next stage or closure) — run: (no next_session_prompt recorded)
   ```
2. Several missions: list them, then pick one. The command exits with code 2 on purpose so a script never guesses for you.
   ```bash
   mugiwara continue
   ```
   ```
   3 missions in flight:

     MISSION  MEMBER           FLOW  TASKS  LANE    MODE
     crew1    jane-doe         2     0/0    direct  guided
     crew1    john-smith       2     0/0    direct  guided
     other    —                1     0/0    direct  guided

   Pick one: mugiwara continue <mission> [member]
   ```
3. Check `next_action` against `plan.md` before executing. The printed state is computed from files, not a judgment call.
4. Handing the work to someone else? Write the report they can act on.
   ```bash
   mugiwara handoff other
   ```
   ```
   # Handoff: other

   … [trimmed]
   | Mission | flow 1, tasks 0/0, lane direct, mode guided |
   | Branch | `main` |
   | Actor | <git author name> |
   … [trimmed]
   written: .mugiwara/missions/other/handoff.md
   ```
   The handoff records your git author name, so read it before sharing outside the team.

## If something goes wrong

If state was never saved, or a file is damaged, these are the manual repairs.

| Symptom | Cause | Fix |
|---|---|---|
| `has a resume point but no state file` | the state file was deleted | run `mugiwara savepoint <mission> [handle] <flow>` to write it again, or delete the stale `continue-<handle>.json` |
| `has unreadable state: crew1/jane-doe.json` | corrupt JSON | restore the file from git, or delete it and re-run triage |
| `⚠ 1 unreadable state file(s)` from `mugiwara status` | corrupt, not absent | inspect or delete it. Never ignore it: it blocks resume |
| `No mission in flight. Start one with Flow 0 triage` | nothing on disk for you | check your branch, or run `mugiwara continue --all` on a shared checkout |

## What you end up with

Either a printed resume point (mission, handle, stage, tasks, lane, next action) that you execute against the plan, or a `handoff.md` the next engineer reads first.
