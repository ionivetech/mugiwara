# Config

You want one behavior changed and you cannot find which key owns it. You edit a file and nothing enforces the change, or the wrong gate fires. This page answers "what can I set" with one example file, then the full key table. Prose on this page never overrides the table.

Example: set `commit=plain` and `review_depth=standard` in `.mugiwara/config`, which wins per key over `~/.mugiwara/config`. Delete a line to take its default. Unknown keys stay ignored.

```ini
mode=guided
commit=plain
review_depth=standard
coverage_new=85
heal_max_cycles=3
```

Optional keys ship commented; uncomment to set.

## Keys

| Key | Default | Meaning |
|---|---|---|
| `mode` | guided / semi / auto | Stage autonomy |
| `verbosity` | normal / full | Echo depth |
| `branch` | feature/{type}-{issue}-{slug} | Mission branch pattern |
| `commit` | conventional | Message style |
| `auto_commit` | off | Push in guided, semi |

Gate and escalation keys:

| Key | Default | Meaning |
|---|---|---|
| `coverage_new` | 85 | New-code gate |
| `coverage_modified` | 90 | Modified-code gate |
| `review_depth` | full / standard / quick | Review pass depth |
| `quality_depth` | full / standard / quick | Quality pass depth |
| `verify_merged` | on / off | Merged verify pass outside lane 3 |
| `delegate_threshold` | 60 | Delegation budget percent |
| `heal_max_cycles` | 3 | Heal cap |

**Commented keys**

Commented keys: what, when, example.

| Key | What | When | Example |
|---|---|---|---|
| `lane_scope_glob` | One-package lane scans | Monorepo with many packages | `lane_scope_glob=packages/api/**` |
| `context_budget_chars` | Archive trail cap | Long missions, big trails | `context_budget_chars=200000` |
| `investigation_max_passes` | Investigation pass cap | Saving budget on small diffs | `investigation_max_passes=1` |
| `investigation_max_unrelated_files` | Unrelated-file tolerance | Keeping investigation focused | `investigation_max_unrelated_files=3` |
| `investigation_repeated_read_threshold` | Repeat-read threshold | Catching read loops early | `investigation_repeated_read_threshold=1` |
| `team` | Shared roster switch | First shared mission, Flow 0 | `team=on` |
| `sign` | off / minisign / pure / auto | Regulated missions only | `sign=auto` |
| `features` | Extension roster control | Trimming skills per mission | `features=core+auto,ship,-testcases` |
| `enforce` | off / warn / block | Stopping on violation | `enforce=block` |

## Features

<details>
<summary>Token table: 7 core plus 7 common auto tokens</summary>

| Token | Fires when | Default |
|---|---|---|
| `orchestration` | always on | core |
| `planning` | always on | core |
| `execution` | always on | core |
| `checkpoint` | always on | core |
| `gates` | always on | core |
| `quality` | always on | core |
| `lessons` | always on, read half | core |
| `ship` | close intent at Flow 8 | auto |
| `migration` | schema, data, framework diff | auto |
| `contract-first` | boundary file diff | auto |
| `testcases` | user declares tests | auto |
| `frontend` | UI paths in diff | auto |
| `backend` | server paths in diff | auto |
| `security` | sensitive path hit | auto |

The rest load the same way: `brainstorm` on vague requests, `healing` after a failed stage, `review` once gates pass, `root-cause` on bug reports, `git` on git operations, `resume` on interrupted missions, `workflow` on meta missions. `team` is read-only (`team=on` or roster over one); `sign` and `lessons-write` stay off unless regulated or closing.

</details>

Three shapes cover most missions:

- `features=core+auto,ship,-testcases` adds close-out, drops test intake.
- `features=all` is the explicit default.
- Bare `features=ship` means base `features=core+auto` plus ship.

Dropping `security` or `contract-first` while it fires throws an error, as does any unknown token. `skeptic` is a role, not a token.

## Branch patterns

Branch names are convention-only with no substitution in code. `{type}` is the commit type (feat, fix, chore, docs, refactor); `{issue}` the tracker id or `noissue`; `{slug}` a short kebab-case summary. Custom shapes reuse the slots: `release/{issue}-{slug}`, `{type}/{issue}`.

Missing config means guided. Say `mugiwara mode auto` to flip for the next stage. `mugiwara.policy.yml` only raises coverage.
