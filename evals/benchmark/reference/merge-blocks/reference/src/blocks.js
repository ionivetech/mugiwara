export const length = ([start, end]) => end - start;
export function mergeBlocks(blocks) {
  const out = [];
  for (const [start, end] of [...blocks].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const last = out[out.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]); // a fresh array: never hand back the caller's own
  }
  return out;
}
