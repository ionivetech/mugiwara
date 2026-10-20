const queues = new WeakMap();
export function reserve(store, sku, qty) {
  // One queue per store: reservations run one at a time, a failure does not poison the queue.
  const run = (queues.get(store) ?? Promise.resolve()).then(async () => {
    const have = await store.get(sku);
    if (have < qty) throw new Error('insufficient stock for ' + sku);
    await store.set(sku, have - qty);
    return have - qty;
  });
  queues.set(store, run.catch(() => {}));
  return run;
}
