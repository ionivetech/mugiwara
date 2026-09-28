// test/enforcement-check.test.ts — the two checks that outgrew validate-content.ts.
import { describe, it, expect } from 'bun:test';
import { checkArtifactPaths, checkMechanismCells, checkWritingCapTargets } from '../src/enforcement-check.ts';

const ROOT = new URL('..', import.meta.url).pathname;

describe('checkMechanismCells', () => {
  it('accepts a mechanism that names an existing file', () => {
    const md = '| Concept | Rule | Mechanism |\n| INV-triage | x | hooks/pipeline-guard.js |\n';
    expect(checkMechanismCells(md, ROOT)).toEqual([]);
  });

  it('accepts a row that admits it is prose', () => {
    const md = '| INV-banner | x | prose (aspirational) |\n';
    expect(checkMechanismCells(md, ROOT)).toEqual([]);
  });

  // The defect this exists for: a cell repeating the concept's own id reads
  // like a mechanism and names nothing. The registry's own anchor check could
  // never catch it, because the anchor IS that id in the same row.
  it('rejects a cell that just repeats the concept id', () => {
    const errs = checkMechanismCells('| INV-banner | x | INV-banner |\n', ROOT);
    expect(errs.length).toBe(1);
    expect(errs[0]).toContain('INV-banner');
    expect(errs[0]).toContain('prose (aspirational)');
  });

  it('rejects a path that looks right but does not exist', () => {
    expect(checkMechanismCells('| INV-x | r | hooks/not-real.js |\n', ROOT).length).toBe(1);
  });

  it('reads concept ids containing digits', () => {
    expect(checkMechanismCells('| INV-a11y | r | INV-a11y |\n', ROOT).length).toBe(1);
    expect(checkMechanismCells('| INV-a11y | r | prose (aspirational) |\n', ROOT)).toEqual([]);
  });

  it('ignores non-concept rows and separators', () => {
    expect(checkMechanismCells('| Concept | Rule | Mechanism |\n|---|---|---|\ntext\n', ROOT)).toEqual([]);
  });
});

describe('checkWritingCapTargets', () => {
  it('passes when every capped file exists', () => {
    expect(checkWritingCapTargets({ 'README.md': 1800 }, ROOT)).toEqual([]);
  });

  // A cap for a missing file is skipped in silence — five had gone stale.
  it('flags a cap whose file is gone', () => {
    const errs = checkWritingCapTargets({ 'docs/ghost.md': 100 }, ROOT);
    expect(errs.length).toBe(1);
    expect(errs[0]).toContain('docs/ghost.md');
  });

  it('flags each missing file once', () => {
    expect(checkWritingCapTargets({ 'a.md': 1, 'b.md': 2, 'README.md': 3 }, ROOT).length).toBe(2);
  });
});

describe('checkArtifactPaths', () => {
  const FLOWS = ['01-execution.md', '02-audit.md', '03-quality.md'] as const;

  it('accepts flow files the layout defines', () => {
    expect(checkArtifactPaths([{ path: 'a.md', text: 'see flows/01-execution.md and flows/03-quality.md' }], FLOWS)).toEqual([]);
  });

  // Defect A verbatim: results/ and logs/ were the workspace before
  // missions/<mission>/ existed. They are prose, not links, so
  // check-doc-links could never see them.
  it('flags a directory the layout replaced', () => {
    const errs = checkArtifactPaths([{ path: 'a.md', text: 'evidence → results/05-quality.md' }], FLOWS);
    expect(errs.length).toBe(1);
    expect(errs[0]).toContain('results/');
  });

  it('flags a flow filename that is not in the layout', () => {
    const errs = checkArtifactPaths([{ path: 'a.md', text: 'overwrite of flows/02-execution.md' }], FLOWS);
    expect(errs.length).toBe(1);
    expect(errs[0]).toContain('02-execution.md');
  });

  it('reports every offending file, not just the first', () => {
    const errs = checkArtifactPaths(
      [{ path: 'a.md', text: 'results/x' }, { path: 'b.md', text: 'flows/99-ghost.md' }],
      FLOWS,
    );
    expect(errs.length).toBe(2);
  });
});
