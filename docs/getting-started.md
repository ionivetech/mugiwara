# Getting Started

Install the crew, run your first mission, and understand what you're looking at
in the chat.

## The minimal path

Everything below is optional on day one. The shortest honest version:

1. **Install** (next section). Nothing runs in the background.
2. **Keep working exactly as before.** Small changes stay small — lane sizing
   routes them around the pipeline automatically.
3. **When a change feels big or touches something sensitive**, say so in your
   request ("this touches auth"). That is the whole trigger: the crew sizes it
   to a full lane, and you get plans, audits, gates, and a reviewable trail.
4. **After any mission**, look at `.mugiwara/missions/<mission>/report.md` —
   that file, plus `provenance.md` and `rollback.sh`, is the product.

You never have to learn the nine flow stages to benefit. They are what happens
when the work demands it. A sample of what a finished trail looks like ships
in [`examples/trail/`](../examples/trail/README.md) — readable without
running anything.

## Requirements

- Git (missions compute lanes and savepoints from git).
- **bash** for `lane.sh`/`savepoint.sh` — present on macOS and Linux;
  on Windows, Git for Windows ships it and mugiwara probes common paths.
  Set `MUGIWARA_BASH` if yours lives elsewhere.

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

**First time?** Install writes `.mugiwara/config` with sensible defaults — edit it directly to set branch pattern, mode, review depth, quality checks, coverage, and commit style.

## 2. Start a mission

The workflow **auto-activates** at session start. The crew announces itself,
then give any non-trivial request.

### Small: lane 0–1

```
> fix the date formatting bug in src/utils/format.ts
```

Luffy routes it to **Lane 1** (Lean). Zoro reproduces and fixes, Sanji runs
format + lint + tests. Two flow stages, visible as compact checkpoint reports. No
nine-flow-stage ceremony for a one-file bug.

That's lane sizing: the process scales to the work. A typo (Lane 0) runs zero
flow stages — the fix happens directly.

### Medium: lane 2

```
> add a search bar to the products page
```

Touches frontend + API. Luffy routes to **Lane 2** (Standard). Nami plans 1
flow stage with 3-5 tasks, Zoro executes test-first, Chopper audits every criterion,
Sanji and Franky gate, Robin and Jinbe review.

### Large: lane 3

```
> add role-based access control to the API
```

Touches auth — Luffy routes to **Lane 3** (Full). All 9 flow stages run. Nami plans
the migration, Zoro executes, Chopper audits, Sanji tests, Franky gates, Robin
reviews the diff with a breaking-change map, Jinbe runs STRIDE + OWASP, Brook
heals any failures (max 3 cycles), Luffy closes with a mission report + push +
ready PR summary.

```
  Flow 0  Luffy   triage → route: full pipe (auth/ touched)
  Flow 2  Nami    plan   → .mugiwara/missions/rbac/plan.md (2 plan waves, 5 tasks)
  Flow 3  Zoro    execute→ 5 tasks, evidence per task
  Flow 4  Chopper audit  → PASS: all criteria met, commit hygiene clean
  Flow 5  Sanji   quality → PASS: lint 0, 312 tests green
  Flow 6  Franky  gates  → PASS: new 94%, modified 87%, build green
  Flow 7  Robin   review → 2 minor findings (batched)
  Flow 7  Jinbe   security→ PASS: STRIDE clean, 0 high
  Flow 9  Luffy   closure→ mission report + push + ready PR summary
```

The crew runs **inline** in your main conversation — every flow stage reports as a
compact checkpoint. Subagents only for parallel task batches.

Execution is **adaptive**: the crew picks an execution posture (inline / parallel /
context-relief / phase / team) from evidence at each flow boundary, and a Cost
Governor keeps spend measured and bounded (see
[adaptive execution](concepts/execution-model.md)). Inline stays the default;
parallel only when the plan proves independent tasks.

Prefer to drive part of it yourself? A few slash commands exist:
`/mugiwara` (mode switch), `/mugiwara-continue` (resume),
`/mugiwara-review`, `/mugiwara-security`. The rest of the pipeline routes
itself — just ask in plain language.

## 3. What you do during a mission

Almost nothing in `guided` mode:

- Answer Nami's clarifying questions (one batched round before planning).
- Give the plan an explicit GO when presented.
- Review Brook's rollback note if a risky fix is proposed.
- In every mode, **open the PR at the end** — the crew pushes the branch and
  hands you a verdict file with a ready PR summary. The crew never creates a
  PR, merges, or deploys.

Switch to `semi` if you want the crew to self-manage branch, commits, and
execution from Flow 3 (you still approve the written plan and answer real
questions). Switch to `auto` for full autonomy — the crew resolves ambiguities
internally (brainstorm → Luffy decides). See [modes](concepts/modes.md).

## 4. The `.mugiwara/` workspace

Every mission writes to `.mugiwara/` at the repo root:

```
.mugiwara/
├── config                    # mode, branch, commit, coverage thresholds
├── lessons.md                # cross-mission lessons ledger
├── index.md                  # one line per archived mission
├── refs/                     # full skill/agent bodies for glob-loading harnesses
└── missions/<mission>/       # ONE dir per mission, bare names
    ├── plan.md               # clean execution plan (source of truth from Flow 2)
    ├── spec.md               # brainstorm output / spec bridge
    ├── decisions.md          # Luffy's decision + check-in log
    ├── blockers.md           # blocker ledger
    ├── review.md / security.md  # Robin's and Jinbe's findings
    ├── report.md             # closure report; archive folds the trail into it
    ├── state.json            # computed at every flow-stage boundary (team: <member>.json)
    ├── continue.json         # machine-written resume point (team: continue-<member>.json)
    └── flows/                # per-flow-stage artifacts: 01-execution … 07-pr-verdict + todos
```

**Savepoint** runs at every flow-stage boundary — the mission state carries lane, flow stage,
files, blockers, heal cycle, and token budget. Resume reads one file instead of
six. **Archive** (`mugiwara archive <mission>`) folds waves + findings into
`report.md`, leaving plan.md + report.md. See
[audit-trail.md](concepts/audit-trail.md) for the full artifact map.

## 5. Configuration

`.mugiwara/config` (project) overrides `~/.mugiwara/config` (global):

| Key | Default | What it controls |
|-----|---------|-----------------|
| `mode` | guided | Autonomy: guided/semi/auto |
| `branch` | `feature/{type}-{issue}-{slug}` | Branch naming pattern |
| `commit` | conventional | Commit style: conventional/gitmoji/plain, or a template like `{issue}: {title}` |
| `auto_commit` | off | on/off — off: guided/semi never commit+push, you do |
| `coverage_new` | 85 | Coverage % for new files |
| `coverage_modified` | 90 | Coverage % for modified files |
| `review_depth` | full | Robin's review depth: full/standard/quick |
| `quality_depth` | full | Sanji's quality depth: full/standard/quick |
| `verify_merged` | off | on merges Flow 5+6 into one verify pass (never Lane 3) |
| `delegate_threshold` | 60 | % of budget at which sequential tasks dispatch to workers |
| `heal_max_cycles` | 3 | Max heal-loop cycles before escalation |
| `verbosity` | normal | normal / full — how much the crew echoes |
| `context_budget_chars` | unset | Ceiling on trail size; over fails `mugiwara archive` (see [config](concepts/config.md)) |

## 6. Next steps

- Meet the [crew](concepts/agents.md) — 11 agents with permission boundaries (+3 internal agents for eval/lessons/verification).
- Browse the [skills](concepts/skills.md) — 21 skills with the 3-layer disclosure model.
- Understand the [lanes](concepts/lanes.md) — how work is sized before it runs.
- Set your [mode](concepts/modes.md) — guided/semi/auto.
- Read the [audit trail](concepts/audit-trail.md) — every artifact and how to review it.
- Sharing the work? [Runbook: team mission](runbooks/team-mission.md) — lead and member steps for shared work.
- See the [compliance matrix](reference/compliance-matrix.md) — rule compliance per model.
