// test/cli.test.ts — src/cli.ts dispatches subcommands. Coverage-gate measures
// it, but the existing e2e suite only spawns the built binary as a subprocess,
// so v8 attributes nothing to it (0.00%). These tests exercise the exported
// run() directly, in-process, with no real installs: version/help, status and
// continue over a fake .mugiwara tree, and the dispatch paths that don't need
// a real install. runScript is mocked so `savepoint` dispatch is provable
// without spawning the real harness.
import { describe, expect, test, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from '../src/cli.ts';
import { runScript } from '../src/run.ts';

vi.mock('../src/run.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/run.ts')>();
  return { ...actual, runScript: vi.fn(() => 0) };
});

// A real process.exit stops execution. A no-op mock would let a command fall
// through past its exit point (e.g. initiativeCmd spawning initiative.ts after
// exit(1)) — so the mock THROWS, preserving real "stop here" semantics while
// letting the test assert the exit code and keep the process alive.
class ExitSignal extends Error {
  code: number;
  constructor(code: number) { super(`exit ${code}`); this.code = code; }
}
const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new ExitSignal(code); }) as never);
afterEach(() => exitSpy.mockClear());

function fixture(files: Array<{ root: string; mission: string; file: string; body: Record<string, unknown> }>): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-'));
  for (const f of files) {
    const d = join(dir, '.mugiwara', f.root, f.mission);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, `${f.file}.json`), JSON.stringify(f.body));
  }
  return dir;
}

const ACTOR = 'Zoro <zoro@example.com>';

const state = (mission: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  mission,
  actor: ACTOR,
  branch: 'main',
  wave: 2,
  mode: 'auto',
  tasks: { done: 1, total: 4 },
  lane: 'standard',
  lane_reason: '',
  lane_rose: false,
  lane_prev: 'standard',
  lane_peak: 'standard',
  blockers_open: 0,
  heal_cycle: 0,
  heal_max_cycles: 3,
  heal_halt: false,
  delegate_due: false,
  tokens_est: 100,
  budget: 1000,
  budget_status: 'ok',
  files_touched: 3,
  evidence: ['a.md'],
  updated_at: '2026-08-19T00:00:00Z',
  ...over,
});

/** Run `run` while capturing stdout/stderr, with a fixed actor. */
async function capture(args: string[], dir?: string): Promise<{ out: string; err: string }> {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const prev = process.env.STATE_ACTOR;
  process.env.STATE_ACTOR = ACTOR;
  try {
    await run(dir ? [...args, '--project', dir] : args);
  } catch (e) {
    if (!(e instanceof ExitSignal)) throw e;
  } finally {
    if (prev === undefined) delete process.env.STATE_ACTOR;
    else process.env.STATE_ACTOR = prev;
  }
  const out = log.mock.calls.map((c) => c.join(' ')).join('\n');
  const err = errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  log.mockRestore();
  errSpy.mockRestore();
  return { out, err };
}

describe('run() — version / help / unknown dispatch', () => {
  test('--version prints the version and returns', async () => {
    const { out } = await capture(['--version']);
    expect(out).toMatch(/mugiwara \d+\.\d+\.\d+/);
  });

  test('help and --help print the usage screen', async () => {
    for (const args of [['help'], ['--help']]) {
      const { out } = await capture(args);
      expect(out).toContain('Usage:');
      expect(out).toContain('savepoint');
    }
  });

  test('unknown command throws', async () => {
    await expect(capture(['unknown-command'])).rejects.toThrow(/Unknown command: unknown-command/);
  });

  test('no args defaults to install — refuses a non-TTY session', async () => {
    await expect(capture([])).rejects.toThrow(/Not a terminal/);
  });
});

describe('run() — status', () => {
  test('no state on disk prints a terse notice', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-empty-'));
    try {
      const { out } = await capture(['status'], dir);
      expect(out).toContain('No mission state on disk.');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('prints computed state for an in-flight mission', async () => {
    const dir = fixture([{ root: 'state', mission: 'seamless', file: 'state', body: state('seamless') }]);
    try {
      const { out } = await capture(['status'], dir);
      expect(out).toContain('seamless');
      expect(out).toContain('1/4 tasks');
      expect(out).toContain('lane standard');
      expect(out).toContain('mode auto');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — continue', () => {
  test('single solo mission resumes directly (no exit)', async () => {
    const dir = fixture([{ root: 'continue', mission: 'seamless', file: 'state', body: state('seamless') }]);
    try {
      const { out } = await capture(['continue'], dir);
      expect(out).toContain('Resumed: seamless');
      expect(exitSpy).not.toHaveBeenCalled();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('several missions in flight lists them and exits 2', async () => {
    const dir = fixture([
      { root: 'continue', mission: 'a-m', file: 'state', body: state('a-m') },
      { root: 'continue', mission: 'b-m', file: 'state', body: state('b-m') },
    ]);
    try {
      const { out } = await capture(['continue'], dir);
      expect(out).toContain('2 missions in flight');
      expect(out).toContain('a-m');
      expect(out).toContain('b-m');
      expect(exitSpy).toHaveBeenCalledWith(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('no mission in flight prints notice and exits 2', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-none-'));
    try {
      const { out } = await capture(['continue'], dir);
      expect(out).toContain('No mission in flight');
      expect(exitSpy).toHaveBeenCalledWith(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — initiative', () => {
  test('no subcommand prints usage and exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-init-'));
    try {
      const { err } = await capture(['initiative'], dir);
      expect(err).toContain('usage: mugiwara initiative');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('with a subcommand it spawns scripts/initiative.ts against the project dir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-init2-'));
    writeFileSync(join(dir, 'plan.md'), '# Plan\n\nSolo mission, no Sub-missions table.\n');
    try {
      // sub = 'status' → spawns bun scripts/initiative.ts status plan.md (cwd=dir).
      // The child exits on its own; cli only process.exit(>0) if the child does.
      await capture(['initiative', 'status', 'plan.md'], dir);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — run / savepoint dispatch', () => {
  test('run with no script prints usage and exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-run-'));
    try {
      const { err } = await capture(['run'], dir);
      expect(err).toContain('usage: mugiwara run <script>');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('savepoint dispatches to runCmd → runScript(savepoint.sh, ...)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-sp-'));
    const mockRun = vi.mocked(runScript);
    mockRun.mockClear();
    try {
      await capture(['savepoint', 'seamless'], dir);
      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun.mock.calls[0][0]).toBe('savepoint.sh');
      expect(mockRun.mock.calls[0][1]).toEqual(['seamless']);
      expect(mockRun.mock.calls[0][2]).toBe(resolve(dir));
      expect(exitSpy).not.toHaveBeenCalled();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — no-install command paths', () => {
  test('list with no manifests reports no installation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-list-'));
    try {
      const { out } = await capture(['list'], dir);
      expect(out).toContain('No mugiwara installation found.');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('reset on an empty project removes nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-reset-'));
    try {
      const { out } = await capture(['reset'], dir);
      expect(out).toContain('nothing to remove.');
      expect(exitSpy).not.toHaveBeenCalled();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('reset refuses to wipe a live mission without --force (blocked → exit 1)', async () => {
    const dir = fixture([{ root: 'state', mission: 'live-m', file: 'state', body: state('live-m') }]);
    try {
      const { err } = await capture(['reset'], dir);
      expect(err).toContain('Active mission for');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('archive with no mission prints usage and exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-arch-'));
    try {
      const { err } = await capture(['archive'], dir);
      expect(err).toContain('usage: mugiwara archive <mission>');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('uninstall with no manifest reports nothing installed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-uni-'));
    try {
      const { out } = await capture(['uninstall'], dir);
      expect(out).toContain('Nothing installed');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('archive folds spec into report, keeps evidence, appends the index', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-arch2-'));
    try {
      mkdirSync(join(dir, '.mugiwara', 'spec'), { recursive: true });
      mkdirSync(join(dir, '.mugiwara', 'reports'), { recursive: true });
      mkdirSync(join(dir, '.mugiwara', 'results', 'live-m'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'spec', 'live-m.md'), '# spec');
      writeFileSync(join(dir, '.mugiwara', 'reports', '2026-08-19-live-m.md'), '# report');
      writeFileSync(join(dir, '.mugiwara', 'results', 'live-m', '01.md'), '# step');
      const { out } = await capture(['archive', 'live-m'], dir);
      expect(out).toContain('archive target: reports/2026-08-19-live-m.md');
      expect(out).toContain('removed: spec');
      expect(existsSync(join(dir, '.mugiwara', 'spec', 'live-m.md'))).toBe(false);
      expect(existsSync(join(dir, '.mugiwara', 'results', 'live-m', '01.md'))).toBe(true);
      expect(out).toContain('index updated');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — in-process install + uninstall (temp dir, no system writes)', () => {
  test('install --yes --target claude writes the crew and a manifest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-install-'));
    try {
      const { out } = await capture(['install', '--yes', '--target', 'claude'], dir);
      expect(existsSync(join(dir, '.claude', 'skills', 'mugiwara-workflow', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(dir, '.mugiwara', 'manifest.json'))).toBe(true);
      expect(out).toContain('OK mugiwara');
      expect(out).toContain('Next:');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('uninstall removes what install wrote', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-cycle-'));
    try {
      await capture(['install', '--yes', '--target', 'claude'], dir);
      const { out } = await capture(['uninstall', '--yes'], dir);
      expect(out).toContain('OK removed');
      expect(existsSync(join(dir, '.claude', 'skills', 'mugiwara-workflow'))).toBe(false);
      expect(existsSync(join(dir, '.mugiwara', 'manifest.json'))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('update dispatches to install with force', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-update-'));
    try {
      await capture(['install', '--yes', '--target', 'claude'], dir);
      const { out } = await capture(['update', '--yes', '--target', 'claude'], dir);
      expect(out).toContain('OK mugiwara');
      expect(existsSync(join(dir, '.mugiwara', 'manifest.json'))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('install --dry-run writes nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-dry-'));
    try {
      const { out } = await capture(['install', '--yes', '--target', 'claude', '--dry-run'], dir);
      expect(out).toContain('Dry run — nothing written.');
      expect(existsSync(join(dir, '.claude'))).toBe(false);
      expect(existsSync(join(dir, '.mugiwara', 'manifest.json'))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — reset with --force removes mission dirs', () => {  test('reset --force wipes spec/state and reports the removals', async () => {
    const dir = fixture([
      { root: 'state', mission: 'live-m', file: 'state', body: state('live-m') },
    ]);
    mkdirSync(join(dir, '.mugiwara', 'spec'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'spec', 'live-m.md'), '# x');
    try {
      const { out } = await capture(['reset', '--force'], dir);
      expect(out).toContain('removed:');
      expect(existsSync(join(dir, '.mugiwara', 'spec'))).toBe(false);
      expect(existsSync(join(dir, '.mugiwara', 'state'))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — start', () => {
  test('no mission prints usage and exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-start-'));
    try {
      const { err } = await capture(['start'], dir);
      expect(err).toContain('usage: mugiwara start <mission>');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('solo plan: dispatches savepoint, no plan status update', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-start-solo-'));
    mkdirSync(join(dir, '.mugiwara', 'plans'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'plans', '2026-08-20-fix-bug.md'), '# Fix bug\n\n## Goal\nFix it.\n');
    const mockRun = vi.mocked(runScript);
    mockRun.mockClear();
    try {
      const { out } = await capture(['start', 'fix-bug'], dir);
      expect(out).toContain('begun at Flow 0');
      // solo → member-less savepoint dispatch
      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun.mock.calls[0][0]).toBe('savepoint.sh');
      expect(mockRun.mock.calls[0][1]).toEqual(['fix-bug', '', '0', 'auto', 'full']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('team plan: dispatches savepoint with member, marks sub-mission in-progress in plan', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-start-team-'));
    mkdirSync(join(dir, '.mugiwara', 'plans'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'plans', '2026-08-20-payment-gateway-v2.md'),
      '# Payment Gateway v2\n\n## Sub-missions\n\n' +
      '| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n' +
      '|----|------|----------|--------|--------|------------|---------------|\n' +
      '| sub-1 | Payment Gateway | Dev A | feat/payment-gateway | [ ] | — | src/payment/ |\n' +
      '| sub-2 | Refund Flow | Dev B | feat/refund | [ ] | sub-1 | src/payment/ |\n');
    const mockRun = vi.mocked(runScript);
    mockRun.mockClear();
    try {
      const { out } = await capture(['start', 'payment-gateway-v2', 'sub-1'], dir);
      expect(out).toContain('begun at Flow 0');
      // team → member savepoint dispatch
      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun.mock.calls[0][0]).toBe('savepoint.sh');
      expect(mockRun.mock.calls[0][1]).toEqual(['payment-gateway-v2', 'sub-1', '0', 'auto', 'full']);
      // plan status cell updated [ ] → [~] (initiative set-status writes the plan)
      const plan = readFileSync(join(dir, '.mugiwara', 'plans', '2026-08-20-payment-gateway-v2.md'), 'utf8');
      expect(plan).toContain('| sub-1 | Payment Gateway | Dev A | feat/payment-gateway | [~] |');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('no plan found prints error and exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-start-noplan-'));
    mkdirSync(join(dir, '.mugiwara', 'plans'), { recursive: true });
    try {
      const { err } = await capture(['start', 'nonexistent'], dir);
      expect(err).toContain('no plan found');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('team plan with no matching assignee errors and suggests explicit member', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-start-nomatch-'));
    mkdirSync(join(dir, '.mugiwara', 'plans'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'plans', '2026-08-20-payment-gateway-v2.md'),
      '# Payment Gateway v2\n\n## Sub-missions\n\n' +
      '| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n' +
      '|----|------|----------|--------|--------|------------|---------------|\n' +
      '| sub-1 | Payment Gateway | Dev A | feat/payment-gateway | [ ] | — | src/payment/ |\n');
    try {
      // git actor in the test repo is "Test <test@test.com>" — no assignee matches
      const { err } = await capture(['start', 'payment-gateway-v2'], dir);
      expect(err).toContain('no sub-mission assigned');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
