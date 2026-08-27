# Positioning

What mugiwara is and when to use something else.

## What mugiwara is

**Mugiwara is the governance layer for AI-assisted engineering work.** Every
change carries a human-reviewable trail — which flow stage, what evidence, approved
by whom — and the cost of the process scales to the size of the work.

- **Lane sizing** — process scales from zero flow stages (typo) to nine (auth
  migration), computed from the diff by `mugiwara run lane.sh`, not guessed.
- **Evidence trail** — every flow-stage boundary writes computed state to
  `state/<mission>/[member].json`. No flow stage passes on a spoken claim;
  check output is captured into `.mugiwara/missions/<mission>/flows/`.
- **Resume from disk** — lose context mid-mission and the crew rebuilds from
  `.mugiwara/` instead of restarting.
- **14 named agents (11 + 3 internal)** in a 9-flow-stage gated pipeline — each flow stage has a defined
  owner, handoff, and verification gate.
- **21 skills** with skip gates on all of them, progressive disclosure into
  `references/`, and deterministic tooling for lane, evidence, and state.

## What mugiwara refuses

- **A runtime or daemon.** Orchestration stays in the harness. Pure markdown.
- **Auto-merge or auto-deploy.** Human review at the PR is the terminal gate.
- **Unattended marathon mode.** Mugiwara runs inline by default — you watch
  every flow stage. Subagents only for parallel work.
- **Skill-count growth.** 21 is the ceiling; a new skill replaces an old one.
- **Head-to-head feature scorecards.** The compliance matrix replaces them.

## When to use something else

- **Deep autonomous marathon runs.** If you want an agent to disappear for
  hours on subagent-driven builds with minimal visibility, superpowers'
  `subagent-driven-development` is built for exactly that.
- **Reference-encyclopedia depth.** agent-skills carries richer per-skill
  engineering references (Hyrum's Law, test pyramid, Chesterton's Fence).
- **A runtime service.** If you need API-driven, deployable agent crews, use a
  framework (LangGraph, CrewAI).
- **A single mega-prompt.** If you want one instruction with no ceremony,
  mugiwara's pipeline is overkill for you.

## Reproducible facts

Generated from `content/` and `scripts/validate-content.ts`:

| Metric | Value |
|--------|:-----:|
| Skills | 21 |
| Agents | 14 (11 + 3 internal) |
| Index (all descriptions) | ~4.7k chars (~1.2k tokens) |
| Avg skill size | ~1.2k tokens |
| Skills with skip gate | 21/21 |
| References/ files | growing |
| Evals | 11 cases |

*Figures from Aug 2026. Recalculate with `bun scripts/validate-content.ts --check-manifest`.*
