# Runbook: Solo mission, start to archive

A solo fix still needs a trail. Same pipeline, crew roles folded into one actor.

**When to use this:** one person does a whole mission alone, no crew handles.
**Time:** minutes of overhead on top of the work itself.
**You need:** git repo with at least one commit, crew installed, a mission name.

## Steps
1. Install once per repo.
   ```bash
   mugiwara install --yes
   ```
   ```
   default .mugiwara/config written at /private/tmp/t5install/.mugiwara/config (edit it to customise)

   -> Claude Code (project)
      written 111, skipped 0, backed up 0
      note: hooks registered in /private/tmp/t5install/.claude/settings.json
   … [trimmed]
   ```
2. Describe the work in session and let Flow 0 pick a lane (direct/lean/standard/full).
3. Record Flow 1. Solo has no handle: the empty handle means solo.
   ```bash
   mugiwara savepoint m "" 1 guided
   ```
   ```
   ✓ savepoint written: .mugiwara/missions/m/state.json (lane=direct, flow=1, files=0)
   ```
4. Check computed state any time.
   ```bash
   mugiwara status
   ```
   ```
   m
     flow 1 · 0/0 tasks · lane direct (0 file(s) under 20 LOC) · mode guided
     blockers 0 · heal cycle 1/3 · files touched 0
     branch main · updated 2026-09-09T05:46:49Z
   ```
5. After each stage, record the next flow (`mugiwara savepoint --flow 2`, then 3, … 9).
6. At Flow 9, close and attest.
   ```bash
   mugiwara archive m
   ```
   ```
   closure integrity warnings (non-blocking):
     ✗ [evidence] mission declares no evidence — closing with zero recorded checks
   archive target: missions/m/report.md
   … [trimmed]
   index updated: index.md
   ```
   ```bash
   mugiwara sign m
   ```
   ```
   ✓ signed /private/tmp/t5scratch/.mugiwara/missions/m/report.md.mugisig (pure ed25519, key: /Users/mekari/.mugiwara/mugiwara.key)
   ```

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| `savepoint: not a git repository` | ran outside git | `git init`, commit, retry |
| `no report.md to sign` | sign before closure | `mugiwara archive m` first |
| `nothing to clean.` from `mugiwara clean` | mission still has live state | finish to Flow 9, then `mugiwara archive m` |

## What you end up with
`.mugiwara/missions/m/` holds `state.json`, `continue.json`, `plan.md`,
`report.md`, `handoff.md`, `provenance.md`, `rollback.sh`. After
`mugiwara archive m` the live state files are folded into `report.md` and removed.
