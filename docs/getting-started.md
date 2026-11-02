# Getting started

You want the crew on a change that is worth reviewing, and you worry that every small fix will trigger a heavy process. It will not: the crew sizes the work from your request and checks it against your diff, and a small fix usually runs direct, with no mission and no report. This page takes you from install to a first finished mission.

Example: you ask for role-based access control. The crew sizes it as the full pipeline, asks six questions it cannot guess, plans, builds test-first, reviews and closes with one report. A typo fix runs none of that.

## 1. Install

Claude Code, two slash commands:

```text
/plugin marketplace add ionivetech/mugiwara
/plugin install mugiwara
```

opencode: add `{ "plugin": ["@ionivetech/mugiwara"] }` to `opencode.json` and restart. Other platforms, and what each one really installs, are on the [install page](install.md).

Then install the CLI once: `npm i -g @ionivetech/mugiwara`. Without it the crew falls back to `npx` and shell scripts, and the closing report comes out shorter because `archive` does not run.

## 2. Give it a risky change

Pick something you would want reviewed: auth, payments, a migration, or many files. Use the slash command on Claude Code and opencode. Do not use your host's `@agent` picker.

```text
/mugiwara add role-based access control: admin, editor, viewer
```

The crew picks the full pipeline, names its members, and stops before any code to ask numbered questions. Answer them, or reply `use your defaults`. Guided mode, the default, waits for you at each decision. To run to the end, set `mode=auto` in `.mugiwara/config` or say `mugiwara mode auto`.

Small fixes and plain requests behave differently, on purpose. `/mugiwara <small fix>` is usually handled directly: the crew says it is a one-line fix, makes it, and writes no report. A request without `/mugiwara` usually does not engage the crew at all. To put the crew on a small change, say `use the full crew`.

Check the position at any time:

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

*Real output from a throwaway repo (v1.0.5). The token figure is the process estimate described in [cost](concepts/cost.md).*

## 3. Close the mission and read the report

When the last stage passes, the crew closes the mission. By default (`auto_commit=off`) your tree stays uncommitted and the crew prints the commands. It never opens a PR, merges or deploys. Open the file you would attach to a PR:

```text
open .mugiwara/missions/<m>/report.md
```

It holds the verdict, what changed, which checks ran with evidence, what was not verified, and the cost. On Claude Code, a full-lane or sensitive-path review runs as separate subagents; otherwise it runs inline, the same model checking its own work. The report says which (`Checked independently` or `Checked inline`).

## What to read next

- Step by step with real output: [your first mission](runbooks/solo-mission.md).
- Auth, payments or migrations: [run a risky change](runbooks/risky-change.md).
- Which runbook fits your situation: the [runbook index](runbooks/README.md).
- Something did not happen: [troubleshooting](runbooks/troubleshooting.md).

Run `/mugiwara` on the riskiest change in your repo this week, and open the report when it closes.
