// test/release-notes.test.ts — R6: the scope-grouping logic in
// scripts/release-notes.ts is exercised without invoking real git (buildNotes
// is pure). Also proves R4: the breaking `!` marker is only honored in the
// type/scope position, not anywhere in the subject.
import {test, expect, describe} from 'bun:test';
import { buildNotes, resolveSince, parseCommitLog, notesHeader } from '../scripts/release-notes';

test('scoped commits group into per-scope sections with type labels', () => {
  const { count, markdown } = buildNotes([
    { sha: 'aaaaaaa', subject: 'feat(opencode): add config sync', body: '' },
    { sha: 'bbbbbbb', subject: 'fix(cli): fix parser crash', body: '' },
  ]);
  expect(count).toBe(2);
  expect(markdown).toContain('## Opencode');
  expect(markdown).toContain('## Cli');
  expect(markdown).toContain('- **New** Add config sync `aaaaaaa`');
  expect(markdown).toContain('- **Fixed** Fix parser crash `bbbbbbb`');
});

test('unscoped commits fall back to type sections', () => {
  const { count, markdown } = buildNotes([
    { sha: 'ccccccc', subject: 'feat: add widget', body: '' },
  ]);
  expect(count).toBe(1);
  expect(markdown).toContain('## New');
  // R5a: fallback bullets live under the type heading, so no redundant label
  expect(markdown).toContain('- Add widget `ccccccc`');
  expect(markdown).not.toContain('- **New** Add widget');
});

test('breaking marker only honored in type/scope position (R4 regression proof)', () => {
  const breaking = buildNotes([
    { sha: 'ddddddd', subject: 'fix(cli)!: drop old flag', body: '' },
  ]);
  expect(breaking.markdown).toContain('⚠️ **BREAKING**');

  // a bare `!` anywhere in the subject must NOT be flagged breaking
  const notBreaking = buildNotes([
    { sha: 'eeeeeee', subject: 'fix: handle a! in parser', body: '' },
  ]);
  expect(notBreaking.markdown).not.toContain('⚠️');
  // and the subject text itself is still parsed intact (unscoped → no label, R5a)
  expect(notBreaking.markdown).toContain('- Handle a! in parser `eeeeeee`');
});

// A commit body is hard-wrapped prose. Rendering one bullet per physical line
// turned every paragraph into a column of fragments, which is exactly how the
// release notes read until this was fixed.
test('a hard-wrapped paragraph rejoins into one bullet, not one per line', () => {
  const { markdown } = buildNotes([
    {
      sha: 'abcdef0',
      subject: 'fix(cost): close the dispatch leak',
      body: 'A dispatched worker costs ~132k tokens\nagainst ~5k for the same work inline.\nThree places spent it without a reason.\n\nThe posture matrix now gates on lane.',
    },
  ]);
  expect(markdown).toContain(
    '  - A dispatched worker costs ~132k tokens against ~5k for the same work inline. Three places spent it without a reason.',
  );
  expect(markdown).toContain('  - The posture matrix now gates on lane.');
  expect(markdown).not.toContain('  - against ~5k for the same work inline.');
});

test('a list the author actually wrote keeps one bullet per item', () => {
  const { markdown } = buildNotes([
    {
      sha: 'abcdef1',
      subject: 'feat(cli): add flags',
      body: '- adds --json\n- adds --ledger',
    },
  ]);
  expect(markdown).toContain('  - adds --json');
  expect(markdown).toContain('  - adds --ledger');
});

test('signature trailers are stripped from the output', () => {
  const { count, markdown } = buildNotes([
    {
      sha: 'fffffff',
      subject: 'feat: add thing',
      body: 'Adds the thing.\n\nCo-authored-by: Alice <alice@example.com>\nSigned-off-by: Alice <alice@example.com>',
    },
  ]);
  expect(count).toBe(1);
  // unscoped → fallback section, no redundant label (R5a)
  expect(markdown).toContain('- Add thing `fffffff`');
  expect(markdown).toContain('  - Adds the thing.');
  expect(markdown).not.toContain('Co-authored-by');
  expect(markdown).not.toContain('Signed-off-by');
});

test('scoped commit does not duplicate into a type section', () => {
  const { markdown } = buildNotes([
    { sha: 'aaaaaaa', subject: 'feat(opencode): add config sync', body: '' },
  ]);
  expect(markdown).toContain('## Opencode');
  expect(markdown).not.toContain('## New');
});

test('type-fallback section bullets carry no redundant type label (R5a)', () => {
  const { markdown } = buildNotes([
    { sha: '1111111', subject: 'feat: add widget', body: '' },
  ]);
  expect(markdown).toContain('## New');
  expect(markdown).toContain('- Add widget `1111111`');
  expect(markdown).not.toContain('**New**');
});

test('scoped section bullets keep the type label (R5a)', () => {
  const { markdown } = buildNotes([
    { sha: '2222222', subject: 'feat(opencode): add sync', body: '' },
  ]);
  expect(markdown).toContain('## Opencode');
  expect(markdown).toContain('- **New** Add sync `2222222`');
});

test('type-fallback heading colliding with a scoped heading merges (R5b)', () => {
  const { markdown } = buildNotes([
    // scope `docs` title-cases to `Docs`, same as the `docs:` type-fallback heading
    { sha: '3333333', subject: 'docs(docs): document config', body: '' },
    { sha: '4444444', subject: 'docs: update readme', body: '' },
  ]);
  // exactly ONE `## Docs` heading, not two
  expect(markdown.match(/^## Docs$/gm)).toHaveLength(1);
  // both bullets live under it: scoped bullet keeps its label, fallback does not
  const docsSection = markdown.split(/^## /m).find(s => s.startsWith('Docs'))!;
  expect(docsSection).toContain('- **Docs** Document config `3333333`');
  expect(docsSection).toContain('- Update readme `4444444`');
});

// The boundary bug this guards: the release workflow used to tag HEAD and then
// ask for notes, so the newest tag was the release itself and the boundary had
// to be tags[1]. Generating notes BEFORE tagging inverts that — tags[0] is the
// previous release and is the boundary. Getting it backwards silently drops a
// whole release from the notes and from the tag message that now carries them.
describe('resolveSince', () => {
  const tags = ['v1.0.4', 'v1.0.3', 'v1.0.2'];

  test('--since always wins', () => {
    expect(resolveSince(tags, 'v1.0.2', true)).toBe('v1.0.2');
    expect(resolveSince(tags, 'v1.0.2', false)).toBe('v1.0.2');
  });

  test('HEAD already tagged: boundary is the tag before this release', () => {
    expect(resolveSince(tags, null, true)).toBe('v1.0.3');
  });

  test('HEAD not yet tagged: boundary is the newest tag', () => {
    expect(resolveSince(tags, null, false)).toBe('v1.0.4');
  });

  test('first release has no boundary', () => {
    expect(resolveSince(['v1.0.0'], null, true)).toBeNull();
    expect(resolveSince([], null, false)).toBeNull();
  });
});

describe('parseCommitLog', () => {
  test('splits records, shortens the sha, keeps the body', () => {
    const raw = 'abcdef0123456789\nfix: one\n\nbody line\n__END__\nfedcba9876543210\nfeat: two\n\n\n__END__\n';
    const commits = parseCommitLog(raw);
    expect(commits.length).toBe(2);
    expect(commits[0]).toEqual({ sha: 'abcdef0', subject: 'fix: one', body: 'body line' });
    expect(commits[1].subject).toBe('feat: two');
    expect(commits[1].body).toBe('');
  });

  test('empty log yields no commits', () => {
    expect(parseCommitLog('')).toEqual([]);
  });
});

describe('notesHeader', () => {
  test('pluralises and names the boundary', () => {
    expect(notesHeader(1, 'v1.0.3')).toBe('**1 change since v1.0.3**');
    expect(notesHeader(4, 'v1.0.3')).toBe('**4 changes since v1.0.3**');
    expect(notesHeader(2, null)).toBe('**2 changes since the start.**');
  });
});
