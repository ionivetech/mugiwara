import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReport } from '../src/report-fold.ts';

const base = {
  mission: 'demo', seed: '', seedIsClosure: false, files: [], changeLine: '', cost: '', routing: '', tooling: [], hasState: false,
};

describe('buildReport (archive fold, reader-first)', () => {
  it('seed with its own sections keeps them, puts verdict first, moves Gates to the appendix', () => {
    const seed = [
      '# Invite flow',
      '2026-09-03 · Jane · branch `x` · lane **lean** · mode guided',
      'Adds invitation acceptance.',
      '',
      '## Verdict',
      '**Ready for review.** 1 finding deferred.',
      '',
      '## What changed',
      '3 files.',
      '',
      '## Gates',
      '| Checkpoint (Flow 4) | PASS |',
      '',
      '## Decisions',
      '- chose A',
      '',
      '## Not verified',
      '- e2e',
      '',
      '## Cost',
      'Used **10** tokens.',
      '',
      '## Review order',
      '1. a.ts',
    ].join('\n');
    const r = buildReport({ ...base, seed, hasState: true });
    expect(r.match(/^# /gm)).toHaveLength(1);
    expect(r).not.toContain('· lane');
    expect(r.indexOf('Adds invitation acceptance.')).toBeLessThan(r.indexOf('## Verdict'));
    expect(r).toContain('**Ready for review.** 1 finding deferred.');
    expect(r.indexOf('## What changed')).toBeGreaterThan(r.indexOf('## Verdict'));
    // Flow numbers only after the Evidence heading
    const body = r.slice(0, r.indexOf('## Evidence'));
    expect(body).not.toMatch(/Flow \d/);
    expect(r.slice(r.indexOf('## Evidence'))).toContain('### Gates');
    expect(r).toContain('## Where to start reviewing'.replace('Where to start reviewing', 'Review order'));
    expect(r).not.toContain('No decisions recorded');
    expect(r).not.toContain('No list of unverified items');
  });

  it('topic sections: stage heading dropped, inner headings demoted, fences untouched, tooling lines lifted', () => {
    const r = buildReport({
      ...base,
      hasState: true,
      files: [
        { name: '03-quality.md', body: '# Flow 5 — Sanji (quality)\n\nlint clean\n\n## Details\n\n```\n# not a heading\n```\nContext footprint: 618 chars (no budget configured)\n' },
        { name: '05-quality.md', body: 'second quality file' },
        { name: '01-execution.md', body: '## Flow 3 — Zoro\n\nT1 done' },
        { name: 'weird-notes.md', body: 'misc' },
        { name: 'empty.md', body: '# only a heading' },
      ],
      tooling: ['Lane `full`.'],
    });
    expect(r).not.toContain('Flow 5 — Sanji (quality)\n\nlint');
    expect(r.indexOf('## Implementation')).toBeLessThan(r.indexOf('## Quality'));
    expect(r).toContain('### Details');
    expect(r).toContain('```\n# not a heading\n```');
    expect(r.match(/^## Quality$/gm)).toHaveLength(1);
    expect(r).toContain('second quality file');
    expect(r).toContain('## Weird notes');
    expect(r).not.toContain('## Empty');
    expect(r).toContain('<summary>Tooling log</summary>');
    expect(r).toContain('Context footprint: 618 chars');
    expect(r.indexOf('Context footprint')).toBeGreaterThan(r.indexOf('<summary>'));
    expect(r).toContain('| Quality | `03-quality.md` | 5 | Sanji |');
    expect(r).toContain('No decisions recorded.');
    expect(r).toContain('No list of unverified items was recorded.');
  });

  it('decisions: cost-governor block goes to the tooling log; blockers get their own section', () => {
    const r = buildReport({
      ...base,
      files: [
        { name: 'decisions.md', body: '- chose B because X\n\n## Cost governor decisions\n\n- 2026-01-01T00:00:00Z — luffy: reuse — reason: r\n' },
        { name: 'blockers.md', body: 'none open' },
      ],
    });
    const dec = r.slice(r.indexOf('## Decisions'), r.indexOf('## Blockers'));
    expect(dec).toContain('chose B because X');
    expect(dec).not.toContain('Cost governor decisions');
    expect(r.slice(r.indexOf('<details>'))).toContain('Cost governor decisions');
  });

  it('closure seed is not folded twice; an existing report keeps the closure as its own section', () => {
    const closure = { name: '06-closure.md', body: 'closure text' };
    const seeded = buildReport({ ...base, seed: closure.body, seedIsClosure: true, files: [closure] });
    expect(seeded.match(/closure text/g)).toHaveLength(1);
    expect(seeded).toContain('| Summary | `06-closure.md` | 9 | Luffy |');
    const kept = buildReport({ ...base, seed: '# R\n\nintro', files: [closure] });
    expect(kept).toContain('## Closure\n\nclosure text');
  });

  it('no seed, no state: default title, verdict, cost and routing passthrough', () => {
    const r = buildReport({ ...base, cost: '## Cost\n\nUsed **1** of 2 tokens.', routing: '## Where to start reviewing\n\n1. a.ts', changeLine: '1 files changed (+1 / -0) on branch `b`, closed 2026-01-01.' });
    expect(r).toContain('# Mission: demo');
    expect(r).toContain('1 files changed');
    expect(r).toContain('Not enough evidence.');
    expect(r).toContain('Used **1** of 2 tokens.');
    expect(r).toContain('## Where to start reviewing');
    expect(r).not.toContain('<details>');
  });
});

describe('README report sample', () => {
  it('is cut from test/fixtures/report-sample.md: every non-marker line appears there, in order', () => {
    const readme = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8');
    const fixture = readFileSync(join(import.meta.dirname, 'fixtures', 'report-sample.md'), 'utf8');
    const shown = readme.match(/```markdown\n(# Mission:[\s\S]*?)```/)![1].split('\n').filter((l) => l.trim() && l !== '[...]');
    expect(shown.length).toBeGreaterThan(8);
    const lines = fixture.split('\n');
    let at = 0;
    for (const l of shown) {
      const i = lines.indexOf(l, at);
      expect(i).toBeGreaterThanOrEqual(at);
      at = i + 1;
    }
    expect(fixture).toContain('## Not verified');
    expect(fixture).toContain('Lane `standard`');
    expect(fixture).not.toMatch(/@|\/Users\/|\/home\//);
  });
});

describe('verdict is never claimed without evidence', () => {
  it('a failed gate gives Needs fixes, a passed one Ready for review, none Not enough evidence', () => {
    const file = (name: string, body: string) => ({ name, body });
    const failed = buildReport({ ...base, files: [file('04-gates.md', 'Verdict: FAIL\nRepo gate NO-GO: 2 tests fail.')] } as any);
    expect(failed).toContain('**Needs fixes.**');
    expect(failed).not.toContain('Ready for review');
    const passed = buildReport({ ...base, files: [file('04-gates.md', 'Coverage gate PASS, build passed.')] } as any);
    expect(passed).toContain('**Ready for review.** The recorded checks passed.');
  });
});

describe('buildReport independence label (ledger-derived)', () => {
  const files = [
    { name: 'review.md', body: '# Review\n\nIndependent review by a fresh agent, trust me.\n' },
    { name: 'security.md', body: '# Security\n\nNo findings.\n' },
  ];
  const INDEP = (n: string) => `*Checked independently: ${n} ran as a separate agent with fresh context.*`;
  const INLINE = '*Checked inline: the same conversation and model that wrote the change.*';

  it('labels each section from the ledger only, first line, model claim untouched', () => {
    const r = buildReport({ ...base, files, dispatched: ['robin-reviewer'] });
    expect(r).toContain(`## Review\n\n${INDEP('Robin')}\n\nIndependent review by a fresh agent, trust me.`);
    expect(r).toContain(`## Security\n\n${INLINE}\n\nNo findings.`);
    expect(r).toContain('Checked inline" means');
  });
  it('model-written independence claim never produces the machine label', () => {
    const r = buildReport({ ...base, files });
    expect(r).not.toContain('Checked independently: ');
    expect(r).toContain(`## Review\n\n${INLINE}\n\nIndependent review`);
  });
  it('jinbe dispatch labels Security independent', () => {
    const r = buildReport({ ...base, files, dispatched: ['jinbe-security'] });
    expect(r).toContain(`## Security\n\n${INDEP('Jinbe')}`);
  });
  it('no review.md or security.md: no label and no appendix note', () => {
    const r = buildReport({ ...base, files: [{ name: 'spec.md', body: '# Spec\n\nx\n' }], dispatched: ['robin-reviewer'] });
    expect(r).not.toContain('Checked ');
  });
});
