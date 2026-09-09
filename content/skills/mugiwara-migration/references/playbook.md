# Migration playbook — batches, flags, verification queries

Companion to `mugiwara-migration`. The skill states the rules; this file
states the moves.

## Backfill batching

- Batch size from the plan (rows or time-boxed, e.g. 10k rows or 60s per
  batch) — never one transaction for the whole table.
- Each batch logs progress (`batch 12/90, 120k/900k rows`) to the evidence
  log; a batch failure resumes from the last logged batch, never restarts.
- Throttle when the store is live (sleep between batches, off-peak window);
  an unthrottled backfill is a self-inflicted DoS.

## Flag discipline

- Cutover behind a flag the operator flips without a deploy; flag defaults
  to the old shape.
- Flag removal is a tracked follow-up (own task, own commit), filed before
  cutover — flags without removal dates become permanent branches.
- One flag per cutover; stacked flags multiply the states to verify.

## Verification queries (adapt to the engine)

- Counts: `SELECT COUNT(*)`, plus per-partition counts when the table is
  partitioned — a matching total with a shifted partition is a silent skew.
- Checksums: hash-sample migrated columns (`CHECKSUM_AGG`, `md5(group)`,
  or application-level sample of N random rows compared field-by-field).
- Canary reads: route N% of reads to the new shape, diff old vs new per
  request, log mismatches with keys — zero mismatches over the canary
  window before full cutover.
- Downstream: re-run one report/export/search query each against the new
  shape; consumers read what you migrated, not what you think you migrated.

## Framework slices

Move traffic or tests in slices (routes, then workers, then cron — never
all at once); keep the old version's tests green until its removal lands;
record the upstream migration guide link in the evidence log.
