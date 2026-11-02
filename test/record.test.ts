import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cap } from './helpers/cli-capture.ts';
import { recordStage, changedFiles } from '../src/record.ts';
import { riskPathsIn } from '../src/risk.ts';

function repo(lane = 'standard'): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-record-'));
  const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  writeFileSync(join(dir, 'a.js'), 'x\n'); g('add', '-A'); g('commit', '-qm', 'init');
  const m = join(dir, '.mugiwara', 'missions', 'm1');
  mkdirSync(m, { recursive: true });
  writeFileSync(join(m, 'state.json'), JSON.stringify({ mission: 'm1', lane, flow: 9, mode: 'auto' }));
  writeFileSync(join(m, 'plan.md'), '# plan\n');
  return dir;
}
const flowFile = (dir: string, n: string) => join(dir, '.mugiwara', 'missions', 'm1', 'flows', n);

describe('mugiwara record', () => {
  test('execution lists the real changed files; no diff is refused', async () => {
    const dir = repo();
    const none = await cap(['record', 'execution', 'm1', '--project', dir]);
    expect(none.code).toBe(1);
    writeFileSync(join(dir, 'b.js'), 'y\n');
    const ok = await cap(['record', 'execution', 'm1', '--project', dir]);
    expect(ok.code).toBe(0);
    expect(readFileSync(flowFile(dir, '01-execution.md'), 'utf8')).toContain('- b.js');
    expect(changedFiles(dir)).toEqual(['b.js']);
  });
  test('gates runs the command and records the true exit code', () => {
    const dir = repo();
    const pass = recordStage(dir, 'm1', 'gates', { cmd: 'echo hello' });
    expect('path' in pass && readFileSync(pass.path, 'utf8')).toContain('Exit code: 0 (pass)');
    const fail = recordStage(dir, 'm1', 'gates', { cmd: 'exit 3' });
    expect('path' in fail && readFileSync(fail.path, 'utf8')).toContain('Exit code: 3 (fail)');
    expect(recordStage(dir, 'm1', 'gates')).toHaveProperty('error');
  });
  test('quality and healing need a note; audit and closure record facts', () => {
    const dir = repo();
    expect(recordStage(dir, 'm1', 'quality')).toHaveProperty('error');
    expect(recordStage(dir, 'm1', 'quality', { note: 'checked edge cases' })).toHaveProperty('path');
    mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
    writeFileSync(join(dir, 'src', 'auth', 'x.js'), 'z\n');
    const a = recordStage(dir, 'm1', 'audit', {});
    expect('path' in a && readFileSync(a.path, 'utf8')).toContain('src/auth/x.js');
    const c = recordStage(dir, 'm1', 'closure', {});
    expect('path' in c && readFileSync(c.path, 'utf8')).toContain('robin-reviewer: not dispatched');
  });
  test('unknown mission, bad stage and a missing stage exit non-zero', async () => {
    const dir = repo();
    expect((await cap(['record', 'execution', 'zzz', '--project', dir])).code).toBe(1);
    expect((await cap(['record', 'bogus', '--project', dir])).code).toBe(2);
    expect((await cap(['record', '--project', dir])).code).toBe(2);
  });
  test('a single mission is picked automatically; several exit 2', async () => {
    const dir = repo();
    writeFileSync(join(dir, 'b.js'), 'y\n');
    expect((await cap(['record', 'execution', '--project', dir])).code).toBe(0);
    mkdirSync(join(dir, '.mugiwara', 'missions', 'm2'), { recursive: true });
    const two = await cap(['record', 'execution', '--project', dir]);
    expect(two.code).toBe(2);
    expect(two.out).toContain('Pick one');
  });
  test('riskPathsIn flags only risky names', () => {
    expect(riskPathsIn(['a.js', 'src/payments/x.ts', 'billing.js', 'src/ui/button.ts'])).toEqual(['src/payments/x.ts', 'billing.js']);
  });
});

describe('mugiwara close', () => {
  test('records execution and closure, then archives into report.md', async () => {
    const dir = repo();
    writeFileSync(join(dir, 'b.js'), 'y\n');
    const r = await cap(['close', 'm1', '--project', dir]);
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'm1', 'report.md'))).toBe(true);
  });
  test('skips execution with no diff and keeps going to the archive gate', async () => {
    const dir = repo();
    const r = await cap(['close', 'm1', '--project', dir]);
    expect(r.out).toContain('skipped execution');
  });
});
