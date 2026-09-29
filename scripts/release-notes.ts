#!/usr/bin/env bun
// scripts/release-notes.ts — generates a detailed GitHub Release description
// from git history between the previous tag and HEAD. Pulls the full commit
// message (subject + body), groups by conventional-commit scope (feature area)
// in first-appearance order, falls back to type for unscoped commits, flags
// breaking changes, and lists the affected scopes. No gh dependency.
//
//   bun scripts/release-notes.ts                 notes since the last tag → stdout
//   bun scripts/release-notes.ts --since v0.3.0   notes from that tag → stdout
import { execFileSync } from 'node:child_process';

// human label for a conventional-commit type: section fallback + per-bullet tag
const TYPE_LABEL: Record<string, string> = {
  feat: 'New',
  fix: 'Fixed',
  refactor: 'Refactored',
  perf: 'Performance',
  docs: 'Docs',
  chore: 'Housekeeping',
  test: 'Housekeeping',
  ci: 'Housekeeping',
};

const TYPE_ORDER = ['feat', 'fix', 'refactor', 'perf', 'docs', 'chore'];

// strip signature trailers (Co-authored-by, Signed-off-by, review notes)
const TRAILER = /^(Co-authored-by|Signed-off-by|Reviewed-by|Helped-by|Reported-by|Tested-by|Acked-by):/i;

// capitalize the first letter of each word; split on non-alphanumerics
// (opencode → Opencode, release-notes → Release Notes)
const titleCase = (s: string) =>
  s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export interface ReleaseCommit {
  sha: string;
  subject: string;
  body: string;
}

/**
 * Group parsed commits into per-scope sections (first-appearance order) with a
 * type-fallback for unscoped commits. Returns the rendered markdown body and
 * the change count. Pure — no git access, deterministic. Exported so tests
 * exercise the grouping without invoking git.
 */
export function buildNotes(commits: ReleaseCommit[]): { count: number; markdown: string } {
  // scoped (feature-area) sections, keyed by lowercased scope, first-appearance order
  const scoped = new Map<string, { label: string; items: string[] }>();
  const scopedOrder: string[] = [];
  // unscoped fallback sections by type, rendered in canonical type order
  const byType = new Map<string, { label: string; items: string[] }>();
  for (const t of TYPE_ORDER) byType.set(t, { label: TYPE_LABEL[t], items: [] });

  for (const commit of commits) {
    const m = /^(\w+)(?:\((.*?)\))?(!)?: (.*)/.exec(commit.subject);
    const type = m ? m[1] : 'chore';
    const scope = m?.[2] || '';
    const text = m ? m[4] : commit.subject;
    // the conventional-commits `!` breaking marker sits between scope and
    // colon; capture it positionally so `fix: handle a! in parser` is NOT
    // flagged breaking (a bare `!` anywhere in the subject would be)
    const breaking = m?.[3] === '!' || /^BREAKING CHANGE:/m.test(commit.body);

    const title = text.charAt(0).toUpperCase() + text.slice(1);
    const breakingTag = breaking ? ' ⚠️ **BREAKING**' : '';

    // A commit body is prose that was hard-wrapped at ~72 columns. Rendering
    // one bullet per physical line shreds every paragraph into fragments —
    // which is what shipped in the release notes until this was fixed. Split
    // on blank lines to recover the author's paragraphs, then rejoin each
    // one. Lines the author really did write as a list keep their shape.
    const LIST_ITEM = /^\s*(?:[-*+]\s|\d+[.)]\s)/;
    const bodyBlocks = commit.body
      .split(/\r?\n\s*\r?\n/)
      .map(block =>
        block
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(l => l && !TRAILER.test(l) && l !== '---')
          // the release-version marker commit repeats the subject as body — drop it
          .filter(l => l !== text),
      )
      .filter(lines => lines.length)
      .map(lines =>
        lines.some(l => LIST_ITEM.test(l))
          ? lines.map(l => l.replace(LIST_ITEM, ''))       // author's own list
          : [lines.join(' ')],                             // reflowed paragraph
      );

    const typeLabel = TYPE_LABEL[type] ?? 'Housekeeping';
    const base = `${title}${breakingTag} \`${commit.sha}\``;
    const bodyBlock = bodyBlocks.length
      ? '\n' + bodyBlocks.flat().map(l => `  - ${l}`).join('\n')
      : '';

    if (scope) {
      const key = scope.toLowerCase();
      let g = scoped.get(key);
      if (!g) {
        g = { label: titleCase(scope), items: [] };
        scoped.set(key, g);
        scopedOrder.push(key);
      }
      // scoped (feature-area) sections: the type label adds information because
      // the heading names the area, not the type
      g.items.push(`- **${typeLabel}** ${base}${bodyBlock}`);
    } else {
      // type-fallback sections: the heading already names the type, so a
      // per-bullet label would be redundant (R5a)
      (byType.get(type) ?? byType.get('chore')!).items.push(`- ${base}${bodyBlock}`);
    }
  }

  // Render into a heading-keyed map (case-insensitive) so a type-fallback
  // heading that collides with an earlier scoped heading merges into it
  // instead of emitting a duplicate section (R5b).
  const sections = new Map<string, { heading: string; items: string[] }>();
  const order: string[] = [];
  const addSection = (heading: string, items: string[]) => {
    const key = heading.toLowerCase();
    let s = sections.get(key);
    if (!s) {
      s = { heading, items: [] };
      sections.set(key, s);
      order.push(key);
    }
    s.items.push(...items);
  };

  // scoped (feature-area) sections first, in order of first appearance
  for (const key of scopedOrder) addSection(scoped.get(key)!.label, scoped.get(key)!.items);
  // then unscoped type-fallback sections, canonical type order
  for (const t of TYPE_ORDER) {
    const g = byType.get(t)!;
    if (g.items.length) addSection(g.label, g.items);
  }

  const lines: string[] = [];
  for (const key of order) {
    const s = sections.get(key)!;
    lines.push(`## ${s.heading}`);
    lines.push('');
    for (const item of s.items) lines.push(item);
    lines.push('');
  }

  const bumpIdx = commits.findIndex(c => /chore: release|chore: bump/.test(c.subject));
  const body = commits.slice(0, bumpIdx === -1 ? commits.length : bumpIdx);
  const count = body.length || commits.length;

  return { count, markdown: lines.join('\n').trimEnd() };
}

/**
 * Resolve the `since` boundary. `--since` always wins. Without it the answer
 * depends on whether the release tag already exists:
 *
 *  - `taggedHead: true`  — the caller tagged HEAD before asking for notes, so
 *    tags[0] IS this release. The boundary is the one before it, tags[1];
 *    otherwise the range `<release>..HEAD` is empty and the notes come out blank.
 *  - `taggedHead: false` — the tag does not exist yet, so tags[0] is the
 *    PREVIOUS release and is itself the boundary.
 *
 * Getting this backwards silently drops a whole release from the notes, which
 * is why it is a function with tests rather than a branch inside the CLI block.
 * First release, no previous tag: null — show everything.
 */
export function resolveSince(tags: string[], explicit: string | null, taggedHead: boolean): string | null {
  if (explicit) return explicit;
  if (taggedHead) return tags.length >= 2 ? tags[1] : null;
  return tags.length >= 1 ? tags[0] : null;
}

/** Parse `git log --pretty=%H%n%s%n%n%b%n__END__` output into commits. Pure. */
export function parseCommitLog(raw: string): ReleaseCommit[] {
  return raw
    .split('__END__\n')
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => {
      const [sha, subject, ...rest] = c.split('\n');
      return { sha: sha.slice(0, 7), subject: subject ?? '', body: rest.join('\n').trim() };
    });
}

/** The header line above the sections. Pure so its pluralisation is tested. */
export function notesHeader(count: number, since: string | null): string {
  return `**${count} change${count === 1 ? '' : 's'} since ${since ?? 'the start.'}**`;
}

// Guard the CLI path so importing the helpers above in tests does not run git.
if (import.meta.main) {
  const args = process.argv;
  const sinceIdx = args.indexOf('--since');
  const explicit = sinceIdx !== -1 ? args[sinceIdx + 1] : null;
  const tags = execFileSync('git', ['tag', '--sort=-version:refname'], { encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
  const since = resolveSince(tags, explicit, args.includes('--tagged-head'));
  const range = since ? `${since}..HEAD` : '';
  const raw = execFileSync('git', ['log', '--pretty=%H%n%s%n%n%b%n__END__', ...(range ? [range] : [])], { encoding: 'utf8' });
  const { count, markdown } = buildNotes(parseCommitLog(raw));
  console.log(notesHeader(count, since));
  console.log('');
  console.log(markdown);
}
