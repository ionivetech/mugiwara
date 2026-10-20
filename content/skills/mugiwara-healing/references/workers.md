# Worker subagents

Brook runs inline for triage and ledger reading. Parallel fixes use disposable workers. Workers are not crew members.

## Fix workers (parallel fixes)

After triage, group ledger rows that are independent (different files, no shared function or interface) and fix them in parallel:

```
Ledger: 4 rows
- Row 1: T3 settings POST guard missing   -> src/routes/settings.ts
- Row 2: T5 formatDate locale bug         -> src/utils/format.ts
- Row 3: review minor: error wording      -> src/middleware/rbac.ts
- Row 4: coverage gap for an edge case    -> src/routes/users.test.ts

Group 1 [PARALLEL]: rows 1, 2, 4 (3 files, no shared surface, 3 workers)
Group 2 [SEQUENTIAL]: row 3 (shares the middleware interface with row 1, runs after group 1)
```

Each fix worker gets five fields:
- FAILURE: the ledger row verbatim.
- ROOT CAUSE: Brook's triage result, where the bug is and why.
- FIX: what to change, in which file and function.
- MUST DO: write a regression test, watch it fail, fix, watch it pass, commit.
- MUST NOT: touch files outside scope, refactor on the side, delete or weaken tests.

## Validation workers: off by default

After the fix stage, Chopper re-runs every failed check and Robin and Jinbe review the same diff. A reviewer worker, security worker, and re-run worker reproduce those results one step early at about 132k tokens each against about 5k inline, for a verdict the next two stages produce anyway. So dispatch none by default: aggregate the fix results, update the ledger, hand back.

Dispatch one only when fresh context beats waiting:

| Trigger | Worker | Why |
|---|---|---|
| The fix touched a sensitive path (auth, payment, secrets, migration, public API) | security worker | Jinbe runs two stages later; a sensitive regression should not travel that far unexamined |
| Second attempt on the same row | reviewer worker | Brook has failed the row twice; its own context is the suspect |

A re-run worker has no trigger: Chopper's whole job is re-running. Record the skip.

Log the decision either way: which workers ran, or one line saying none did and why.

Sequence: triage and grouping, fix workers in parallel, aggregate, (validation worker only on a trigger), update the ledger, recommend Chopper for the re-check.
