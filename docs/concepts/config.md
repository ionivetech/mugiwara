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

Rule: mode owns autonomy, config owns writing standards. Code reads nine keys through savepoint, lane, coverage gate, closure, sign, and guard hooks. The rest are advisory: the crew reads them from this file at stage start, no validator fires.

| Keys | Default | Meaning |
|---|---|---|
| `mode` | guided | Autonomy level, read per flow stage |
| `branch`, `commit` | pattern, conventional | Naming styles, advisory, crew-read |
| `auto_commit` | off | Commit and push in guided and semi, no effect in auto |
| `coverage_new`, `coverage_modified` | 85, 90 | Gate thresholds, policy can raise only |
| `review_depth`, `quality_depth` | full | Review and quality depth, advisory |
| `verify_merged`, `verbosity` | off, normal | Merged verify pass outside lane 3; echo level |
| `delegate_threshold`, `heal_max_cycles` | 60, 3 | Dispatch flag; heal halt, both computed to state |
| `context_budget_chars`, `lane_scope_glob` | unset | Archive ceiling; monorepo scope |
| `investigation_*`, `sign`, `enforce` | 2, 5, 2, auto, block | Investigation caps; attestation; guard policy |

Missing config on read means guided. Flip mid-mission by saying `mugiwara mode auto` in session. It applies from the next flow stage. Policy file `mugiwara.policy.yml` can raise coverage, never lower it. Full consumer map lives in code: `scripts/savepoint.sh`, `scripts/lane.sh`, coverage gate, `src/sign.ts`, guard hooks.
