# Harness Matrix

What actually differs per harness tier. Every skill and agent file ships to every harness, but behavior differs in three tiers.

| Tier | Harnesses | Skills | Agents | `references/` | Scope | CLI availability | Conformance |
|------|-----------|--------|--------|:---:|-------|----------------|------|
| **1** | Claude Code, opencode | Native, auto-trigger per skill | Real, dispatchable | Yes | global + project | bundled | **verified** — claude, opencode in CI (`scripts/conformance.ts`) |
| **2** | Gemini, Codex, Copilot | Full body in rules dir + bootstrap pointer | Markdown only | Yes | project only | npx only | **verified** — gemini, codex, copilot in CI |
| **3** | Windsurf, Cline, Kilo, Antigravity | Stub; body in `.mugiwara/refs/` | Stub | Yes | project only | shell fallback | **verified** — windsurf, cline, kilo, antigravity in CI |
| **marketplace** | Cursor, Kimi, Pi | plugin.json manifest + `content/` pointers (no rules-dir install) | via manifest | n/a | n/a | npx only | **verified** — cursor, kimi, pi manifests in CI |

### If the CLI is unavailable

`mugiwara savepoint`, `archive`, `continue`, and `sign` all require the CLI.
Without it the crew still runs the pipeline and still produces an inline report,
but **no machine-readable state is written** — so resume, budget tracking,
lane-escalation memory, and the closure integrity gate are inactive. The crew
announces this at Flow 0 rather than failing silently.

Conformance runs `scripts/conformance.ts` in CI: every installable target
installs into a scripted fixture repo, runs
`lane.sh` / `savepoint.sh`, and asserts
state fields, the gitignore block, and
file counts match `test/golden/<target>.json`. Marketplace platforms (Cursor,
Kimi, Pi) install from the repo itself through the host's plugin system —
their conformance asserts the plugin manifest parses, its version matches the
package, its `skills` pointer resolves to all 21 skills, and its
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
- Flow-stage-boundary state flush: savepoint writes the mission state so the model has computed state to resume from.

## What's the same everywhere

- All 21 skill directories ship to every harness.
- All 14 agent markdown files ship to every harness.
- `references/` files are always copied.
- The workflow, lane sizing, and evidence discipline are identical — the difference is in how the model loads them.
- The `.mugiwara/missions/<mission>/continue.json | continue-<member>.json` handoff is harness-agnostic (works across every tier in this matrix). Step caps are per-platform and do not break the protocol — one `/mugiwara continue` per session restores the exact resume point on any harness.

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
active-agent identity would force tab-switching per flow stage and break auto mode
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

## Harness enforcement policy (enterprise)

Write-scope is runtime-enforced only on **opencode**; the other 11 harnesses are
rules-based. Enterprise orgs can require the enforced path:

```yaml
# mugiwara.policy.yml
harness:
  require_enforcement: true  # refuse to run where write-scope is rules-based only
```

When `harness.require_enforcement: true`, the CLI (`src/cli.ts` → `src/policy.ts`
`enforceHarnessPolicy` / `isEnforcedHarness` / `detectHarness`) refuses to run
on any non-opencode harness and exits 1:

> `harness enforcement required but current harness is rules-based only — use opencode or set harness.require_enforcement:false`

Detection mirrors `scripts/savepoint.sh`: `OPENCODE` / `OPENCODE_TOKENS_FILE` env
or `.opencode/config.json` (project or cwd) ⇒ `opencode` (enforced);
`CLAUDECODE` / `CLAUDE_CODE_ENTRYPOINT` / `ANTHROPIC_MODEL` containing `claude`
⇒ `claude`; otherwise `unknown` / `cursor` — all non-opencode are treated as
rules-based. Set `harness.require_enforcement: false` or run under opencode to
pass. See `docs/concepts/policy-as-code.md`.

## Turn-end enforcement capability

Hooks are the only mechanism that produces a mission artifact without a model
choosing to, and they are not portable.

| Target | Turn-end enforcement | Basis |
|--------|----------------------|-------|
| `claude` | **enforced** | `Stop` + `SubagentStop` run `hooks/auto-savepoint.ts` |
| `opencode` | advisory only | no verified turn-end event to bind to |
| the other 7 targets | advisory only | no hook mechanism at all |

| Target | Irreversible-command guard | Basis |
|--------|----------------------------|-------|
| `claude` | **enforced** | `PreToolUse` on Bash runs `hooks/pretool-guard.js` |
| `opencode` | under verification (T9) | opencode hook capability not yet confirmed |
| the other 7 targets | prose only | no hook mechanism at all |

Full ENFORCED / ASPIRATIONAL split: [enforcement.md](enforcement.md).

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

The plan doc `.mugiwara/missions/<mission>/flows/todos.md` stays the source of truth
on every host; host tools mirror it. Mirror timing is hard: seed at Flow 2
(tasks + flow-stage list), update in the SAME response each task's evidence lands,
one transition per call, never batched at flow-stage end. Wave banners use the crew
color table in `references/wave-banners.md`
— the plugin and installer read the same table, so the banner color always
matches the agent's UI chip.
