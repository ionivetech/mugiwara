# The crew

You hand an AI agent a vague task and one voice does everything: plans, codes, grades its own work. Mugiwara splits that into named roles, each with its own checklist and a boundary it does not cross. This page lists who does what, which playbooks they follow, and when to call one directly.

Example: the implementation stage finished and you want it checked. Say "Chopper, audit the last stage against the plan". Luffy records the route, Chopper re-runs each check, and findings land in a ledger. Chopper reports failures and never fixes them. Calling a member directly never skips the check-ins.

The crew is 11 agents (+2 internal), backed by 14 skills. An agent is a persona. A skill is the written playbook the persona follows. You do not pick from this list at the start of a mission: Luffy routes each stage to the right member. See [mission flow](mission-flow.md) for the order.

## The agents

Each file lives in `content/agents/`.

- **Luffy** (`luffy-orchestrator`): the captain. Sizes the work, runs check-ins, records decisions, closes the mission. Never writes code.
- **Usopp** (`usopp-brainstorm`): questions a vague idea and researches before recommending. Returns options with trade-offs.
- **Nami** (`nami-planner`): turns the surviving idea into a plan with tasks, waves and acceptance checks.
- **Zoro** (`zoro-execution`): runs an approved plan, with evidence and one commit per task. Only runs plans someone approved.
- **Chopper** (`chopper-checkpoint`): audits each finished stage against the plan. Reads and re-runs, never edits source.
- **Sanji** (`sanji-quality`): finds the repo's real tooling and runs format, lint, tests, duplication and complexity.
- **Franky** (`franky-gates`): applies coverage, build and Definition of Done as pass or fail.
- **Robin** (`robin-reviewer`): maps breaking changes with caller lists and rates the diff. Read-only. Runs as a separate subagent on the full lane or a sensitive path, inline otherwise.
- **Jinbe** (`jinbe-security`): threat model (STRIDE), OWASP Top 10, secrets and license checks. Reports, never fixes. Same dispatch rule as Robin.
- **Brook** (`brook-healing`): fixes what failed, finding the root cause first, within the heal cap in [config](config.md).
- **Skeptic** (`skeptic-verifier`, internal): the optional adversarial doubt pass on high-stakes missions.
- **Resume coordinator** (`resume-coordinator`): rebuilds a dead session from disk and continues where it stopped.
- **Memory keeper** (`memory-keeper`, internal): reads past lessons at triage and writes new ones at closure.

The repo's own eval runner is a dev tool kept in `evals/agents/`, not shipped, see [evals](../contributing/evals.md). Every install ships the whole crew. Which files exist where depends on the platform: see [install](../install.md).

When Robin and Jinbe run as subagents, Luffy tells each what to read because they start with no memory, records what they return and routes any blocker to Brook or Zoro. A subagent never routes and Luffy never edits its findings. Neither writes whether the check was independent: archive adds that line from a record of real dispatches.

## The skills

Every skill is `content/skills/<name>/SKILL.md`. Skills load on demand, so a small task does not pay for the whole catalog. Use `mugiwara features explain` to see which ones a mission loaded and why.

- **Run the mission**: `mugiwara-orchestration` (triage, routing, closure, the stage pipeline, session resume, the lessons ledger), `mugiwara-brainstorm`, `mugiwara-planning`, `mugiwara-execution` (also atomic commits and save-points).
- **Check the result**: `mugiwara-checkpoint` (audit, plus an adversarial depth), `mugiwara-quality` (checks, then the coverage and build gates, and the declared acceptance cases that are frozen so a failing case is judged, never edited away), `mugiwara-review`, `mugiwara-security`.
- **Recover and continue**: `mugiwara-healing` (including the root-cause hunt: reproduce, localize, reduce, then fix and guard); resume and lessons live in `mugiwara-orchestration`.
- **Ship safely**: `mugiwara-ship` (a verdict of ready for review, needs fixes or not enough evidence, with a rollback plan).
- **Domain**: `mugiwara-contract-first` (write the interface and error shape before the code), `mugiwara-backend`, `mugiwara-frontend`, `mugiwara-migration` (expand, backfill, verify, then drop, with a rollback proven first).

Skill file layout and size rules are in [anatomy](../contributing/anatomy.md).

## When each one earns its cost

Brainstorm adds a round trip, so it runs for vague asks and architecture forks, not for a typed fix. Planning is skipped on the direct and lean lanes. Contract-first slows day one to protect month six, so use it where other code depends on an interface. Migration is six steps where one `ALTER` would do, and it is worth it only when stored rows or a live contract sit behind the change. Security and the adversarial pass add latency exactly where rushing hurts, so docs-only work skips them.

Gates do not negotiate: weak-coverage legacy code pays its debt before it ships, or a human defers the finding with an owner named. A cost ledger and a hard stop keep process spend visible, see [cost](cost.md).

## What is not proven

The crew structure is measured only where the repo can measure it: skill routing, pointer resolution and the size of the always-loaded index (numbers in the [README](../../README.md#what-is-measured-and-what-is-not)). Whether a mission with the crew produces fewer bugs than the same agent unaided has not been measured. The claim here is structural: you get one report and per-task evidence, instead of a chat log.

Ready to try it? Open [getting started](../getting-started.md) and hand the crew one small task.
