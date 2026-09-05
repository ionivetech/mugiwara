# Runbook: Monorepo with per-package lanes

**When to use this:** one repo holds several packages and a repo-wide lane oversizes small slices.
**Time:** ~10 min setup, then normal per-handle flow.
**You need:** monorepo checkout, package paths, one mission per package slice or per handle.

## Steps
1. Scope lane sizing to one package in `.mugiwara/config` (read by `savepoint.sh` and `lane.sh`).
   ```ini
   lane_scope_glob=packages/api/**
   ```
2. Record a savepoint — the lane now sizes from matching files only.
   ```bash
   mugiwara savepoint --flow 1
   ```
   Expected output:
   ```
   ✓ savepoint written: .mugiwara/missions/m/state.json (lane=direct, flow=1, files=0)
   ```
3. Give each package its own sub-mission row (assignee per package), so
   `mugiwara initiative conflict-check plan.md` compares file sets per package.
4. Handles in other packages repeat step 1 with their own glob
   (`packages/web/**`) on their branch before their first savepoint.
5. Close per package: `mugiwara archive <mission>` folds only that mission's waves.

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| lane looks too big for a tiny package change | glob unset — whole repo counted | set `lane_scope_glob` to the package path, re-run savepoint |
| conflict check flags two packages | overlapping file sets in plan rows | narrow each row's Files column to its package dir |
| `multiple missions on disk … — specify <mission>` | short form cannot infer | pass the mission: `mugiwara savepoint --flow 2 <mission>` |

## What you end up with
Each package slice sizes, runs, and archives on its own lane, while the repo root
keeps one shared config and one archive index.
