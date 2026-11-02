import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { autoCloseIfAuto, missionMode } from '../src/auto-close.ts';

function repo(state: object, plan = true): { dir: string; md: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-autoclose-'));
  const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  writeFileSync(join(dir, 'a.js'), 'x\n'); g('add', '-A'); g('commit', '-qm', 'i');
  const md = join(dir, '.mugiwara', 'missions', 'm1');
  mkdirSync(md, { recursive: true });
  writeFileSync(join(md, 'state.json'), JSON.stringify({ mission: 'm1', lane: 'standard', ...state }));
  if (plan) writeFileSync(join(md, 'plan.md'), '# plan\n');
  writeFileSync(join(dir, 'b.js'), 'y\n');
  return { dir, md };
}

describe('autoCloseIfAuto', () => {
  test('mode=auto closes and writes report.md', () => {
    const { dir, md } = repo({ mode: 'auto' });
    const r = autoCloseIfAuto(dir, 'm1');
    expect(r.closed).toBe(true);
    expect(existsSync(join(md, 'report.md'))).toBe(true);
  });
  test('no plan.md: still closes and the report lists it as not verified', () => {
    const { dir, md } = repo({ mode: 'auto' }, false);
    const r = autoCloseIfAuto(dir, 'm1');
    expect(r.closed).toBe(true);
    expect(r.message).toContain('plan listed as Not verified');
    expect(readFileSync(join(md, 'report.md'), 'utf8')).toContain('plan.md');
  });
  test('guided, semi and unreadable state are left alone', () => {
    for (const mode of ['guided', 'semi']) {
      const { dir, md } = repo({ mode });
      expect(autoCloseIfAuto(dir, 'm1').closed).toBe(false);
      expect(existsSync(join(md, 'report.md'))).toBe(false);
    }
    const { dir } = repo({});
    expect(missionMode(dir, 'm1')).toBe('');
    expect(autoCloseIfAuto(dir, 'm1').message).toContain('unknown');
    expect(missionMode(dir, 'nope')).toBe('');
  });
  test('an archive failure is reported, not thrown', () => {
    const { dir } = repo({ mode: 'auto', lane: 'full' });
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', '.engaged'), '{}'); // ledger active, no reviewer dispatched
    const r = autoCloseIfAuto(dir, 'm1');
    expect(r.closed).toBe(false);
    expect(r.message).toContain('automatic close failed');
  });
});

import { openFindings, healProgress } from '../src/auto-close.ts';

describe('openFindings', () => {
  const missionWith = (security: string, review = '# Review\n') => {
    const { dir, md } = repo({ mode: 'auto' });
    writeFileSync(join(md, 'security.md'), security);
    writeFileSync(join(md, 'review.md'), review);
    return dir;
  };
  test('failing verdicts in either file are open findings', () => {
    expect(openFindings(missionWith('Verdict: **FAIL** (2 open High)'), 'm1')).toContain('security.md');
    expect(openFindings(missionWith('ok', 'Verdict: CHANGES REQUESTED (1 blocker)'), 'm1')).toContain('review.md');
    expect(openFindings(missionWith('ok', 'Verdict: needs fixes'), 'm1')).toContain('review.md');
  });
  test('passing verdicts are not, including "0 blockers"', () => {
    expect(openFindings(missionWith('## Verdict: PASS (no open Critical or High)', 'Verdict: APPROVE. 0 blockers, 0 majors, 3 minors'), 'm1')).toBeNull();
    expect(openFindings(missionWith('Verdict: PASS\nfailing tests were fixed'), 'm1')).toBeNull();
  });
  test('no files: no findings', () => {
    expect(openFindings(repo({ mode: 'auto' }).dir, 'm1')).toBeNull();
  });
});

describe('healProgress', () => {
  test('cycles are re-reviews after the first; the cap comes from state', () => {
    const { dir } = repo({ mode: 'auto', heal_max_cycles: 2 });
    const row = (a: string) => JSON.stringify({ agent: a, at: new Date().toISOString(), session_id: 's', mission: 'm1' }) + '\n';
    expect(healProgress(dir, 'm1')).toEqual({ cycles: 0, max: 2 });
    writeFileSync(join(dir, '.mugiwara', 'review-dispatch.jsonl'), row('robin-reviewer') + row('jinbe-security') + row('robin-reviewer'));
    expect(healProgress(dir, 'm1')).toEqual({ cycles: 1, max: 2 });
  });
  test('default cap is 3', () => {
    expect(healProgress(repo({ mode: 'auto' }).dir, 'm1').max).toBe(3);
  });
});
