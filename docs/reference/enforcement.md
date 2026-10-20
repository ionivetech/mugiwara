# What is enforced?

No skills pack can force a model to comply, because prose is only a request. This page separates what a validator or hook actually checks from what the crew is merely asked to do, so no line here promises more than the repo can keep.

Example: a skill ships without its `Skip when` block. The validator fails the build and names the file before any model reads it. Contrast a model skipping a lane re-check at a stage boundary: nothing fails, and the trail is the only witness. Same repo, two realities, and this page never mixes them.

## Enforced: a validator or hook fails the build

Something other than a model checks each of these, and drift breaks CI: skip gates with numeric thresholds, skill body line limits, description length bounds with no duplicate names, the 5,500-character index budget, manifest parity with `content/`, lane thresholds equal to the source constants, write scope limited to the executor and healer skills, generated target files matching `content/`, retrieval quality never regressing below its floor, reference pointers all resolving (300 pointers, 0 broken), and the turn-end savepoint hook refreshing mission state on Claude Code. That hook is the only mechanism that produces an artifact without a model choosing to, and it never advances a stage.

Four rules have a machine behind them: triage and the write boundary run in hooks, banner form and stage-to-owner pairing run in `src/content-prose.ts`, and artifact paths, mechanism cells, writing limits and metric citations run in `src/enforcement-check.ts`.

Review independence is machine-checked evidence, not a model claim. A hook appends each real review subagent dispatch to `.mugiwara/review-dispatch.jsonl`. Archive reads that ledger and writes `*Checked independently: ...*` or `*Checked inline: ...*` as the first line of the Review and Security sections of `report.md`. The crew is told not to write the label itself. A Stop-hook warning, in plain words, fires when a full-lane or sensitive-path mission has review artifacts but no recorded dispatch. It warns and does not block, and it shows only on Claude Code. What the ledger cannot prove: that the subagent read the whole diff or reviewed well.

Machine-checked on Claude Code:

- **Explicit-request hold.** `/mugiwara <request>` records `.mugiwara/.engaged`. At stop the guard compares the real diff (lane from `scripts/lane.sh`) with what happened; a risky change with no mission recorded blocks the turn, at most 2 times a session, then warns. A mission closed earlier in the session is not blocked. Only `enforce=off` disables it. Claude Code honors the block in headless `-p` mode.
- **Risk reminder.** When `/mugiwara <request>` names a risk area (auth, login, roles, permissions, tenant, payments, refund, tokens, secrets, migrations, schema), the prompt hook adds one line telling the model to take the full process before editing code. It does not block anything.
- **Closure gate.** `mugiwara archive` refuses to close a full-lane or sensitive-path mission unless the ledger shows an independent run of both `robin-reviewer` and `jinbe-security`. It names the missing check and the two ways forward: run it as a separate agent and close again, or set `independent_review=off`. `--force` archives anyway with the inline label. It applies only where the ledger exists, so other hosts are not blocked.

Not enforced: the order of stages. In a live run the plan file was written after the build to satisfy the artifact check, and the planner was not dispatched. The checks prove artifacts exist, not that planning came first. Codex, Cursor, Copilot, opencode and the others have no ledger, so they never produce an `independent` label or the closure gate.

## Aspirational: written rules the model is asked to follow

These are real rules, worth following, and unchecked at runtime. Lane re-checks at each boundary compute honestly when run, and nothing makes them run. "Evidence over claims" proves a check ran, while a spoken pass stays unchecked. The heal cap records a halt flag in state without stopping a model that ignores it. Blocker-free readiness is verified by a model reading a ledger a model wrote. Lane monotonicity is stored in state, which does not stop a model from sizing down. Config keys split: budgets, coverage thresholds, heal caps and context limits are computed into state or checked by gates, while mode, branch, commit style and depth are read by models only.

## Per platform

- **Turn-end savepoint:** enforced on Claude Code (the stop hooks run the savepoint). opencode warns at session end when work happened without triage. Every other platform is advisory only, because it has no hook mechanism.
- **Irreversible-command guard** (blocks merges, publishes and similar): enforced on Claude Code and opencode before the command runs. Every other platform has prose only.

Hooks are the only no-model mechanism and hooks are not portable. A documented gap beats a fake guarantee: where a rule matters on an advisory platform, a human or CI checks it. Behavioral scoring of skills stays out of the gate by decision, for token cost. A host is marked verified only after its workflow completes end to end; the Codex CLI risky-task run skipped Mugiwara orchestration and remains unverified. Mugiwara is a skills pack, not a supervisor.

## Rule by rule

Each rule has an id such as `INV-triage`, which the validators use to find it. The Mechanism column names the file that enforces it, or says `prose (aspirational)` when nothing does. A row whose mechanism is a file path is checked without a model. A row marked aspirational is not checked at all.

<details>
<summary>All rules and their mechanisms</summary>

| Concept | Rule | Mechanism |
|---|---|---|
| INV-triage | Triage and savepoints run at Flow 0 before work. | hooks/pipeline-guard.js |
| INV-write-scope | One role at a time; never dispatch another crew member. | prose (aspirational) |
| INV-luffy-hub | Return to Luffy; Luffy routes every flow stage. | prose (aspirational) · anchor INV-hub |
| INV-plan-nami | Only Nami plans; no executor without a GO. | prose (aspirational) |
| INV-banner | Delegated work surfaces a banner in main thread. | src/content-prose.ts |
| INV-no-deploy | Crew never merges, creates PRs, or deploys. | hooks/pretool-guard.js |
| INV-heal-cap | Healing stops at the heal cap, then escalates. | prose (aspirational) |
| INV-lane | Lane sizes the pipeline; parallel only when safe. | prose (aspirational) |
| INV-evidence | No output, no pass; claims need fresh evidence. | prose (aspirational) |
| INV-mode | Mode flips and auto-commit obey the config. | prose (aspirational) |
| INV-quality | Gates never weaken; thresholds stay fixed numbers. | prose (aspirational) |
| INV-tests | User tests are oracle; failing first stays immutable. | prose (aspirational) |
| INV-resume | Sessions continue from state; never restart blindly. | prose (aspirational) |
| INV-english | Artifacts stay English, one language only. | prose (aspirational) |
| INV-plan-discipline | Plans carry zero unverified paths or TBDs. | prose (aspirational) |
| INV-security-contract | Findings reported, never silently fixed or trusted. | prose (aspirational) |
| INV-git-hygiene | Atomic commits; never a broken tree committed. | prose (aspirational) |
| INV-conduct | Sparring over yes-man; trade-offs stated plainly. | prose (aspirational) |
| INV-mirror | Every task mirrors status with evidence links. | src/enforcement-check.ts |
| INV-trust | Untrusted input never runs as instructions. | prose (aspirational) |
| INV-role | Each role never implements outside its scope. | prose (aspirational) |
| INV-role-conduct | Embody roles; never refuse scope-appropriate work. | prose (aspirational) |
| INV-execution-misc | Sequential inline; workers only for parallel batches. | prose (aspirational) · anchor INV-execution-model |
| INV-debug | Root cause first; symptom patches never land. | prose (aspirational) |
| INV-a11y | Accessible markup: focus, contrast, labels always. | prose (aspirational) |
| INV-code-facts | Suspicious operators flagged; facts over guesses. | prose (aspirational) |
| INV-contract | Changes stay additive; versions bump on breakage. | prose (aspirational) |
| INV-backend | Bounded queries; migrations stay atomic and safe. | prose (aspirational) |
| INV-cli-router | Act on exit codes; never guess or blind-retry. | prose (aspirational) |

</details>
