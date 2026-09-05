# Runbook: Crew mission, lead plus handles

**When to use this:** work splits across named handles with separate lanes and branches.
**Time:** Flow 0 setup ~15 min; per-handle overhead minutes per stage.
**You need:** git repo, crew installed, lead plus handle names (slugs, lowercase).

## Steps
1. Lead: install, then set the runtime mode by saying `mugiwara mode guided` in session (no CLI).
2. Lead: cut a branch and run Flow 0, naming each handle plus area.
   ```bash
   git switch -c feat/crew1
   ```
   Example split: `jane-doe` owns api, `john-smith` owns web, `eleanor-vance` owns docs.
3. Lead: write one sub-mission row per handle in `plan.md`, then check overlap.
   ```bash
   mugiwara initiative conflict-check plan.md
   ```
4. Lead: `git add` the plan, `git commit`, `git push -u origin feat/crew1`.
5. Handle: sync, resume, pick a number when asked.
   ```bash
   git pull
   mugiwara continue crew1
   ```
   Expected output:
   ```
   Mission: crew1

     #  ID  AREA           ASSIGNEE  STATE
     1  S1  api            jane-doe  Flow 2
     2  S2  web            john-smith Flow 2

   Which one are you? [1-2]
   ```
6. Handle: work the stage, then record it (short form infers mission and handle).
   ```bash
   mugiwara savepoint --flow 3
   ```
   Expected output:
   ```
   ✓ savepoint written: .mugiwara/missions/demo/sophia-martinez.json (lane=direct, flow=2, files=0)
   ```
7. Handle, next day: `mugiwara continue crew1 jane-doe` prints the exact resume point.
   ```
   Resumed: m [jane-doe], Flow 1, 0/0 tasks — next_action: verify this wave against the plan, then continue per plan (next wave or closure) — run: (no next_session_prompt recorded)
   ```
8. Closing: every assignee reaches Flow 9, then lead verifies, folds, attests.
   ```bash
   mugiwara status
   mugiwara archive crew1
   mugiwara sign crew1
   ```
   Closure refuses early folds:
   ```
    mugiwara: closure blocked — mission "crew1" is not finished:
     jane-doe     Flow 2, still in flight
     john-smith   Flow 2, still in flight

     Every assignee must reach Flow 9. Run `mugiwara status` to check.
     Use --force to archive anyway — in-flight resume points will be lost.
   ```

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| `refusing to add member 'jane-doe'` | mission is solo (`state.json` exists) | `mugiwara migrate --to-team jane-doe` |
| `member "x" already in roster` | handle joined twice | pick the existing handle, no re-join |
| closure blocked listing `assigned, never started` | roster row with no state | that handle runs `mugiwara continue crew1 <handle>` to start |

## What you end up with
`.mugiwara/missions/crew1/` holds one `<handle>.json` plus `continue-<handle>.json`
per handle, a shared `plan.md` with the sub-mission table, and after closure one
`report.md` covering every handle, optionally with `report.md.mugisig`.
