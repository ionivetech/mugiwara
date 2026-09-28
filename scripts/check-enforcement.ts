#!/usr/bin/env bun
// scripts/check-enforcement.ts — gate runner for src/enforcement-check.ts.
// Thin on purpose: the logic is tested there, this only reads files and exits.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkArtifactPaths, checkMechanismCells, checkWritingCapTargets } from '../src/enforcement-check.ts';
import { WRITING_CAPS } from '../src/check-writing.ts';

const root = join(import.meta.dirname, '..');
// The one source: content/skills/mugiwara-workflow/references/workspace-layout.md
const CANONICAL_FLOWS = [
  '01-execution.md', '02-audit.md', '03-quality.md', '04-gates.md',
  '05-healing.md', '06-closure.md', '07-pr-verdict.md', '08-verifier.md',
] as const;

const walk = (d: string, out: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.md')) out.push(p);
  }
  return out;
};
const prose = [...walk(join(root, 'content')), ...walk(join(root, 'references'))].map((p) => ({
  path: p.slice(root.length + 1),
  text: readFileSync(p, 'utf8'),
}));

const errors = [
  ...checkArtifactPaths(prose, CANONICAL_FLOWS),
  ...checkMechanismCells(readFileSync(join(root, 'docs/concepts/enforcement.md'), 'utf8'), root),
  ...checkWritingCapTargets(WRITING_CAPS, root),
];
if (errors.length) {
  for (const e of errors) console.log(`✗ ${e}`);
  console.log(`check-enforcement: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log('✓ enforcement: every mechanism cell resolves; every writing cap has a file');
