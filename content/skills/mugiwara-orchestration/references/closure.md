# Closure

Read after deciding to close a mission, never mid-argument. Templates for `report.md` and `pr-verdict.md`: `references/artifact-templates.md`.

## Closing summary (inline)

Give the user a summary with substance, not a one-liner:

- Goal, mode, stages run, task count.
- Per-stage outcome with a clickable evidence link `[path](relative/path)`. Archive folds the stage files into `report.md` instead of deleting them.
- Gate verdicts: quality, coverage and build, review and security findings with what was done about each, e2e (run, or skipped and why). Do not state how review was done; archive adds the independent or inline label from the dispatch ledger.
- Tests: unit and integration results; the user-test verdict when user tests were declared.
- Remaining risk and the rollback path (revert commit or feature flag).
- Deferred items with an owner, and what the user must do next.

Say it in plain words. Open with the verdict, then what changed, then what was not verified.

## Terminal step

0. Fold the trail with `mugiwara archive <mission>`. With no `mugiwara` binary, run the npx form from the CLI ladder first. Write the report by hand only when both fail: use every section of the report template and say in the report that archive did not run.
1. Run `mugiwara-ship` for the ship verdict (Ready for review, Needs fixes or Not enough evidence).
2. Save-point commit, then `git push -u origin <branch>`.
3. Write `flows/07-pr-verdict.md` (it survives archive as `pr-verdict.md`).
4. Hand branch and verdict to the user.

The crew never creates a PR, merges, or deploys. On a push failure, fall back to the local closing report and log the reason.

With `auto_commit=off` in guided/semi there is no save-point commit and no push. Write the verdict as usual, then hand over the branch name, the exact commands (`git status`, then `git add` of the mission's files only, never a bare `git add -A`, then `git commit -m "<suggested message>"` and `git push -u origin <branch>`), and the verdict path. In `auto` the terminal step runs unchanged.

## Lessons

At triage read `.mugiwara/lessons.md` and pass relevant rows to the owning agent. At closing, write this mission's lessons as one row each, append-only, never overwriting.

## Report layering

The first paragraph of `report.md`, `pr-verdict.md`, and each flow file says who did what and the outcome in plain words, with no identifiers or hashes. Check results stay literal (PASS, FAIL); the mission verdict is one of Ready for review, Needs fixes, Not enough evidence. Detail sits behind it: evidence links, `- [ ]`/`- [x]` boxes (one item per line), and tables with their columns intact. Prose follows `_shared/references/prose-style.md`.
