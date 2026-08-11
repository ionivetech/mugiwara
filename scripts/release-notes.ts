#!/usr/bin/env bun
// scripts/release-notes.ts — generates a human-readable release description
// from git history between the previous tag and HEAD. Grouped by change type,
// conventional-commit aware, no gh dependency.
//
//   bun scripts/release-notes.ts            notes since the last tag → stdout
//   bun scripts/release-notes.ts --since v0.3.0   notes from that tag → stdout
import { execFileSync } from 'node:child_process';

const args = process.argv;
const sinceIdx = args.indexOf('--since');
let since = sinceIdx !== -1 ? args[sinceIdx + 1] : null;

if (!since) {
  try {
    since = execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf8' }).trim();
  } catch {
    since = null;
  }
}

const range = since ? `${since}..HEAD` : '';
const raw = execFileSync('git', ['log', '--pretty=%s', ...(range ? [range] : [])], { encoding: 'utf8' });
const commits = raw.split(/\r?\n/).filter(Boolean);

const groups: Record<string, { label: string; items: string[] }> = {
  feat: { label: 'New', items: [] },
  fix: { label: 'Fixed', items: [] },
  docs: { label: 'Docs', items: [] },
  refactor: { label: 'Refactored', items: [] },
  perf: { label: 'Performance', items: [] },
  chore: { label: 'Housekeeping', items: [] },
  test: { label: 'Housekeeping', items: [] },
  ci: { label: 'Housekeeping', items: [] },
};

const order = ['feat', 'fix', 'refactor', 'perf', 'docs', 'chore'];

for (const c of commits) {
  const m = /^(\w+)(?:\(.*\))?!?: (.*)/.exec(c);
  const type = m ? m[1] : 'chore';
  const text = m ? m[2] : c;
  const g = groups[type] ?? groups.chore;
  g.items.push(text.charAt(0).toUpperCase() + text.slice(1));
}

const lines: string[] = [];
for (const t of order) {
  const g = groups[t];
  if (!g.items.length) continue;
  lines.push(`## ${g.label}`);
  lines.push('');
  for (const item of g.items) lines.push(`- ${item}`);
  lines.push('');
}

const bumpIdx = commits.findIndex(c => /chore: release|chore: bump/.test(c));
const body = commits.slice(0, bumpIdx === -1 ? commits.length : bumpIdx);
const count = body.length || commits.length;

console.log(`**${count} change${count === 1 ? '' : 's'} since ${since ?? 'the start'}.**`);
console.log('');
console.log(lines.join('\n').trimEnd());
