# Adoption Guide

How to take the crew into your workflow without fighting it.

## Pick your harness

The crew ships native skills + agents where the harness supports them, and
markdown rule files everywhere else.

| Situation | Pick |
|-----------|------|
| You live in Claude Code or opencode | Native install — agents + skills + (Claude) session hook |
| You want the full crew pipeline | Claude Code, opencode |
| You want skills-only, any tool | `npx skills add ionivetech/mugiwara` (agentskills.io layout) |
| You only use one niche tool | Its per-harness guide (index → install by harness) |

Native targets (Claude Code, opencode, Copilot) register the 15 agents directly.
Rule-based targets (Gemini, Codex, Cursor, Windsurf, Cline, Kilo, Antigravity)
get the same 32 skills as markdown rules plus a bootstrap pointer, so the crew
is still steered even where subagents don't exist.

## Pick your mode

Modes live in `.mugiwara/config` (project) or `~/.mugiwara/config` (global):

```
mode=guided
branch=feature/{type}-{issue}-{slug}
commit=conventional
```

| Level | What it asks you |
|-------|------------------|
| `guided` | Plan GO, branch, commits, ambiguities, check-ins — everything |
| `semi` | Plan GO only; branch/commits/ambiguities self-answer and log |
| `auto` | Nothing, unless a high-risk task exists (auto-GO is gated) |

State-mutating tests against shared state (real DB writes, network, browsers)
always need your explicit consent — in every mode. That consent is not a knob.

Missing config on read = `guided`. A flip applies from the next wave, never
mid-wave.

## Fit the crew to your workflow

- **Trivial one-liners** don't need the crew — Luffy routes them straight to
  execution.
- **Medium features** run the standard pipeline: triage → plan → execute →
  checkpoint → quality → gates → review → closure.
- **High-stakes work** (money, security, data, public API) always gets the full
  pipeline, including Skeptic's adversarial pass and Brook's heal loop.
- **Repos the crew has touched before** read the lessons ledger at triage, so
  every mission stands on the previous ones.

## The execution model, in one sentence

The crew runs **inline in your main conversation**; subagents are used only for
independent `[PARALLEL]` task batches and background checks. You see every wave
as it happens. See [execution-model.md](execution-model.md).

## What the crew will never do

- Merge a PR, or deploy. It pushes the branch and hands you the verdict file —
  PR review is the terminal gate.
- Auto-react to review comments or CI.
- Let a wave pass on a spoken claim — evidence or it didn't happen.
- Work around a blocker silently — everything lands in the ledger.

## Going further

- [Developer onboarding](developer-onboarding.md) if you want to contribute.
- [Comparison](comparison.md) if you're weighing mugiwara against alternatives.
