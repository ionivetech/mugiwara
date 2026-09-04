# Runbook: Joining a mission already in flight

**When to use this:** a mission exists with a plan and you take a slice of it.
**Time:** ~5 min.
**You need:** the mission name, your handle, an agreed area.

## Steps
1. Sync and confirm the mission exists.
   ```bash
   git pull
   mugiwara continue demo
   ```
2. Join with your area (writes a plan row, a decisions row, sets active handle).
   ```bash
   mugiwara join demo sophia-martinez --area testing
   ```
   Expected output:
   ```
   joined demo as sophia-martinez (testing) — plan updated, decisions logged, active-member set
   ```
3. Read your new row in `plan.md` (id, area, branch `feat/sophia-martinez`) plus the
   surrounding rows so your slice does not collide.
4. Start Flow 0 state for your slice, then work and record each stage.
   ```bash
   mugiwara savepoint --flow 2
   ```
   Expected output:
   ```
   ✓ savepoint written: .mugiwara/missions/demo/sophia-martinez.json (lane=direct, flow=2, files=0)
   ```

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| `no plan for mission "demo"` | mission never wrote `plan.md` | ask lead for the plan, or start from Flow 0 |
| `no sub-mission table found in plan.md` | plan lacks the sub-mission table | lead adds the table, then re-join |
| `member "sophia-martinez" already in roster` | already joined | `mugiwara continue demo sophia-martinez` and work |
| `invalid member name "bad name!" (allowlist: [a-zA-Z0-9._-], not a dot-path, not state/continue)` | handle has spaces or reserved word | use a slug such as `sophia-martinez` |

## What you end up with
`plan.md` gains `| SN | testing | sophia-martinez | feat/sophia-martinez | [ ] | - | … |`,
`decisions.md` gains a `Join: sophia-martinez (testing)` row, `.mugiwara/active-member`
holds your handle, and your state lives at `sophia-martinez.json`.
