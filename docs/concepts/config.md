# Config

You want one behavior changed and cannot find which key owns it. This page lists every key `.mugiwara/config` reads, with its default.

Example: set `commit=plain` and `review_depth=standard`. The project file wins per key over `~/.mugiwara/config`. Delete a line to take its default. Unknown keys are ignored.

```ini
mode=guided
commit=plain
review_depth=standard
coverage=85
heal_max_cycles=3
```

Install writes the file with defaults. Optional keys ship commented out; uncomment to set them.

## Keys

| Key | Values | Default | Meaning |
|---|---|---|---|
| `mode` | guided / semi / auto | guided | How often the crew stops to ask. See [mission flow](mission-flow.md#modes-how-closely-you-watch). |
| `verbosity` | normal / full | normal | How much the crew echoes per stage. |
| `branch` | pattern | `feature/{type}-{issue}-{slug}` | Mission branch name. A convention the crew follows, not substituted by code. |
| `commit` | conventional / gitmoji / plain / template | conventional | Commit message style. |
| `auto_commit` | off / on | off | Whether the crew commits for you. Details below. |
| `coverage` | number | 85 | Minimum coverage (%) for new and modified code. Older configs may still set `coverage_new` or `coverage_modified`; they win when present. |
| `review_depth` | full / standard / quick | full | Review pass depth. |
| `independent_review` | on / off | on | Run Robin and Jinbe as separate subagents on the full lane or a sensitive path, on hosts that can dispatch. `off` keeps review inline. Costs more tokens; see [cost](cost.md). |
| `quality_depth` | full / standard / quick | full | Quality pass depth. |
| `delegate_threshold` | number | 60 | Percent of the token budget after which remaining tasks go to workers. |
| `heal_max_cycles` | number | 3 | Fix-and-recheck attempts (a heal cycle) before the crew hands the failure to a human. The one place this cap is defined. |

Optional keys, commented out by default:

| Key | Values | Use when | Example |
|---|---|---|---|
| `lane_scope_glob` | glob | Monorepo: size the lane from one package | `lane_scope_glob=packages/api/**` |
| `context_budget_chars` | number | Fail archive when the trail grows past a size | `context_budget_chars=200000` |
| `team` | on / off | First shared mission (set at Flow 0) | `team=on` |
| `sign` | off / minisign / pure / auto | Optional add-on, see [signing](../optional/signing.md) | `sign=auto` |
| `features` | token list | Trim which skills load | `features=core+auto,ship,-review` |
| `enforce` | off / warn / block | What the stop hook does when the pipeline was skipped. Default `warn` | `enforce=warn` |

## `enforce` and the explicit `/mugiwara` check

`enforce` governs sessions that did not use `/mugiwara`: by default the stop hook only warns. When you type `/mugiwara <request>` the hook records an explicit crew request, and at stop it compares the real diff with what happened. A risky change (sensitive path, standard or full lane) with no mission recorded blocks the end of the turn with a plain message, at most 2 times per session, then it warns. A mission already closed this session is not blocked. Only `enforce=off` disables this check. It is a Claude Code hook; no other host has it.

## What `auto_commit` does

With `auto_commit=off` (the default), guided and semi missions leave your working tree uncommitted. The crew writes the verdict file and prints the exact `git add`, `git commit` and `git push` commands for you to run. With `auto_commit=on`, the crew commits per task and pushes at closure. Auto mode ignores the key and always commits. In every case the crew never opens the PR, merges or deploys.

## Features

`features=` picks which skills a mission loads. Absent means `core+auto`: the core skills (orchestration, planning, execution, checkpoint, quality) plus the ones whose trigger fires, such as `migration` on a schema diff, `security` on a sensitive path, or `frontend` on UI files. Three shapes cover most missions:

- `features=core+auto,ship,-review` adds close-out and drops the diff review.
- `features=all` loads everything.
- A bare `features=ship` means the default plus ship.

Old tokens from before the skill merge still work as aliases: `gates` and `testcases` map to `quality`, `git` to `execution`, `root-cause` to `healing`, and `resume`, `lessons` and `workflow` to `orchestration`. Adding one adds its owner; removing one does nothing, because the capability now ships inside the owner skill.

Dropping `security` or `contract-first` while its trigger fires is an error, as is an unknown token. `mugiwara features explain` prints each token with its trigger and whether it fired.

Missing config means guided. Say `mugiwara mode auto` in session to flip for the next stage. `mugiwara.policy.yml` can only raise coverage, never lower it: see [policy](policy.md).
