// test/release-notes.test.ts — R6: the scope-grouping logic in
// scripts/release-notes.ts is exercised without invoking real git (buildNotes
// is pure). Also proves R4: the breaking `!` marker is only honored in the
// type/scope position, not anywhere in the subject.
import { test, expect } from 'vitest';
import { buildNotes } from '../scripts/release-notes';

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
