# Developer Onboarding

Set up, validate, and contribute to the mugiwara repo.

## Requirements

| Dependency | Required for | Version |
|------------|--------------|---------|
| Node.js | running the CLI and the built artifact | >= 20.11 |
| Bun | building from source, running tests | optional (preferred) |

```bash
bun install
```

## Repo layout

```
mugiwara/
├── content/            # single source of truth: skills/ + agents/ markdown
├── agents/             # symlink → content/agents (Claude Code plugin reads plugin root)
├── skills/             # symlink → content/skills
├── src/                # CLI, installer, targets, frontmatter parser
├── scripts/            # validate-content, sync-version, run-evals, install scripts
├── test/               # vitest suite
├── .opencode/plugins/  # opencode plugin (registers crew at config load)
├── .claude-plugin/     # Claude Code marketplace + sync.sh (symlink guard)
└── docs/               # these docs
```

## The source of truth

`content/` is the only physical source. The repo-root `agents/` and `skills/`
are **symlinks** into it, so harnesses that read the plugin root (Claude Code
marketplace) see the same files — there is no copy to drift. On a fresh clone
where the symlinks are missing, recreate them:

```bash
sh .claude-plugin/sync.sh
```

Always edit `content/`. `bun run validate --check-sync` verifies the symlinks
resolve to `content/` and never diverge.

## Validation

```bash
bun run validate                # 26 skills + 12 agents (+3 internal): names, descriptions, skip gates, line limits
bun run validate --check-sync   # symlinks resolve to content/, never diverge
bun run typecheck               # tsc --noEmit
bun run test                    # vitest
bun run evals                   # eval suite valid (structure + coverage gates)
bun run evals --run             # optional: execute cases against a model CLI (MUGIWARA_EVAL_CMD)
```

## Editing a skill or agent

1. Edit `content/skills/<name>/SKILL.md` or `content/agents/<name>.md`.
2. Respect the house style (see [skill-anatomy.md](skill-anatomy.md) and
   [agent-anatomy.md](agent-anatomy.md)): evidence over claims, exact commands,
   red flags, ≤120-line skill bodies.
3. `bun run validate && bun run typecheck && bun run test`

## Adding a new skill or agent

1. Create the content file following the anatomy docs.
2. If it's an agent, list its held skills in frontmatter; give it a
   `description` ≥20 chars.
3. If it's a skill, pick a folder name that matches `name`; description 20–500
   chars; body ≤120 lines; include a `## Skip when` block (1–4 bullets, numeric
   thresholds) so the skill knows when it does not apply.
4. Update the crew/technique tables in `README.md` and the docs (`agents.md`,
   `skills.md`).
5. Sync + validate + test.

## Building and publishing

```bash
bun run build          # dist/mugiwara.js
bun run sync-version   # sync version from package.json into manifests
bun prepack            # build + sync-version
```

Version numbers in the manifests sync from `package.json` via `sync-version`
(runs automatically on publish).

## Contributing

Open an issue or pull request on GitHub: <https://github.com/ionivetech/mugiwara>.
