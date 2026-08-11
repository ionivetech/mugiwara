#!/usr/bin/env bun
// Ad-hoc retrieval probe. Usage: bun scripts/probe.ts "your prompt here"

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '../src/frontmatter.ts';

const skillsDir = join(import.meta.dirname, '..', 'content', 'skills');
const STOP = ['the', 'and', 'for', 'use', 'when', 'that', 'with', 'this', 'from', 'its', 'not', 'are', 'has'];
const tok = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')
  .split(/\s+/).filter(x => x.length > 1 && !STOP.includes(x));

const terms = new Map<string, number>();
const docs = new Map<string, Map<string, number>>();
for (const d of readdirSync(skillsDir).filter(d => statSync(join(skillsDir, d)).isDirectory())) {
  const f = join(skillsDir, d, 'SKILL.md');
  if (!existsSync(f)) continue;
  const { data } = parseFrontmatter(readFileSync(f, 'utf8'));
  const tf = new Map<string, number>();
  for (const t of tok(data.description ?? '')) {
    tf.set(t, (tf.get(t) || 0) + 1);
    terms.set(t, (terms.get(t) || 0) + 1);
  }
  docs.set(d, tf);
}

const N = docs.size;
const prompt = process.argv.slice(2).join(' ');
const ranked = [...docs.keys()].map(d => {
  let s = 0;
  for (const t of tok(prompt)) {
    const tf = docs.get(d)!.get(t) || 0;
    if (tf) s += tf * Math.log(N / (terms.get(t) || 1));
  }
  return { d, s };
}).sort((a, b) => b.s - a.s);

console.log(`"${prompt}"\n`);
ranked.slice(0, 8).forEach((r, i) =>
  console.log(`  ${String(i + 1).padStart(2)}. ${r.d.padEnd(28)} ${r.s.toFixed(2)}`));
