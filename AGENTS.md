# Mugiwara Development Standards

Rules for working on this repo. Follow these or validation fails.

## Language

**All files must be English.** Skills, agents, docs, scripts, references — no
exceptions. Comments in source code should be English. This conversation is the
only place Indonesian is acceptable.

## Trunk-based branching strategy

`main` is always stable and releasable. No commits directly to `main`.

| Branch | Purpose | Lifetime |
|--------|---------|----------|
| `main` | Source of truth. Always passes CI. | Permanent |
| `feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*` | Feature work from main, PR to main | Short-lived, delete after merge |
| `release/vX.Y.Z` | Created from main for publishing. Archival. | Short-lived, delete after tag |

### Flow

1. Branch from `main`
2. Work + validate locally
3. PR to `main` — CI must pass (all gates)
4. Merge to `main`
5. Run "Manual Release" workflow on GitHub Actions → creates tag + npm publish + GitHub Release
6. Release branch (`release/vX.Y.Z`) created from the release commit — archival

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<description>` | `feat/add-mcp-audit-skill` |
| Fix | `fix/<description>` | `fix/token-budget-overflow` |
| Chore | `chore/<description>` | `chore/update-deps` |
| Docs | `docs/<description>` | `docs/rewrite-readme` |
| Refactor | `refactor/<description>` | `refactor/split-checkpoint` |
| Release | `release/vX.Y.Z` | `release/v0.5.0` |

### Version bumping

| Trigger | Bump |
|---------|------|
| Bug fix, no new features | `patch` |
| New feature, backward-compatible | `minor` |
| Breaking change | `major` |

All version bumps via the Manual Release workflow — never manually edited.

## Validation before commit (CI gates)

All must pass on every PR. CI runs automatically:

```bash
bun run typecheck                                              # TypeScript
bun run test                                                   # 70 tests
bun run build                                                  # dist/
bun scripts/validate-content.ts --check-manifest --check-docs  # content + manifest + docs drift
bun scripts/run-evals.ts                                       # behavioral evals
bun scripts/retrieval-eval.ts                                  # retrieval ranking
echo "✓ all checks passed"
```

No PR merges without all green CI.

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
