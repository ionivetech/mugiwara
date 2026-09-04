# Runbook: Solo mission, start to archive

**When to use this:** one person does a whole mission alone, no crew handles.
**Time:** minutes of overhead on top of the work itself.
**You need:** git repo with at least one commit, crew installed, a mission name.

## Steps
1. Install once per repo.
   ```bash
   mugiwara install --yes
   ```
   Expected output (trimmed to first target):
   ```
   -> Claude Code (project)
      written 91, skipped 0, backed up 0
      note: default config written: … [trimmed]/.mugiwara/config (edit it to customise)
   … [trimmed]
   ```
2. Describe the work in session and let Flow 0 pick a lane (direct/lean/standard/full).
3. Record Flow 1 (solo has no handle — empty handle means solo).
   ```bash
   mugiwara savepoint m "" 1 guided
   ```
   Expected output:
   ```
   ✓ savepoint written: .mugiwara/missions/m/state.json (lane=direct, flow=1, files=0)
   ```
4. Check computed state any time.
   ```bash
   mugiwara status
   ```
   Expected output:
   ```
   m
     flow 1 · 0/0 tasks · lane direct (0 file(s) under 20 LOC) · mode guided
     blockers 0 · heal cycle 1/3 · files touched 0
     branch main · updated 2026-09-04T16:07:02Z
   ```
5. After each stage, record the next flow (`mugiwara savepoint --flow 2`, then 3, … 9).
6. At Flow 9, close and attest.
   ```bash
   mugiwara archive m
   mugiwara sign m
   ```

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| `savepoint: not a git repository` | ran outside git | `git init`, commit, retry |
| `✗ no report.md to sign — archive first` | sign before closure | `mugiwara archive m` first |
| `nothing to clean.` from `mugiwara clean` | mission still has live state | finish to Flow 9, then `mugiwara archive m` |

## What you end up with
`.mugiwara/missions/m/` holds `state.json`, `continue.json`, `plan.md`,
`report.md`, `handoff.md`, `provenance.md`, `rollback.sh`. After
`mugiwara archive m` the live state files are folded into `report.md` and removed.
