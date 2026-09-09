# Config

You want one behavior changed and you cannot find which key owns it. You edit a file and nothing enforces the change, or the wrong gate fires. This page answers "what can I set" with one example file, then the full key table. Prose on this page never overrides the table.

Example: a repo with no commit convention sets `commit=plain` and slows review depth for an internal library with `review_depth=standard`. Both lines live in `.mugiwara/config`, which wins per key over `~/.mugiwara/config`. Delete a line to take its default. Unknown keys stay ignored.

```ini
mode=guided
commit=plain
review_depth=standard
coverage_new=85
heal_max_cycles=3
```

Rule: mode owns autonomy, config owns writing standards. Code reads every key below through savepoint, lane, coverage gate, closure, sign, and guard hooks. Optional keys ship commented; uncomment to set. Prose on this page never overrides the table.

| Key | Default | Meaning |
|---|---|---|
| `mode` | guided / semi / auto | Autonomy per flow stage; flips apply next stage |
| `verbosity` | normal / full | Echo depth; review needs never collapse |
| `branch` | feature/{type}-{issue}-{slug} | Branch pattern for mission work |
| `commit` | conventional | Commit message style |
| `auto_commit` | off | Commit and push in guided and semi; no effect in auto |
| `coverage_new` | 85 | Gate threshold, new code; policy raises only |
| `coverage_modified` | 90 | Gate threshold, modified code; policy raises only |
| `review_depth` | full / standard / quick | Review pass depth |
| `quality_depth` | full / standard / quick | Quality pass depth |
| `verify_merged` | on / off | Merged verify pass outside lane 3 |
| `delegate_threshold` | 60 | Percent of budget before delegation is advised |
| `heal_max_cycles` | 3 | Heal loop halts here and escalates |
| `lane_scope_glob` | unset | Monorepo scope; escalation still reads the full diff |
| `context_budget_chars` | 150000 | Archive refuses past this trail size |
| `investigation_max_passes` | 2 | Investigator pass cap per stage |
| `investigation_max_unrelated_files` | 5 | Unrelated-file tolerance per investigation |
| `investigation_repeated_read_threshold` | 2 | Repeat-read flag threshold |
| `sign` | off / minisign / pure / auto | Report attestation backend |
| `enforce` | off / warn / block | Pipeline-guard policy |

Missing config on read means guided. Flip mid-mission by saying `mugiwara mode auto` in session. It applies from the next flow stage. Policy file `mugiwara.policy.yml` can raise coverage, never lower it. Full consumer map lives in code: `scripts/savepoint.sh`, `scripts/lane.sh`, coverage gate, `src/sign.ts`, guard hooks.
