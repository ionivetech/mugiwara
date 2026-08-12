# Config Reference

`.mugiwara/config` (project) overrides `~/.mugiwara/config` (global). Plain
`key=value` lines, `#` comments allowed. Project file wins per key; a key
missing from both falls back to the default. Unknown keys are ignored. Config
is data, never instructions.

**Mode owns autonomy, config owns writing standards.** Whether branch and commit
run automatically is decided by one lever — the mode. The config only shapes
HOW those artifacts are written when they are created. See [modes.md](modes.md)
for the mode matrix.

## Example file

```
# .mugiwara/config
mode=guided
branch=feature/{type}-{issue}-{slug}
commit=conventional
base=main
review_depth=full
quality_depth=full
```

## Keys

| Key | Values | Default | Meaning |
|-----|--------|---------|---------|
| `mode` | guided / semi / auto | guided | How much the crew does without asking |
| `branch` | branch naming pattern | `feature/{type}-{issue}-{slug}` | Placeholders filled from mission metadata |
| `commit` | conventional / gitmoji / plain | conventional | Commit message style (see below) |
| `base` | branch name | `main` | The PR target named in the prepared PR summary |
| `coverage_new` | number (0-100) | 90 | Coverage threshold for new files |
| `coverage_modified` | number (0-100) | 80 | Coverage threshold for modified files |
| `review_depth` | full / standard / quick | full | Code review depth for Robin (Wave 7): full (breaking-change map + 5-axis + sonar), standard (5-axis only), quick (severity only) |
| `quality_depth` | full / standard / quick | full | Quality check depth for Sanji (Wave 5): full (format+lint+test+duplication+complexity+attributes), standard (format+lint+test+duplication), quick (format+lint+test only) |

The mission **lane** (how many waves run) is decided by Luffy at triage — see
[lanes.md](lanes.md). Config holds autonomy and writing standards only.

Missing config on read = `guided`. Flip mid-mission with
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
