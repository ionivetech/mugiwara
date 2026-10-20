# Capabilities

You want to know what Mugiwara can do before you spend an afternoon on it. This page lists every capability, when it applies, and where to go next. Each line says whether it needs the full crew or works on its own.

Example: you ask for role-based access control. Mugiwara sizes it as a full mission, asks what it cannot guess, plans, builds test-first, checks its own work, reviews security, and closes with one report. A one-line typo fix runs none of that.

## How a request is handled

| Capability | What it does | Page |
|---|---|---|
| Sizing by risk | Reads `git diff` and picks a lane: Direct, Lean, Standard or Full. The lane only rises during a mission. Sensitive paths (`auth/`, payments, migrations, secrets, CI) always mean Full. | [mission flow](concepts/mission-flow.md) |
| Triage | Decides whether a request is work at all: an answer, a refusal (deploys, key rotation), a hotfix, or a mission. | [mission flow](concepts/mission-flow.md) |
| Modes | `guided` asks at each stage, `semi` asks once at the plan, `auto` runs to the end. Say `mugiwara mode auto` in the chat to switch. | [mission flow](concepts/mission-flow.md) |
| Direct calls | Call one member by name: "Brook, fix the failing login test", "Jinbe, audit the auth middleware". | [the crew](concepts/crew.md) |

## What the crew does to your code

| Capability | What it does | Page |
|---|---|---|
| Brainstorm | Questions a vague idea and offers options with trade-offs before anything is planned. | [the crew](concepts/crew.md) |
| Planning | Turns an approved idea into tasks with acceptance checks, ordered groups (waves), and a note of which tasks can run in parallel without touching the same files. | [mission flow](concepts/mission-flow.md) |
| Test-first execution | Builds the plan task by task, one commit per task, with the evidence for each. | [the crew](concepts/crew.md) |
| Contract-first | For interfaces others depend on, writes the interface and error shape before the code. Opt-in. | [the crew](concepts/crew.md) |
| Migrations | Expand, backfill, verify, then drop, with the rollback proven first. Opt-in. | [the crew](concepts/crew.md) |
| Audit | Re-runs each check against the plan instead of trusting the report. | [the crew](concepts/crew.md) |
| Quality and coverage gates | Format, lint, tests, duplication, complexity, then a coverage floor you set with `coverage` in [config](concepts/config.md). A weak result is fixed or deferred with a named owner. | [config](concepts/config.md) |
| Review | Maps breaking changes with caller lists and rates the diff. | [the crew](concepts/crew.md) |
| Security review | Threat model (STRIDE), OWASP Top 10, secrets and dependency checks. Runs on sensitive paths or when you ask. On the full lane or a sensitive path on Claude Code, it runs as a separate subagent (`independent_review`). | [security](concepts/security.md) |
| Healing | A failed check goes to a root-cause fix, up to `heal_max_cycles` times (default 3), then stops and hands the full history to you. | [mission flow](concepts/mission-flow.md) |
| Ship verdict | One plain verdict (ready for review, needs fixes, or not enough evidence) with a rollback plan. The crew never opens a PR, merges or deploys. | [mission flow](concepts/mission-flow.md) |

## What you get back

| Capability | What it does | Page |
|---|---|---|
| Closing report | `.mugiwara/missions/<mission>/report.md`: verdict, what changed, checks with evidence, what was not verified, cost. | [the trail](concepts/trail.md) |
| PR material | `pr-verdict.md`: a title, summary, evidence and verdict you can paste into a pull request. | [the trail](concepts/trail.md) |
| Rollback script | `rollback.sh` for the mission's changes. | [the trail](concepts/trail.md) |
| Handoff | `mugiwara handoff <mission>` writes a report the next engineer can act on, with a staleness check. | [CLI](reference/cli.md) |
| Lessons | `mugiwara lesson "<text>"` records what you learned. The crew reads the ledger at the start of the next mission. | [the trail](concepts/trail.md) |

## Staying safe

| Capability | What it does | Page |
|---|---|---|
| Command guard | On Claude Code, blocks merging, deploying and other irreversible commands before they run. | [enforcement](reference/enforcement.md) |
| Triage guard | On Claude Code, warns when a session changed code without triage on disk. Set `enforce=block` to make it stop the turn. |
| Explicit-request hold | On Claude Code, after `/mugiwara <request>`, the stop hook blocks the end of the turn when the real diff is risky and no mission was recorded. At most 2 blocks per session, then a warning. Only `enforce=off` disables it. | [enforcement](reference/enforcement.md) |
| Closure gate | On Claude Code, `mugiwara archive` refuses to close a full-lane or sensitive-path mission without a ledger record of Robin and Jinbe running as separate agents. `--force` closes anyway, labeled inline. Other hosts are not blocked. | [enforcement](reference/enforcement.md) | [enforcement](reference/enforcement.md) |
| Write boundaries | Only the builder and the healer write source. Enforced at runtime on opencode, written as rules elsewhere. | [harness matrix](reference/harness-matrix.md) |
| Policy file | `mugiwara.policy.yml` raises scrutiny floors for a whole org: forced full lane for paths, minimum evidence, coverage. It can only raise, never lower. | [policy](concepts/policy.md) |
| Signed reports | Optional. Proof that a report was not edited after closing. | [signing](optional/signing.md) |

## Running it over time

| Capability | What it does | Page |
|---|---|---|
| Resume | A dead session continues from the exact stage. `mugiwara continue` lists in-flight missions. | [resume runbook](runbooks/resume-after-crash.md) |
| Team missions | One plan split into sub-missions, one state file per person, file conflicts caught before merge. | [team runbook](runbooks/team-mission.md) |
| Monorepos | Size the lane from one package with `lane_scope_glob`. | [monorepo runbook](runbooks/monorepo.md) |
| Status | `mugiwara status` shows stage, tasks, lane, blockers and budget for any mission. | [CLI](reference/cli.md) |
| Cost | `mugiwara cost` shows the process budget per lane and, on Claude Code, the provider-reported token total of the session. | [cost](concepts/cost.md) |
| Feature selection | `features=` in config picks which skills load. `mugiwara features explain` shows why each one did. | [config](concepts/config.md) |
| Cleanup | `mugiwara archive <mission>` folds a closed mission into its report. `mugiwara clean` does it in batch. | [CLI](reference/cli.md) |

## Where it runs

Claude Code and opencode are tested end to end. Codex and Cursor install in each host's documented format and have not been run in the real host. Copilot, Gemini, Windsurf, Cline, Kilo, Antigravity, Kimi and Pi are community, best effort. See [install](install.md) and the [harness matrix](reference/harness-matrix.md) for what is enforced where.

## What it does not do

- It does not make an agent smarter. It adds order and evidence.
- Review is independent only where it can be: on Claude Code, on the full lane or a sensitive path, with `independent_review=on`. Everywhere else the review is the same model checking its own work, and the report says `Checked inline`. Independent review costs more tokens and is not a substitute for your own checks. The order of stages is not enforced: the checks prove artifacts exist, not that planning came first.
- It does not open pull requests, merge or deploy.
- It does not prove that it saves tokens or improves results. Small runs found about 10% more tokens and no conclusive quality difference. See the [benchmark](contributing/benchmark.md).
