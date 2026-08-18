# Mugiwara Feature Inventory

Everything mugiwara does, with how to use it and a real scenario for each.
This is the companion to the feature table in the
[README](../../README.md#all-features) — the README lists, this doc explains.

## Table of contents

- [1. The 9-wave crew pipeline](#1-the-9-wave-crew-pipeline)
- [2. Multi-persona crew agents](#2-multi-persona-crew-agents)
- [3. Inline execution model](#3-inline-execution-model)
- [4. Autonomy modes (guided / semi / auto)](#4-autonomy-modes)
- [5. Config system](#5-config-system)
- [6. Lane sizing](#6-lane-sizing)
- [7. Configurable depth](#7-configurable-depth)
- [8. Savepoint state (`state/<mission>/`)](#8-savepoint-state)
- [9. Resume & continue](#9-resume--continue)
- [10. Lessons ledger](#10-lessons-ledger)
- [11. Sonar-style quality](#11-sonar-style-quality)
- [12. Gates (coverage / build / DoD)](#12-gates)
- [13. Security (STRIDE + OWASP)](#13-security)
- [14. Self-healing](#14-self-healing)
- [15. Adversarial verification](#15-adversarial-verification)
- [16. Ship gate](#16-ship-gate)
- [17. Sunset & deprecation](#17-sunset--deprecation)
- [18. PR summary handoff](#18-pr-summary-handoff)
- [19. Team initiatives](#19-team-initiatives)
- [20. Git discipline](#20-git-discipline)
- [21. TDD & user tests as oracle](#21-tdd--user-tests-as-oracle)
- [22. Multi-platform install](#22-multi-platform-install)
- [23. CLI](#23-cli)
- [24. Onboarding wizard](#24-onboarding-wizard)
- [25. Cost tracking](#25-cost-tracking)
- [26. Eval harness & self-testing gates](#26-eval-harness--self-testing-gates)
- [27. Enforcement mechanisms](#27-enforcement-mechanisms)
- [28. Engineering practice skills](#28-engineering-practice-skills)

---

## 1. The 9-wave crew pipeline

**What.** Non-trivial work runs a ten-wave pipeline (Wave 0 triage + Waves
1-9). Each wave is owned by one crew member, and every wave passes only on
**evidence** — the owning agent runs the check and shows the output, never a
spoken claim.

| Wave | Owner | Skill | Output |
|------|-------|-------|--------|
| 0 Triage | Luffy | `mugiwara-orchestration` | route decision + reason |
| 1 Brainstorm | Usopp | `mugiwara-brainstorm` | options + recommendation |
| 2 Planning | Nami | `mugiwara-planning` | plan doc: waves, tasks, criteria |
| 3 Execution | Zoro | `mugiwara-execution` | implemented tasks with evidence |
| 4 Checkpoint | Chopper | `mugiwara-checkpoint` | audit report + failure ledger |
| 4.5 Adversarial | Skeptic | `mugiwara-claim-audit` | findings (optional) |
| 5 Quality | Sanji | `mugiwara-quality` | format / lint / test results |
| 6 Gates | Franky | `mugiwara-gates` | coverage + build + DoD verdict |
| 7 Review | Robin ∥ Jinbe | `mugiwara-review` + `mugiwara-security` | severity-tagged findings |
| 8 Healing | Brook | `mugiwara-healing` | fixes; loops to Wave 4, ≤3 cycles |
| 9 Closure | Luffy | `mugiwara-orchestration` | closure report + push + PR verdict |

**How to use.** Ask for something non-trivial. The pipeline auto-activates and
routes itself — no agent names to memorize, no pipeline config to write:

```
> add role-based access control: admin, editor, viewer
```

**Scenario.** A 15-file refactor that touches the auth surface routes to
Lane 3 (Full) and runs all 9 waves: Nami plans, Zoro executes test-first,
Chopper re-runs every acceptance criterion, Sanji lint-tests, Franky checks
coverage, Robin and Jinbe review the diff in parallel, Brook heals any
failures, and Luffy closes with a pushed branch and ready PR summary.

→ [Full pipeline](workflow.md) · [README pipeline diagram](../../README.md#the-pipeline)

---

## 2. Multi-persona crew agents

**What.** 11 user-facing specialists (+3 internal). Each has role boundaries —
auditors and reviewers are **read-only** (they report, never fix). The main
thread embodies each persona inline, or you can summon any member by name.

**How to use.**

```
> Jinbe, audit auth middleware              # security only, read-only
> Brook, fix the failing login test         # healer only
> Nami, plan this out                       # planner directly
> Chopper, audit the last wave              # checkpoint directly
```

**Detail.** Luffy still records the route and its reason in the decision log,
and direct calls do not skip check-ins. Crew members never dispatch each
other; workers are subagents, never crew.

**Scenario.** Before a release you want only the security pass, no pipeline —
`/mugiwara-security` or "Jinbe, audit X" runs STRIDE + OWASP read-only and
reports findings without touching code.

→ [All agents](agents.md) · [Agent anatomy](../reference/agent-anatomy.md)

---

## 3. Inline execution model

**What.** The crew runs **inline** in your main conversation by default. Every
wave plays out where you can see it; evidence lands in `.mugiwara/` files and
the chat carries terse verdicts and evidence pointers. Subagents exist to
parallelize, never to hide work.

**How to use.** Nothing to configure. Watch wave banners
(`===== ⚔️ WAVE 3 — ZORO (EXECUTION) =====` —
ANSI-wrapped in terminals, plain in markdown UIs) and checkpoint
reports in the chat.

**Detail.** Subagents are used only for genuinely parallel work:
`[PARALLEL]` task batches (one worker per task), Brook's parallel heal fixes,
background checks, and independent re-runs by Chopper/Robin/Jinbe. Sequential
work stays inline. Results return as reports; the main thread summarizes.

**Scenario.** A feature with three file-disjoint tasks executes all three in
parallel workers, then each worker's evidence is folded back inline before the
next batch starts.

→ [Execution model](execution-model.md)

---

## 4. Autonomy modes

**What.** One lever decides how much the crew does without asking. Three
levels, read once per wave — a flip applies from the next wave.

| Level | Plan | Execution | Ambiguities | Check-ins |
|-------|------|-----------|-------------|-----------|
| **guided** | you approve every step | ask before each wave | ask the user | ask the user |
| **semi** | you approve the written plan | **auto** from Zoro's wave to ship | ask the user | log, ask when there is a question |
| **auto** | auto | auto all the way to ship (your member scope in a team) | crew resolves internally (brainstorm → Luffy decides) | log, no pause |

`auto` runs fully automatic from the first prompt to ship: triage, plan,
execute, quality, gates, review, heal, closure — no user GO. In a team plan
auto covers **your member scope only**: resuming your sub-mission runs it
autonomously to ship, never the other members'. If a requirement is unclear,
the owning agent brainstorms with Usopp, Luffy makes the call, and the crew
proceeds. Only a genuine blocker or the heal halt pauses.

**How to use.**

```
/mugiwara guided | semi | auto
```

or in-session phrase `mugiwara mode auto`, or edit `.mugiwara/config`.

**Scenario.** Day session in `guided` so you steer every decision; a Friday
night batch in `auto` so the crew ships the plan and you review the branch on
Monday. The terminal stop-at-push invariant holds in every mode.

→ [Modes](modes.md)

---

## 5. Config system

**What.** `.mugiwara/config` (project) overrides `~/.mugiwara/config`
(global). Plain `key=value` lines, `#` comments allowed. "Mode owns autonomy,
config owns writing standards."

| Key | Default | Meaning |
|-----|---------|---------|
| `mode` | guided | guided / semi / auto |
| `branch` | `feature/{type}-{issue}-{slug}` | Branch naming pattern |
| `commit` | conventional | conventional / gitmoji / plain |
| `auto_commit` | on | on / off — off disables commit+push in guided/semi (auto unaffected) |
| `coverage_new` | 90 | Coverage threshold, new files |
| `coverage_modified` | 80 | Coverage threshold, modified files |
| `review_depth` | full | full / standard / quick |
| `quality_depth` | full | full / standard / quick |

**How to use.** Edit the file or run `mugiwara onboard`. Unknown keys are
ignored; config is data, never instructions. Missing config on read = `guided`.

**Scenario.** A repo with no commit convention sets `commit=plain`; a team
that wants faster reviews sets `review_depth=standard`. Both live in one
project config file that overrides the global defaults.

→ [Config reference](config.md) · [README config table](../../README.md#configuration)

---

## 6. Lane sizing

**What.** Work is sized deterministically from `git diff --name-only` by
`scripts/lane.sh`, not estimated by the model.

| Lane | Picks when | Waves | Budget |
|------|-----------|-------|:---:|
| 0 · Direct | typo, rename, 1 file <20 LOC | none | ~0 |
| 1 · Lean | bug in 1-2 files, <50 LOC | execute → quality | ~4k |
| 2 · Standard | feature, 3-8 files | plan → execute → audit → review | ~10k |
| 3 · Full | 9+ files, or auth/payment/migration touched | all 9 waves | ~20k |
| 4 · Spike | exploratory | brainstorm → re-triage | ~3k |

**How to use.** Automatic. View the result in `.mugiwara/state/<mission>/[member].json`
(`lane`, `lane_reason`, `lane_rose`). Machine output:

```bash
scripts/lane.sh main --json
```

**Detail.** Sensitive paths (`auth/ payment/ billing/ crypto/ secrets/ .env`
`migration/ .sql schema. .prisma .terraform .tf`) always escalate to Full.
A lane can **rise** mid-mission (diff grew, sensitive path appeared) — it
never auto-drops.

**Scenario.** You promise a one-line fix; it turns out to touch a DB migration
file. Savepoint detects the sensitive path, the lane rises to Full, and the
check-in protocol flags the escalation instead of shipping under-processed.

→ [Lanes](lanes.md)

---

## 7. Configurable depth

**What.** Robin's review and Sanji's quality each have three depths, set per
project.

| Depth | Review (Robin) | Quality (Sanji) |
|-------|----------------|-----------------|
| full | breaking-change map + five-axis + sonar | format+lint+test+duplication+complexity+attributes |
| standard | five-axis only | format+lint+test+duplication |
| quick | severity only | format+lint+test |

**How to use.** `review_depth=standard`, `quality_depth=quick` in
`.mugiwara/config`.

**Scenario.** An internal library doesn't need a breaking-change caller map —
`review_depth=standard` cuts review time while keeping five-axis coverage.

→ [Config reference](config.md)

---

## 8. Savepoint state

**What.** `scripts/savepoint.sh` writes
`.mugiwara/state/<mission>/[member].json` at every wave boundary. Every field
is **computed from git + file counts**, never model-supplied: mission, member,
actor, branch, lane, wave, mode, base/head SHA, files touched, LOC delta,
sensitive paths, task counts, open blockers, heal cycle, token estimate,
budget status, evidence file list. Identity = (mission, member); solo writes
`state.json`.

**How to use.** Read it to answer "where are we, how big, any blockers?"
without opening many files. Written by the crew automatically.

```bash
scripts/savepoint.sh <mission> [member] [wave] [mode]
```

**Scenario.** After a context loss you open `state/<mission>/state.json`:
Wave 3, 5/5 tasks done in the first batch, 0 blockers, mode semi — a one-file
picture of the whole mission.

**Multi-actor safe.** State is scoped by (mission, member), so any number of
engineers can share one repo without colliding — each member has their own
file in the mission folder. `mugiwara reset` refuses to wipe another actor's
live mission without `--force`.

→ [Audit trail](audit-trail.md) · [savepoint.test.ts](../../test/savepoint.test.ts)

---

## 9. Resume & continue

**What.** Rebuild the mission from disk state and continue — never restart.
`resume-coordinator` reads the state + continue JSON, reports one line
("Resumed: <mission> [<member>], Wave 3, 2/5 tasks, 0 blockers, mode semi"),
and hands off to the next wave without re-running completed work.

**How to use.**

```
/mugiwara continue                 # list in-flight (never auto-start)
/mugiwara continue <mission>       # solo → resume; team → list members
/mugiwara continue <mission> <member>  # resume that member's work
```

or just say "where were we?" at session start. In **auto mode** the
`session-start` hook scans `continue/<mission>/*.json` for the current git
actor and surfaces an `AUTO-RESUME` context (single mission → resume hint;
multiple → list) — it never auto-resumes an ambiguous mission.

**Where the resume point lives.** `scripts/savepoint.sh` writes
`continue/<mission>/[member].json` at every wave boundary with the position
fields (mission, member, branch, wave, mode, tasks done/total, lane,
next_action) — machine written, same trust as `state.json`. The
`next_session_prompt` field is crew-written and preserved across savepoints.
The resume skill verifies every field against the plan + todos before acting;
a contradiction escalates.

**Scenario.** Session dies mid-execution on Friday. Monday you open the same
repo: the crew reads state + continue, verifies `next_action` against todos,
and picks up at the exact task — no re-run, no restart.

→ [Resume skill](../../content/skills/mugiwara-resume/SKILL.md)

---

## 10. Lessons ledger

**What.** Cross-mission institutional memory. At Wave 0 the crew surfaces
relevant past lessons; at closure it appends new ones. Append-only, one
actionable row per real lesson, platitudes rejected.

**How to use.** Automatic. Inspect `.mugiwara/logs/lessons.md`. Kept by
`mugiwara reset --keep-logs`.

**Scenario.** Mission A learns "never auto-migrate a DB without a rollback
plan." Mission B, which touches a DB, receives that lesson at triage and plans
a rollback from the start.

→ [Lessons skill](../../content/skills/mugiwara-lessons/SKILL.md)

---

## 11. Sonar-style quality

**What.** Sanji discovers the project's real tooling from configs and package
manifests (never invents tooling), then runs format, lint, tests, duplication
detection, cyclomatic complexity scoring (McCabe, measured per changed
function), maintainability rating (A-E), and code-attribute checks. Never
weakens a config to make red go green.

**How to use.** Automatic in Wave 5. No tooling exists → the gap is reported
honestly, never silently skipped.

**Scenario.** Sanji finds a linter warning in new code. Instead of adding an
ignore comment, the failure is reported; Brook later fixes the root cause so
the check stays green.

→ [Quality skill](../../content/skills/mugiwara-quality/SKILL.md)

---

## 12. Gates

**What.** Franky issues binary verdicts backed by evidence: coverage
(≥90% new / ≥80% modified by default), build, Definition of Done, and a
granular sonar gate with per-condition thresholds (vulnerabilities, bugs,
code smells, duplications). Missing coverage tooling is a reported gap, never
a silent pass.

**How to use.** Automatic in Wave 6. Thresholds via config
(`coverage_new`, `coverage_modified`). Local full gate run: `bun run gate`.

**Scenario.** A mission adds 40 new lines with 70% coverage. The gate reads
`FAIL` with the numbers shown; the crew heals before the mission moves on.

→ [Gates skill](../../content/skills/mugiwara-gates/SKILL.md)

---

## 13. Security

**What.** Jinbe audits with STRIDE threat modeling first, then the checklist
in order: OWASP Top 10 (for payment/health/PII), secret scan, injection
checks, authn/authz, dependency audit, SCA license review, security hotspots,
CVSS-style severity (exploitability × impact). Read-only.

**How to use.**

```
/mugiwara-security
> Jinbe, audit the auth middleware for security gaps
```

**Scenario.** Before a release touching payment code, Jinbe maps the surfaces
to STRIDE, finds a hardcoded secret at the trust boundary, and flags it
Critical. Brook fixes it and the audit is re-run before closure.

→ [Security skill](../../content/skills/mugiwara-security/SKILL.md)

---

## 14. Self-healing

**What.** Brook reads the entire blocker ledger at once, triages and groups
failures, fixes **root causes** with minimal diffs, and proves each fix by
re-running the check that failed. The loop returns to Wave 4 — max 3 cycles,
then escalation to the human with full history.

**How to use.** Automatic in Wave 8. Manual: `/mugiwara-heal`.

**Scenario.** Chopper's audit surfaces five failures. Brook fixes them in one
pass with root-cause changes, re-runs each failed check, and hands back to
Chopper for re-audit. Three failed cycles in a row halts the mission and asks
you.

→ [Healing skill](../../content/skills/mugiwara-healing/SKILL.md)

---

## 15. Adversarial verification

**What.** The optional Wave 4.5. Skeptic finds what is **wrong** — it never
validates. It doubts claims, plans, and verdicts; classifies findings
(actionable vs noise); and runs a bounded loop (3 cycles max). Read-only.

**How to use.** Automatic on high-stakes missions (Luffy summons it), or
on-demand for any plan/verdict.

**Scenario.** A payment mission's plan is adversarially checked before
execution. Skeptic catches an unstated assumption ("every user has a payment
method") and the plan is amended before code is written.

→ [Claim-audit skill](../../content/skills/mugiwara-claim-audit/SKILL.md)

---

## 16. Ship gate

**What.** A binary GO/NO-GO at release: pre-launch checklist, feature flags,
staged rollout, and a mandatory rollback plan. A critical finding or a missing
rollback plan → NO-GO.

**How to use.** Automatic at closure; manual `/mugiwara-ship`.

**Scenario.** The mission passes all gates but has no rollback plan for the
DB change. The ship gate says NO-GO; the plan is added before the branch is
pushed.

→ [Ship skill](../../content/skills/mugiwara-ship/SKILL.md)

---

## 17. Sunset & deprecation

**What.** Removing code, legacy APIs, or v1 endpoints runs a keep-or-retire
gate with safe migration and phased cutovers — every removal needs a plan.

**How to use.** Include the deprecation in the mission; Brook applies
`mugiwara-sunset` when removal is in scope.

**Scenario.** A v1 endpoint is being retired. The crew plans the deprecation
window, warns callers, and cuts over in phases instead of deleting
hot-swap.

→ [Sunset skill](../../content/skills/mugiwara-sunset/SKILL.md)

---

## 18. PR summary handoff

**What.** At the end of every mission the crew pushes the branch and **stops**.
It never creates a PR, merges, or deploys — in any mode. What you get is a
ready-to-paste **PR summary block** in `.mugiwara/results/<mission>/07-pr-verdict.md`.

**How to use.** Let the mission close, then open the PR yourself and paste
the block. No `gh`, no PR API calls, no auto-reaction to review comments or
CI.

**Scenario.** Mission closes: branch pushed with `git push -u origin <branch>`,
verdict file written with title + body + checks. You open the PR, paste, done.

→ [PR summary](pr-summary.md) · [README quick reference](../../README.md#quick-reference)

---

## 19. Team initiatives

**What.** One big initiative split into sub-missions, each with an assignee
and its own branch, sharing one plan doc with status tracking per
sub-mission.

**How to use.**

```
> split payment system: gateway, ledger, fraud
```

Nami interviews and writes an initiative plan; each dev works in their own
branch; `mugiwara initiative status <plan>` (via
`bun scripts/initiative.ts`) shows progress; all sub-missions `[x]` →
initiative-level closure.

**Scenario.** Three developers, one payment split. Each owns a file-disjoint
sub-mission, never colliding; the initiative plan shows green across all three
before the shared closure.

→ [Initiative script](../../scripts/initiative.ts) · [README example](../../README.md#30-second-try)

---

## 20. Git discipline

**What.** Atomic commits, one logical task per commit, save-points before
risky work, commit style matched to the repo's history, multi-commit
splitting, and bisect/blame debugging support.

**How to use.** Automatic (Zoro applies it during execution; Brook during
healing). Commit style via config (`commit=conventional|gitmoji|plain`, or a
template like `{issue}: {title}`). Manual debugging: `mugiwara-git` skill.

**Scenario.** A task's commit contains exactly the files that task declared —
never commingled with a neighbor. Before a risky migration, a save-point
commit lets the crew roll back cleanly.

→ [Git strategy](git-strategy.md) · [Git skill](../../content/skills/mugiwara-git/SKILL.md)

---

## 21. TDD & user tests as oracle

**What.** Every production-code task is test-first (RED-GREEN-REFACTOR), and
user-declared tests are the **oracle** — immutable gold. A user test is never
edited or skipped; a change needs your consent plus a ledger row. Executable
tests fail first, then go green; declarative ACs become project test files.

**How to use.** Declare tests in the mission prompt or reference a repo path.
The crew maps every acceptance criterion to a check and runs it.

**Scenario.** You paste a failing test for the login bug. Zoro watches it fail,
fixes the root cause, re-runs green, and the test stays untouched end to end.

→ [Testcases skill](../../content/skills/mugiwara-testcases/SKILL.md) · [TDD reference](../../content/skills/mugiwara-execution/references/tdd.md)

---

## 22. Multi-platform install

**What.** The same crew installs to 12 platforms with no feature gaps: Claude
Code, opencode, GitHub Copilot, Gemini, Codex, Cursor, Kimi, Pi, Antigravity,
Windsurf, Cline, Kilo — plus the CLI.

**How to use.** Per platform (README install section). opencode:

```json
{ "plugin": ["@ionivetech/mugiwara"] }
```

Claude Code: `/plugin marketplace add ionivetech/mugiwara && /plugin install mugiwara`

Any platform: `npx @ionivetech/mugiwara@latest install --target all --yes`

**Scenario.** The same repo opened in Claude Code at work and opencode at home
runs the identical crew with identical behavior.

→ [Install guides](../install/index.md) · [README install](../../README.md#install)

---

## 23. CLI

**What.** A small Node CLI for lifecycle management: install wizard, update,
uninstall via manifest, list + health check, and reset with protection.

**How to use.**

```bash
mugiwara install --target all --yes    # non-interactive
mugiwara update --target <id> --yes    # overwrite to latest
mugiwara list --check                  # health check, missing files
mugiwara uninstall                     # remove installed files
mugiwara reset --keep-logs             # wipe state, keep lessons
mugiwara --version                     # version
```

**Scenario.** A broken install after a manual edit is diagnosed with
`mugiwara list --check`; the missing files are restored with `mugiwara
update --force`.

→ [CLI reference](../install/cli.md) · [src/cli.ts](../../src/cli.ts)

---

## 24. Onboarding wizard

**What.** `mugiwara onboard` — a zero-LLM terminal wizard (6 fixed questions:
branch pattern, autonomy mode, review depth, quality depth, coverage, commit
style/template). A plain script — no LLM, no network, works on every platform
and every harness. Writes `.mugiwara/config` only — never
`.mugiwara/onboard.json`. Unasked keys (`auto_commit`, `delegate_threshold`,
`heal_max_cycles`, `verbosity`) are preserved from an existing config.

**How to use.**

```
mugiwara onboard
```

Or `/mugiwara onboard` in-chat — the command tells you to run the terminal
wizard; it never asks the questions itself.

First run or re-onboard to reset config.

**Scenario.** Setting up a new repo: answer 6 questions in the terminal, get a
verified config summary, and the crew knows the mode, depths, thresholds, and
branch/commit formats from the start — at zero LLM cost.

→ [Config reference](config.md) · [src/onboard.ts](../../src/onboard.ts)

---

## 25. Cost tracking

**What.** Per-lane token budgets (lean 12k, standard 25k, full 50k). Status
writes to `state/<mission>/[member].json` (`tokens_est`, `budget`,
`budget_status`): warn at 1.5×, stop at 3×. Surfaced in the mission report as
cost delta vs. lane budget.

**How to use.** Automatic. Read `.mugiwara/state/<mission>/[member].json` or
the mission report.

**Scenario.** A standard mission passes 15k tokens → `warn` logged; 30k →
`stop`, state written, and the mission pauses for a human decision.

→ [Cost model](cost.md)

---

## 26. Eval harness & self-testing gates

**What.** The harness proves itself: `run-evals.ts` behavioral evals,
`retrieval-eval.ts` retrieval ranking with a floor ratchet, and
`gate-selftest.ts` which proves every gate can fail (anti-rot). The
`eval-runner` agent judges with a fresh agent, never the skill's author; a
failing case means fix the skill, never the eval.

**How to use.**

```bash
bun run gate          # everything CI runs on a PR
bun scripts/run-evals.ts
bun scripts/gate-selftest.ts
```

**Scenario.** Before a release the full eval suite runs. A changed skill's
case fails under a fresh judge → the skill is fixed, the eval is not touched.

→ [Developer onboarding](../reference/developer-onboarding.md) · [Evals](../../evals/cases/)

---

## 27. Enforcement mechanisms

**What.** What keeps the pipeline honest when markdown alone can't force a
model: computed mechanisms leave a trace regardless of model cooperation —
lane sizing, savepoint state, evidence capture
(`scripts/evidence.sh`), index-budget validation, manifest sync, and skill
format checks. Discipline rules (skip gates, evidence over claims, wave
banners, bounded heal loop) rely on the model reading and following them.

**How to use.** Automatic. Run locally with `bun run gate`; mechanisms run
in CI on every PR.

**Scenario.** A model skips a wave or passes on a claim — savepoint and lane
still write state, evidence.sh still captures output, so the trace exposes
the shortcut even when the model cooperates poorly.

→ [Enforcement](../reference/enforcement.md)

---

## 28. Engineering practice skills

**What.** Beyond the pipeline, 26 skills encode portable engineering
practices the crew loads on demand: `mugiwara-contract-first` (contract-first
API design, error semantics, backward compatibility), `mugiwara-root-cause`
(4-phase reproduce → localize → reduce → fix + guard),
`mugiwara-context-budget` (token/context discipline), and domain skills —
`mugiwara-frontend` (anti-slop UI, design-system extraction, WCAG 2.1 AA),
`mugiwara-backend` (repo standards first, source-backed code, data
integrity), `mugiwara-agent-security` (prompt injection, memory poisoning,
excessive agency, MCP trust, sandboxing).

**How to use.** Automatic — the skill fires when the task matches its
description. Frontend tasks in Wave 3 always apply `mugiwara-frontend`.

**Scenario.** A new REST API is planned; `mugiwara-contract-first` shapes the
contract before implementation, so backward-compatibility and error semantics
are decided up front instead of retrofitted.

→ [All skills](skills.md) · [Skill anatomy](../reference/skill-anatomy.md)

---

## Where to go next

- [README — all features table](../../README.md#all-features)
- [Getting started](../getting-started.md) — install and first mission
- [Workflow](workflow.md) — the wave pipeline in detail
- [Agents](agents.md) — the 12 + 3 crew members
- [Skills](skills.md) — the 26 techniques
