# Claude Code Setup

Claude Code is a fully supported target — native skills + agents + SessionStart
hook.

## Install via the marketplace

```bash
/plugin marketplace add ionivetech/mugiwara
/plugin install mugiwara
```

## Install via CLI (global or per project)

```bash
# global Claude Code install
npx @ionivetech/mugiwara@latest --global --target claude --yes

# project install
npx @ionivetech/mugiwara@latest --project ./my-app --target claude --yes
```

**Update** — re-install from the marketplace (or `mugiwara update` via CLI).

**Uninstall** — `/plugin uninstall mugiwara`, or `mugiwara uninstall` via CLI.

## What you get

- 32 skills in `~/.claude/skills/` (global) or `.claude/skills/` (project).
- 14 agents in `~/.claude/agents/` or `.claude/agents/`.
- A SessionStart hook that announces the crew and auto-activates the workflow —
  a non-trivial request runs the pipeline by itself. `/using-mugiwara` is an
  optional explicit router if you want to hand-route a mission.

## Use it

```
> add dark mode to the settings page
```

The crew runs inline in your main conversation; subagents only for parallel
batches. At closure the crew pushes the branch and hands you the PR verdict
file with a ready PR summary block — you open the PR, in every mode.
