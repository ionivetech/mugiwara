# Ledger Format

Blocker ledger row format used by Chopper (wave-audit) and Brook (healing).

## Row format

```
| wave | task | symptom | attempted | help-needed |
```

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `wave` | yes | Which wave produced the failure (4, 5, 6, 7, 8) |
| `task` | yes | Task identifier from the plan (T3, T5, etc.) |
| `symptom` | yes | What failed — error message, exit code, missing artifact. Include category: `test-fail`, `missing-impl`, `parallel-conflict`, `env`, `regression` |
| `attempted` | yes | What was tried — "re-ran npm test -- scope", "checked caller imports" |
| `help-needed` | no | What the healer needs to know — "race in token expiry check", "env var missing in CI" |

## Example

```
| 4 | T3 | test-fail: formatDate returns wrong locale | re-ran with en-US locale explicitly | locale detection differs between Node 18 and 20 |
| 4 | T5 | missing-impl: no thumbnail endpoint | searched routes/ dir, not found | endpoint was in a different plan wave |
| 5 | T2 | env: vitest hangs on CI | re-ran locally, passes | needs --pool=forks flag on CI |
```

## Rules

- Every blocker gets one row. Never combine two failures into one row.
- Category goes in `symptom` or `help-needed` — whichever is more specific.
- `env` classification must be proven (reproduce on clean checkout). Unproven = `test-fail`.
- File at `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md`. Create if absent.
