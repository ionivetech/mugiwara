---
name: mugiwara-migration
description: Use for schema, data, or framework migrations — expand-contract pattern, backfill verification, tested rollback. One-way doors only.
gate_artifact: flows/01-execution.md migration evidence — row counts before/after + rollback proof
---

# Migration (Zoro)

## Skip when

- No stored data or live contract changes: code-only refactor with zero rows and zero callers outside the diff.
- Greenfield schema with no existing rows and no deployed version to stay compatible with.
- The change is a deploy, key rotation, or merge — refused territory, not migration territory.

Migrations are one-way doors: a lost row cannot be reverted, only mourned. Expand first, prove, then contract. Never the reverse.

## Expand–contract (the only pattern)

1. **Expand** — add the new column/table/endpoint alongside the old. Old keeps serving.
2. **Dual-write** — write both shapes; read the old. Old stays the truth.
3. **Backfill** — fill the new shape in batches with progress logs; resumable, never one giant transaction.
4. **Verify** — row counts match, checksums match, canary reads match (see below).
5. **Cut over** — flip reads to the new shape behind a flag if risky.
6. **Contract** — drop the old shape only after one full release with zero reads on it.

Full steps with batching and flag discipline: `references/playbook.md`. A migration that starts at step 5 is a hope, not a plan.

## Verification (counts, not claims)

- Row counts before = after, per table, captured in the evidence log.
- Checksum or hash-sample on migrated columns where the engine supports it.
- Canary: N% of reads against the new shape compared field-by-field before full cutover (N from the plan, never 0, never "looks fine").
- Downstream consumers (reports, exports, search indexes) re-run against the new shape once.

## Destructive operations

`DROP`, `DELETE` without `WHERE`, narrowing a type, or removing a default
requires ALL of: a verified backup (restore-tested, not just taken), explicit
user consent naming the blast radius, and the rollback below proven first.
One missing → the operation does not run, in any mode.

## Rollback (proven before migrate)

Every migration ships its reverse before it ships itself: the exact commands,
in order, with an owner and a time budget (rollback must run no slower than
the deploy). Prove the path exists — restore the backup to a scratch target
once, or the rollback is paper. Record proof in the evidence log.

## Framework migrations

Same pattern, different shape: new version alongside (adapter/shim), traffic
or tests moved in slices, old removed last. Pin versions, read the upstream
migration guide (source-grounded, not memory), and keep the old behavior
asserted by tests until the cutover lands.

## Common rationalizations

- "Small table, one shot is fine" → small tables grow; batches are resumable, one-shots are not.
- "Backup exists" → restored, or it does not exist. Prove it on scratch.
- "We'll backfill after cutover" → cutover on unverified data is corruption with a flag.
- "Down migration later" → the reverse ships with the migration, or the door is one-way.
- "No users yet, skip verify" → counts cost seconds and catch real bugs; skip nothing.

## Red flags

- A migration starting at cutover with no expand phase.
- Counts asserted from memory instead of captured output.
- A destructive operation with backup taken but never restored.
- Rollback described but never exercised, or slower than the deploy.
- Dual-write skipped "to save time" on a live shape.
- Old shape dropped in the same release that stops reading it.

Any red flag = the door is already one-way. Stop, expand, verify, then continue.
