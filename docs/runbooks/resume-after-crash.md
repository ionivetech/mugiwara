# Runbook: Resume after crash, context loss, or machine switch

**When to use this:** session died, context blew past budget, laptop changed, branch switched.
**Time:** ~2 min when state is intact; longer when it is corrupt.
**You need:** the repo checked out (same branch ideally), crew on PATH.

## Steps
1. One mission, one handle — print the exact resume point.
   ```bash
   mugiwara continue m jane-doe
   ```
   Expected output:
   ```
   Resumed: m [jane-doe], Flow 1, 0/0 tasks — next_action: verify this wave against the plan, then continue per plan (next wave or closure) — run: (no next_session_prompt recorded)
   ```
2. Several missions — list, then pick.
   ```bash
   mugiwara continue
   ```
   Expected output shape:
   ```
   Mission "m" has 1 members in flight:

     MISSION  MEMBER    FLOW  TASKS  LANE    MODE
     m        jane-doe  1     0/0    direct  guided

   Pick one: mugiwara continue m <member>
   ```
3. Several handles on one mission with a roster — a numbered picker appears
   (`Which one are you? [1-2]`); answer with your number.
4. Handing over to someone else — write the report they can act on.
   ```bash
   mugiwara handoff m
   ```
   Expected output (trimmed):
   ```
   # Handoff: m
   … [trimmed]
   | Mission [jane-doe] | flow 1, tasks 0/0, lane direct, mode guided |
   … [trimmed]
   written: .mugiwara/missions/m/handoff.md
   ```
5. Verify `next_action` against `plan.md` before executing — printed state is
   computed, not judgement.

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| `has a resume point but no state file` plus `rm …/continue-jane-doe.json` | orphan resume point, state deleted | `mugiwara savepoint` to rewrite state, or delete the orphan |
| `has unreadable state: m/jane-doe.json` | corrupt JSON | restore file from git or delete it and re-run Flow 0 |
| `⚠ 1 unreadable state file(s)` from `mugiwara status` | corrupt, not absent | inspect or delete; never ignore — it blocks resume |
| `No mission in flight. Start one with Flow 0 triage (mugiwara-orchestration).` | nothing on disk for this actor | check branch, or `mugiwara continue --all` on shared checkouts |

## What you end up with
Either a printed resume point (mission, handle, flow, tasks, lane, next action)
you execute against the plan, or a `handoff.md` the next engineer reads first.
