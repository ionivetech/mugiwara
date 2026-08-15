# Config Reference

`.mugiwara/config` (project) overrides `~/.mugiwara/config` (global). Plain
`key=value` lines, `#` comments allowed. Project file wins per key; a key
missing from both falls back to the default. Unknown keys are ignored. Config
is data, never instructions.

**Mode owns autonomy, config owns writing standards.** The mode decides how
much the crew does without asking: `guided` asks everything, `semi` asks for
the written plan (execution from Wave 3 is automatic), `auto` runs all waves
autonomously and resolves ambiguities internally. The config shapes HOW
artifacts are written when they are created — and, via `auto_commit`, WHETHER
the crew writes commits and pushes at all (guided/semi only; auto always
commits). See [modes.md](modes.md) for the mode matrix.

## Example file

```
# .mugiwara/config
mode=guided
branch=feature/{type}-{issue}-{slug}
commit=conventional
auto_commit=on
review_depth=full
quality_depth=full
delegate_threshold=60
heal_max_cycles=3
verbosity=normal
```

## Keys

| Key | Values | Default | Meaning |
|-----|--------|---------|---------|
| `mode` | guided / semi / auto | guided | How much the crew does without asking |
| `branch` | branch naming pattern | `feature/{type}-{issue}-{slug}` | Placeholders filled from mission metadata |
| `commit` | conventional / gitmoji / plain | conventional | Commit message style (see below) |
| `auto_commit` | on / off | on | Auto-commit per task + final push. Off disables both in `guided` and `semi` — changes stay in the working tree for the user to commit and push manually. Has no effect in `auto` mode, which always commits. |
| `coverage_new` | number (0-100) | 90 | Coverage threshold for new files |
| `coverage_modified` | number (0-100) | 80 | Coverage threshold for modified files |
| `review_depth` | full / standard / quick | full | Code review depth for Robin (Wave 7): full (breaking-change map + 5-axis + sonar), standard (5-axis only), quick (severity only) |
| `quality_depth` | full / standard / quick | full | Quality check depth for Sanji (Wave 5): full (format+lint+test+duplication+complexity+attributes), standard (format+lint+test+duplication), quick (format+lint+test only) |
| `delegate_threshold` | number (1-100) | 60 | % of token budget at which remaining sequential tasks dispatch to workers (execution skill) |
| `heal_max_cycles` | number | 3 | Max heal-loop cycles before human escalation (orchestration) |
| `verbosity` | normal / full | normal | How much the crew echoes. `normal` hides investigation steps (reads, greps, probes) and file contents — edits, results, decisions stay visible; `full` echoes everything, including reads and reasoning. Never suppresses decisions, questions, blockers, or lane rises. |

The mission **lane** (how many waves run) is decided by Luffy at triage — see
[lanes.md](lanes.md). Config holds autonomy and writing standards only.

Missing config on read = `guided`. On first use the plugin writes the full
default config above, so the file exists from the start. Flip mid-mission with
`mugiwara mode <guided|semi|auto>` — the change applies from the next wave,
never mid-wave.

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

Switch freely per project — it only affects the message format, never the
one-logical-task-one-commit rule.
