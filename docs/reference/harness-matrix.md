# Harness Matrix

What actually differs per harness tier. Every skill and agent file ships to every harness, but behavior differs in three tiers.

| Tier | Harnesses | Skills | Agents | `references/` | Scope |
|------|-----------|--------|--------|:---:|-------|
| **1** | Claude Code, opencode | Native, auto-trigger per skill | Real, dispatchable | Yes | global + project |
| **2** | Gemini, Codex, Copilot | Full body in rules dir + bootstrap pointer | Markdown only | Yes | project only |
| **3** | Windsurf, Cline, Kilo, Antigravity | Stub; body in `.mugiwara/refs/` | Stub | Yes | project only |

## Behavioral differences

### Tier 1 — Full

- Skills auto-trigger when `description` frontmatter matches the task.
- Agents are dispatchable subagents with isolation.
- Progressive disclosure works: description → body → `references/`.
- Global scope supported — install once, use in every project.

### Tier 2 — Skills only

- Agent files are markdown — the main thread embodies the persona, no subagent dispatch.
- Skills load as rules files; the model chooses which to read per task.
- **Project scope only** — `generic.ts` throws on global scope.
- `references/` files are copied to `.mugiwara/refs/` and reachable.

### Tier 3 — Stubs

- Rule directories get **stub files** — the frontmatter and a pointer to `.mugiwara/refs/`.
- Full body is loaded only when the agent opens the reference file.
- Saves ~40k tokens of glob-load. Trade: the model must decide to open the ref.
- **Project scope only.**
- `references/` files are copied to `.mugiwara/refs/` — depth is available, just not auto-loaded.
- Wave-boundary state flush: savepoint writes `state.json` so the model has computed state to resume from.

## What's the same everywhere

- All 26 skill directories ship to every harness.
- All 14 agent markdown files ship to every harness.
- `references/` files are always copied.
- The workflow, lane sizing, and evidence discipline are identical — the difference is in how the model loads them.

## Write-boundary enforcement (honest limits)

The path-scoped write boundary (`write-scope: artifacts` vs `source` in agent
frontmatter) is **not expressible as a permission rule on any harness**. `edit:
deny` on opencode is global — it blocks legitimate `.mugiwara/**` writes
(results, plans, logs) exactly as hard as source edits. Where a harness cannot
express path-scoped writes, the constraint is carried as the agent's first Rule
(`## Before you start`), mirrored in Red flags, and enforced by the validator
gate (`scripts/validate-content.ts`: every agent declares `write-scope`, only
`zoro-execution`/`brook-healing` may be `source`, handoff targets must be Luffy)
plus the tier-3 stub lines in `src/targets/generic.ts`.

| Harness | `write-scope` expression | Status |
|---------|--------------------------|--------|
| Claude Code | `tools:` frontmatter (plumbed in `claude.ts`, unused — no path-scope support) | **unenforced**, prose + validator |
| opencode | permission map (hand-maintained `edit: deny` removed — wrong axis) | **unenforced**, prose + validator |
| Copilot / tier 2 / tier 3 | prose Rule + Red flag + stub lines | **unenforced**, prose + validator |

The validator is the floor everywhere; CI blocks drift. This does not make
mugiwara a runtime — see `enforcement.md`.
