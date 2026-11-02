export const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export function splitByWeights(totalCents, weights) {
  const w = sum(weights);
  const shares = weights.map((x) => Math.floor((totalCents * x) / w));
  // Largest remainder: hand the leftover cents to the shares that lost the most to flooring.
  const order = weights.map((x, i) => [(totalCents * x) % w, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let left = totalCents - sum(shares), k = 0; left > 0; left--, k++) shares[order[k][1]]++;
  return shares;
}
