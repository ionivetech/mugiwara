---
name: mugiwara-git
description: Use when committing, splitting commits, or debugging via git history during execution or healing. Atomic commits, save-points, style detection, bisect.
---

# Git Discipline (Zoro, Brook)

Git hygiene keeps the mission reversible: one logical change per commit, a save-point before risky work, and history you can bisect.

## Atomic commits

1. One logical change per commit. A rename, a refactor, and its feature are three commits.
2. Each commit must compile and pass the relevant checks — never commit a broken tree.
3. Commit when a unit of work passes its acceptance criteria, not at arbitrary time points.
4. Staging is exact: `git add` specific files and paths, never `git add -A` sweeping an unrelated commit.

## Save-point pattern

1. Before any risky or large operation (refactor, migration, merge), commit the current working state as a save-point even if incomplete.
2. A save-point message names the intent, e.g. `checkpoint: before renderer migration`.
3. Save-points make rollback one command: `git reset --hard <save-point>`. Verify with a diff before resetting.

## Multi-commit splitting

1. A large task becomes multiple commits, one per logical step in the plan.
2. Split boundaries follow the plan's tasks: no commit spans two plan tasks, no plan task is left partially committed.
3. Commit each step the moment it is green; never batch a whole wave into one commit.

## Commit message conventions

1. Imperative mood subject, capitalized, <= 50 chars: `Add route guard for /api`.
2. Scoped subject when scope is not obvious: `feat(auth): enforce session TTL`.
3. Body (after a blank line) explains WHY, not what. What is visible in the diff; why is not.
4. Match the repo's existing style — detect it before writing messages (below).

## Style detection

1. Inspect existing history before the first commit: `git log --oneline -20`.
2. Copy the observed conventions: prefix style (`feat:`/`fix:` vs plain), subject case, body usage, subject length.
3. No commits in the repo yet → adopt conventional commits and note it in the plan.

## Debugging via history

1. `git bisect start`, then `git bisect bad <current>` and `git bisect good <known-good>` to find the regression commit. Log the bad commit range in the result.
2. `git blame -L <file>` to find which commit introduced a line, then read that commit's message and diff.
3. Pickaxe `git log -S <string>` to find when a symbol appeared or vanished.
4. `git log -- <file>` to trace a file's evolution before touching it.

## Never commit secrets

1. Scan before every commit: `.env*`, keys, tokens, passwords, private keys, credentials in code or comments.
2. A secret already committed → treat as compromised: rotate it, purge it from history, file a security finding.
3. Respect `.gitignore`; never force-add an ignored file without a recorded reason.

## Iron Law

EVERY COMMIT IS REVERSIBLE AND EXPLAINABLE. If you cannot name the logical change and why, the commit is not ready.

## Red flags

- A commit mixing refactor and feature, or failing to compile.
- `git add -A` sweeping unrelated files into a commit.
- A save-point skipped before a risky operation.
- Writing commit messages in a style the repo's history does not use.
- A secret reaching a commit, or a force-added ignored file.

All mean: stop, unstage or reset, and re-stage exactly what belongs together.
