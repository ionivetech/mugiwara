# Codex Setup

## Install

```bash
codex plugin marketplace add ionivetech/mugiwara
codex plugin add mugiwara@mugiwara
```

Or via the CLI:

```bash
npx @ionivetech/mugiwara@latest --project ./my-app --target codex --yes
```

## What you get

- 25 skills as markdown rules in `.codex/mugiwara/`.
- An `AGENTS.md` bootstrap pointer (created if missing).

## Notes

Codex is a **project-only** target. Agents are skills-only here — the crew
pipeline runs through the rule files.
