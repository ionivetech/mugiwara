export const length = ([start, end]) => end - start;
export function mergeBlocks(blocks) {
  const out = [];
  for (const b of [...blocks].sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1];
    if (last && b[0] < last[1]) last[1] = Math.max(last[1], b[1]);
    else out.push(b);
  }
  return out;
}
