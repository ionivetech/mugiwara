import { describe, it, expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { checkWritingFile, stripFences, WRITING_CAPS } from '../src/check-writing.ts';

const CLEAN = [
  '# Lanes',
  '',
  'A typo and an auth migration need different process. Lanes size it.',
  '',
  '| Change | Lane |',
  '|---|---|',
  '| Typo | Direct |',
  '',
  'Run the lane script and read the reason it prints.',
].join('\n');

describe('checkWritingFile', () => {
  it('clean page passes with zero errors', () => {
    expect(checkWritingFile('docs/concepts/lanes.md', CLEAN)).toEqual([]);
  });

  it('page over cap +15% fails naming file and counts', () => {
    const text = `${CLEAN}\n${'word '.repeat(700)}`;
    const errs = checkWritingFile('docs/concepts/lanes.md', text);
    expect(errs.length).toBe(1);
    expect(errs[0]).toContain('docs/concepts/lanes.md');
    expect(errs[0]).toContain('exceeds cap 600');
  });

  it('two tables over 12 rows fail, one passes', () => {
    const big = Array.from({ length: 13 }, (_, i) => `| a${i} | b |`).join('\n');
    const two = `${CLEAN}\n\n${big}\n\nbetween\n\n${big}\n`;
    expect(checkWritingFile('docs/concepts/lanes.md', two).some((e) => e.includes('tables over 12 rows'))).toBe(true);
    const one = `${CLEAN}\n\n${big}\n`;
    expect(checkWritingFile('docs/concepts/lanes.md', one)).toEqual([]);
  });

  it('banned word "simply" fails, "simplify" does not (word boundary)', () => {
    const bad = checkWritingFile('docs/x.md', `${CLEAN}\n\nSimply run it.\n`);
    expect(bad.some((e) => e.includes('banned word "simply"'))).toBe(true);
    expect(checkWritingFile('docs/x.md', `${CLEAN}\n\nThis will simplify setup.\n`)).toEqual([]);
  });

  it('three em-dashes fail, two pass', () => {
    expect(checkWritingFile('docs/x.md', `${CLEAN}\n\na — b — c — d\n`).some((e) => e.includes('em-dashes'))).toBe(true);
    expect(checkWritingFile('docs/x.md', `${CLEAN}\n\na — b — c\n`)).toEqual([]);
  });

  it('definition opening fails, problem opening passes', () => {
    const def = ['# Lanes', '', 'A lane is a process size.'].join('\n');
    expect(checkWritingFile('docs/x.md', def).some((e) => e.includes('opens with a definition'))).toBe(true);
    expect(checkWritingFile('docs/x.md', CLEAN)).toEqual([]);
  });

  it('fenced output is exempt from prose checks', () => {
    const fenced = `${CLEAN}\n\n\`\`\`text\nsimply just robust — output\n\`\`\`\n`;
    expect(checkWritingFile('docs/x.md', fenced)).toEqual([]);
  });

  it('caps cover every numeric audit target plus README', () => {
    expect(WRITING_CAPS['README.md']).toBe(1800);
    expect(WRITING_CAPS['docs/concepts/features.md']).toBe(2400);
    expect(Object.keys(WRITING_CAPS).length).toBeGreaterThan(40);
  });

  it('stripFences removes fenced spans only', () => {
    expect(stripFences('a\n```\nb\n```\nc')).toBe('a\nc');
  });

  it('--check-writing passes on the current tree', () => {
    const out = execFileSync('bun', ['scripts/validate-content.ts', '--check-writing'], {
      cwd: join(import.meta.dirname, '..'),
      encoding: 'utf8',
    });
    expect(out).toContain('writing rules hold');
  });
});
