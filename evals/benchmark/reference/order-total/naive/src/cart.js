export const itemCount = (items) => items.reduce((n, i) => n + i.qty, 0);
export function orderTotal(items, taxPercent) {
  const sub = items.reduce((n, i) => n + i.priceCents * i.qty, 0);
  return Math.round(sub * (1 + taxPercent / 100));
}
