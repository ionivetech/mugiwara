# Worker Subagents

Brook runs inline for triage + ledger reading. Parallel fixes use disposable WORKER subagents.

## Heal workers (parallel fixes)

After triage, group ledger rows that are **independent** (different files, no shared function/interface) for parallel healing:

```
Ledger: 4 rows
├─ Row 1: T3 settings POST guard missing     → src/routes/settings.ts
├─ Row 2: T5 formatDate locale bug           → src/utils/format.ts
├─ Row 3: review minor: error msg wording    → src/middleware/rbac.ts
├─ Row 4: coverage: add test for edge case   → src/routes/users.test.ts

Group 1 [PARALLEL]: Row 1 (settings.ts) + Row 2 (format.ts) + Row 4 (users.test.ts)
                     → 3 files, no shared surface → 3 heal workers parallel
Group 2 [SEQUENTIAL]: Row 3 (rbac.ts)
                       → shares interface with Row 1 (middleware) → after Group 1
```

Each heal worker receives a prompt with 5 fields:
- **FAILURE** — ledger row verbatim (wave, task, symptom, attempted)
- **ROOT CAUSE** — Brook's triage result: where the bug is, why it happened
- **FIX** — what to change, which file, which function
- **MUST DO** — Prove-It: write regression test, watch it fail, implement fix, watch it pass, commit
- **MUST NOT** — files outside scope, drive-by refactor, delete/weaken tests

## Validation workers (verify)

After all heal workers complete, dispatch validation workers in parallel:
- **reviewer-worker** — adversarial diff review from fresh context (per `mugiwara-review`)
- **security-worker** — security pass over fixes (per `mugiwara-security`)
- **re-run-check worker** — independently re-runs failed checks, returns raw evidence

Flow: Brook triage + grouping → dispatch heal workers parallel → aggregate results → dispatch validation workers → update ledger → back to Wave 4.

Workers are NOT crew members — disposable subagents, one narrow job per worker. Crew runs inline in main thread.
