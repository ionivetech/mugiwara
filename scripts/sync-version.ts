#!/usr/bin/env bun
// scripts/sync-version.ts — syncs package.json version into the plugin manifests
// so Claude/Copilot plugin version always matches the published npm version.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const v = pkg.version;

const targets = [
  join(root, '.claude-plugin', 'plugin.json'),
  join(root, 'plugin.json'),
  join(root, '.claude-plugin', 'marketplace.json'),
];

for (const file of targets) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  if (doc.version !== undefined) doc.version = v;
  if (doc.metadata?.version !== undefined) doc.metadata.version = v;
  if (Array.isArray(doc.plugins)) {
    for (const p of doc.plugins) if (p.version !== undefined) p.version = v;
  }
  writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
  console.log(`synced ${file} → ${v}`);
}
