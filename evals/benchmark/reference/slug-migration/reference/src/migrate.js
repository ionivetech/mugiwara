export const slugify = (s) => s.toLowerCase().replace(/ /g, '-');
export function backfillSlugs(db, batchSize = 2) {
  // Keyset cursor: continue after the last id seen until the table runs dry, so rows added
  // meanwhile are picked up. Rows with a slug are skipped, which makes a re-run cheap and safe.
  let after = 0;
  for (;;) {
    const batch = db.fetchBatch(after, batchSize);
    if (!batch.length) return;
    for (const row of batch) if (!row.slug) db.update(row.id, { slug: slugify(row.title) });
    after = batch[batch.length - 1].id;
  }
}
