#!/usr/bin/env bun
// scripts/run-evals.ts — validates the eval suite exists and prints the case list.
// Does NOT execute cases: the host agent runs them. Run: bun scripts/run-evals.ts
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const casesDir = join(root, 'evals', 'cases');
const skillsDir = join(root, 'content', 'skills');
const errors: string[] = [];

function listCases(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listCases(p, join(prefix, ent.name)));
    else if (ent.name.endsWith('.json')) out.push(join(prefix, ent.name));
  }
  return out;
}

const cases = listCases(casesDir).sort();
for (const rel of cases) {
  let c: { name?: string; skill?: string; task?: string; rubric?: unknown[] };
  try { c = JSON.parse(readFileSync(join(casesDir, rel), 'utf8')); }
  catch (e) { errors.push(`${rel}: invalid JSON (${(e as Error).message})`); continue; }
  if (!c.name || !c.skill || !c.task || !Array.isArray(c.rubric) || !c.rubric.length)
    errors.push(`${rel}: missing name/skill/task/nonempty rubric`);
  else if (!existsSync(join(skillsDir, c.skill!))) errors.push(`${rel}: unknown skill "${c.skill}"`);
}

if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
if (!cases.length) { console.error('✗ no cases in evals/cases/'); process.exit(1); }
console.log(`✓ ${cases.length} eval case(s) OK:`);
for (const rel of cases) console.log(`  ${rel}`);
