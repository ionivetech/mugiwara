#!/usr/bin/env bun
// scripts/check-enforcement.ts — gate runner for src/enforcement-check.ts.
// Thin on purpose: the logic is tested there, this only reads files and exits.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkMechanismCells, checkWritingCapTargets } from '../src/enforcement-check.ts';
import { WRITING_CAPS } from '../src/check-writing.ts';

const root = join(import.meta.dirname, '..');
const errors = [
  ...checkMechanismCells(readFileSync(join(root, 'docs/concepts/enforcement.md'), 'utf8'), root),
  ...checkWritingCapTargets(WRITING_CAPS, root),
];
if (errors.length) {
  for (const e of errors) console.log(`✗ ${e}`);
  console.log(`check-enforcement: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log('✓ enforcement: every mechanism cell resolves; every writing cap has a file');
