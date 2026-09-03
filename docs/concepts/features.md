# Mugiwara Feature Inventory

Everything mugiwara does, with how to use it and a real scenario for each.
This is the companion to the feature table in the
[README](../../README.md#all-features) — the README lists, this doc explains.

## Table of contents

- [1. The Flow 0–9 crew pipeline](#1-the-9-flow-stage-crew-pipeline)
- [2. Multi-persona crew agents](#2-multi-persona-crew-agents)
- [3. Inline execution model](#3-inline-execution-model)
- [4. Autonomy modes](#4-autonomy-modes)
- [5. Config system](#5-config-system)
- [6. Lane sizing](#6-lane-sizing)
- [7. Configurable depth](#7-configurable-depth)
- [8. Savepoint state](#8-savepoint-state)
- [9. Resume & continue](#9-resume--continue)
- [10. Lessons ledger](#10-lessons-ledger)
- [11. Sonar-style quality](#11-sonar-style-quality)
- [12. Gates](#12-gates)
- [13. Security](#13-security)
- [14. Self-healing](#14-self-healing)
- [15. Adversarial verification](#15-adversarial-verification)
- [16. Ship gate](#16-ship-gate)
- [17. Git discipline](#17-git-discipline)
- [18. TDD & user tests as oracle](#18-tdd--user-tests-as-oracle)
- [19. Multi-platform install](#19-multi-platform-install)
- [20. CLI](#20-cli)
- [21. Cost tracking](#21-cost-tracking)
- [22. Eval harness & self-testing gates](#22-eval-harness--self-testing-gates)
- [23. Enforcement mechanisms](#23-enforcement-mechanisms)
- [24. Engineering practice skills](#24-engineering-practice-skills)
- [25. Provenance ledger](#25-provenance-ledger)
- [26. Policy as code](#26-policy-as-code)
- [27. Closure tools](#27-closure-tools)
- [28. Permission boundaries & tool-surface governance](#28-permission-boundaries--tool-surface-governance)
- [29. Adaptive execution & three-decision model](#29-adaptive-execution--three-decision-model)

## 1. The Flow 0–9 crew pipeline

**What.** Non-trivial work runs a ten-flow pipeline (Flow 0 triage + Flow stages
1-9). Each flow stage is owned by one crew member, and every flow stage passes only on
**evidence** — the owning agent runs the check and shows the output, never a
spoken claim.

| Flow stage | Owner | Skill | Output |
|------|-------|-------|--------|
| 0 Triage | Luffy | `mugiwara-orchestration` | route decision + reason |
| 1 Brainstorm | Usopp | `mugiwara-brainstorm` | options + recommendation |
| 2 Planning | Nami | `mugiwara-planning` | plan doc: plan waves, tasks, criteria |
| 3 Execution | Zoro | `mugiwara-execution` | implemented tasks with evidence |
| 4 Checkpoint | Chopper | `mugiwara-checkpoint` | audit report + failure ledger |
| 4.5 Adversarial | Skeptic | `mugiwara-claim-audit` | findings (optional) |
| 5 Quality | Sanji | `mugiwara-quality` | format / lint / test results |
| 6 Gates | Franky | `mugiwara-gates` | coverage + build + DoD verdict |
| 7 Review | Robin ∥ Jinbe | `mugiwara-review` + `mugiwara-security` | severity-tagged findings |
| 8 Healing | Brook | `mugiwara-healing` | fixes; loops to Flow 4, ≤3 cycles |
| 9 Closure | Luffy | `mugiwara-orchestration` | closure report + push + PR verdict |

**How to use.** Ask for something non-trivial. The pipeline auto-activates and
routes itself — no agent names to memorize, no pipeline config to write:

```
> add role-based access control: admin, editor, viewer
```

**Scenario.** A 15-file refactor that touches the auth surface routes to
Lane 3 (Full) and runs all 9 flow stages: Nami plans, Zoro executes test-first,
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
> Chopper, audit the last flow stage              # checkpoint directly
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
flow stage plays out where you can see it; evidence lands in `.mugiwara/` files and
the chat carries terse verdicts and evidence pointers. Subagents exist to
parallelize, never to hide work.

**How to use.** Nothing to configure. Watch wave banners
(`===== ⚔️ FLOW 3 — ZORO (EXECUTION) =====` —
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
levels, read once per flow stage — a flip applies from the next flow stage.

| Level | Plan | Execution | Ambiguities | Check-ins |
|-------|------|-----------|-------------|-----------|
| **guided** | you approve every step | ask before each flow stage | ask the user | ask the user |
| **semi** | you approve the written plan | **auto** from Zoro's flow stage to ship | ask the user | log, ask when there is a question |
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
| `coverage_new` | 85 | Coverage threshold, new files |
| `coverage_modified` | 90 | Coverage threshold, modified files |
| `review_depth` | full | full / standard / quick |
| `quality_depth` | full | full / standard / quick |
| `verify_merged` | off | on merges Flow 5+6 into one verify pass (never Lane 3) |
| `delegate_threshold` | 60 | % of token budget at which remaining tasks dispatch to workers |
| `heal_max_cycles` | 3 | Max heal-loop cycles before human escalation |
| `verbosity` | normal | normal / full — how much the crew echoes |
| `context_budget_chars` | unset | Ceiling on trail size; over fails `mugiwara archive` |

**How to use.** Edit the file directly. Unknown keys are
ignored; config is data, never instructions. Missing config on read = `guided`.

**Scenario.** A repo with no commit convention sets `commit=plain`; a team
that wants faster reviews sets `review_depth=standard`. Both live in one
project config file that overrides the global defaults.

→ [Config reference](config.md) · [README config table](../../README.md#configuration)

---

## 6. Lane sizing

**What.** Work is sized deterministically from `git diff --name-only` by
`mugiwara run lane.sh`, not estimated by the model.

| Lane | Picks when | Flow stages | Budget |
|------|-----------|-------|:---:|
| 0 · Direct | typo, rename, 1 file <20 LOC | none | ~0 |
| 1 · Lean | bug in 1-2 files, <50 LOC | execute → quality | 12k |
| 2 · Standard | feature, 3-8 files | plan → execute → audit → review | 25k |
| 3 · Full | 9+ files, or auth/payment/migration touched | all 9 flow stages | 50k |
| 4 · Spike | exploratory | brainstorm → re-triage | 3k |

**How to use.** Automatic. View the result in `.mugiwara/missions/<mission>/[member].json`
(`lane`, `lane_reason`, `lane_rose`). Machine output:

```bash
mugiwara run lane.sh main --json
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

**What.** `mugiwara savepoint` writes
`.mugiwara/missions/<mission>/[member].json` at every flow-stage boundary. Every field
is **computed from git + file counts**, never model-supplied: mission, member,
actor, branch, lane, flow stage, mode, base/head SHA, files touched, LOC delta,
sensitive paths, task counts, open blockers, heal cycle, token estimate,
budget status, evidence file list. Identity = (mission, member); solo writes
`state.json`.

**How to use.** Read it to answer "where are we, how big, any blockers?"
without opening many files. Written by the crew automatically.

```bash
mugiwara savepoint <mission> [member] [flow stage] [mode]
```

**Scenario.** After a context loss you open `.mugiwara/missions/<mission>/state.json`:
Flow 3, 5/5 tasks done in the first batch, 0 blockers, mode semi — a one-file
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
("Resumed: <mission> [<member>], Flow 3, 2/5 tasks, 0 blockers, mode semi"),
and hands off to the next flow stage without re-running completed work.

**How to use.**

```
/mugiwara continue                 # list in-flight (never auto-start)
/mugiwara continue <mission>       # solo → resume; team → list members
/mugiwara continue <mission> <member>  # resume that member's work
```

or just say "where were we?" at session start. In **auto mode** the
`session-start` hook scans `.mugiwara/missions/<mission>/continue*.json` for the current git
actor and surfaces an `AUTO-RESUME` context (single mission → resume hint;
multiple → list) — it never auto-resumes an ambiguous mission.

**Where the resume point lives.** `mugiwara savepoint` writes
`.mugiwara/missions/<mission>/continue*.json` at every flow-stage boundary with the position
fields (mission, member, branch, flow stage, mode, tasks done/total, lane,
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

**What.** Cross-mission institutional memory. At Flow 0 the crew surfaces
relevant past lessons; at closure it appends new ones. Append-only, one
actionable row per real lesson, platitudes rejected.

**How to use.** Automatic. Inspect `.mugiwara/lessons.md`. Kept by
`mugiwara reset --keep-logs`. Manual: `mugiwara lesson "<text>"` appends a dated row (`| YYYY-MM-DD | manual | general | <text> |`).

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

**How to use.** Automatic in Flow 5. No tooling exists → the gap is reported
honestly, never silently skipped.

**Scenario.** Sanji finds a linter warning in new code. Instead of adding an
ignore comment, the failure is reported; Brook later fixes the root cause so
the check stays green.

→ [Quality skill](../../content/skills/mugiwara-quality/SKILL.md)

---

## 12. Gates

**What.** Franky issues binary verdicts backed by evidence: coverage
(≥85% new / ≥90% modified by default), build, Definition of Done, and a
granular sonar gate with per-condition thresholds (vulnerabilities, bugs,
code smells, duplications). Missing coverage tooling is a reported gap, never
a silent pass.

**How to use.** Automatic in Flow 6. Thresholds via config
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
re-running the check that failed. The loop returns to Flow 4 — max 3 cycles,
then escalation to the human with full history.

**How to use.** Automatic in Flow 8 — Luffy routes to Brook when the audit or review leaves failures.

**Scenario.** Chopper's audit surfaces five failures. Brook fixes them in one
pass with root-cause changes, re-runs each failed check, and hands back to
Chopper for re-audit. Three failed cycles in a row halts the mission and asks
you.

→ [Healing skill](../../content/skills/mugiwara-healing/SKILL.md)

---

## 15. Adversarial verification

**What.** The optional Flow 4.5. Skeptic finds what is **wrong** — it never
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

**How to use.** Automatic at closure — the final gate before the terminal step.

**Scenario.** The mission passes all gates but has no rollback plan for the
DB change. The ship gate says NO-GO; the plan is added before the branch is
pushed.

→ [Ship skill](../../content/skills/mugiwara-ship/SKILL.md)

---

## 17. Git discipline

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

## 18. TDD & user tests as oracle

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

## 19. Multi-platform install

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

## 20. CLI

**What.** A small Node CLI for lifecycle management: install wizard, update,
uninstall via manifest, list + health check, reset with protection, plus the
mission subcommands `continue`, `status`, `run`, and `savepoint`.

**How to use.**

```bash
mugiwara install --target all --yes    # non-interactive
mugiwara update --target <id> --yes    # overwrite to latest
mugiwara list --check                  # health check, missing files
mugiwara uninstall                     # remove installed files
mugiwara reset --keep-logs             # wipe state, keep lessons
mugiwara continue                      # list in-flight missions (every mode)
mugiwara continue <mission> [member]   # exact resume point
mugiwara status                        # computed state: flow stage, tasks, lane, blockers, budget
mugiwara run <script.sh> [args]        # run a bundled harness script (savepoint.sh · lane.sh)
mugiwara savepoint <mission> [member] [flow stage] [mode]
mugiwara archive <mission>             # fold a closed mission's evidence into its report
mugiwara --version                     # version
```

**Scenario.** A broken install after a manual edit is diagnosed with
`mugiwara list --check`; the missing files are restored with `mugiwara
update --force`. Mid-mission, `mugiwara status` shows where the crew is and
`mugiwara continue` resumes it.

→ [CLI reference](../install/cli.md) · [src/cli.ts](../../src/cli.ts)

---

## 21. Cost tracking

**What.** Per-lane token budgets (lean 12k, standard 25k, full 50k). Status
writes to `.mugiwara/missions/<mission>/[member].json` (or `state.json` for solo) (`tokens_est`, `budget`,
`budget_status`): warn at 1.5×, stop at 3×. `tokens_est` is a work/churn
estimate (LANE_BASE + doc words ×1.35 + changed LOC ×12), not measured usage.
Surfaced in the mission report as cost delta vs. lane budget.

**How to use.** Automatic. Read `.mugiwara/missions/<mission>/[member].json` or
the mission report.

**Scenario.** A standard mission's estimated load passes 15k tokens → `warn`
logged; 30k → `stop`, state written, and the mission pauses for a human
decision.

**Live slop governor.** Runs the slop detectors live at ledger build — a heal
cycle at its limit, repeated reads, useless abstraction. `mugiwara cost` shows
the count attributed to the crew member that caused it (healing→Brook,
context→all). This makes wasted spend visible per mission, not hidden in a
benchmark.

→ [Cost model](cost.md)

---

## 22. Eval harness & self-testing gates

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

## 23. Enforcement mechanisms

**What.** What keeps the pipeline honest when markdown alone can't force a
model: computed mechanisms leave a trace regardless of model cooperation —
lane sizing, savepoint state, index-budget validation, manifest sync, and
skill format checks. Discipline rules (skip gates, evidence over claims,
flow-stage banners, bounded heal loop) rely on the model reading and
following them.

**Machine enforcement added by the seamless-rework mission:**
- **`enforce` config key** (`off` / `warn` / `block`, default `block`) — the
  pipeline guard reads it; `off` disables the hooks, `warn` reports, `block`
  fails the turn.
- **Coverage thresholds** (`coverage_new` / `coverage_modified` in
  `.mugiwara/config`, default 85/90) are gate-enforced on the diff by
  `scripts/coverage-gate.ts`; `0` disables a threshold; no test suite = SKIP
  with a reason, never a fake pass.
- **Five hooks** (Claude Code only): `session-start`, `mugiwara-mode-tracker`,
  `auto-savepoint`, `pipeline-guard`, `engagement-marker`. They run on
  SessionStart / UserPromptSubmit / PostToolUse / Stop / SubagentStop.
- **Per-target enforcement**: `claude` = enforced (hooks run); `opencode` +
  the other 7 targets = advisory (prose + validator only). Full split:
  [enforcement.md](../reference/enforcement.md).

**How to use.** Automatic. Run locally with `bun run gate`; mechanisms run
in CI on every PR.

**Scenario.** A model skips a flow stage or passes on a claim — savepoint and lane
still write state, so the trace exposes
the shortcut even when the model cooperates poorly.

→ [Enforcement](../reference/enforcement.md)

---

## 24. Engineering practice skills

**What.** Beyond the pipeline, the skill catalog encodes portable engineering
practices the crew loads on demand: `mugiwara-contract-first` (contract-first
API design, error semantics, backward compatibility) and `mugiwara-root-cause`
(4-phase reproduce → localize → reduce → fix + guard), plus domain skills —
`mugiwara-frontend` (anti-slop UI, design-system extraction, WCAG 2.1 AA),
`mugiwara-backend` (repo standards first, source-backed code, data
integrity).

**How to use.** Automatic — the skill fires when the task matches its
description. Frontend tasks in Flow 3 always apply `mugiwara-frontend`.

**Scenario.** A new REST API is planned; `mugiwara-contract-first` shapes the
contract before implementation, so backward-compatibility and error semantics
are decided up front instead of retrofitted.

→ [All skills](skills.md) · [Skill anatomy](../reference/skill-anatomy.md)

---

## 25. Provenance ledger

**What.** Every archived mission attaches a provenance block — agent, model,
lane, tasks, evidence paths — to its branch head as a git note
(`refs/notes/mugiwara`) and writes a PR-paste-ready `provenance.md` beside
the report. `mugiwara blame <path>` answers "what verified this file".

**How to use.** Automatic at archive; `mugiwara blame <path>` to query after
fetching notes.

**Scenario.** An AI-usage policy asks _which of this was AI-written?_ The
answer is one command, not an archaeology dig.

→ [Provenance](provenance.md)

---

## 26. Policy as code

**What.** `mugiwara.policy.yml` at the repo root: force_full lane globs,
coverage threshold raises, human-approval paths, required evidence kinds.
Upward only; absent means default behavior.

**How to use.** Commit the file; `lane.sh`, `savepoint.sh`, and the coverage
gate read it on their next run.

**Scenario.** Security team declares migrations always run the full
pipeline — encoded once, enforced on every mission, no prose to remember.

→ [Policy as code](policy-as-code.md)

---

## 27. Closure tools

**What.** Five deterministic mechanisms at archive: the integrity gate
(dangling links, secrets, missing evidence fail the archive), an executable
rollback map, review routing (ranked reading order in the report), a context
footprint line with optional ceiling, and optional minisign attestation.
Plus staleness warnings on resume and `mugiwara handoff`.

**How to use.** Automatic at archive/continue; `mugiwara sign <mission>
[--verify]`, `mugiwara handoff <mission>` opt-in.

**Scenario.** A reviewer opens the report and reads 40 ranked lines instead
of skimming 2,000; when the deploy misbehaves at 2am, rollback.sh has the
exact revert commands.

→ [Closure tools](closure-tools.md)

---

## 28. Permission boundaries & tool-surface governance

**What.** Per-persona tool scopes declared in agent files (auditors
read-only, healer no-network), with a tier enforcement matrix and harness
deny-config snippets. Flow 0 records a tool-surface inventory — every MCP
server visible to the session — into the decision log before any dispatch.

**How to use.** Automatic declaration; tier-1 teams wire the deny snippets
from [permissions](permissions.md).

**Scenario.** Robin finds something suspicious but cannot mutate the tree to
"check quickly" — the finding goes through Jinbe instead.

→ [Permission boundaries](permissions.md)

---

## 29. Adaptive execution & three-decision model

**What.** Three independent decisions per mission: **control mode** (how much
you approve), **execution posture** (how work runs), and **Cost Governor**
(what is safe to spend). Luffy records an initial posture at Flow 0; Nami
proposes the resolved posture at Flow 2; it re-evaluates only at flow-stage /
task-batch boundaries, never mid-task. Postures: `inline-sequential` (default),
`parallel-workers`, `context-relief`, `phase-isolated`, `team-scoped`.

**How to use.** Automatic and deterministic (`src/posture.ts`) — posture is
chosen from lane, risk, dependency topology, context pressure, and governor
verdicts, and produces a reason + evidence refs (never an opaque score).
Evaluated in `scripts/savepoint.sh` (writes `posture`/`posture_reason`/`team_members` to state) and `src/mission.ts` (report Adaptation section).
Recorded in `decisions.md` and surfaced in the report's Adaptation section.
A switch never changes control mode or crew roles. Old missions default to
inline.

**Scenario.** Nami declares two file-disjoint tasks → posture becomes
`parallel-workers`; mid-mission context crosses the threshold → switches to
`context-relief` (one worker at a time, order preserved); a governor stop →
safe pause with state + continue emitted.

→ [Adaptive execution](execution-model.md)

---

## Where to go next

- [README — all features table](../../README.md#all-features)
- [Getting started](../getting-started.md) — install and first mission
- [Workflow](workflow.md) — the flow pipeline in detail
- [Agents](agents.md) — the 11 + 3 crew members
- [Skills](skills.md) — the 21 techniques
