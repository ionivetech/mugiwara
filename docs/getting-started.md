# Getting Started

You want the crew running without learning nine flow stages on day one. You worry a small fix will trigger a heavy process. This page answers "how do I start" with one example, then the short path. Nothing here runs in the background.

Example: you report a date formatting bug in one file. Luffy routes it to a lean lane. Zoro reproduces and fixes, Sanji runs format plus lint plus tests. Two flow stages, compact checkpoint reports, no planning ceremony. A typo runs zero flow stages.

Rule: the process scales to the work. Small changes stay small by lane sizing. Large or sensitive changes get plans, audits, gates, and a reviewable trail.

## Install

Requirements: git, plus Node.js 20.11 or newer. Bash runs `lane.sh` and `savepoint.sh`. On Windows, Git for Windows ships bash. Set `MUGIWARA_BASH` when yours lives elsewhere.

| Harness | Install |
|---|---|
| opencode | Add the plugin block below to `opencode.json` |
| Claude Code | Marketplace add `ionivetech/mugiwara`, then install `mugiwara` |
| Gemini, Codex, Copilot, Cursor, others | `npx @ionivetech/mugiwara@latest` with your target flag and `--yes` |
| Any target, CLI path | `npx @ionivetech/mugiwara@latest --project ./my-app --target all --yes` |

```json
{ "plugin": ["@ionivetech/mugiwara"] }
```

Install writes `.mugiwara/config` with defaults. Edit it directly to set mode, branch pattern, review depth, quality depth, coverage, and commit style.

## Start a mission

The workflow auto-activates at session start. The crew announces itself. Give any non-trivial request in plain language.

A medium change such as a search bar across frontend plus API routes to a standard lane. Nami plans tasks, Zoro executes test-first, Chopper audits each criterion, Sanji and Franky gate, Robin and Jinbe review. A large change touching auth routes to a full lane with all nine flow stages, STRIDE plus OWASP review, and at most 3 heal cycles before escalation.

The crew runs inline in your main conversation. Subagents cover parallel task batches only. Slash commands exist for mode switch, continue, review, and security. The rest routes itself.

## Your role and your trail

In guided mode you answer one batched round of clarifying questions, give the written plan an explicit GO, and open the PR at the end. The crew pushes the branch and hands you a ready summary. It never creates a PR, merges, or deploys. Semi keeps your plan approval and automates from execution to ship. Auto resolves ambiguities internally and pauses only on a genuine blocker.

Every mission writes to `.mugiwara/missions/<mission>/`: `plan.md`, `decisions.md`, `blockers.md`, `report.md`, state JSON, continue JSON, and per-flow-stage files under `flows/`. Open `report.md` first at review time. Runbooks cover team missions, resume after a crash, and troubleshooting. Meet the [crew](concepts/agents.md), read the [lanes](concepts/lanes.md), set your [mode](concepts/modes.md).
