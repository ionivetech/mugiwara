# Runbook: Your first mission

You installed the crew, typed a small request, and nothing visibly changed. That is expected, and this page shows what a request that does engage the crew looks like, so you can tell the two apart.

**When to use this:** you work alone and want one change reviewed properly, with a report you can attach to a pull request.
**Time:** 10 to 30 minutes, mostly spent answering questions.
**You need:** a git repo with one commit, Claude Code or opencode, and a change worth reviewing: auth, payments, a migration, or anything that touches many files.

## Steps

1. Install the crew into the repo. On Claude Code you can use the two `/plugin` commands from the [install page](../install.md) instead.
   ```bash
   mugiwara install --target claude --yes
   ```
   ```
   default .mugiwara/config written at <project>/.mugiwara/config (edit it to customise)

   -> Claude Code (project)
      written 115, skipped 0, backed up 0
      note: hooks registered in <project>/.claude/settings.json

   OK mugiwara 1.0.5 installed (manifest: <project>/.mugiwara/manifest.json)
   2 note(s) above may need attention.
   CLI: run `npm i -g @ionivetech/mugiwara` so the crew can call `mugiwara savepoint/archive/continue` directly.
        Without it the crew falls back to npx, then `.mugiwara/bin/*.sh`, then direct file ops — state and resume keep working.
   ```
   The files appear as untracked in `git status`: a `.claude/` folder, a `.mugiwara/` folder, and an edit to `.gitignore`.
2. Install the CLI once on your machine, as the note says: `npm i -g @ionivetech/mugiwara`. Do not skip this. Without it the crew falls back to shell scripts, never runs `archive`, and the closing report is a short hand-written note instead of the folded one.
3. Pick the change. Choose something you would want a second pair of eyes on, such as role-based access control or a signup validation change. A one-line fix will not exercise the crew, see "A small change runs direct" below.
4. In the chat, run the command with your request:
   ```text
   /mugiwara add role-based access control: admin, editor, viewer
   ```
   The crew sizes the work from the diff and the paths involved. Access control touches security, so it picks the full pipeline (called a lane; the lanes are Direct, Lean, Standard and Full). It names its members in one line, then stops before writing code and asks numbered questions. This is an excerpt of a real first reply, shortened:
   ```text
   Access control touches security, so this gets the full pipeline. Mode is guided, so I need
   your go at each stage. I'm stopping before any code because the request is too vague to plan.
   ...
   1. Where does identity come from: an IdP or JWT, a local user store, or the caller passes a role?
   2. Which resources are protected: only invoices, or more?
   3. What do the roles mean? My default: admin does everything, editor reads and writes, viewer reads.
   ...
   Reply with answers or "use your defaults".
   ```
   It may also point out a failing test that has nothing to do with your request, so the failure is not blamed on this work.
5. Answer, or reply `use your defaults`. In the default guided mode the crew then waits for your reply at each decision. That is slow on purpose. To let it run to the end, set `mode=auto` in `.mugiwara/config`, or say `mugiwara mode auto` in the chat.
6. Check where the mission is, from a terminal in the repo.
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
   *Real output from a throwaway repo (v1.0.5), after a state save at the first stage. The token figure is the process estimate described in [cost](../concepts/cost.md).*
7. See what the mission cost.
   ```bash
   mugiwara cost
   ```
   ```
   Tokens: process estimate 20694 · no provider usage recorded
   Cost envelope: ok 41% (20694/50000)
   Avoided: 0 stages, 0 contexts, ~0 tokens
   Efficiency: reuse 0, dup 0 chars, budget 41%
   Forced continuations (Stop hook blocks): 0
   Trail: 0 decisions
   ```
   On Claude Code the Stop hook also records the provider-reported token total of the session. When it has, `mugiwara cost` prints it next to the estimate. Here no session was recorded, so it says so.
8. When the crew finishes, it closes the mission and writes `.mugiwara/missions/<mission>/report.md`. By default (`auto_commit=off`) your tree stays uncommitted and the crew prints the git commands for you to run. It never opens a pull request, merges or deploys.
9. Read the report before you attach it. The verdict, the "Not verified" section and the evidence table matter most. A reviewer will read them first, see [review a mission](review-a-mission.md).

## A small change runs direct

Type `/mugiwara fix the typo in the invoice header` and the crew will most likely decide it is a one-line fix, say so, and make the change. There is no mission and no report. That is the design: a typo should not cost a pipeline. To force the full crew on something small, ask for it: `/mugiwara <request>, use the full crew`.

A plain request with no `/mugiwara` usually does not engage the crew at all. In a test, "fix the date format bug in the invoice list" produced no skill call, no mission and no report, the same as an agent without Mugiwara. If you want the crew, start with the slash command.

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| no mission, no report | the request was small or had no `/mugiwara` | run `/mugiwara <request>`, add "use the full crew" if it is small |
| the crew keeps asking for your go | guided mode waits at each decision | reply, or set `mode=auto` |
| `report.md` is a few hand-written lines | the global CLI is missing, so `archive` did not run | `npm i -g @ionivetech/mugiwara`, then `mugiwara archive <mission>` |
| `mugiwara: command not found` | the CLI is not on PATH | `npx -y @ionivetech/mugiwara@latest <command>` |
| `mugiwara status` prints `No mission state on disk.` | no mission started in this checkout | check the branch and that you used `/mugiwara` |

More messages and fixes: [troubleshooting](troubleshooting.md). For auth, payments and migrations, read [risky change](risky-change.md) next.

## What you end up with

Uncommitted code and tests in your tree, and `.mugiwara/missions/<mission>/` holding `report.md`, `plan.md` (when the lane wrote one), `provenance.md` and `rollback.sh`. Commit the report with your change. Most of the crew runs inside your conversation, so its reviews are the same model checking its own work unless the report says otherwise.
