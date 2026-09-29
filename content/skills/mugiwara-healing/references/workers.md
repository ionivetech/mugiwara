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
- **FAILURE** — ledger row verbatim (flow stage, task, symptom, attempted)
- **ROOT CAUSE** — Brook's triage result: where the bug is, why it happened
- **FIX** — what to change, which file, which function
- **MUST DO** — Prove-It: write regression test, watch it fail, implement fix, watch it pass, commit
- **MUST NOT** — files outside scope, drive-by refactor, delete/weaken tests

## Validation workers (verify) — off by default

Healing hands back to Flow 4, and Chopper re-runs every failed check there;
Flow 7 then runs Robin and Jinbe over the same diff. A reviewer-worker, a
security-worker and a re-run-check worker reproduce all three, one stage early,
at roughly 132k tokens per dispatch against 5k inline. Three workers a cycle
across the 3-cycle cap is ~1.19M tokens buying a verdict the next two stages
derive anyway.

So: **dispatch none of them by default.** Aggregate the heal results, update the
ledger, hand back to Flow 4.

Dispatch a validation worker only when fresh context genuinely beats the next
stage, which is one of two cases:

| Trigger | Worker | Why it beats waiting for Flow 4/7 |
|---|---|---|
| the heal touched a sensitive path (auth, payment, secrets, migration, public API) | `security-worker` | Jinbe runs at Flow 7, two gates away — a sensitive-path regression should not travel that far unexamined |
| `heal_cycle ≥ 2` on the same row | `reviewer-worker` | Brook has now failed the same row twice; its own context is the suspect, and fresh eyes are the point |

`re-run-check worker` has no trigger — Chopper re-runs the checks at Flow 4 as
its entire job, and running them one stage early only produces evidence Chopper
must re-derive to trust. Record the skip; do not dispatch it.

Log the dispatch decision either way — which workers ran, or the one line saying
none did and why. Trail row `slop-governor`.

Flow: Brook triage + grouping → dispatch heal workers parallel → aggregate results → (validation worker only on a trigger above) → update ledger → back to Flow 4.

Workers are NOT crew members — disposable subagents, one narrow job per worker. Crew runs inline in main thread.
