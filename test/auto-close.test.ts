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
