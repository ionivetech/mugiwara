# The Flow Pipeline

A mission runs as ten flow stages (plus one optional adversarial pass). Each flow stage is
owned by one crew member and runs **inline** in the main conversation.

| Flow stage | Owner | Skill | Output |
|------|-------|-------|--------|
| 0 Triage | Luffy | `mugiwara-orchestration` | 5-way route decision + reason |
| 1 Brainstorm | Usopp | `mugiwara-brainstorm` | refined direction, options, recommendation |
| 2 Planning | Nami | `mugiwara-planning` | plan doc: plan waves, tasks, acceptance criteria |
| 3 Execution | Zoro | `mugiwara-execution` | implemented tasks with evidence |
| 4 Checkpoint | Chopper | `mugiwara-checkpoint` | audit report + failure ledger |
| 4.5 Adversarial | Skeptic | `mugiwara-claim-audit` | findings report (optional) |
| 5 Quality | Sanji | `mugiwara-quality` | format/lint/test/duplication/complexity/maintainability results |
| 6 Gates | Franky | `mugiwara-gates` | coverage + build + DoD + per-condition sonar gate |
| 7 Review | Robin ∥ Jinbe | `mugiwara-review` + `mugiwara-security` | severity-tagged findings |
| 8 Healing | Brook | `mugiwara-healing` | fixes; loops back to Flow 4, max 3 cycles |
| 9 Closure | Luffy | `mugiwara-orchestration` | closure report + push + PR verdict handed to you |

## Flow 0 — Triage

Every mission starts at the Luffy gateway, which classifies the request 5 ways
and sizes it to a **lane**:

| Class | Signal | Route |
|-------|--------|-------|
| Trivial | one obvious small change, no ambiguity | Lane 0/1 — Flow 2 directly |
| Explicit | clear requirements, written spec exists | Flow 2 directly |
| Exploratory | needs direction, options, research | Flow 1 first |
| Open-ended | broad goal, undefined scope | Flow 1 first |
| Ambiguous | requirements, APIs, scope unclear | Flow 1 first |

A clear-work route straight to Flow 2 still writes a short **spec bridge** to
`.mugiwara/missions/<mission>/spec.md` before planning — Nami reads that file, so it is
never empty. The decision + reason is logged in `.mugiwara/missions/<mission>/decisions.md`. Risk
(money/security/data/public API) always triggers the full pipeline and the
lane escalates automatically when the work outgrows the estimate — it never
auto-drops. See [lanes.md](lanes.md).

### Solo or team

Triage also settles who the mission is for. In `guided` and `semi` Luffy asks
the solo/team question at every lane — one member or several; in `auto` it is
never asked, derived instead from member state files on disk. A team answer
produces the roster in `plan.md`: one sub-mission row per member carrying name
+ area, which fixes the state layout for the whole mission (`state.json` solo,
`<member>.json` team). Never switch mid-mission — run
`mugiwara migrate --to-team` instead, which moves the state file rather than
forking it.

## Flow 4 — Checkpoint (Chopper)

The verify-everything gate. After execution, Chopper re-runs every acceptance
criterion — but efficiently:

- **Deduped**: each unique check command runs once per flow stage, scoped to the
  files this flow stage changed. No running `npm test` once per task.
- **Scoped by diff**: `git diff --name-only <flow-base>..HEAD` decides what
  actually needs re-verification.
- **Commit hygiene**: one `git log --stat` pass, not per-commit.
- Failures land in the blocker ledger `.mugiwara/missions/<mission>/blockers.md` with honest
  code-vs-env classification.

## Flow 5 + 6 — Quality and Gates

Sanji runs format/lint/test/duplication/complexity/attributes; Franky then
evaluates coverage, build, DoD, and the sonar-style gate from Sanji's evidence.
With `verify_merged=on` in config (and never on Lane 3), the two flow stages
run as ONE verify pass that writes both artifacts — one check run, two verdicts.

## Flow 7 — Review

Robin (doubt-driven review) and Jinbe (security) run in parallel. Robin maps
breaking changes to callers before reading the diff, scores reliability rating
(A–E), and deep-reviews code attributes; Jinbe runs STRIDE + OWASP + hotspot
review + SCA license. Findings are severity-tagged with path:line.

## Flow 8 — Healing

Brook reads the blocker ledger and fixes root causes, proving each fix by
re-running the failed check. The loop returns to Flow 4 — max 3 cycles, then
escalation to you.

## Flow 9 — Closure

Luffy runs the ship gate, writes the closure report, deletes superseded
intermediate files, then the terminal step in every mode: **save-point commit →
push the mission branch → write the PR verdict file → hand branch + verdict to
you**, who opens the PR. The crew never creates a PR, merges, or deploys.

## Banners and progress

Each flow stage opens with a heading banner and closes
with a handoff line. One banner form everywhere — `## ⚔️ Flow 3 — Zoro (Execution)`,
never ANSI escapes (the model cannot tell a terminal from a markdown UI;
the harness plugin applies colour). Colors and emoji come from one table
(`references/wave-banners.md`), which the
opencode plugin and installer read too, so the banner color always matches
the agent's UI chip.

Progress is mirrored into the host's native todo tool (opencode `todowrite`,
Claude Code `Task*`) in the same response each task's evidence lands — one
transition per call, never batched at flow-stage end. The plan doc stays the source
of truth; the host tool is a mirror.

## The two rules that hold it together

1. **Evidence over claims.** No flow stage passes on assertion — the owning agent
   runs the checks and shows output. "Subagents lie. No evidence = not
   complete." A skipped flow stage is recorded in the decision log, never silent.
2. **The plan is the source of truth.** From Flow 2 on, the plan doc in
   `.mugiwara/missions/<mission>/plan.md` holds the clean execution plan; the decision log (`decisions.md`) holds the
   who-and-why trace.

**Every skill has a skip gate.** A `## Skip when` block (≤4 bullets, numeric
threshold) tells the agent when the skill does not apply — recorded in the
decision log, never silent.

## Execution posture (adaptive)

Control mode, execution posture, and the Cost Governor are three **independent**
decisions — one never quietly drives another:

- **Control mode** (guided/semi/auto) decides how much you approve.
- **Execution posture** decides *how* work runs: `inline-sequential` (default),
  `inline-batched`, `parallel-workers`, `context-relief`, `phase-isolated`, `team-scoped`.
- **Cost Governor** decides what is safe to spend (reserve / project / avoid / stop).

Luffy records an initial posture at Flow 0 (ordinary work defaults to
`inline-sequential`); Nami proposes the resolved posture at Flow 2. The posture
re-evaluates **only at flow-stage or task-batch boundaries** — never mid-task —
from lane, risk, dependency topology, context pressure, and governor verdicts.
A switch never changes control mode or crew roles. On a governor stop or heal
halt, the crew emits state + continue with the exact next action.

The selection is deterministic (`src/posture.ts`) and produces a reason +
evidence refs, never an opaque score. Old missions with no posture recorded
default to inline. See [execution-model.md](execution-model.md).

## Large campaigns — sub-plan

Missions >3 phases or >1500-line plans split via `sub-plan/` — master `plan.md` is the index, `sub-plan/01-phase01-<slug>.md` slices hold detail, `flows/phase-NN/` isolates execution per phase, `mugiwara archive` folds all into `report.md`. Precedent: `native-cost-governor` (9 phases, 2688-line plan → single `report.md`).

## Blocker protocol

Any agent that hits a blocker appends a row
(`flow stage | task | symptom | attempted | help-needed`) to the ledger and escalates.
Never a silent workaround. Brook heals what the ledger lists.
