# Git Strategy

Commits, branches, save-points — and why the executor commits, not the closer.

## Who commits and when

**Zoro commits during execution, per logical task.** The executor is the one
making the changes, so it commits at the moment each unit of work passes its
acceptance criteria. This gives:

- **Save-points** — rollback is one `git reset --hard <save-point>` away.
- **Reversibility** — every commit is one logical change you can name.
- **Bisectability** — a regression points at the exact commit that introduced it.

Luffy does NOT re-commit at closure. The closer pushes the mission branch and
writes the PR verdict — re-slicing history at the end means one giant diff, no
save-points, and a painful bisect.

## Commit granularity: logical tasks, not micro-steps

A commit = one **logical change** (a feature, a fix, a refactor). The plan's
tasks are sized at that granularity — see `mugiwara-planning`.

- Adjacent trivial changes (typo, formatting, one-line tweak) fold into the
  neighboring logical task's commit.
- Never one commit per keystroke; never a flow stage of micro-commits.
- If the plan slices finer than a logical change, group adjacent tasks into one
  commit and note the grouping in the execution report.

## The rules (from `mugiwara-git`)

1. **Atomic commits.** One logical change per commit; each commit compiles and
   passes the relevant checks — never commit a broken tree.
2. **Exact staging.** `git add` specific files and paths, never `git add -A`
   sweeping an unrelated commit.
3. **Save-points before risky work.** Commit the working state with a naming
   intent message (`checkpoint: before renderer migration`) before refactors,
   migrations, or merges.
4. **Match repo style.** Inspect `git log --oneline -20` before the first
   commit and copy the observed conventions (prefix style, case, body usage).
5. **Never commit secrets.** Scan for `.env*`, keys, tokens before every
   commit. A secret already committed = treat as compromised, rotate, purge,
   file a security finding.

## Branches

One branch per mission, from the config `branch` key:

```
branch=feature/{type}-{issue}-{slug}
```

`{type}` = feat/fix/chore/refactor from the task, `{issue}` = ticket/key
reference (fallback: date), `{slug}` = kebab-case mission title. Created before
the first task commit; never force-push once pushed. No mugiwara-prefixed
branch names. Any pattern with these placeholders works — e.g.
`branch={issue}-{slug}` yields `CR-5432-testing-button`. Commit messages
follow the `commit` key: a style name (conventional/gitmoji/plain) or a
template with `{type}` `{issue}` `{title}` (e.g. `commit={issue}: {title}` →
`CR-5432: Testing button`). Full guide: [config.md](config.md).

## Terminal step

Every mode ends the same way: save-point commit → `git push -u origin <branch>`
→ PR verdict file written (`.mugiwara/results/<mission>/07-pr-verdict.md`, a
ready-to-paste PR summary) → branch + verdict handed to you,
who opens the PR. The crew never creates a PR, merges, or deploys.
