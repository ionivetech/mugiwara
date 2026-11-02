# Failure taxonomy and ledger rows

The one taxonomy for failures. Chopper files rows with these categories, Brook triages by them. The ledger is `.mugiwara/missions/<mission>/blockers.md`; create it if absent.

## Categories

| Category | Signal | Action |
|----------|--------|--------|
| `test-fail` | A test, lint, or build command fails with a specific error | Reproduce, localize, reduce, fix the root cause, add a guard test |
| `type-error` | Typecheck fails on changed code | Fix at the root cause, grep all callers, re-run the typecheck |
| `missing-impl` | An acceptance criterion cannot be verified, or an artifact is absent | Check whether the task was skipped; if not, implement the missing piece |
| `parallel-conflict` | Two tasks changed the same file concurrently | Serialize, merge the changes, re-verify |
| `regression` | A previously passing check now fails | `git bisect` to the breaking commit, fix the root cause |
| `flaky` | Intermittent pass and fail with no code change | Run 3 times, record all results, quarantine with an owner. Mark flaky only after showing the non-determinism. Never a pass, never a code patch |
| `env` | Fails only in one environment | Mark `env`, do not patch code, note for re-run |

`env` must reproduce on a clean checkout in the same environment, or fail only on one OS or CI. "Probably env" is not proof: until proven, the failure is a code failure.

## Row format

```
| stage | task | symptom | attempted | help-needed |
```

- `stage`: the Flow number of the stage that produced the failure, digits only (the stage table in `mugiwara-orchestration`, stages.md, lists them). Savepoint counts open rows by this leading number.
- `task`: the plan task id (T3, T5).
- `symptom`: what failed (error, exit code, missing artifact) with its category from the table.
- `attempted`: what was tried, for example "re-ran with en-US locale", "checked caller imports".
- `help-needed`: optional; what the fixer needs to know, for example "race in token expiry check".

One failure, one row; never combine two. The category goes in `symptom` or `help-needed`, whichever is more specific.

Example:

```
| 4 | T3 | test-fail: formatDate returns wrong locale | re-ran with en-US explicitly | locale detection differs between Node 18 and 20 |
| 5 | T2 | env: tests hang on CI | re-ran locally, passes | needs a shard split on CI |
```

## Escalation

When the same failure survives `heal_max_cycles` fix rounds, stop and hand it to the user with the repro, the attempted fixes, and the root-cause hypothesis. Round and per-row limits: stage table (`mugiwara-orchestration`, stages.md).
