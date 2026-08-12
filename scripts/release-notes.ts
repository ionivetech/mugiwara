#!/usr/bin/env bun
// scripts/release-notes.ts — generates a detailed GitHub Release description
// from git history between the previous tag and HEAD. Pulls the full commit
// message (subject + body), groups by conventional-commit type, flags breaking
// changes, and lists the affected scopes. No gh dependency.
//
//   bun scripts/release-notes.ts                 notes since the last tag → stdout
//   bun scripts/release-notes.ts --since v0.3.0   notes from that tag → stdout
import { execFileSync } from 'node:child_process';

const args = process.argv;
const sinceIdx = args.indexOf('--since');
let since = sinceIdx !== -1 ? args[sinceIdx + 1] : null;

if (!since) {
  // The release workflow tags HEAD BEFORE generating notes, so the newest tag
  // is the release tag itself. The "since" boundary must be the tag BEFORE it,
  // otherwise range = "<release>..HEAD" is empty and the notes come out blank.
  // With only one tag (first release), there is no previous tag — show all.
  const tags = execFileSync('git', ['tag', '--sort=-version:refname'], { encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
  since = tags.length >= 2 ? tags[1] : null;
}

const range = since ? `${since}..HEAD` : '';
const raw = execFileSync('git', ['log', '--pretty=%H%n%s%n%n%b%n__END__', ...(range ? [range] : [])], { encoding: 'utf8' });
const commits = raw
  .split('__END__\n')
  .map(c => c.trim())
  .filter(Boolean)
  .map(c => {
    const [sha, subject, ...rest] = c.split('\n');
    return { sha: sha.slice(0, 7), subject: subject ?? '', body: rest.join('\n').trim() };
  });

const groups: Record<string, { label: string; items: string[] }> = {
  feat: { label: 'New', items: [] },
  fix: { label: 'Fixed', items: [] },
  refactor: { label: 'Refactored', items: [] },
  perf: { label: 'Performance', items: [] },
  docs: { label: 'Docs', items: [] },
  chore: { label: 'Housekeeping', items: [] },
  test: { label: 'Housekeeping', items: [] },
  ci: { label: 'Housekeeping', items: [] },
};

const order = ['feat', 'fix', 'refactor', 'perf', 'docs', 'chore'];

// strip signature trailers (Co-authored-by, Signed-off-by, review notes)
const TRAILER = /^(Co-authored-by|Signed-off-by|Reviewed-by|Helped-by|Reported-by|Tested-by|Acked-by):/i;

for (const commit of commits) {
  const m = /^(\w+)(?:\((.*?)\))?!?: (.*)/.exec(commit.subject);
  const type = m ? m[1] : 'chore';
  const scope = m?.[2] || '';
  const text = m ? m[3] : commit.subject;
  const breaking = Boolean(m?.[0]?.includes('!')) || /^BREAKING CHANGE:/m.test(commit.body);

  const title = text.charAt(0).toUpperCase() + text.slice(1);
  const scopeTag = scope ? ` \`${scope}\`` : '';
  const breakingTag = breaking ? ' ⚠️ **BREAKING**' : '';

  const bodyLines = commit.body
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !TRAILER.test(l) && l !== '---')
    // the release-version marker commit repeats the subject as body — drop it
    .filter(l => l !== text);

  let entry = `- ${title}${scopeTag}${breakingTag} \`${commit.sha}\``;
  if (bodyLines.length) {
    entry += '\n' + bodyLines.map(l => `  - ${l}`).join('\n');
  }
  const g = groups[type] ?? groups.chore;
  g.items.push(entry);
}

const lines: string[] = [];
for (const t of order) {
  const g = groups[t];
  if (!g.items.length) continue;
  lines.push(`## ${g.label}`);
  lines.push('');
  for (const item of g.items) lines.push(item);
  lines.push('');
}

const bumpIdx = commits.findIndex(c => /chore: release|chore: bump/.test(c.subject));
const body = commits.slice(0, bumpIdx === -1 ? commits.length : bumpIdx);
const count = body.length || commits.length;

console.log(`**${count} change${count === 1 ? '' : 's'} since ${since ?? 'the start'}.**`);
console.log('');
console.log(lines.join('\n').trimEnd());
