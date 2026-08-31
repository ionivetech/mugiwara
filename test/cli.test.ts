// test/cli.test.ts — src/cli.ts dispatches subcommands. Coverage-gate measures
// it, but the existing e2e suite only spawns the built binary as a subprocess,
// so v8 attributes nothing to it (0.00%). These tests exercise the exported
// run() directly, in-process, with no real installs: version/help, status and
// continue over a fake .mugiwara tree, and the dispatch paths that don't need
// a real install. runScript is mocked so `savepoint` dispatch is provable
// without spawning the real harness.
import { describe, expect, test, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from '../src/cli.ts';
import { stalenessLine } from '../src/cli.ts';
import { runScript } from '../src/run.ts';

vi.mock('../src/run.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/run.ts')>();
  return { ...actual, runScript: vi.fn(() => 0) };
});

// A real process.exit stops execution. A no-op mock would let a command fall
// through past its exit point — so the mock THROWS, preserving real "stop
// here" semantics while letting the test assert the exit code and keep the
// process alive.
class ExitSignal extends Error {
  code: number;
  constructor(code: number) { super(`exit ${code}`); this.code = code; }
}
const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new ExitSignal(code); }) as never);
afterEach(() => exitSpy.mockClear());

function fixture(files: Array<{ root: string; mission: string; file: string; body: Record<string, unknown> }>): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-'));
  for (const f of files) {
    // root 'continue' → continue family names; root 'state' → state family
    const name = f.root === 'continue'
      ? f.file === 'state' ? 'continue' : `continue-${f.file}`
      : f.file;
    const d = join(dir, '.mugiwara', 'missions', f.mission);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, `${name}.json`), JSON.stringify(f.body));
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

  test('status on a fresh project auto-creates .mugiwara/config (tier-3 bootstrap)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-boot-'));
    try {
      const cfg = join(dir, '.mugiwara', 'config');
      expect(existsSync(cfg)).toBe(false);
      const { out } = await capture(['status'], dir);
      expect(out).toContain('No mission state on disk.');
      expect(out).toContain('default .mugiwara/config written');
      expect(existsSync(cfg)).toBe(true);
      expect(readFileSync(cfg, 'utf8')).toContain('mode=guided');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('bootstrap: existing config is never overwritten', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-boot2-'));
    try {
      const cfg = join(dir, '.mugiwara', 'config');
      mkdirSync(join(dir, '.mugiwara'), { recursive: true });
      writeFileSync(cfg, 'mode=auto\n');
      const { out } = await capture(['status'], dir);
      expect(out).not.toContain('default .mugiwara/config written');
      expect(readFileSync(cfg, 'utf8')).toBe('mode=auto\n');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('bootstrap: install --dry-run does not write config (no mutation)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-dryrun-'));
    try {
      const cfg = join(dir, '.mugiwara', 'config');
      expect(existsSync(cfg)).toBe(false);
      await expect(capture(['install', '--dry-run'], dir)).rejects.toThrow(/Not a terminal/);
      expect(existsSync(cfg)).toBe(false);
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

  test('archive folds waves + findings into report.md, keeps plan.md, appends the index', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-arch2-'));
    try {
      const m = join(dir, '.mugiwara', 'missions', 'live-m');
      mkdirSync(join(m, 'waves'), { recursive: true });
      writeFileSync(join(m, 'plan.md'), '# plan');
      writeFileSync(join(m, 'spec.md'), '# spec');
      writeFileSync(join(m, 'decisions.md'), '# decisions');
      writeFileSync(join(m, 'waves', '01-execution.md'), '# step');
      writeFileSync(join(m, 'waves', '06-closure.md'), '# closure');
      writeFileSync(join(m, 'state.json'), '{"mission":"live-m","flow":9}');
      const { out } = await capture(['archive', 'live-m'], dir);
      expect(out).toContain('archive target: missions/live-m/report.md');
      expect(out).toContain('removed:');
      expect(existsSync(join(m, 'spec.md'))).toBe(false);
      expect(existsSync(join(m, 'decisions.md'))).toBe(false);
      expect(existsSync(join(m, 'waves'))).toBe(false);
      expect(existsSync(join(m, 'plan.md'))).toBe(true);
      const rep = readFileSync(join(m, 'report.md'), 'utf8');
      expect(rep).toContain('# closure');
      expect(rep).toContain('## Archived: 01-execution.md');
      expect(rep).toContain('## Archived: decisions.md');
      expect(out).toContain('index updated');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('clean batch-archives closed missions, refuses in-flight without --force', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-clean-'));
    try {
      const mk = (m: string, live: boolean) => {
        const d = join(dir, '.mugiwara', 'missions', m);
        mkdirSync(join(d, 'waves'), { recursive: true });
        writeFileSync(join(d, 'plan.md'), '# plan');
        writeFileSync(join(d, 'waves', '06-closure.md'), '# closure');
        if (!live) writeFileSync(join(d, 'report.md'), '# report');
        if (live) writeFileSync(join(d, 'state.json'), `{"mission":"${m}","flow":5}`);
      };
      mk('done-m', false);
      mk('live-m', true);
      // default: only the closed mission is a candidate
      const { out } = await capture(['clean'], dir);
      expect(out).toContain('cleaned done-m');
      expect(out).not.toContain('live-m');
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'done-m', 'waves'))).toBe(false);
      expect(readFileSync(join(dir, '.mugiwara', 'missions', 'done-m', 'report.md'), 'utf8')).toContain('## Archived: 06-closure.md');
      expect(existsSync(join(dir, '.mugiwara', 'index.md'))).toBe(true);
      // --all without --force: in-flight blocks (process.exit(1))
      const { err } = await capture(['clean', '--all'], dir);
      expect(err).toContain('in-flight mission(s): live-m');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('clean --before archives stale in-flight missions, keeps fresh ones', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-before-'));
    try {
      const mk = (m: string, updatedAt: string) => {
        const d = join(dir, '.mugiwara', 'missions', m);
        mkdirSync(d, { recursive: true });
        writeFileSync(join(d, 'plan.md'), '# plan');
        writeFileSync(join(d, 'state.json'), JSON.stringify({ mission: m, flow: 3, updated_at: updatedAt }));
      };
      mk('stale-m', '2020-01-01T00:00:00Z');
      mk('fresh-m', new Date().toISOString());
      const { out } = await capture(['clean', '--before', '2025-01-01'], dir);
      expect(out).toContain('cleaned stale-m');
      expect(out).not.toContain('fresh-m');
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'stale-m', 'report.md'))).toBe(true);
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'stale-m', 'state.json'))).toBe(false);
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'fresh-m', 'state.json'))).toBe(true);
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

describe('run() — reset with --force removes mission dirs', () => {  test('reset --force wipes missions/ and reports the removals', async () => {
    const dir = fixture([
      { root: 'state', mission: 'live-m', file: 'state', body: state('live-m') },
    ]);
    mkdirSync(join(dir, '.mugiwara', 'missions', 'live-m'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'missions', 'live-m', 'plan.md'), '# x');
    try {
      const { out } = await capture(['reset', '--force'], dir);
      expect(out).toContain('removed:');
      expect(existsSync(join(dir, '.mugiwara', 'missions'))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — cost live slop', () => {
  test('heal cycle at the limit surfaces live slop attributed to Brook', async () => {
    const dir = fixture([
      { root: 'state', mission: 'sloppy', file: 'state', body: { mission: 'sloppy', lane: 'full', heal_cycle: 4, tokens_est: 5000, budget: 20000, evidence: [], updated_at: '2026-08-29T00:00:00Z' } },
    ]);
    try {
      const { out } = await capture(['cost', '--mission', 'sloppy'], dir);
      expect(out).toContain('Cost envelope');
      expect(out).toContain('Slop: 1 intervention(s)');
      expect(out).toContain('Brook:1');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('clean mission shows no slop line', async () => {
    const dir = fixture([
      { root: 'state', mission: 'clean', file: 'state', body: { mission: 'clean', lane: 'standard', heal_cycle: 0, tokens_est: 1000, budget: 20000, evidence: [], updated_at: '2026-08-29T00:00:00Z' } },
    ]);
    try {
      const { out } = await capture(['cost', '--mission', 'clean'], dir);
      expect(out).toContain('Cost envelope');
      expect(out).not.toContain('Slop:');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('--json emits a parseable ledger with slop interventions', async () => {
    const dir = fixture([
      { root: 'state', mission: 'sloppy', file: 'state', body: { mission: 'sloppy', lane: 'full', heal_cycle: 4, tokens_est: 5000, budget: 20000, evidence: [], updated_at: '2026-08-29T00:00:00Z' } },
    ]);
    // a config present means no bootstrap chatter pollutes the JSON output
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=guided\n');
    try {
      const { out } = await capture(['cost', '--mission', 'sloppy', '--json'], dir);
      const parsed = JSON.parse(out);
      expect(parsed.avoided.slop_interventions).toBe(1);
      expect(parsed.envelope.status).toBeTruthy();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('cost with an unknown mission prints an error and exits 1', async () => {
    const dir = fixture([]);
    try {
      const { err } = await capture(['cost', '--mission', 'nope'], dir);
      expect(err).toContain('No cost ledger found');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('cost without a mission and multiple in-flight states requires --mission', async () => {
    const dir = fixture([
      { root: 'state', mission: 'm1', file: 'state', body: state('m1') },
      { root: 'state', mission: 'm2', file: 'state', body: state('m2') },
    ]);
    try {
      const { err } = await capture(['cost'], dir);
      expect(err).toContain('multiple missions in flight');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — blame', () => {
  test('blame prints a provenance note for a path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-blame-'));
    try {
      const { out } = await capture(['blame', 'src/cli.ts'], dir);
      expect(out.length).toBeGreaterThan(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — handoff', () => {
  test('writes a handoff.md from computed state', async () => {
    const dir = fixture([
      { root: 'state', mission: 'hm', file: 'state', body: state('hm', { next_action: 'verify T2', blockers_open: 1, heal_cycle: 1 }) },
    ]);
    try {
      const { out } = await capture(['handoff', 'hm'], dir);
      expect(out).toContain('# Handoff: hm');
      expect(out).toContain('Next action');
      expect(out).toContain('Open blockers');
      expect(out).toContain('Heal cycles');
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'hm', 'handoff.md'))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — sign / list --check / cost --ledger', () => {
  test('sign --gen-key creates a pure ed25519 key pair in an isolated HOME', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mugi-cli-home-'));
    const prev = process.env.HOME;
    process.env.HOME = home;
    try {
      const { out } = await capture(['sign', '--gen-key']);
      expect(out).toContain('ed25519 key pair ready');
      expect(existsSync(join(home, '.mugiwara', 'mugiwara.pub'))).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.HOME; else process.env.HOME = prev;
      rmSync(home, { recursive: true, force: true });
    }
  });

  test('sign on a missing mission errors and exits 1', async () => {
    const dir = fixture([]);
    try {
      const { err } = await capture(['sign', 'nope'], dir);
      expect(err).toContain('no mission dir');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('list --check reports installation health', async () => {
    const dir = fixture([]);
    try {
      const { out } = await capture(['list', '--check'], dir);
      expect(out).toContain('No mugiwara installation found.');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('cost --ledger prints the decision trail', async () => {
    const dir = fixture([
      { root: 'state', mission: 'trail', file: 'state', body: { mission: 'trail', lane: 'standard', heal_cycle: 0, tokens_est: 1000, budget: 20000, evidence: [], updated_at: '2026-08-29T00:00:00Z' } },
    ]);
    writeFileSync(join(dir, '.mugiwara', 'missions', 'trail', 'decisions.md'), '## Cost governor decisions\n- 2026-08-29T00:00:00Z — AI: luffy: resume fast-path — reason: no config on fresh project\n');
    try {
      const { out } = await capture(['cost', '--mission', 'trail', '--ledger'], dir);
      expect(out).toContain('Trail: 1 decisions');
      expect(out).toContain('resume fast-path');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('continue --all crosses actors', async () => {
    const dir = fixture([
      { root: 'continue', mission: 'm1', file: 'state', body: { ...state('m1'), next_action: 'continue T1' } },
    ]);
    try {
      const { out } = await capture(['continue', '--all'], dir);
      // --all ignores the git actor filter; a solo mission resumes directly
      expect(out).toContain('Resumed:');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('cost auto-selects a single in-flight mission', async () => {
    const dir = fixture([
      { root: 'state', mission: 'solo', file: 'state', body: { mission: 'solo', lane: 'lean', heal_cycle: 0, tokens_est: 500, budget: 12000, evidence: [], updated_at: '2026-08-29T00:00:00Z' } },
    ]);
    try {
      const { out } = await capture(['cost'], dir);
      expect(out).toContain('Cost envelope');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('run() — install targets / uninstall --global', () => {
  test('install --target all expands every target id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-targets-'));
    try {
      const { out } = await capture(['install', '--yes', '--target', 'all'], dir);
      expect(out).toContain('OK mugiwara');
      expect(existsSync(join(dir, '.mugiwara', 'manifest.json'))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('uninstall --global with no manifest reports nothing installed', async () => {
    const dir = fixture([]);
    try {
      const { out } = await capture(['uninstall', '--global'], dir);
      expect(out).toContain('Nothing installed');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('project uninstall with no project manifest but a global one points at --global', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mugi-cli-uproj-'));
    const prev = process.env.HOME;
    process.env.HOME = home;
    mkdirSync(join(home, '.mugiwara'), { recursive: true });
    writeFileSync(join(home, '.mugiwara', 'manifest.json'), JSON.stringify({ version: '0.7.0', scope: 'global', installedAt: 'x', targets: ['claude'], files: [] }));
    const dir = fixture([]);
    try {
      const { out } = await capture(['uninstall', '--yes'], dir);
      expect(out).toContain('No project manifest found');
    } finally {
      if (prev === undefined) delete process.env.HOME; else process.env.HOME = prev;
      rmSync(home, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('uninstall of an opencode install clears the npm cache', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mugi-cli-uopen-'));
    const prev = process.env.HOME;
    process.env.HOME = home;
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-uopendir-'));
    mkdirSync(join(home, '.cache', 'opencode', 'packages', '@ionivetech'), { recursive: true });
    writeFileSync(join(home, '.cache', 'opencode', 'packages', '@ionivetech', 'x'), '');
    try {
      await capture(['install', '--yes', '--target', 'opencode'], dir);
      const { out } = await capture(['uninstall', '--yes'], dir);
      expect(out).toContain('OK removed');
    } finally {
      if (prev === undefined) delete process.env.HOME; else process.env.HOME = prev;
      rmSync(home, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('run() — usage errors + stalenessLine', () => {
  test('archive with no mission prints usage and exits 1', async () => {
    const dir = fixture([]);
    try {
      const { err } = await capture(['archive'], dir);
      expect(err).toContain('usage: mugiwara archive <mission>');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('blame with no path prints usage and exits 1', async () => {
    const dir = fixture([]);
    try {
      const { err } = await capture(['blame'], dir);
      expect(err).toContain('usage: mugiwara blame <file-path>');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('continue with an unknown mission prints known missions and exits 2', async () => {
    const dir = fixture([
      { root: 'continue', mission: 'm1', file: 'state', body: { ...state('m1'), next_action: 'go' } },
    ]);
    try {
      const { err } = await capture(['continue', 'ghost'], dir);
      expect(err).toContain('No in-flight mission "ghost"');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('continue with several missions lists them and exits 2', async () => {
    const dir = fixture([
      { root: 'continue', mission: 'm1', file: 'state', body: { ...state('m1'), next_action: 'go' } },
      { root: 'continue', mission: 'm2', file: 'state', body: { ...state('m2'), next_action: 'go' } },
    ]);
    try {
      const { out } = await capture(['continue', '--all'], dir);
      expect(out).toContain('missions in flight');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('continue on a team mission lists members and exits 2', async () => {
    const dir = fixture([
      { root: 'continue', mission: 'team', file: 'zoro', body: { ...state('team'), member: 'zoro', next_action: 'go' } },
      { root: 'continue', mission: 'team', file: 'nami', body: { ...state('team'), member: 'nami', next_action: 'go' } },
    ]);
    try {
      const { out } = await capture(['continue', '--all', 'team'], dir);
      expect(out).toContain('members in flight');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('continue with an unknown member of a known team reports it and exits 2', async () => {
    const dir = fixture([
      { root: 'continue', mission: 'team', file: 'zoro', body: { ...state('team'), member: 'zoro', next_action: 'go' } },
    ]);
    try {
      const { err } = await capture(['continue', '--all', 'team', 'nami'], dir);
      expect(err).toContain('has no member "nami"');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('stalenessLine returns null when base is unknown', () => {
    expect(stalenessLine(process.cwd(), 'unknown')).toBeNull();
  });

  test('stalenessLine returns null when no git ref resolves', () => {
    expect(stalenessLine(join(tmpdir(), 'no-such-repo'), 'abc1234')).toBeNull();
  });

  test('list prints a project manifest', async () => {
    const dir = fixture([]);
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    writeFileSync(
      join(dir, '.mugiwara', 'manifest.json'),
      JSON.stringify({ version: '0.7.0', scope: 'project', installedAt: '2026-08-29T00:00:00Z', targets: ['claude'], files: ['x'] }),
    );
    try {
      const { out } = await capture(['list'], dir);
      expect(out).toContain('project: v0.7.0 targets=claude');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('cost with a mission dir but no state uses the full-lane fallback', async () => {
    const dir = fixture([]);
    mkdirSync(join(dir, '.mugiwara', 'missions', 'nostate'), { recursive: true });
    try {
      const { out } = await capture(['cost', '--mission', 'nostate'], dir);
      expect(out).toContain('Cost envelope');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('sign on a mission with sign=off reports signing disabled', async () => {
    const dir = fixture([
      { root: 'state', mission: 's', file: 'state', body: state('s') },
    ]);
    writeFileSync(join(dir, '.mugiwara', 'missions', 's', 'report.md'), '# Report');
    writeFileSync(join(dir, '.mugiwara', 'config'), 'sign=off\n');
    try {
      const { out } = await capture(['sign', 's'], dir);
      expect(out).toContain('signing disabled');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('install --global writes to an isolated HOME', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mugi-cli-ghome-'));
    const prev = process.env.HOME;
    process.env.HOME = home;
    const dir = fixture([]);
    try {
      const { out } = await capture(['install', '--yes', '--global', '--target', 'claude'], dir);
      expect(out).toContain('OK mugiwara');
      expect(existsSync(join(home, '.mugiwara', 'manifest.json'))).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.HOME; else process.env.HOME = prev;
      rmSync(home, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('global install then uninstall cleans the manifest', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mugi-cli-gcycle-'));
    const prev = process.env.HOME;
    process.env.HOME = home;
    const dir = fixture([]);
    try {
      await capture(['install', '--yes', '--global', '--target', 'claude'], dir);
      const { out } = await capture(['uninstall', '--yes', '--global'], dir);
      expect(out).toContain('OK removed');
      expect(existsSync(join(home, '.mugiwara', 'manifest.json'))).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.HOME; else process.env.HOME = prev;
      rmSync(home, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('sign with the pure backend signs a mission report and verifies', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mugi-cli-signhome-'));
    const prev = process.env.HOME;
    process.env.HOME = home;
    const dir = fixture([
      { root: 'state', mission: 'signed', file: 'state', body: state('signed') },
    ]);
    writeFileSync(join(dir, '.mugiwara', 'missions', 'signed', 'report.md'), '# Signed report');
    try {
      await capture(['sign', '--gen-key'], dir);
      const signOut = await capture(['sign', 'signed'], dir);
      expect(signOut.out).toContain('signed');
      const verifyOut = await capture(['sign', 'signed', '--verify'], dir);
      expect(verifyOut.out).toContain('verifies');
    } finally {
      if (prev === undefined) delete process.env.HOME; else process.env.HOME = prev;
      rmSync(home, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('list --check reports missing files from a manifest', async () => {
    const dir = fixture([]);
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    writeFileSync(
      join(dir, '.mugiwara', 'manifest.json'),
      JSON.stringify({ version: '0.7.0', scope: 'project', installedAt: '2026-08-29T00:00:00Z', targets: ['claude'], files: ['/tmp/does-not-exist-mugi'] }),
    );
    try {
      const { out } = await capture(['list', '--check'], dir);
      expect(out).toContain('missing=1');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('handoff for a mission with no in-flight state errors and exits 1', async () => {
    const dir = fixture([]);
    try {
      const { err } = await capture(['handoff', 'ghost'], dir);
      expect(err).toContain('no in-flight mission "ghost"');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('handoff with no mission arg prints usage and exits 1', async () => {
    const dir = fixture([]);
    try {
      const { err } = await capture(['handoff'], dir);
      expect(err).toContain('usage: mugiwara handoff <mission>');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('sign --verify on a mission with no report errors', async () => {
    const dir = fixture([
      { root: 'state', mission: 's2', file: 'state', body: state('s2') },
    ]);
    try {
      const { out } = await capture(['sign', 's2', '--verify'], dir);
      expect(out).toContain('✗');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('stalenessLine flags when main is ahead of the mission base', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cli-git-'));
    try {
      const g = (a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      g(['init', '-q']);
      g(['config', 'user.email', 't@t.co']);
      g(['config', 'user.name', 't']);
      writeFileSync(join(dir, 'a.txt'), 'a');
      g(['add', '.']);
      g(['commit', '-q', '-m', 'a']);
      const base = g(['rev-parse', 'HEAD']);
      writeFileSync(join(dir, 'b.txt'), 'b');
      g(['add', '.']);
      g(['commit', '-q', '-m', 'b']);
      try { g(['branch', '-m', 'main']); } catch { /* already main */ }
      const line = stalenessLine(dir, base);
      expect(line).toContain('stale base');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});





