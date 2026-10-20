export const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export function splitByWeights(totalCents, weights) {
  const w = sum(weights);
  return weights.map((x) => Math.round((totalCents * x) / w));
}
