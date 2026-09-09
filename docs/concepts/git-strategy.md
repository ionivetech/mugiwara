# How are branches handled?

A closer re-slicing history at mission end produces one giant diff with no save-points and a painful bisect. Mugiwara avoids that by having the executor commit during the work, per logical task, while the closer only pushes and reports.

Example: Zoro finishes the renderer task and its acceptance checks pass, so Zoro commits that task now with its name. Three tasks later a regression appears, and `git bisect` points at the exact task commit that introduced it.

## Commit granularity

One commit covers one logical change: a feature, fix, or refactor. Adjacent trivial edits fold into the neighboring task commit. Group over-sliced plan tasks into one commit and note the grouping in the execution report.

## The rules

Atomic commits that compile and pass relevant checks; exact staging of named paths, never sweeping adds; save-point commits before risky refactors, migrations, or merges; repo style matched from recent log lines before the first commit; no secrets, with an already-committed secret treated as compromised (rotate, purge, file a finding).

## Branches and the terminal step

One branch per mission from the `branch` config key, created before the first task commit and never force-pushed once pushed. Every mode ends identically: save-point commit, push, a ready-to-paste PR verdict file under the mission flows dir, then handoff. The crew never opens the PR, merges, or deploys; the human performs the terminal step.
