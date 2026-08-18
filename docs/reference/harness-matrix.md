# Harness Matrix

What actually differs per harness tier. Every skill and agent file ships to every harness, but behavior differs in three tiers.

| Tier | Harnesses | Skills | Agents | `references/` | Scope | Conformance |
|------|-----------|--------|--------|:---:|-------|------|
| **1** | Claude Code, opencode | Native, auto-trigger per skill | Real, dispatchable | Yes | global + project | **verified** — claude, opencode in CI (`scripts/conformance.ts`) |
| **2** | Gemini, Codex, Copilot | Full body in rules dir + bootstrap pointer | Markdown only | Yes | project only | **verified** — gemini, codex, copilot in CI |
| **3** | Windsurf, Cline, Kilo, Antigravity | Stub; body in `.mugiwara/refs/` | Stub | Yes | project only | **verified** — windsurf, cline, kilo, antigravity in CI |
| **marketplace** | Cursor, Kimi, Pi | plugin.json manifest + `content/` pointers (no rules-dir install) | via manifest | n/a | n/a | **verified** — cursor, kimi, pi manifests in CI |

Conformance runs `scripts/conformance.ts` in CI: every installable target
installs into a scripted fixture repo, runs
`lane.sh` / `savepoint.sh` / `evidence.sh` / `mission-report.sh`, and asserts
state fields, report sections, evidence headers, the gitignore block, and
file counts match `test/golden/<target>.json`. Marketplace platforms (Cursor,
Kimi, Pi) install from the repo itself through the host's plugin system —
their conformance asserts the plugin manifest parses, its version matches the
package, its `skills` pointer resolves to all 26 skills, and its
`metadata.skills/agents` set-equals `content/`, against
`test/golden/<platform>.json`. All twelve platforms are covered; anything
outside them is **untested**.

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
- Wave-boundary state flush: savepoint writes the mission state so the model has computed state to resume from.

## What's the same everywhere

- All 26 skill directories ship to every harness.
- All 15 agent markdown files ship to every harness.
- `references/` files are always copied.
- The workflow, lane sizing, and evidence discipline are identical — the difference is in how the model loads them.
- The `.mugiwara/continue/<mission>/[member].json` handoff is harness-agnostic (works across every tier in this matrix). Step caps are per-platform and do not break the protocol — one `/mugiwara continue` per session restores the exact resume point on any harness.

## Write-boundary enforcement (honest limits)

The path-scoped write boundary (`write-scope: artifacts` vs `source` in agent
frontmatter) splits into two regimes.

**User-facing crew agents** (luffy-orchestrator, usopp-brainstorm,
nami-planner, zoro-execution, chopper-checkpoint, sanji-quality,
franky-gates, robin-reviewer, jinbe-security, brook-healing,
resume-coordinator) run inline in the main thread with the
full toolset and get **no runtime write-scope enforcement** on any harness.
Discipline is rules-based: persona rules (`## Before you start`), the
orchestration skill's Write boundary section, and the write-scope reflex (an
artifacts-scope agent facing a source-edit task announces "Delegating to
Zoro" and dispatches immediately). A runtime permission bound to the
active-agent identity would force tab-switching per wave and break auto mode
+ resume — see `src/targets/opencode.ts`.

**Internal subagent-only agents** (skeptic-verifier, eval-runner,
memory-keeper — all `artifacts`) keep runtime enforcement where the harness
can express path-scoped rules:

| Harness | Internal-agent `write-scope` expression | Status |
|---------|-----------------------------------------|--------|
| opencode | `permission.edit` glob map — artifacts: `{ '*': 'deny', '.mugiwara/**': 'allow' }`; source: `edit: allow` (last-match-wins) | **ENFORCED at runtime** (generated in `src/targets/opencode.ts` + `.opencode/plugins/mugiwara.mjs`) |
| Claude Code | `tools:` frontmatter generated from `write-scope` — artifacts: `Read, Grep, Glob, Write, Bash, WebFetch, WebSearch` (no `Edit`); source: default set | **partial** — Edit blocked, Write unscoped, Bash can still write via redirection |
| Copilot / tier 2 / tier 3 | no dispatch — Rule + Red flag + stub lines | **unenforced**, prose + validator |

Where the harness cannot enforce, the constraint is carried as the agent's
first Rule (`## Before you start`), mirrored in Red flags, and enforced by the
validator gate (`scripts/validate-content.ts`: every agent declares
`write-scope`, only `zoro-execution`/`brook-healing` may be `source`, handoff
targets must be Luffy) plus the tier-3 stub lines in `src/targets/generic.ts`.

The validator is the floor everywhere; CI blocks drift. This does not make
mugiwara a runtime — see `enforcement.md`.

## Worker dispatch capability

| Harness | Worker dispatch | Context-pressure fallback |
|---------|-----------------|---------------------------|
| Claude Code, opencode, Copilot | yes (native subagents) | — |
| Gemini, Codex, Windsurf, Cline, Kilo, Antigravity | no | savepoint + checkpoint + fresh session via `resume` |

## Todo sync per host

| Host | Native todo tool | Notes |
|------|------------------|-------|
| opencode | `todowrite` / `todoread` | Permission key `todowrite`; disabled for subagents by default |
| Claude Code | `TaskCreate` / `TaskUpdate` / `TaskList` | `TodoWrite` deprecated since v2.1.142 |
| Copilot / tier 2 / tier 3 | none | plan doc `todos.md` is the only mirror |

The plan doc `.mugiwara/results/<mission>/todos.md` stays the source of truth
on every host; host tools mirror it. Mirror timing is hard: seed at Wave 2
(tasks + wave list), update in the SAME response each task's evidence lands,
one transition per call, never batched at wave end. Wave banners use the crew
color table in `references/wave-banners.md`
— the plugin and installer read the same table, so the banner color always
matches the agent's UI chip.
