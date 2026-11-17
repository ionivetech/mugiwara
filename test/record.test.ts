import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cap } from './helpers/cli-capture.ts';
import { recordStage, missionFiles } from '../src/record.ts';
import { riskPathsIn } from '../src/risk.ts';

function repo(lane = 'standard'): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-record-'));
  const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  writeFileSync(join(dir, 'a.js'), 'x\n'); g('add', '-A'); g('commit', '-qm', 'init');
  const base_sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  const m = join(dir, '.mugiwara', 'missions', 'm1');
  mkdirSync(m, { recursive: true });
  writeFileSync(join(m, 'state.json'), JSON.stringify({ mission: 'm1', lane, flow: 9, mode: 'auto', base_sha }));
  writeFileSync(join(m, 'plan.md'), '# plan\n');
  return dir;
}
const flowFile = (dir: string, n: string) => join(dir, '.mugiwara', 'missions', 'm1', 'flows', n);
const commit = (dir: string, msg: string) => {
  execFileSync('git', ['add', '-A', '--', ':!.mugiwara', ':!.claude'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-qm', msg], { cwd: dir, stdio: 'ignore' });
};
const body = (r: ReturnType<typeof recordStage>) => ('path' in r ? readFileSync(r.path, 'utf8') : r.error);

describe('mugiwara record', () => {
  test('execution lists the real changed files; no diff is refused', async () => {
    const dir = repo();
    const none = await cap(['record', 'execution', 'm1', '--project', dir]);
    expect(none.code).toBe(1);
    writeFileSync(join(dir, 'b.js'), 'y\n');
    const ok = await cap(['record', 'execution', 'm1', '--project', dir]);
    expect(ok.code).toBe(0);
    expect(readFileSync(flowFile(dir, '01-execution.md'), 'utf8')).toContain('- b.js');
    expect(missionFiles(dir, 'm1')).toMatchObject({ files: ['b.js'] });
  });
  test('gates runs the command and records the true exit code', () => {
    const dir = repo();
    const pass = recordStage(dir, 'm1', 'gates', { cmd: 'echo hello' });
    expect('path' in pass && readFileSync(pass.path, 'utf8')).toContain('Exit code: 0 (pass)');
    const fail = recordStage(dir, 'm1', 'gates', { cmd: 'exit 3' });
    expect('path' in fail && readFileSync(fail.path, 'utf8')).toContain('Exit code: 3 (fail)');
    expect(recordStage(dir, 'm1', 'gates')).toHaveProperty('error');
  });
  test('quality and healing need a note or a command; audit and closure record facts', () => {
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
  // R1: the evidence is the mission diff from base_sha, never the working tree against HEAD.
  // The exact failing shape: install first (untracked), then commit the real work.
  test('committed mission work is listed; untracked install files are not', async () => {
    const dir = repo();
    expect((await cap(['install', '--yes', '--target', 'claude', '--project', dir])).code).toBe(0);
    writeFileSync(join(dir, 'b.js'), 'y\n');
    commit(dir, 'mission work');
    const out = body(recordStage(dir, 'm1', 'execution'));
    expect(out).toContain('Changed files (1):');
    expect(out).toContain('- b.js');
    expect(out).not.toContain('.claude/');
    expect(out).not.toContain('.gitignore');
  }, 30_000);
  test('a mission edit to a file install also merges into stays listed', async () => {
    const dir = repo();
    expect((await cap(['install', '--yes', '--target', 'claude', '--project', dir])).code).toBe(0);
    writeFileSync(join(dir, '.gitignore'), `dist/\n${readFileSync(join(dir, '.gitignore'), 'utf8')}`);
    expect(missionFiles(dir, 'm1')).toMatchObject({ files: ['.gitignore'] });
  }, 30_000);
  test('uncommitted mission work is listed too', () => {
    const dir = repo();
    writeFileSync(join(dir, 'a.js'), 'changed\n');
    expect(body(recordStage(dir, 'm1', 'execution'))).toContain('- a.js');
  });
  test('audit names a committed risky path', () => {
    const dir = repo();
    mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
    writeFileSync(join(dir, 'src', 'auth', 'login.ts'), 'z\n');
    commit(dir, 'auth');
    expect(body(recordStage(dir, 'm1', 'audit'))).toContain('Risky paths: src/auth/login.ts');
  });
  test('no state or an unknown base refuses and writes nothing', () => {
    const dir = repo();
    writeFileSync(join(dir, 'b.js'), 'y\n');
    mkdirSync(join(dir, '.mugiwara', 'missions', 'orphan'), { recursive: true });
    expect(body(recordStage(dir, 'orphan', 'execution'))).toContain("no state for mission 'orphan'");
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'orphan', 'flows'))).toBe(false);
    writeFileSync(join(dir, '.mugiwara', 'missions', 'm1', 'state.json'), JSON.stringify({ mission: 'm1', base_sha: 'unknown' }));
    expect(body(recordStage(dir, 'm1', 'execution'))).toContain('no base_sha');
  });
  test('team members with different bases: union of both diffs', () => {
    const dir = repo();
    const m = join(dir, '.mugiwara', 'missions', 'm1');
    writeFileSync(join(dir, 'b.js'), 'y\n'); commit(dir, 'one');
    const mid = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    writeFileSync(join(dir, 'c.js'), 'z\n'); commit(dir, 'two');
    rmSync(join(m, 'state.json'));
    const first = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    writeFileSync(join(m, 'farid.json'), JSON.stringify({ mission: 'm1', base_sha: first }));
    writeFileSync(join(m, 'rina.json'), JSON.stringify({ mission: 'm1', base_sha: mid }));
    expect(missionFiles(dir, 'm1')).toMatchObject({ files: ['b.js', 'c.js'] });
  });
  // R2: a flag is recorded or refused, never dropped.
  test('quality --cmd --note records both', () => {
    const out = body(recordStage(repo(), 'm1', 'quality', { cmd: 'echo lint ok', note: 'lint clean' }));
    expect(out).toContain('Command: `echo lint ok`');
    expect(out).toContain('Exit code: 0 (pass)');
    expect(out).toContain('lint clean');
  });
  test('quality --cmd records a failing exit code as fail', () => {
    expect(body(recordStage(repo(), 'm1', 'quality', { cmd: 'exit 3' }))).toContain('Exit code: 3 (fail)');
  });
  test('execution --cmd refuses and names the stages that accept it', () => {
    expect(body(recordStage(repo(), 'm1', 'execution', { cmd: 'echo x' }))).toContain('gates, quality, healing');
  });
  test('gates body keeps its format', () => {
    expect(body(recordStage(repo(), 'm1', 'gates', { cmd: 'echo hi', note: 'n' })))
      .toBe('# Gates\n\nCommand: `echo hi`\nExit code: 0 (pass)\n\n```\nhi\n```\n\n## Note\n\nn\n');
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
  test('without plan.md, close still archives and lists the plan under Not verified; archive alone refuses', async () => {
    const dir = repo();
    const m = join(dir, '.mugiwara', 'missions', 'm1');
    rmSync(join(m, 'plan.md'));
    writeFileSync(join(dir, 'b.js'), 'y\n');
    writeFileSync(join(m, 'review.md'), '# Review\n');
    const refused = await cap(['archive', 'm1', '--project', dir]);
    expect(refused.code).not.toBe(0);
    const r = await cap(['close', 'm1', '--project', dir]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('no plan.md');
    const report = readFileSync(join(m, 'report.md'), 'utf8');
    expect(report).toContain('Not verified');
    expect(report).toContain('plan.md');
  });
  test('skips execution with no diff and keeps going to the archive gate', async () => {
    const dir = repo();
    const r = await cap(['close', 'm1', '--project', dir]);
    expect(r.out).toContain('skipped execution');
  });
});
