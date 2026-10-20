# Runbook: Review a mission's report

A teammate opened a pull request and attached a `report.md` from the crew. You have ten minutes and no wish to read the whole diff cold. This page tells you where the report helps, where it cannot, and what to push back on.

**When to use this:** you review a pull request that carries `.mugiwara/missions/<mission>/report.md`.
**Time:** 10 minutes for the report, then your normal review of the diff.
**You need:** the branch checked out, and the author available for questions.

## Steps

1. Open the report. It sits at `.mugiwara/missions/<mission>/report.md` and starts with a summary, the branch and the sensitive paths touched. This is an excerpt from a throwaway repo, where the mission trail was written by hand to demonstrate `archive`:
   ```markdown
   # Mission: rbac

   3 files changed (+13 / -0) on branch `feat/rbac`, closed 2026-10-19. Sensitive paths touched: `src/auth/rbac.js`, `test/rbac.test.js`.

   ## Verdict

   **Ready for review.** The recorded checks passed.
   ...
   ## Not verified

   Nothing was left unverified.

   ## Cost

   Used **20,694** of 50,000 tokens (41%).
   ```
   Do not stop at the verdict. In this demo the gates note says the repo gate failed because two tests already failed, yet the verdict line says ready and "Not verified" says nothing. (Current versions of `archive` no longer write a ready verdict without evidence.) A real report can disagree with itself the same way, so read every section.
2. Go through the checklist:
   - **Verdict.** One of Ready for review, Needs fixes, or Not enough evidence, and who decided. Anything but Ready needs a stated reason in the PR, not silence.
   - **Not verified.** Everything listed is now your job. An empty section on a large change deserves a question.
   - **Evidence.** Each check should name the command that ran and its result, such as a test command with its exit code. A claim without a command is a claim.
   - **Independent or inline review.** The first line of the Review and Security sections reads `Checked independently` or `Checked inline`. A hook writes it from a record of real subagent dispatches; the crew does not. Independent means a fresh-context subagent read the diff. Inline means the same model that wrote the code reviewed it. With no label, assume inline. The label proves a separate agent ran. It does not prove the review was good. Also check the order: stage order is not enforced, and a plan written after the build can satisfy the artifact check. Compare the file times of `plan.md` and the build's work; a plan newer than the code is a tell.
   - **Sensitive paths.** Read those files in the diff first. The report also ranks a reading order.
   - **Deferred items.** Each one needs an owner and a place it is tracked.
   - **Cost.** Compare the tokens used with the lane budget. A mission far over budget usually looped on a failing check.
3. Open `provenance.md` next to the report. It is the block the author should have pasted into the PR description:
   ```
   mission: rbac
   agent: Demo · model(s): unknown · lane full · mode guided
   tasks: 0/0
   gates/evidence: .mugiwara/missions/rbac/flows/01-execution.md · .mugiwara/missions/rbac/flows/03-quality.md · .mugiwara/missions/rbac/flows/04-gates.md
   branch: feat/rbac
   human review: pending (PR review is the terminal gate)
   ```
   *Real output from a throwaway repo (shortened). Note `tasks: 0/0` and `model(s): unknown`: the block records what was written to state, not what you would hope. The lane and mode tell you how much process ran.*
4. Spot-check one claim. Pick the test count in the report, run the suite, and compare.
5. Leave your comments on the pull request, not in the report. The report records what the author's session did.

## Red flags

- No evidence: the mission declares no checks. The closing step prints this warning when it happens:
  ```
  closure integrity warnings (non-blocking):
    ✗ [evidence] mission declares no evidence — closing with zero recorded checks
  ```
  *Real output from `mugiwara archive`. It does not block, so a zero-check report can still be attached.*
- A report of a few hand-written lines. The author probably had no global CLI, so `archive` never ran and nothing was folded. Ask them to install it and archive.
- A "Needs fixes" or "Not enough evidence" verdict that was ignored. The PR says "ready" and the report does not.
- The verdict contradicts a section, as in the demo above.
- `Checked inline` on a change that touches auth, payments or a migration. Check `independent_review` is not `off` and that you ran on Claude Code. If it was off by choice, the extra checking is yours: read the sensitive files line by line.
- Sensitive paths in the diff that the report does not list.
- "Not verified" is empty on a change with no end-to-end tests.
- A deferred item with no owner.

## What to ask the author

- Which of the checks in the report did you re-run yourself?
- Why does a sensitive change say `Checked inline`: host, lane, or `independent_review=off`?
- Which tests were already failing on main, and where are they tracked?
- What is in "Not verified" that you plan to test before merge?
- Did the crew block any command, and what did you run by hand instead?

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| there is no `report.md` in the branch | the mission was never closed, or the trail was not committed | ask the author to run `mugiwara archive <mission>` and commit the result |
| the report is only a short note | the global CLI was missing | ask the author to install it and archive again |
| you cannot tell who approved what | the mission ran in guided mode without notes | read `decisions.md` if it is still there, or ask |

## What you end up with

A short list of questions for the author and a clear idea of which parts of the diff the report covers and which it does not. The report speeds up a review. It does not replace one.
