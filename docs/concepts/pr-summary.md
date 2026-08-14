# PR summary (closure handoff)

At the end of a mission the crew pushes the branch and **stops** — it never
creates a PR, in any mode. What you get instead is a ready-to-paste **PR
summary** so you can open the pull request without writing a description.

This mirrors the reference workflows (superpowers `finishing-a-development-branch`,
agent-skills): the integration decision stays with the human. Mugiwara's
addition is that the PR description is already written.

## What happens at the terminal

1. Save-point commit → push the mission branch with plain `git push -u origin <branch>`.
2. Write `.mugiwara/results/<mission>/07-pr-verdict.md` per `mugiwara-pr` —
   the verdict file IS the PR summary: title line + body, one document,
   order title → summary → what changed → per-wave evidence → tests → checks.
3. Hand the branch + verdict file to you. You open the PR and paste it as-is.

No `gh` CLI, no PR API calls, no auto-reaction to review comments or CI.

## The verdict file

The verdict file is shaped by `.mugiwara/config` (project) /
`~/.mugiwara/config` (global):

Example:

```
mode=guided
branch=feature/{type}-{issue}-{slug}
commit=conventional
```

The title is a concise `{type}: {summary}` line from mission metadata; the
body is the rest of the verdict file (summary, what changed, per-wave
evidence, tests, checks) — one document, no separate block. The summary is
**material, never posted** — the crew's job ends at push.

## Why no auto-create

- PR creation is an external, irreversible side effect (public artifact, CI
  trigger, reviewer notifications) — keeping it human avoids surprise and
  security surface.
- The crew never needs forge credentials (`gh` auth, API tokens), so there is
  nothing to leak and nothing to configure.
- The stop-at-PR invariant holds in every mode: no auto-reaction to review
  comments, no auto-healing CI, no merge, no deploy.

See [`mugiwara-pr`](../content/skills/mugiwara-pr/SKILL.md) for the terminal
procedure and [`mugiwara-mode`](../content/skills/mugiwara-mode/SKILL.md) for
the mode contract.
