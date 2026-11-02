# Runbook: Monorepo with per-package lanes

One repo-wide lane sizes a one-package fix like a whole-repo migration. Scoping the lane to your package stops that.

**When to use this:** one repo holds several packages and the repo-wide lane oversizes small changes.
**Time:** about 10 minutes of setup, then the normal flow.
**You need:** the monorepo checkout and your package path.

## Steps

1. Scope lane sizing to one package in `.mugiwara/config`. The setting is read by the lane and savepoint scripts.
   ```ini
   lane_scope_glob=packages/api/**
   ```
2. Record a savepoint (the state snapshot the crew writes at each stage boundary, so this normally happens on its own). The lane now sizes from matching files only.
   ```bash
   mugiwara savepoint m "" 1 guided
   ```
   ```
   ✓ savepoint written: .mugiwara/missions/m/state.json (lane=direct, flow=1, files=1)
   ```
3. Give each package its own row in the plan's sub-missions table, so `mugiwara plan conflict-check plan.md` compares file sets per package.
4. Teammates in other packages repeat step 1 with their own glob (`packages/web/**`) on their branch before their first savepoint.
5. Close per package: `mugiwara archive <mission>` folds only that mission's files. A bare `archive` lists the missions to pick from (exit 2) instead of guessing.

Sensitive-path escalation still reads the whole diff, so scoping never hides an `auth/` change in another package.

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| the lane looks too big for a tiny package change | the glob is unset, so the whole repo counts | set `lane_scope_glob` to the package path and run the savepoint again |
| the conflict check flags two packages | the plan rows share files | narrow each row's Touched Files to its package directory |
| `multiple missions on disk … specify <mission>` | the short form cannot infer the mission | `mugiwara savepoint --flow 2 <mission>` |

## What you end up with

Each package slice sizes, runs and archives on its own lane, while the repo root keeps one shared config and one archive index.
