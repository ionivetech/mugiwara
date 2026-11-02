export const itemCount = (items) => items.reduce((n, i) => n + i.qty, 0);
export function orderTotal(items, taxPercent) {
  if (!Number.isFinite(taxPercent) || taxPercent < 0) throw new RangeError('invalid tax');
  let sub = 0;
  for (const { priceCents, qty } of items) {
    if (!Number.isInteger(priceCents) || priceCents < 0 || !Number.isInteger(qty) || qty < 0) throw new RangeError('invalid item');
    sub += priceCents * qty;
  }
  const bp = Math.round(taxPercent * 100); // basis points: integer maths, no float drift
  return sub + Math.floor((sub * bp * 2 + 10000) / 20000);
}
