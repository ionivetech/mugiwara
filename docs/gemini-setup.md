# Gemini CLI Setup

## Install

```bash
gemini extensions install https://github.com/ionivetech/mugiwara
```

Or via the CLI:

```bash
npx @ionivetech/mugiwara@latest --project ./my-app --target gemini --yes
```

## What you get

- 25 skills as markdown rules in `.gemini/mugiwara/`.
- A `GEMINI.md` bootstrap pointer (created if missing).

## Notes

Gemini is a **project-only** target — skipped (with a note) on `--global`
installs. Agents are skills-only here (no native subagent registry); the crew
pipeline runs through the rule files.
