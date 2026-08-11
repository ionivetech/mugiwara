---
name: mugiwara-git-worktrees
description: Use when running parallel branch work, keeping the main workspace clean, or reviewing a branch without switching. Isolated worktrees via git worktree add, branch hygiene, and safe cleanup.
---

# Git Worktrees — Isolated Parallel Branches

Worktrees give each branch its own checkout, so parallel missions, reviews, and experiments never fight over one working tree. Companion to mugiwara-git, not a replacement for commit discipline.

## When to use

- Parallel independent tasks on separate branches that must progress without blocking each other.
- Keeping the main workspace clean: main checkout stays untouched while risky work lives in a worktree.
- Reviewing or verifying a branch without switching: open it in a worktree, inspect, discard.
- Any task so risky you want it physically separate from the current tree.

Prefer a worktree over `git stash` juggling — each branch gets a real checkout, not a rescue from the reflog.

## Process

1. Create the worktree bound to a new branch:
   `git worktree add -b <branch> <path>` (e.g. `git worktree add -b feature/ABC-123-dark-mode ../dark-mode`).
2. Work entirely inside `<path>`: edit, commit, push there. Treat it as the only home of that branch.
3. Do not touch that branch from the main checkout, and vice versa. Two tasks never share one worktree.
4. Verify the work before it leaves the worktree: run the branch's checks and tests inside `<path>`.
5. Merge or rebase back into the main branch from the main checkout; push when done.
6. Clean up once the branch is merged or abandoned:
   - `git worktree remove <path>` (add `--force` only if it has uncommitted changes you accept losing).
   - `git worktree prune` to drop stale bookkeeping for worktrees removed outside git's book.
7. Check nothing is left behind: `git worktree list` should show only your active checkouts.

## Cleanup safety

- Remove only worktrees you created. Host-owned worktrees — ones the repo or another agent set up — are not yours to delete; leave them.
- Never remove a worktree that still has unmerged commits unless you have deliberately abandoned that branch.
- Remove the worktree, not the branch directory with `rm -rf`; bypassing git leaves stale metadata that `prune` then has to guess about.
- A worktree without a branch (`--detach`) is throwaway: verify, then remove with no branch to worry about.

## Rationalizations

| Rationalization | Why it fails |
| --- | --- |
| "I'll just switch branches, it's faster." | Uncommitted changes block checkout; one mistake mixes work from two tasks. |
| "I can work on both branches in one checkout." | Stash conflicts and forgotten checkouts lose or misattribute work. |
| "Removing a worktree is the same as deleting a folder." | `rm -rf` leaves git's worktree bookkeeping stale; `git worktree remove` stays consistent. |
| "Their worktree looks abandoned, I'll clean it up." | Host-owned state. If it looks dead, report it, never remove it. |

## Red flags

- A worktree path inside the repo's own directory tree — nested worktrees are confusing and error-prone.
- Deleting or force-removing a worktree whose branch has unpushed commits.
- The same branch checked out in two worktrees, or two tasks sharing one worktree.
- Touching or re-checking-out a host-owned worktree.

All mean: stop, verify branch state, and clean up only what belongs to your task.

## Verification

1. `git worktree list` shows exactly the checkouts you expect — yours, none stale.
2. After cleanup, the worktree path is gone and `git worktree prune` reports nothing to prune.
3. The main checkout shows no leftover files, locks, or artifacts from the removed worktree.
4. The removed branch's commits are either merged into main or deliberately abandoned — never stranded.
