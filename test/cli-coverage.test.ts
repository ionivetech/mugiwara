// test/cli-coverage.test.ts — cover legacy CLI branches the gate measures
// file-wide (migrate team switches, lesson, archive/continue/status/cost/
// handoff errors, sign keygen, unknown target). Uses run() + exit mock.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.ts';
import { hasMinisign } from '../src/sign.ts';

class ExitSignal extends Error { code: number; constructor(c: number) { super(`exit ${c}`); this.code = c; } }
afterEach(() => vi.restoreAllMocks());

async function cap(args: string[]): Promise<{ out: string; err: string; code: number | null }> {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((c: number) => { throw new ExitSignal(c); }) as never);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  let code: number | null = 0;
  let out = '', err = '';
  try {
    await run(args);
  } catch (e) {
    code = e instanceof ExitSignal ? e.code : 99;
  } finally {
    out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    err = errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    exitSpy.mockRestore(); logSpy.mockRestore(); errSpy.mockRestore();
  }
  return { out, err, code };
}

const tmp = (): string => mkdtempSync(join(tmpdir(), 'mugi-clicov-'));
const missionState = (dir: string, m: string, name: string, body = {}): void => {
  const d = join(dir, '.mugiwara', 'missions', m);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, name), JSON.stringify({ mission: m, ...body }));
};

describe('migrate team switches', () => {
  test('--to-team moves state + continue', async () => {
    const dir = tmp();
    try {
      missionState(dir, 'm', 'state.json', { flow: 1 });
      missionState(dir, 'm', 'continue.json', {});
      const r = await cap(['migrate', '--to-team', 'alice', '--mission', 'm', '--project', dir]);
      expect(r.code).toBe(0);
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'm', 'alice.json'))).toBe(true);
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'm', 'state.json'))).toBe(false);
      expect(r.out).toContain('migrated 2 file(s)');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('--to-team --dry-run moves nothing', async () => {
    const dir = tmp();
    try {
      missionState(dir, 'm', 'state.json', {});
      const r = await cap(['migrate', '--to-team', 'alice', '--mission', 'm', '--project', dir, '--dry-run']);
      expect(r.code).toBe(0);
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'm', 'state.json'))).toBe(true);
      expect(r.out).toContain('would migrate');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('--to-team invalid member exits 1', async () => {
    const dir = tmp();
    try {
      const r = await cap(['migrate', '--to-team', '../evil', '--mission', 'm', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('invalid member name');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('--to-team and --to-solo together exits 1', async () => {
    const dir = tmp();
    try {
      const r = await cap(['migrate', '--to-team', 'a', '--to-solo', 'a', '--mission', 'm', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('either --to-team or --to-solo');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('--to-team with no solo mission exits 1', async () => {
    const dir = tmp();
    try {
      mkdirSync(join(dir, '.mugiwara', 'missions', 'm'), { recursive: true });
      const r = await cap(['migrate', '--to-team', 'alice', '--mission', 'm', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('no state.json');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('--to-solo moves member state back', async () => {
    const dir = tmp();
    try {
      missionState(dir, 'm', 'alice.json', { flow: 2 });
      const r = await cap(['migrate', '--to-solo', 'alice', '--mission', 'm', '--project', dir]);
      expect(r.code).toBe(0);
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'm', 'state.json'))).toBe(true);
      expect(r.out).toContain('migrated 1 file(s)');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('--to-solo refuses a second member', async () => {
    const dir = tmp();
    try {
      missionState(dir, 'm', 'alice.json', {});
      missionState(dir, 'm', 'bob.json', {});
      const r = await cap(['migrate', '--to-solo', 'alice', '--mission', 'm', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('refusing --to-solo');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('command usage + state errors', () => {
  test('lesson with no text prints usage', async () => {
    const dir = tmp();
    try {
      const r = await cap(['lesson', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('usage: mugiwara lesson');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('lesson appends then appends again', async () => {
    const dir = tmp();
    try {
      const a = await cap(['lesson', 'first insight', '--project', dir]);
      expect(a.out).toContain('lesson appended');
      const b = await cap(['lesson', 'second | insight', '--project', dir]);
      expect(b.out).toContain('lesson appended');
      const ledger = readFileSync(join(dir, '.mugiwara', 'lessons.md'), 'utf8');
      expect(ledger).toContain('first insight');
      expect(ledger).not.toContain('second | insight');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('archive with no mission prints usage', async () => {
    const dir = tmp();
    try {
      const r = await cap(['archive', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('usage: mugiwara archive');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('archive unknown mission reports it', async () => {
    const dir = tmp();
    try {
      const r = await cap(['archive', 'nope', '--project', dir]);
      expect(r.err).toContain('no mission dir');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('status via run() reports empty state', async () => {
    const dir = tmp();
    try {
      const r = await cap(['status', '--project', dir]);
      expect(r.code).toBe(0);
      expect(r.out).toContain('No mission state');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('continue with no missions exits 2', async () => {
    const dir = tmp();
    try {
      const r = await cap(['continue', '--project', dir]);
      expect(r.code).toBe(2);
      expect(r.out).toContain('No mission in flight');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('continue unknown mission exits 2', async () => {
    const dir = tmp();
    try {
      missionState(dir, 'm', 'state.json', {});
      missionState(dir, 'm', 'continue.json', { flow: 1 });
      const r = await cap(['continue', 'ghost', '--project', dir]);
      expect(r.code).toBe(2);
      expect(r.err).toContain('No in-flight mission "ghost"');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('status with corrupt state warns instead of crashing', async () => {
    const dir = tmp();
    try {
      const d = join(dir, '.mugiwara', 'missions', 'm');
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'state.json'), '{corrupt\n');
      const r = await cap(['status', '--project', dir]);
      expect(r.code).toBe(0);
      expect(r.err).toContain('unreadable state file');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('continue with unreadable member state exits 1', async () => {
    const dir = tmp();
    try {
      const d = join(dir, '.mugiwara', 'missions', 'm');
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'state.json'), '{corrupt\n');
      const r = await cap(['continue', 'm', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('unreadable state');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('cost with no state prints usage', async () => {
    const dir = tmp();
    try {
      const r = await cap(['cost', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('usage: mugiwara cost');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('handoff with no mission prints usage', async () => {
    const dir = tmp();
    try {
      const r = await cap(['handoff', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('usage: mugiwara handoff');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('install unknown target throws', async () => {
    const dir = tmp();
    try {
      const r = await cap(['install', '--project', dir, '--target', 'nope', '--yes']);
      expect(r.code).toBe(99);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('clean --before tolerates corrupt state', async () => {
    const dir = tmp();
    try {
      const d = join(dir, '.mugiwara', 'missions', 'm');
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'state.json'), '{corrupt\n');
      const r = await cap(['clean', '--before', '2020-01-01', '--project', dir]);
      expect(r.code).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('sign keygen', () => {
  // No homedir redirection on either runner (bun ignores $HOME, node freezes
  // the ESM namespace) — exercise the minisign-absent error branch, which
  // exits before touching the home directory. Pure-backend file writes are
  // covered by sign.test.ts against a temp home.
  test('--gen-key --backend minisign without the binary exits 1', async () => {
    if (hasMinisign()) return;
    const dir = tmp();
    try {
      const r = await cap(['sign', '--gen-key', '--backend', 'minisign', '--project', dir]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('minisign not installed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
