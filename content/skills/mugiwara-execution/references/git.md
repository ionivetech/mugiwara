# Git Discipline (Zoro, Brook)

## Skip when

- No commits to make in this stage: 0 files staged, nothing to split or amend.
- User handles version control manually for this mission.

Git hygiene keeps the mission reversible: one logical change per commit, a coherent save-point before risky work, and history you can bisect.

## Atomic commits

1. One logical change per commit. A rename, a refactor, and its feature are three commits.
2. Each task commit compiles and passes the relevant checks. Never commit a broken tree.
3. Commit when a unit of work passes its acceptance criteria, not at arbitrary time points.
4. Staging is exact: `git add` specific files and paths, never `git add -A` sweeping an unrelated commit.

## Save-point pattern

A save-point is a local WIP commit on the mission branch, never pushed. It is not a task commit.

1. Before a risky or large operation (refactor, migration, merge), make a save-point only when the tree is in a coherent, runnable state. If it is broken, fix or stash it first; never commit a broken tree as a save-point.
2. The message names the intent, e.g. `checkpoint: before renderer migration`.
3. Task commits stay atomic per logical task. Fold a save-point into its task commit before handoff when the history should read one change per commit.
4. Rolling back with `git reset --hard <save-point>` destroys uncommitted work. Show the user the diff and name exactly what will be lost, then run it only after explicit consent. Prefer `git revert` or `git stash` when they do the job.

## Multi-commit splitting

1. A large task becomes multiple commits, one per logical step in the plan.
2. Split boundaries follow the plan's tasks: no commit spans two plan tasks, no plan task is left partially committed.
3. Commit each step the moment it is green; never batch a whole flow stage into one commit.

## Commit message conventions

1. Imperative mood subject, capitalized, <= 50 chars: `Add route guard for /api`.
2. Scoped subject when scope is not obvious: `feat(auth): enforce session TTL`.
3. Mission commits carry the task id (`fix(T4): test seams` per `SKILL.md`). Style detection copies the repo's case and prefix habits but never drops the id.
4. The body (after a blank line) explains why, not what.
5. Match the repo's existing style: detect it before writing messages (below).
6. Config `commit` may be a template: any value containing `{` is a template with
   placeholders `{type}` `{issue}` `{title}` (e.g. `{issue}: {title}` → `CR-5432: Testing
   button`). Fill placeholders from mission metadata; `{issue}` falls back to the date.
   Style names (conventional/gitmoji/plain) keep their normal rules.

## Style detection

1. Inspect existing history before the first commit: `git log --oneline -20`.
2. Copy the observed conventions: prefix style (`feat:`/`fix:` vs plain), subject case, body usage, subject length.
3. No commits in the repo yet → adopt conventional commits and note it in the plan.
4. A config `commit` template overrides history detection — the user's format wins.

## Branch naming

The mission branch pattern comes from the config `branch` key (default `feature/{type}-{issue}-{slug}`): `{type}` = feat/fix/chore/refactor from the task, `{issue}` = ticket/key ref (fallback: date), `{slug}` = kebab-case mission title (e.g. `feature/ABC-123-dark-mode`). One branch per mission, created before the first task commit; never force-push it once pushed. No mugiwara-prefixed branch names.

## Worktrees — isolated workspaces

1. For risky or parallel work, prefer a worktree over the shared working tree: `git worktree add ../<name> <branch>` gives an isolated checkout and lets you return to the main one without stashing.
2. One worktree per mission/branch; two tasks never share a worktree.
3. Remove when done: `git worktree remove ../<name>` (after the branch is merged or abandoned).

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
- A save-point skipped before a risky operation, or one made from a broken tree.
- `git reset --hard` run without the user naming what is lost.
- Writing commit messages in a style the repo's history does not use.
- A secret reaching a commit, or a force-added ignored file.

All mean: stop, unstage, and re-stage exactly what belongs together.
