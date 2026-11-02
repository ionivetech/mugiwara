#!/usr/bin/env bun
// scripts/sync-version.ts — syncs package.json version into the plugin manifests
// so Claude/Copilot plugin version always matches the published npm version.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const v = pkg.version;

const targets = [
  join(root, '.claude-plugin', 'plugin.json'),
  join(root, 'plugin.json'),
  join(root, '.claude-plugin', 'marketplace.json'),
  join(root, 'gemini-extension.json'),
  join(root, '.codex-plugin', 'plugin.json'),
  join(root, '.cursor-plugin', 'plugin.json'),
  join(root, '.kimi-plugin', 'plugin.json'),
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

// Pin the npx fallback the crew runs when no global CLI exists:
// `npx -y @ionivetech/mugiwara@<version>` in command and skill text names the
// plugin's own version, so the CLI always matches the instructions that call
// it. Install lines for users (README, docs, install scripts) stay `@latest`.
const NPX_PIN_RE = /(npx -y @ionivetech\/mugiwara@)(?:latest|\d+\.\d+\.\d+[\w.+-]*)/g;
const pinRoots = ['.claude/commands', '.opencode/commands', 'content'];

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

for (const rootDir of pinRoots) {
  for (const file of walk(join(root, rootDir))) {
    const text = readFileSync(file, 'utf8');
    const next = text.replace(NPX_PIN_RE, `$1${v}`);
    if (next !== text) { writeFileSync(file, next); console.log(`pinned npx in ${file} -> ${v}`); }
  }
}
