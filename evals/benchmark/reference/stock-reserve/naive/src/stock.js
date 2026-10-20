export async function reserve(store, sku, qty) {
  const have = await store.get(sku);
  if (have < qty) throw new Error('insufficient stock for ' + sku);
  await store.set(sku, have - qty);
  return have - qty;
}
