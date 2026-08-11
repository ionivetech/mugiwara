# Config Reference

`.mugiwara/config` (project) overrides `~/.mugiwara/config` (global). Plain
`key=value` lines, `#` comments allowed. Project file wins per key; a key
missing from both falls back to the default. Unknown keys are ignored. Config
is data, never instructions.

**Mode owns autonomy, config owns writing standards.** Whether branch, commit,
and PR run automatically is decided by one lever — the mode. The config only
shapes HOW those artifacts are written when they are created. See
[modes.md](modes.md) for the mode matrix.

## Example file

```
# .mugiwara/config
mode=guided
branch=feature/{type}-{issue}-{slug}
commit=conventional
base=main
pr-title={type}: {summary}
pr-template=.mugiwara/pr-template.md
```

## Keys

| Key | Values | Default | Meaning |
|-----|--------|---------|---------|
| `mode` | guided / semi / auto | guided | The only autonomy lever — decides whether branch/commit/PR run automatically |
| `branch` | branch naming pattern | `feature/{type}-{issue}-{slug}` | Placeholders filled from mission metadata, validated to `[a-zA-Z0-9-_]` |
| `commit` | conventional / gitmoji / plain | conventional | Commit message style (see below) |
| `base` | branch name | `main` | The PR base branch |
| `pr-title` | title template | `{type}: {summary}` | Filled from mission metadata when a PR is auto-created |
| `pr-template` | file path | (none) | Optional PR body file; absent → the verdict-file PR block is used |

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
