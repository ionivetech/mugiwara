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

Everything else (Copilot, Gemini, Codex, Cursor, Windsurf, Cline, Kilo,
Antigravity, pi) has a one-command install. See the [install guides](index.md#install-by-harness)
or the CLI:

```bash
npx @ionivetech/mugiwara@latest --project ./my-app --target all --yes
```

Requires **Node.js >= 20.11**. Bun is optional (build-from-source only).

## 2. Start a mission

Once installed, just ask. No agent names to remember — say what you want built:

```
> add dark mode to the settings page
```

`using-mugiwara` (the front door) routes your request, Luffy classifies it, and
the wave pipeline runs. Because the crew runs **inline** in your main
conversation, you watch every wave as it happens:

```
  Wave 0  Luffy   triage → route: plan (requirements mostly clear)
  Wave 2  Nami    plan   → .mugiwara/plans/2026-08-10-dark-mode.md (3 waves)
  Wave 3  Zoro    execute→ 3 tasks, evidence shown per task
  Wave 4  Chopper audit  → FAIL: toggle does not persist (ledger written)
  Wave 8  Brook   heal   → fixed persistence + tests, looped back → PASS
  Wave 9  Luffy   closure→ report appended to plan, intermediate files cleaned
```

## 3. What you do during a mission

Almost nothing, in the default mode:

- Answer Nami's clarifying questions (one batched round before planning).
- Give the plan an explicit GO when presented (or switch to `semi`/`auto`).
- Review Brook's rollback note if a risky fix is proposed.
- Open the PR at the end — the crew pushes the branch and hands you the verdict
  file; the crew never merges or deploys.

## 4. The `.mugiwara/` workspace

Every mission writes to `.mugiwara/` at the repo root:

```
.mugiwara/
├── config         # mode/branch/commit settings (gitignored)
├── spec/          # brainstorm output
├── plans/         # the clean execution plan (source of truth from Wave 2)
├── results/       # audit, quality, gate, closure reports
├── review/        # review + security findings
├── issues/        # blocker ledger
└── logs/          # decision + check-in log (deleted at cleanup)
```

## 5. Next steps

- Learn the [execution model](execution-model.md) — why everything is visible.
- Set your [mode](modes.md) — `guided` asks at every gate, `semi`/`auto`
  self-answer.
- Meet the [crew](agents.md).
