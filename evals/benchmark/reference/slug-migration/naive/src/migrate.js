export const slugify = (s) => s.toLowerCase().replace(/ /g, '-');
export function backfillSlugs(db, batchSize = 2) {
  let after = 0;
  for (;;) {
    const batch = db.fetchBatch(after, batchSize);
    if (!batch.length) return;
    for (const row of batch) db.update(row.id, { slug: slugify(row.title) });
    after = batch[batch.length - 1].id;
  }
}
