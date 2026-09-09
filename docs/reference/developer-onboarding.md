# How do I onboard a developer?

A contributor's first hour decides their second month. This page takes a developer from fresh clone to validated change with one source of truth and one command chain.

Example: a new contributor edits `content/skills/mugiwara-gates/SKILL.md`, then runs validation, typecheck, and tests from the repo root (`bun run validate`, `bun run typecheck`, `bun run test`). Green across all three means the change is shaped correctly; anything red names the file and rule before review time.

## Requirements and layout

Node.js 20.11 or newer runs the CLI and the built artifact; Bun is preferred for building from source and running tests. `content/` holds skills plus agents as the only physical source; repo-root `agents/` and `skills/` are symlinks into it, so harnesses reading the plugin root see identical files with no copy to drift. Recreate missing symlinks with the sync script under `.claude-plugin/`.

## Source rules

Always edit `content/`, never the symlink faces. Skill plus agent descriptions share a 5,500-char index budget enforced by the validator: a new description replaces an old one, since the catalog never grows past the ceiling. New skills match folder name to frontmatter name, carry a 20-char-plus description, keep bodies within 120 lines, and declare a numeric `Skip when` block. New agents list held skills in frontmatter with a summon-ready description, then update the crew tables in README and docs.

## Validate, build, contribute

Run `bun run validate`, `bun run typecheck`, and `bun run test` from the repo root, then `bun run build` for the distributable. Version numbers sync from `package.json` at publish time. Open an issue or pull request on GitHub to contribute.
