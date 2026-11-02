# Failure ledger (checkpoint)

Chopper appends one row per failing criterion to `.mugiwara/missions/<mission>/blockers.md`, creating it only if absent. Row schema, field meanings, and the categories (`test-fail`, `type-error`, `missing-impl`, `parallel-conflict`, `regression`, `flaky`, `env`): see the failure taxonomy in `mugiwara-healing`.

Checkpoint-specific rules:

- Every unmet acceptance criterion gets its own row, with the command that was re-run in `attempted`.
- An acceptance criterion with no command or file to check gives no evidence and is unverifiable: file it as `missing-impl`, do not waive it.
- `env` needs a clean-checkout reproduction. Without it, file `test-fail`.
- A check that passes sometimes and fails sometimes is `flaky`: run it 3 times, put all three results in `attempted`, and name an owner in `help-needed`.

Example:

```
| 4 | T5 | missing-impl: no thumbnail endpoint | searched routes/, not found | endpoint may sit in a later plan task |
```
