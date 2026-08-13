#!/usr/bin/env bun
// scripts/setup-fixtures.ts — materialize test/fixtures/*.json into real git
// repos in a temp dir. Each fixture = a JSON manifest with base/branch file
// trees. The script writes the base tree on the trunk branch, creates the
// feature branch, applies the branch tree, and commits. Used by tests to get
// a deterministic repo per scenario. Never touches the main repo's .git.
//
// Usage:
//   bun scripts/setup-fixtures.ts <fixture> <targetDir>
//   bun scripts/setup-fixtures.ts --list

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, '..', 'test', 'fixtures');

function fixtureNames(): string[] {
  return readdirSync(fixturesDir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
}

if (process.argv[2] === '--list') {
  console.log(fixtureNames().join('\n'));
  process.exit(0);
}

const name = process.argv[2];
const target = process.argv[3];
if (!name || !target) {
  console.error('usage: bun scripts/setup-fixtures.ts <fixture> <targetDir>');
  process.exit(1);
}

type Fixture = {
  name: string;
  baseBranch: string;
  base: Record<string, string>;
  branch: Record<string, string>;
  binary?: string[];
  gitInit?: boolean;
  note?: string;
};

const file = join(fixturesDir, name + '.json');
if (!existsSync(file)) {
  console.error(`fixture not found: ${name} (have: ${fixtureNames().join(', ')})`);
  process.exit(1);
}
const fx = JSON.parse(readFileSync(file, 'utf8')) as Fixture;

// target must be a fresh empty dir
if (existsSync(target)) rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

if (fx.gitInit === false) {
  // no-git fixture: just an empty dir with one file, no .git ever created
  mkdirSync(join(target, 'src'), { recursive: true });
  writeFileSync(join(target, 'src', 'main.ts'), 'export const main = () => 1;\n');
  console.log(`fixture ${name}: materialized (no .git)`);
  process.exit(0);
}

const writeTree = (tree: Record<string, string>) => {
  for (const [path, content] of Object.entries(tree)) {
    const full = join(target, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
};

execSync('git init -q', { cwd: target });
execSync('git config user.email test@test.com && git config user.name Test', { cwd: target });

const trunk = fx.baseBranch || 'main';
// branch named after trunk if trunk isn't main (so savepoint base-resolve paths differ)
execSync(`git checkout -q -b ${trunk}`, { cwd: target });

// base commit on trunk
writeTree(fx.base);
for (const rel of fx.binary ?? []) {
  if (fx.base[rel]) writeFileSync(join(target, rel), fx.base[rel]);
}
execSync('git add -A && git commit -q -m base', { cwd: target });

// feature branch applies the branch tree (files removed from base not in
// branch get deleted; contents updated; new files added)
execSync(`git checkout -q -b feat-${fx.name}`, { cwd: target });
for (const rel of Object.keys(fx.base)) {
  if (!(rel in fx.branch)) {
    execSync(`git rm -q --ignore-unmatch "${rel}"`, { cwd: target });
  }
}
writeTree(fx.branch);
for (const rel of fx.binary ?? []) {
  if (fx.branch[rel]) writeFileSync(join(target, rel), fx.branch[rel]);
}
execSync('git add -A && git commit -q -m wip', { cwd: target });

console.log(`fixture ${name}: materialized at ${target} (trunk=${trunk}, branch=feat-${fx.name})`);
