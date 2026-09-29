// test/enforcement-check.test.ts — the two checks that outgrew validate-content.ts.
import { describe, it, test, expect } from 'bun:test';
import { checkArtifactPaths, checkMechanismCells, checkMetricCitations, checkWorkflowGateDrift, checkWritingCapTargets, gateScriptPaths } from '../src/enforcement-check.ts';

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

// These three numbers rot silently: --check-readme-metrics covers README.md
// only, so the same figures went stale in reference/enforcement.md, twice in
// features.md, and in concepts/skills.md, all behind a green gate.
describe('checkMetricCitations', () => {
  const M = { retrieval_rank1: 95.6, retrieval_probes: 272, pointers_total: 166 };

  it('passes when the cited figures match the measurement', () => {
    const text = 'measured at 95.6% rank-1 over 272 retrieval probes with 166 pointers resolving';
    expect(checkMetricCitations([{ path: 'd.md', text }], M)).toEqual([]);
  });

  it('flags each stale figure separately', () => {
    const text = 'measured at 95.4% rank-1 over 221 probes with 342 pointers';
    const errs = checkMetricCitations([{ path: 'd.md', text }], M);
    expect(errs.length).toBe(3);
    expect(errs.join(' ')).toContain('95.4');
    expect(errs.join(' ')).toContain('221');
    expect(errs.join(' ')).toContain('342');
  });

  it('reads comma-grouped figures', () => {
    expect(checkMetricCitations([{ path: 'd.md', text: '1,234 pointers' }], M).length).toBe(1);
    expect(checkMetricCitations([{ path: 'd.md', text: '166 pointers' }], M)).toEqual([]);
  });

  // A story about a past regression is not a claim about the present.
  it('leaves historical prose alone', () => {
    const text = 'the v0.5.0 trim dropped rank-1 to 33% with nobody noticing.';
    expect(checkMetricCitations([{ path: 'd.md', text }], M)).toEqual([]);
  });
});

// ci.yml states the rule in prose and it has now failed three times: the
// original five dead capabilities, then release-manual.yml hand-listing a
// fraction of the gate, then that same line combining --check-sync (which
// exits early) with two checks it therefore never ran.
describe('checkWorkflowGateDrift', () => {
  const GATE = ['scripts/validate-content.ts', 'scripts/lane-base.ts', 'scripts/conformance.ts'];

  test('a workflow that only runs `bun run gate` is clean', () => {
    const wf = [{ path: 'ci.yml', text: 'steps:\n  - run: bun run gate\n' }];
    expect(checkWorkflowGateDrift(wf, GATE)).toEqual([]);
  });

  test('a workflow re-running a gate script is flagged and told why', () => {
    const wf = [{ path: 'release.yml', text: '  - run: bun scripts/validate-content.ts --check-docs\n' }];
    const errs = checkWorkflowGateDrift(wf, GATE);
    expect(errs.length).toBe(1);
    expect(errs[0]).toContain('release.yml');
    expect(errs[0]).toContain('One gate, one definition');
  });

  test('each re-run script is reported separately', () => {
    const wf = [{ path: 'a.yml', text: 'bun scripts/validate-content.ts\nbun scripts/lane-base.ts\n' }];
    expect(checkWorkflowGateDrift(wf, GATE).length).toBe(2);
  });

  test('an exempt script may be run on its own', () => {
    const wf = [{ path: 'ci.yml', text: 'bun scripts/gate-selftest.ts\n' }];
    expect(checkWorkflowGateDrift(wf, [...GATE, 'scripts/gate-selftest.ts'], ['scripts/gate-selftest.ts'])).toEqual([]);
  });
});

describe('gateScriptPaths', () => {
  test('extracts each script path once, in the gate command', () => {
    const cmd = 'bun run typecheck && bun scripts/a.ts --x && bun scripts/b.ts && bun scripts/a.ts --y';
    expect(gateScriptPaths(cmd).sort()).toEqual(['scripts/a.ts', 'scripts/b.ts']);
  });

  test('a gate with no scripts yields nothing', () => {
    expect(gateScriptPaths('bun run typecheck && bun run build')).toEqual([]);
  });
});
