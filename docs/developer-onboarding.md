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
├── agents/             # synced copy of content/agents (plugin copies at repo root)
├── skills/             # synced copy of content/skills
├── src/                # CLI, installer, targets, frontmatter parser
├── scripts/            # validate-content, sync-version, run-evals, install scripts
├── test/               # vitest suite
├── .opencode/plugins/  # opencode plugin (registers crew at config load)
├── .claude-plugin/     # Claude Code marketplace + sync.sh
└── docs/               # these docs
```

## The source of truth

`content/` is canonical. The repo-root `agents/` and `skills/` copies are
generated for harnesses that read the repo directly:

```bash
sh .claude-plugin/sync.sh
```

Always edit `content/`, then sync. `bun run validate --check-sync` fails if the
copies drift.

## Validation

```bash
bun run validate                # 32 skills + 15 agents: names, descriptions, line limits
bun run validate --check-sync   # plugin copies match content/
bun run typecheck               # tsc --noEmit
bun run test                    # vitest (43 tests)
```

## Editing a skill or agent

1. Edit `content/skills/<name>/SKILL.md` or `content/agents/<name>.md`.
2. Respect the house style (see [skill-anatomy.md](skill-anatomy.md) and
   [agent-anatomy.md](agent-anatomy.md)): evidence over claims, exact commands,
   red flags, ≤120-line skill bodies.
3. `sh .claude-plugin/sync.sh`
4. `bun run validate && bun run typecheck && bun run test`

## Adding a new skill or agent

1. Create the content file following the anatomy docs.
2. If it's an agent, list its held skills in frontmatter; give it a
   `description` ≥20 chars.
3. If it's a skill, pick a folder name that matches `name`; description 20–500
   chars; body ≤120 lines.
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
