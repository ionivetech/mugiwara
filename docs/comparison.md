# Comparison

How mugiwara fits against the alternatives — and an honest benchmark.

## The landscape

| Tool | What it is | Harnesses |
|------|-----------|-----------|
| **mugiwara** | Crew (15 agents) + pipeline (9 waves, gated) + 32 skills + lane sizing | 12 harnesses + 70+ via skills.sh |
| **superpowers** | Skills-only methodology with auto-trigger + subagent-driven development | 11 harnesses |
| **agent-skills** (addyosmani) | 24 skills + 8 slash commands + 4 personas, Google engineering culture | 70+ via skills.sh |
| **anthropics/skills** | Official demo skills — creative/docs/document skills, not a dev pipeline | Claude Code |
| **mattpocock/skills** | Small composable engineering skills, mostly user-invoked | Claude Code + Codex + any |
| **agent frameworks** (LangGraph, CrewAI, …) | Code: graphs, nodes, runtimes to host | one per framework |
| **mega-prompt** | One big instruction | any |

## Mugiwara vs. skills packs (superpowers, agent-skills)

Both are markdown skills an agent picks up on demand. Mugiwara ships the same
portable `SKILL.md` format — and adds what a pile of skills cannot:

- **A named crew, not a pile.** 15 personas (Luffy, Nami, Zoro, …) each own a
  wave, so the pipeline has a defined owner and handoff instead of "whichever
  skill fires first."
- **A gated pipeline, not loose triggers.** Ordered waves
  (triage → plan → execute → checkpoint → quality → gates → review → heal →
  closure) with a verify-everything gate between and a bounded heal loop.
  Superpowers has a gated workflow too (`spec → plan → build → verify →
  review`); agent-skills exposes gates as slash commands but does not chain
  them into one pipeline.
- **Sizing (lane routing).** Work is sized before it runs: a one-file typo runs
  zero waves, an auth change always runs all nine. No other pack scales the
  process to the work — they run the same ceremony (or lack of it) for every
  task. Mugiwara's auto-lane also means **trivial fixes are handled natively**,
  not "don't use it for small stuff."
- **Skip gates.** Every mugiwara skill declares when it does *not* apply, so a
  docs-only change skips Jinbe's security audit instead of burning a wave.
- **Workspace + resume.** `.mugiwara/` holds plan, results, ledger, and logs,
  so a mission survives context loss and resumes instead of restarting.
- **A single source of truth.** `content/` is the only physical copy; every
  harness reads the same files (symlinks), so there is no drift between
  "Claude version" and "Cursor version."

### Against superpowers specifically

Superpowers is excellent at deep autonomous work: its subagent-driven
development dispatches a fresh subagent per task with two-stage review, and
runs for hours. Differences:

- **Visibility.** Mugiwara runs inline by default — you watch every wave in the
  main conversation. Superpowers hides work behind subagent dispatch.
- **Crew depth.** Mugiwara ships 15 agents (auditor, security, gates, healing,
  memory) vs. superpowers' review-first model. A standalone security wave with
  STRIDE + OWASP and a dedicated healer are mugiwara-specific.
- **Wider surface.** Mugiwara adds domain skills (frontend anti-slop, backend,
  agent-security) and meta-controls (mode, resume, lessons) beyond the
  build-loop superpowers centers on.

### Against agent-skills specifically

agent-skills has the strongest SDLC breadth (19/21 categories in the audit
baseline) and carries Google's engineering culture (Hyrum's Law, test pyramid,
Chesterton's Fence). Differences:

- **Pipeline vs. commands.** agent-skills gates are per-skill; the agent must
  chain them by hand. Mugiwara chains them into one auto-running pipeline.
- **Healing.** agent-skills reports; mugiwara's Brook reads the failure ledger
  and fixes root causes in a bounded loop — the loop agent-skills lacks.
- **Sizing.** agent-skills runs its full process on any change; mugiwara routes
  to a lane first.

## Mugiwara vs. agent frameworks (LangGraph, CrewAI, …)

Framework crews are code: graphs, nodes, runtimes to host. Mugiwara is:

- **Zero runtime.** Pure markdown; your existing agent's own machinery does the
  work. A tiny Node CLI exists only to install and uninstall. Nothing to
  deploy, nothing to keep updated.
- **Harness-native.** The same crew installs into 12 harnesses instead of
  forcing one runtime.
- **Inline.** The pipeline runs in your main conversation; frameworks hide the
  work behind their execution graph.

Frameworks win when you need API-driven crews, deployable graphs, or
deterministic orchestration in code. If your team runs agents as a service,
pick a framework; if you want your existing coding agent to work *better*, pick
mugiwara.

## Mugiwara vs. a mega-prompt

A mega-prompt is one big instruction. Mugiwara:

- **Splits by specialization** — 32 focused skills + 15 personas instead of one
  document trying to be everything.
- **Sizes** — lanes mean small tasks skip the pipeline instead of paying the
  mega-prompt's full cost every time.
- **Gates + heals** — verifiable gates catch drift; a bounded heal loop fixes
  root causes instead of re-running the same prompt.

## What they all share

Every option above — including mugiwara — is **prose an agent chooses to
follow**. Markdown cannot force a model to comply. What differs is how much
structure the prose builds to catch drift: mugiwara's answer is the wave gates,
the skip gates, the lane sizing, and the workspace contract.

## Benchmark

Measured against `content/` at the audit baseline (Aug 2026). Token figures are
estimates (chars ÷ 4); skill counts are exact.

### Size & density

| Metric | mugiwara | superpowers | agent-skills |
|--------|:--------:|:-----------:|:------------:|
| Skills | **32** | 14 | 24 |
| Index size (all descriptions loaded) | ~2.0k tok | ~0.5k tok | ~1.7k tok |
| Avg skill size | **~1.2k tok** | ~2.3k tok | ~3.1k tok |
| Avg skill length | **~80 lines** | ~227 lines | ~305 lines |
| Skills with a skip gate | **32/32** | 0/14 | 11/24 |

Mugiwara ships the most skills with the smallest average footprint — the
biggest pack with the densest per-skill content.

### Process & capability

| Dimension | mugiwara | superpowers | agent-skills |
|-----------|:--------:|:-----------:|:------------:|
| Ordered pipeline | ✅ 9 waves + gates | ✅ spec→plan→build→verify | ⚠️ per-command |
| Lane sizing (work scales process) | ✅ 0–4 | ❌ | ❌ |
| Named crew / agents | ✅ 15 | ❌ | ⚠️ 4 personas |
| Auto-activation | ✅ | ✅ | ⚠️ per-command |
| Evidence gates on every wave | ✅ | ✅ | ✅ |
| Skip gates per skill | ✅ 32/32 | ❌ | ⚠️ 11/24 |
| Self-healing loop | ✅ bounded 3-cycle | ⚠️ review-block | ❌ |
| Session resume from disk | ✅ | ⚠️ worktree-based | ❌ |
| Cross-mission memory (lessons) | ✅ | ❌ | ❌ |
| Security review as a first-class wave | ✅ STRIDE+OWASP | ⚠️ via review | ⚠️ security skill |
| Workspace contract | ✅ `.mugiwara/` | ⚠️ worktrees | ❌ |
| Slash commands (manual stages) | ✅ 6 | ✅ | ✅ 8 |
| Agent-layer security skill | ✅ | ❌ | ❌ |

### Harness / portability

| Metric | mugiwara | superpowers | agent-skills |
|--------|:--------:|:-----------:|:------------:|
| Native install targets | 12 | 11 | ~15 |
| Skills-only via skills.sh | ✅ 70+ | ✅ | ✅ |
| Tiered emission (stub for glob-loading harnesses) | ✅ | ❌ | ❌ |
| Static token load on rules-dir harnesses | **~4.8k** (stubs) | n/a | n/a |

### Where mugiwara is *not* the best fit

- **Deep autonomous marathon runs.** If you want an agent to disappear for
  hours on a subagent-driven build with minimal visibility, superpowers'
  `subagent-driven-development` is built for exactly that.
- **Google-culture reference depth.** agent-skills' source-cited engineering
  practices (Hyrum's Law, test pyramid, review norms) are richer per skill.
- **A runtime service.** If you need API-driven, deployable agent crews, use a
  framework.

## Summary

| | Mugiwara | Superpowers | Agent-skills | Frameworks | Mega-prompt |
|---|----------|-------------|--------------|------------|-------------|
| Skills | 32 | 14 | 24 | — | 1 |
| Pipeline | 9 waves + gates | gated workflow | per-command | graph | linear |
| Lane sizing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Named crew | 15 | — | 4 personas | code | — |
| Skip gates | 32/32 | 0/14 | 11/24 | — | — |
| Self-healing | ✅ | ⚠️ | ❌ | configurable | ❌ |
| Session resume | ✅ | ⚠️ | ❌ | — | ❌ |
| Lessons memory | ✅ | ❌ | ❌ | — | ❌ |
| Visibility | inline | subagent-heavy | inline | behind graph | inline |
| Runtime | none | none | none | yes | none |
| Harnesses | 12+ / 70+ | 11 | 70+ | 1 | any |

**Bottom line.** Mugiwara is the only option that scales the process to the
work (lane routing), ships a named gated crew with a bounded heal loop, and
keeps the full pipeline visible inline — while carrying the most skills at the
lowest average cost. Where it trades ground: marathon subagent autonomy
(superpowers) and per-skill reference depth (agent-skills).

*Benchmark figures are estimates from the audit baseline (Aug 2026); mugiwara
skill counts are exact, competitor counts from their READMEs.*
