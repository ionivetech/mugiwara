# Getting Started

Install the crew, run your first mission, and understand what you're looking at
in the chat.

## 1. Install

Pick your harness — every major one is supported. The two easiest:

**opencode** — add the plugin to `opencode.json`:

```json
{ "plugin": ["@ionivetech/mugiwara"] }
```

**Claude Code** — via the marketplace:

```bash
/plugin marketplace add ionivetech/mugiwara
/plugin install mugiwara
```

| Harness | Install command |
|---------|----------------|
| Claude Code | `/plugin marketplace add ionivetech/mugiwara` then `/plugin install mugiwara` |
| opencode | `{ "plugin": ["@ionivetech/mugiwara"] }` in `opencode.json` |
| GitHub Copilot | `copilot plugin marketplace add ionivetech/mugiwara` then `copilot plugin install mugiwara` |
| Gemini CLI | `gemini extensions install https://github.com/ionivetech/mugiwara` |
| Codex | `codex plugin marketplace add ionivetech/mugiwara` then `codex plugin add mugiwara@mugiwara` |
| Cursor | `/add-plugin mugiwara` |
| Kimi Code | `/plugins install https://github.com/ionivetech/mugiwara` |
| pi | `pi install git:github.com/ionivetech/mugiwara` |
| Windsurf, Cline, Kilo, Antigravity | `npx @ionivetech/mugiwara@latest --project . --target <id> --yes` |

Or the CLI for any target:

```bash
npx @ionivetech/mugiwara@latest --project ./my-app --target all --yes
```

Requires **Node.js >= 20.11**. Bun is optional (build-from-source only).

## 2. Start a mission

The workflow **auto-activates** at session start. The crew announces itself,
then give any non-trivial request.

### Small: lane 0–1

```
> fix the date formatting bug in src/utils/format.ts
```

Luffy routes it to **Lane 1** (Lean). Zoro reproduces and fixes, Sanji runs
format + lint + tests. Two waves, visible as compact checkpoint reports. No
nine-wave ceremony for a one-file bug.

That's lane sizing: the process scales to the work. A typo (Lane 0) runs zero
waves — the fix happens directly.

### Medium: lane 2

```
> add a search bar to the products page
```

Touches frontend + API. Luffy routes to **Lane 2** (Standard). Nami plans 1
wave with 3-5 tasks, Zoro executes test-first, Chopper audits every criterion,
Sanji and Franky gate, Robin and Jinbe review.

### Large: lane 3

```
> add role-based access control to the API
```

Touches auth — Luffy routes to **Lane 3** (Full). All 9 waves run. Nami plans
the migration, Zoro executes, Chopper audits, Sanji tests, Franky gates, Robin
reviews the diff with a breaking-change map, Jinbe runs STRIDE + OWASP, Brook
heals any failures (max 3 cycles), Luffy closes with a mission report + push +
ready PR summary.

```
  Wave 0  Luffy   triage → route: full pipe (auth/ touched)
  Wave 2  Nami    plan   → .mugiwara/plans/2026-08-10-rbac.md (2 waves, 5 tasks)
  Wave 3  Zoro    execute→ 5 tasks, evidence per task
  Wave 4  Chopper audit  → PASS: all criteria met, commit hygiene clean
  Wave 5  Sanji   quality → PASS: lint 0, 312 tests green
  Wave 6  Franky  gates  → PASS: new 94%, modified 87%, build green
  Wave 7  Robin   review → 2 minor findings (batched)
  Wave 7  Jinbe   security→ PASS: STRIDE clean, 0 high
  Wave 9  Luffy   closure→ mission report + push + ready PR summary
```

The crew runs **inline** in your main conversation — every wave reports as a
compact checkpoint. Subagents only for parallel task batches.

Prefer to drive stages yourself? Every stage has a slash command:
`/mugiwara-plan`, `/mugiwara-execute`, `/mugiwara-review`,
`/mugiwara-security`, `/mugiwara-heal`, `/mugiwara-ship`. Jump into any stage.

## 3. What you do during a mission

Almost nothing in `guided` mode:

- Answer Nami's clarifying questions (one batched round before planning).
- Give the plan an explicit GO when presented.
- Review Brook's rollback note if a risky fix is proposed.
- In every mode, **open the PR at the end** — the crew pushes the branch and
  hands you a verdict file with a ready PR summary. The crew never creates a
  PR, merges, or deploys.

Switch to `semi` or `auto` if you want the crew to self-manage branch, commits,
and ambiguities. See [modes](modes.md).

## 4. The `.mugiwara/` workspace

Every mission writes to `.mugiwara/` at the repo root:

```
.mugiwara/
├── config          # mode, branch, commit, base, coverage thresholds
├── state.json      # computed at every wave boundary by scripts/savepoint.sh
├── spec/           # brainstorm output
├── plans/          # clean execution plan (source of truth from Wave 2)
├── results/        # audit, quality, gate, closure reports + evidence logs
├── reports/        # human-readable mission reports
├── review/         # review + security findings
├── issues/         # blocker ledger
├── refs/           # full skill/agent bodies for glob-loading harnesses
└── logs/           # decision log + cross-mission lessons
```

**Savepoint** runs at every wave boundary — `state.json` carries lane, wave,
files, blockers, heal cycle, and token budget. Resume reads one file instead of
six. See [audit-trail.md](audit-trail.md) for the full artifact map.

## 5. Configuration

`.mugiwara/config` (project) overrides `~/.mugiwara/config` (global):

| Key | Default | What it controls |
|-----|---------|-----------------|
| `mode` | guided | Autonomy: guided/semi/auto |
| `branch` | `feature/{type}-{issue}-{slug}` | Branch naming pattern |
| `commit` | conventional | Commit style: conventional/gitmoji/plain |
| `base` | main | PR target branch |
| `coverage_new` | 90 | Coverage % for new files |
| `coverage_modified` | 80 | Coverage % for modified files |

## 6. Next steps

- Meet the [crew](agents.md) — 15 agents with permission boundaries.
- Browse the [skills](skills.md) — 26 skills with the 3-layer disclosure model.
- Understand the [lanes](lanes.md) — how work is sized before it runs.
- Set your [mode](modes.md) — guided/semi/auto.
- Read the [audit trail](audit-trail.md) — every artifact and how to review it.
- See the [compliance matrix](compliance-matrix.md) — rule compliance per model.
