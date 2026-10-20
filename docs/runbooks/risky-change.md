# Runbook: Run a risky change (auth, payments, migrations)

A login change that ships with "tests pass" and nothing else is how a Friday night starts. This runbook covers the changes where you want a plan, a security pass and a written verdict, and it says plainly which parts you still have to check yourself.

**When to use this:** the change touches `auth/`, payments or billing, secrets, CI, a migration or schema file, or nine or more files.
**Time:** 20 to 60 minutes in guided mode. Less in auto mode, but you review more at the end.
**You need:** the crew installed with the global CLI (see [your first mission](solo-mission.md)), a clean working tree, and the tests passing on your branch or a list of the ones that already fail.

## Steps

1. Start on a branch and say what you want in one sentence, with the rules that matter.
   ```text
   /mugiwara add role-based access control: admin, editor, viewer
   ```
   Paths such as `auth/`, payments, migrations, secrets and CI always size the work as the full lane, whatever the file count. The full lane is the one that runs a plan, an audit, quality and coverage gates, a review, a security pass and a fix loop.
2. Expect questions before any code. In guided mode the crew stops and asks. For the request above it asked six, shortened here (an excerpt, not the full reply):
   ```text
   1. Where does identity come from: an IdP or JWT, a local user store, or the caller passes a role?
   2. Which resources are protected?
   3. What do the roles mean? My default: admin does everything, editor reads and writes, viewer reads.
   4. Where is it enforced?
   5. Are the roles fixed or editable?
   6. Solo or shared?
   Reply with answers or "use your defaults".
   ```
   Answer the ones where your system has a fact the crew cannot see: where identity comes from and which resources count. Take its defaults for the rest only if you read them first. A default is a guess, and in security work a guess about role meaning is the most expensive kind.
3. Pick the mode. Guided mode waits for you at each decision. That suits a risky change, because you see the plan before code exists. To run to the end instead, set `mode=auto` in `.mugiwara/config` or say `mugiwara mode auto` in the chat. In auto mode the crew still stops for a real blocker or when a failed check has used up its fix rounds.
4. Read the plan when it appears. Check that the acceptance checks would actually fail if the feature were wrong. Ask for changes now: this is the cheap moment.
5. Watch the state while it builds.
   ```bash
   mugiwara status
   ```
   ```
   rbac
     flow 1 · 0/0 tasks · lane full (sensitive paths: src/auth/rbac.js,test/rbac.test.js) · mode guided
     blockers 0 · heal cycle 1/3 · files touched 3
     tokens 20580/50000 (ok)
     branch feat/rbac · updated 2026-10-19T05:05:06Z
   ```
   *Real output from a throwaway repo (v1.0.5). `heal cycle 1/3` means the fix loop is allowed three rounds.*
6. When it closes, open `report.md` and read it as a reviewer would, with [review a mission](review-a-mission.md). Then do your own checks from the list below.

## What you will see on Claude Code

- **The hold.** If you typed `/mugiwara <request>`, the change is risky, and no mission was recorded, the stop hook blocks the end of the turn with a plain message and the model continues. This happens at most twice a session, then it becomes a warning. Only `enforce=off` turns it off.
- **The closure refusal.** On the full lane or a sensitive path, `mugiwara archive` refuses to close if the ledger shows no separate run of both Robin and Jinbe. The message names the missing check. Either run it as a separate agent and archive again, or set `independent_review=off`. `archive --force` closes anyway and the report says `Checked inline`.
- **The cost.** The report's Cost section shows the process estimate against budget and the provider-reported tokens on a separate line. Independent review costs more: see [cost](../concepts/cost.md).

Stage order is not enforced, so read the plan's file time against the build's.

## What each stage leaves in `.mugiwara/missions/<mission>/`

- Plan stage: `plan.md` and, when the idea was vague, `spec.md`.
- Build stage: `flows/01-execution.md`, a task table with the evidence for each task.
- Check, quality and gate stages: `flows/02-audit.md`, `03-quality.md`, `04-gates.md`.
- Review and security stages: `review.md` and `security.md`.
- Fix stage, only when a check failed: `flows/05-healing.md`.
- Decisions and blockers as they happen: `decisions.md`, `blockers.md`.
- Closing: `report.md`, `pr-verdict.md`, `rollback.sh`, `provenance.md`.

After `mugiwara archive <mission>` the loose files are folded into `report.md` and removed. What stays:

```
plan.md
provenance.md
report.md
rollback.sh
```

*Real listing of a closed mission in a throwaway repo. The trail there was written by hand to demonstrate `archive`, so a real mission may keep more files, such as `pr-verdict.md`.*

## What you still verify yourself

On Claude Code, a full-lane or sensitive-path mission runs Robin and Jinbe as separate subagents (`independent_review=on`), and the report says `Checked independently`. That is a second read by a fresh context, and it still does not replace your checks. When the report says `Checked inline`, the same model that wrote the code read it again: treat that review as a checklist the author filled in, not a second opinion.

- Run the test suite yourself and compare it with the count in the report.
- Read the diff of every sensitive path line by line. The report lists them.
- For auth: try the denied case by hand. The role that should not get in, the expired token, the missing header.
- For migrations: run the rollback on a copy of the data before you trust it.
- For payments or secrets: check that no key, token or card number landed in the diff, the logs or the tests.
- Read "Not verified". Anything listed there is yours.
- Check pre-existing failures. The crew flags a test that was already failing so it is not blamed on the change. Confirm that on main.

## When to stop and take over

- The report says Needs fixes and the reason is about your change, not a failure that was already there. Fix it by hand or ask for a new mission.
- The same check fails after the third fix round. The crew stops and hands you the history. More rounds will not help.
- The crew is asking the same question twice, or its defaults keep contradicting what you told it.
- A command was blocked by the guard. The crew never merges, deploys or force-pushes. Run that step yourself, see [troubleshooting](troubleshooting.md).
- The diff is larger than your plan. Stop, trim the scope, and start a smaller mission.

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| it built code without asking | the mode is `auto`, or the request was specific enough | read the plan and decisions in the trail, then review as usual |
| no security pass shows in the report | the change did not touch a sensitive path | say `Jinbe, audit the auth middleware` in the chat to ask for one |
| Needs fixes on the repo, ready on the change | tests that already failed on main | confirm on main, then record the failing tests as a deferred item with an owner |
| the lane is full but the change is two lines | a sensitive path was touched | expected. Ask for a smaller process only if you accept the risk |

## What you end up with

An uncommitted change in your tree, a closed mission with a verdict, and a report that says what was and was not checked. The next step is yours: your own checks, your commit, your pull request.
