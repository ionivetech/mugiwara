export const columns = (rows) => Object.keys(rows[0] ?? {});
export function parseCsv(text) {
  const [head, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const names = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [names[i], v])));
}
