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

## What you get

- 25 skills in `~/.claude/skills/` (global) or `.claude/skills/` (project).
- 15 agents in `~/.claude/agents/` or `.claude/agents/`.
- A SessionStart hook that announces the crew.

## Use it

```
> use mugiwara
> add dark mode to the settings page
```

The crew runs inline in your main conversation; subagents only for parallel
batches. At closure the crew pushes the branch and hands you the PR verdict
file — you open the PR.
