// src/frontmatter.ts
export type FrontmatterData = Record<string, string>;

export function parseFrontmatter(text: string): { data: FrontmatterData; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) throw new Error('Missing frontmatter fence (---)');
  const data: FrontmatterData = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf(': ');
    if (i === -1) throw new Error(`Bad frontmatter line (missing ': ' separator): ${line}`);
    data[line.slice(0, i).trim()] = line.slice(i + 2).trim();
  }
  return { data, body: text.slice(m[0].length) };
}

export function stringifyFrontmatter(data: FrontmatterData, body: string): string {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n${body}`;
}
