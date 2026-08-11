# Cursor Setup

## Install

```
/add-plugin mugiwara
```

Or via the CLI:

```bash
npx @ionivetech/mugiwara@latest --project ./my-app --target cursor --yes
```

**Update** — re-run `/add-plugin mugiwara`. **Uninstall** — `/remove-plugin mugiwara`.

## What you get

- 32 skills as markdown rule files.
- The `.cursor-plugin/plugin.json` manifest.

## Notes

Cursor is a **project-only** target. Agents are skills-only here — the crew
pipeline runs through the rule files.
