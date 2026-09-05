# Config Reference

`.mugiwara/config` (project) overrides `~/.mugiwara/config` (global). Plain
`key=value` lines, `#` comments allowed. Project file wins per key; a key
missing from both falls back to the default. Unknown keys are ignored. Config
is data, never instructions.

**Mode owns autonomy, config owns writing standards.** The mode decides how
much the crew does without asking: `guided` asks everything, `semi` asks for
the written plan (execution from Flow 3 is automatic), `auto` runs all flow stages
autonomously and resolves ambiguities internally. The config shapes HOW
artifacts are written when they are created — and, via `auto_commit`, WHETHER
the crew writes commits and pushes at all (guided/semi only; auto always
commits). See [modes.md](modes.md) for the mode matrix.

## Example file

```
# Mugiwara config. Project overrides ~/.mugiwara/config.
# Every key here is read by code. Delete a line to take its default.

# -- Autonomy ---------------------------------------------
mode=guided                  # guided | semi | auto — how much the crew does without asking
verbosity=normal             # normal | full — how much the crew echoes

# -- Git --------------------------------------------------
branch=feature/{type}-{issue}-{slug}
commit=conventional
auto_commit=off              # on | off — off hands you an uncommitted tree in guided/semi

# -- Gates ------------------------------------------------
coverage_new=85
coverage_modified=90
review_depth=full            # full | standard | quick
quality_depth=full
verify_merged=off

# -- Limits -----------------------------------------------
delegate_threshold=60        # % of budget before delegation is advised
heal_max_cycles=3            # heal loop halts here and escalates

# -- Monorepo ---------------------------------------------
# lane_scope_glob=packages/api/**   # count only matching files when sizing the lane

# -- Optional ---------------------------------------------
# context_budget_chars=150000       # fail archive if the trail exceeds this
# investigation_max_passes=2
# investigation_max_unrelated_files=5
# investigation_repeated_read_threshold=2
# sign=auto                         # auto | minisign | pure | off
# enforce=block                     # off | warn | block — pipeline-guard policy
```

## Keys

| Key | Values | Default | Meaning |
|-----|--------|---------|---------|
| `mode` | guided / semi / auto | guided | How much the crew does without asking |
| `branch` | branch naming pattern | `feature/{type}-{issue}-{slug}` | Placeholders filled from mission metadata (see [Branch and commit templates](#branch-and-commit-templates)). **Advisory-only** — the crew reads it to name branches; the harness never creates branches. |
| `commit` | conventional / gitmoji / plain / template | conventional | Commit message style, or a template with placeholders (see below). **Advisory-only** — the crew reads it to format commit messages; the harness never writes commits. |
| `auto_commit` | on / off | off | Off by default: changes stay in the working tree for the user to commit and push manually. Set `on` to auto-commit per task + final push in `guided` and `semi`. Has no effect in `auto` mode, which always commits. **Advisory-only** — commit/push are model decisions; no validator or hook reads this. |
| `coverage_new` | number (0-100) | 85 | Coverage threshold for new files |
| `coverage_modified` | number (0-100) | 90 | Coverage threshold for modified files |
| `review_depth` | full / standard / quick | full | Code review depth for Robin (Flow 7): full (breaking-change map + 5-axis + sonar), standard (5-axis only), quick (severity only). **Advisory-only** — read by the crew, not by code. |
| `quality_depth` | full / standard / quick | full | Quality check depth for Sanji (Flow 5): full (format+lint+test+duplication+complexity+attributes), standard (format+lint+test+duplication), quick (format+lint+test only). **Advisory-only** — read by the crew, not by code. |
| `verify_merged` | on / off | off | Merge Flow 5 (quality) and Flow 6 (gates) into ONE verify pass that writes both artifacts (`flows/03-quality.md` + `flows/04-gates.md`) from a single check run. Intended for strong models and small lanes where three separate verification passes are redundant; Lane 3 (sensitive) always keeps them separate. **Advisory-only** — read by the crew from this file at Flow 5 start. |
| `delegate_threshold` | number (1-100) | 60 | % of token budget at which remaining sequential tasks dispatch to workers. **Read by `scripts/savepoint.sh`** — it computes `delegate_due` (`tokens_est ≥ threshold% of budget`) into `state.json`; the execution skill reads that flag, never the raw value. |
| `heal_max_cycles` | number | 3 | Max heal-loop cycles before human escalation. **Read by `scripts/savepoint.sh`** — recorded in `state.json` and used to compute `heal_halt` (`heal_cycle ≥ max`), which the crew reads. |
| `verbosity` | normal / full | normal | How much the crew echoes. `normal` hides investigation steps (reads, greps, probes) and file contents — edits, results, decisions stay visible; `full` echoes everything, including reads and reasoning. Never suppresses decisions, questions, blockers, or lane rises. **Read by `scripts/savepoint.sh`** — recorded in `state.json`. |
Team identity is not a config key. The roster lives in the mission's
sub-mission table, and `mugiwara continue` caches your choice to
`.mugiwara/active-member`. See [runbooks/team-mission.md](../runbooks/team-mission.md).

| `lane_scope_glob` | glob pattern | unset | Count only matching files when sizing the lane (monorepo scoping). **Read by `scripts/lane.sh` and `scripts/savepoint.sh`**. |
| `context_budget_chars` | number (bytes) | unset | Ceiling on the mission trail's total size (top-level `*.md` + `flows/*`), measured at archive. Over the ceiling fails the archive like a failed test; unset = measured and printed in the report only. **Read by the closure pipeline** (`src/budget.ts`). |
| `investigation_max_passes` | number (≥1) | 2 | Max exploration passes the Investigation Governor allows before it flags unbounded exploration as slop (§13). **Read by `readInvestigationConfig`** (`src/investigation.ts`). |
| `investigation_max_unrelated_files` | number (≥1) | 5 | Max unrelated files opened during investigation before the governor flags it (§13). **Read by `readInvestigationConfig`**. |
| `investigation_repeated_read_threshold` | number (≥1) | 2 | Repeated reads of the same file before the governor flags context slop (§13). **Read by `readInvestigationConfig`**. |
| `sign` | auto / minisign / pure / off | auto | Report attestation backend. `auto` = minisign if installed+keyed, else the built-in `pure` ed25519 backend; `pure` = internal node:crypto (keys via `mugiwara sign --gen-key`); `off` = unsigned. **Read by `src/sign.ts`**. See [Signed attestation](closure-tools.md#signed-attestation-optional). |
| `enforce` | off / warn / block | block | How strictly the pipeline-guard hook enforces the lane/consent rules (e.g. skipping the pipeline on non-trivial work, out-of-scope mutation). `block` fails, `warn` logs, `off` disables. **Read by `hooks/pipeline-guard.ts`**. |

## Policy file interplay

`mugiwara.policy.yml` (repo root) is a separate mechanism from this config:
config sets *your* thresholds; policy sets *the org's* rules on top. Where
both define a coverage threshold, the higher value wins — policy can raise,
never lower. See [policy-as-code](policy-as-code.md). An invalid policy file
(unknown root key) fails lane/archive loudly instead of being ignored.

```yaml
evidence:
  require_nonempty_for_lanes: ["full"]   # a lane-3 mission must record evidence
```

## Machine-read vs advisory-only

Code reads: `mode` (read by `scripts/savepoint.sh` — positional > env > project > global > guided, validated), `verbosity`, `delegate_threshold`, `heal_max_cycles`, `lane_scope_glob` (read by `scripts/savepoint.sh` and `scripts/lane.sh`), `coverage_new`/`coverage_modified` (read by the coverage gate), `context_budget_chars` (read by the closure pipeline), the three `investigation_*` keys (read by `readInvestigationConfig` into the Investigation Governor), `sign` (read by `src/sign.ts`), and `enforce` (read by `hooks/pipeline-guard.ts`). Everything else is **advisory-only** — read by the crew from this prose,
never by a validator or hook. Changing an advisory key changes crew behavior
but no gate fails and no computation changes:

- `branch`, `commit`, `auto_commit` — git discipline (execution skill): the
  branch naming pattern, the commit style, and whether to commit/push at all.
  The harness never creates branches or writes commits — those are model
  decisions, so these keys are advisory by design.
- `review_depth`, `quality_depth` — depth selection for Robin (Flow 7) and
  Sanji (Flow 5); the crew reads them from this file at stage start.
- `verify_merged` — collapses the Flow 5/6 check passes into one on `on`.

An advisory key is documented, never silently inert: its consumer (the crew
via prose) and its effect are stated here so a reader knows who acts on it.
`delegate_threshold` and `heal_max_cycles` were advisory until the execution
and healing skills' triggers were wired to computed `state.json` flags.

The mission **lane** (how many flow stages run) is decided by Luffy at triage — see
[lanes.md](lanes.md). Config holds autonomy and writing standards only.

Missing config on read = `guided`. On first use the plugin writes the full
default config above, so the file exists from the start. Flip mid-mission by
saying `mugiwara mode <guided|semi|auto>` in session (the mode-tracker hook
edits this file — there is no CLI subcommand); the change applies from the
next flow stage, never mid-flow-stage.

## Commit message styles

`commit` selects how Zoro writes commit messages:

- **conventional** — `feat: ...`, `fix(scope): ...`, `refactor: ...`, per the
  [Conventional Commits](https://www.conventionalcommits.org) spec. Type from
  the task, optional scope in parens. The default.
- **gitmoji** — a leading emoji carries the intent, e.g. `✨ feat: ...`,
  `🐛 fix: ...`. Signals the change type at a glance in log views that render
  emoji; a bit noisy in plain terminals.
- **plain** — no prefix, just a short imperative sentence: `Fix export csv
  encoding`. Clearest for repos that don't use any convention.
- **template** — any value containing `{` is treated as a template with
  placeholders, e.g. `commit={issue}: {title}` produces
  `CR-5432: Testing button`. See below.

Switch freely per project — it only affects the message format, never the
one-logical-task-one-commit rule.

## Branch and commit templates

Both `branch` and `commit` accept templates with placeholders filled from
mission metadata. A value containing `{` is a template; anything else is a
style name (commit) or a literal pattern (branch).

### Placeholders

| Placeholder | Meaning | Example |
|-------------|---------|---------|
| `{type}` | Change type from the task: feat / fix / chore / refactor / docs | `feat` |
| `{issue}` | Ticket/key reference (fallback: date) | `CR-5432` |
| `{slug}` | Kebab-case mission title | `testing-button` |
| `{title}` | Task summary, imperative, capitalized (commit templates only) | `Testing button` |

### Branch examples

| Config | Result for ticket CR-5432, mission "Testing button" |
|--------|-----------------------------------------------------|
| `branch=feature/{type}-{issue}-{slug}` (default) | `feature/feat-CR-5432-testing-button` |
| `branch={issue}-{slug}` | `CR-5432-testing-button` |
| `branch=feat/{slug}` | `feat/testing-button` |
| `branch=feature/{issue}` | `feature/CR-5432` |

Branch names are kebab-case; the crew never force-pushes a pushed branch.

### Commit examples

| Config | Result for ticket CR-5432, task "Testing button" |
|--------|--------------------------------------------------|
| `commit={issue}: {title}` | `CR-5432: Testing button` |
| `commit=[{issue}] {type}: {title}` | `[CR-5432] feat: Testing button` |
| `commit={type}({issue}): {title}` | `feat(CR-5432): Testing button` |
| `commit={title}` | `Testing button` |

A template with no `{issue}` placeholder falls back to the date for the
ticket ref, exactly like the branch pattern. The subject stays <= 50 chars
and imperative — templates shape the format, never the content quality.
