# Mugiwara Development Standards

Rules for working on this repo. Follow these or validation fails.

## Language

**All files must be English.** Skills, agents, docs, scripts, references — no
exceptions. Comments in source code should be English. This conversation is the
only place Indonesian is acceptable.

## Validation before commit

```bash
bun scripts/validate-content.ts --check-manifest --check-docs  # content + manifest + docs drift
bun run typecheck                                              # TypeScript
bun run test                                                   # 70 tests
bun scripts/retrieval-eval.ts                                  # retrieval ranking
```

All must pass. Fix failures before committing.

## Skill standards

Every skill is `content/skills/<name>/SKILL.md`:

| Rule | Limit | Validated |
|------|-------|:---:|
| Frontmatter `name` matches directory | exact match | ✅ |
| `description` length | 20–500 chars | ✅ |
| `description` content | trigger keywords + disambiguators only, no procedure | — |
| Body lines | ≤120 | ✅ |
| `## Skip when` block | 1–4 bullets, numeric threshold | ✅ |
| Sections >15–20 lines | move to `references/<topic>.md`, one-line pointer in body | — |
| Language | **English only** | — |

## Agent standards

Every agent is `content/agents/<name>.md`:

| Rule | Requirement |
|------|------------|
| Frontmatter `name` matches filename | exact match (without `.md`) |
| `description` | pointer line: "Persona for <skill>. <role summary>." |
| `skills` | list of held skills, comma-separated |
| `permissions` | optional: `read-only`, `can-write`, `no-network` |
| Language | **English only** |

## Reference files

Two locations:
- `references/` — shared, linked from multiple skills
- `content/skills/<name>/references/` — skill-specific

Body → one-line pointer: "Full checklist: `references/checklist.md` — 37 items;
unchecked boxes are not done." Never just a bare filename.

## Index budget

Combined skill + agent description chars must be ≤5500. Enforced by validator.
Trimming descriptions = always drop procedure, keep trigger vocabulary.

## Manifest sync

`.claude-plugin/plugin.json` `metadata.skills` and `metadata.agents` must
set-equal `content/skills/` and `content/agents/`. Enforced by
`--check-manifest`. If you add/remove/rename a skill or agent, update the
manifest.

## Docs drift

`docs/skills.md` must mention every skill directory. `docs/agents.md` must
mention every agent file. Enforced by `--check-docs`.

## Skill count

26 is the ceiling. A new skill replaces an old one — never add to grow.

## Commit style

Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.

## Directory map

```
content/skills/    — 26 skill dirs, each with SKILL.md + optional references/
content/agents/    — 15 agent .md files
references/         — shared reference files (definition-of-done, source-grounding, etc.)
docs/               — user-facing documentation
scripts/            — validation + tooling scripts
src/                — CLI TypeScript source
test/               — vitest tests
evals/cases/        — eval case JSON files
```
