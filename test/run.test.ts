// test/run.test.ts — src/run.ts had zero tests. It takes a script name from a
// skill prompt and executes it, so its allowlist is a trust boundary, and its
// bash lookup must fail CLOSED (a silent no-op is how savepoint went missing
// in the first place).
import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runScript, findBash, RUNNABLE, SCRIPTS_DIR } from '../src/run.ts';

// git init + a real savepoint.sh spawn blows past vitest's 5s default on a loaded
// machine — the same reason lane-integrity.test.ts and savepoint.test.ts carry
// explicit timeouts. Anything here that shells out gets this, not a smaller test.
const SLOW = 30000;

const DIR = mkdtempSync(join(tmpdir(), 'mugi-run-'));

describe('script name allowlist — a name, never a path', () => {
  test.each([
    ['../../../etc/passwd', 'parent traversal'],
    ['../savepoint.sh', 'relative escape'],
    ['/etc/passwd', 'absolute path'],
    ['/bin/sh', 'absolute executable'],
    ['scripts/savepoint.sh', 'nested path'],
    ['sub/dir/x.sh', 'deep path'],
    ['savepoint.sh; rm -rf /', 'command injection'],
    ['savepoint.ts', 'non-.sh extension'],
    ['savepoint', 'no extension'],
    ['SAVEPOINT.SH', 'uppercase bypass'],
    ['', 'empty'],
  ])('rejects %s (%s)', (name) => {
    expect(() => runScript(name, [], DIR)).toThrow(/invalid script name/);
  });

  test('the rejection names the scripts that ARE runnable', () => {
    expect(() => runScript('../x', [], DIR)).toThrow(new RegExp(RUNNABLE.join(', ').replace(/\./g, '\\.')));
  });

  test('every declared RUNNABLE script actually exists on disk', () => {
    for (const name of RUNNABLE) expect(existsSync(join(SCRIPTS_DIR, name)), name).toBe(true);
  });
});

describe('unknown script', () => {
  test('a well-formed but unknown name errors and lists what is available', () => {
    let msg = '';
    try { runScript('not-a-real-script.sh', [], DIR); } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/script not found: not-a-real-script\.sh/);
    expect(msg).toContain('available:');
    expect(msg).toContain('savepoint.sh');
  });
});

describe('bash lookup fails CLOSED', () => {
  test('MUGIWARA_BASH pointing at a nonexistent path returns null, never a fallback', () => {
    const prev = process.env.MUGIWARA_BASH;
    process.env.MUGIWARA_BASH = join(DIR, 'no', 'such', 'bash');
    try {
      expect(findBash()).toBeNull();
    } finally { prev === undefined ? delete process.env.MUGIWARA_BASH : (process.env.MUGIWARA_BASH = prev); }
  });

  test('runScript with a broken MUGIWARA_BASH throws an actionable, platform-correct message — not a silent no-op', () => {
    const prev = process.env.MUGIWARA_BASH;
    process.env.MUGIWARA_BASH = join(DIR, 'no', 'such', 'bash');
    try {
      let msg = '';
      let returned: number | undefined;
      try { returned = runScript('savepoint.sh', ['m'], DIR); } catch (e) { msg = (e as Error).message; }
      expect(returned).toBeUndefined();           // it threw; it did not return 0
      expect(msg).toContain('no bash found');
      // "install Git for Windows" is wrong advice on Linux/macOS — the remedy
      // has to name the platform's actual package manager there
      expect(msg).toContain(process.platform === 'win32' ? 'Git for Windows' : 'package manager');
      expect(msg).toContain('MUGIWARA_BASH');
    } finally { prev === undefined ? delete process.env.MUGIWARA_BASH : (process.env.MUGIWARA_BASH = prev); }
  });

  test('an explicit MUGIWARA_BASH that DOES exist is honoured over the platform default', () => {
    const prev = process.env.MUGIWARA_BASH;
    process.env.MUGIWARA_BASH = '/bin/sh';
    try {
      expect(findBash()).toBe('/bin/sh');
    } finally { prev === undefined ? delete process.env.MUGIWARA_BASH : (process.env.MUGIWARA_BASH = prev); }
  });
});

describe('a real savepoint.sh run through runScript', () => {
  test('writes state and continue JSON into a fixture git repo', { timeout: SLOW }, () => {
    const repo = mkdtempSync(join(tmpdir(), 'mugi-run-repo-'));
    try {
      const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
      git('init', '-q');
      git('config', 'user.email', 'zoro@example.com');
      git('config', 'user.name', 'Zoro');
      writeFileSync(join(repo, 'a.txt'), 'seed\n');
      git('add', 'a.txt');
      git('commit', '-qm', 'seed');

      const code = runScript('savepoint.sh', ['run-fixture', '', '3', 'auto'], repo);
      expect(code).toBe(0);

      const statePath = join(repo, '.mugiwara', 'missions', 'run-fixture', 'state.json');
      expect(existsSync(statePath), 'savepoint wrote no state file').toBe(true);

      const state = JSON.parse(readFileSync(statePath, 'utf8'));
      expect(state.mission).toBe('run-fixture');
      expect(state.member).toBeNull();
      expect(state.flow).toBe(3);
      expect(state.mode).toBe('auto');
      expect(typeof state.base_sha).toBe('string');
      expect(state.base_sha).not.toBe('');

      // the same run must leave a resume point continue.ts can read back
      const contPath = join(repo, '.mugiwara', 'missions', 'run-fixture', 'continue.json');
      expect(existsSync(contPath), 'savepoint wrote no continue file').toBe(true);
      expect(JSON.parse(readFileSync(contPath, 'utf8')).mission).toBe('run-fixture');
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });

  test('runs against the passed projectDir, not the harness cwd', { timeout: SLOW }, () => {
    const repo = mkdtempSync(join(tmpdir(), 'mugi-run-cwd-'));
    try {
      const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
      git('init', '-q');
      git('config', 'user.email', 'z@e.com');
      git('config', 'user.name', 'Z');
      writeFileSync(join(repo, 'a.txt'), 'x\n');
      git('add', 'a.txt');
      git('commit', '-qm', 'seed');

      runScript('savepoint.sh', ['cwd-fixture'], repo);
      expect(existsSync(join(repo, '.mugiwara', 'missions', 'cwd-fixture', 'state.json'))).toBe(true);
      // never in the mugiwara checkout itself
      expect(existsSync(join(process.cwd(), '.mugiwara', 'missions', 'cwd-fixture'))).toBe(false);
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });
});

process.on('exit', () => { try { rmSync(DIR, { recursive: true, force: true }); } catch { /* best effort */ } });

describe('bash lookup on POSIX does not assume /bin/bash', () => {
  test('findBash returns a path that actually exists (Alpine ships /bin/sh only)', () => {
    const prev = process.env.MUGIWARA_BASH;
    delete process.env.MUGIWARA_BASH;
    try {
      const bash = findBash();
      // null is a legitimate answer on a bash-less machine; a non-null answer
      // must never be an assumed path that is not there
      if (bash !== null) expect(existsSync(bash)).toBe(true);
    } finally { if (prev !== undefined) process.env.MUGIWARA_BASH = prev; }
  });
});
