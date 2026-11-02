# Runbook: Team mission, lead plus handles

Three people editing one plan collide unless each owns a named slice. The lead cuts the work into owned areas, then each person (a handle, such as `jane-doe`) runs their own slice and branch. The same steps cover someone joining a mission already in flight.

**When to use this:** work splits across named people with separate areas and branches.
**Time:** about 15 minutes of lead setup, then minutes per stage.
**You need:** a git repo, the crew installed, and one lowercase slug per person.

The outputs below come from a real run in a throwaway repo (v1.0.5).

## Lead

1. Cut a branch and describe the split in chat, naming each handle and area. Example: `jane-doe` owns api, `john-smith` owns web.
2. Write one row per handle in the plan's `## Sub-missions` table. The header is `| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |`. Then check that no file belongs to two rows.
   ```bash
   mugiwara plan conflict-check .mugiwara/missions/crew1/plan.md
   ```
   ```
   no conflicts: no file is touched by two sub-missions
   ```
3. Commit the plan and push the branch so everyone starts from the same file.

## Each handle

4. Pull, then resume. With several handles you get a numbered picker. Pass your handle next time to skip it.
   ```bash
   mugiwara continue crew1
   ```
   ```
   Mission: crew1

     #  ID  AREA           ASSIGNEE  STATE
     1  S1  api            jane-doe  Flow 2
     2  S2  web            john-smith Flow 2

   Which one are you? [1-2]
   ```
   ```bash
   mugiwara continue crew1 jane-doe
   ```
   ```
   Resumed: crew1 [jane-doe], Flow 2, 0/0 tasks — next_action: verify this flow stage against the plan, then continue per plan (next stage or closure) — run: (no next_session_prompt recorded)
   ```
5. Work your stage. The crew saves your position as you go, under your own handle, so nobody overwrites anyone else.

## Joining a mission already in flight

6. Pull, then join with your handle and area. This adds a row to the plan, logs the join in `decisions.md` and sets you as the active handle.
   ```bash
   mugiwara join crew1 sophia-martinez --area testing
   ```
   ```
   joined crew1 as sophia-martinez (testing) — plan updated, decisions logged, active-member set
   ```
   Read your new row and the rows around it so your slice does not collide. Then continue as in step 4.

## Closing

7. Every handle must reach the last stage. Then the lead runs `mugiwara archive crew1`. Until then closure refuses and says who is still working:
   ```
   mugiwara: closure blocked — mission "crew1" is not finished:
     jane-doe     Flow 2, still in flight
     john-smith   Flow 2, still in flight
     sophia-martinez Flow 3, still in flight

     Every assignee must reach Flow 9. Run `mugiwara status` to check.
     Use --force to archive anyway — in-flight resume points will be lost.
   ```

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| `refusing to add member 'jane-doe'` | the mission started solo | `mugiwara migrate --to-team jane-doe` |
| `member "x" already in roster` | the handle joined twice | `mugiwara continue crew1 x` and work |
| `no plan for mission "crew1"` | the mission never wrote `plan.md` | ask the lead for the plan, or start from triage |
| `no sub-mission table found in plan.md` | the plan has no sub-missions table | the lead adds it, then you join again |
| `invalid member name "bad name!"` | spaces or a reserved word in the handle | use a slug such as `sophia-martinez` |
| closure blocked, `assigned, never started` | a roster row has no state | that person runs `mugiwara continue crew1 <handle>` |

## What you end up with

`.mugiwara/missions/crew1/` holds one state file and one resume file per handle, a shared `plan.md` with the sub-missions table, and, after closure, one `report.md` covering everyone.
