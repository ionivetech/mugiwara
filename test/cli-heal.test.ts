// test/cli-heal.test.ts — healing: push src/cli.ts coverage 79 → ≥90
// Covers migrateCmd (0% before), legacyWarning/schemaWarnings, harness bypass, clean edge cases
import { describe, expect, test, vi, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run, migrateCmd, stalenessLine } from '../src/cli.ts';
import { CURRENT_SCHEMA_VERSION } from '../src/continue.ts';

class ExitSignal extends Error { code: number; constructor(c: number) { super(`exit ${c}`); this.code = c; } }
const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((c: number) => { throw new ExitSignal(c); }) as never);
afterEach(() => exitSpy.mockClear());

async function capture(args: string[], dir?: string): Promise<{ out: string; err: string }> {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await run(dir ? [...args, '--project', dir] : args);
  } catch (e) {
    if (!(e instanceof ExitSignal)) throw e;
  } finally {
    const out = log.mock.calls.map(c => c.join(' ')).join('\n');
    const err = errSpy.mock.calls.map(c => c.join(' ')).join('\n');
    log.mockRestore(); errSpy.mockRestore();
    // return after restore
    return { out, err } as any;
  }
}

// helper to capture after restore — we need to capture inside try
async function cap(args: string[], dir?: string): Promise<{ out: string; err: string }> {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  let out = '', err = '';
  try {
    await run(dir ? [...args, '--project', dir] : args);
  } catch (e) {
    if (!(e instanceof ExitSignal)) throw e;
  } finally {
    out = log.mock.calls.map(c => c.join(' ')).join('\n');
    err = errSpy.mock.calls.map(c => c.join(' ')).join('\n');
    log.mockRestore(); errSpy.mockRestore();
  }
  return { out, err };
}

describe('heal: migrate', () => {
  test('migrate with no legacy layout prints no legacy', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-mig-none-'));
    try {
      const { out } = await cap(['migrate'], dir);
      expect(out).toContain('no legacy layout found');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('migrate with empty legacy dirs prints no legacy state files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-mig-empty-'));
    try {
      mkdirSync(join(dir, '.mugiwara', 'state'), { recursive: true });
      mkdirSync(join(dir, '.mugiwara', 'continue'), { recursive: true });
      const { out } = await cap(['migrate'], dir);
      expect(out).toContain('no legacy state files to migrate');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('migrate dry-run collects state + continue and does not delete', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-mig-dry-'));
    try {
      const sRoot = join(dir, '.mugiwara', 'state', 'my-mission');
      const cRoot = join(dir, '.mugiwara', 'continue', 'my-mission');
      mkdirSync(sRoot, { recursive: true });
      mkdirSync(cRoot, { recursive: true });
      writeFileSync(join(sRoot, 'state.json'), JSON.stringify({ mission: 'my-mission', flow: 1 }));
      writeFileSync(join(cRoot, 'state.json'), JSON.stringify({ mission: 'my-mission', member: null }));
      writeFileSync(join(cRoot, 'zoro.json'), JSON.stringify({ mission: 'my-mission', member: 'zoro' }));
      const { out } = await cap(['migrate', '--dry-run'], dir);
      expect(out).toContain('would migrate');
      expect(out).toContain('dry run');
      expect(existsSync(join(sRoot, 'state.json'))).toBe(true);
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'my-mission', 'state.json'))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('migrate real copies files, injects schema_version and prunes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-mig-real-'));
    try {
      const sRoot = join(dir, '.mugiwara', 'state', 'alpha');
      mkdirSync(sRoot, { recursive: true });
      writeFileSync(join(sRoot, 'state.json'), JSON.stringify({ mission: 'alpha', flow: 2 }));
      const cRoot = join(dir, '.mugiwara', 'continue');
      mkdirSync(cRoot, { recursive: true });
      writeFileSync(join(cRoot, 'state.json'), JSON.stringify({ mission: 'alpha', flow: 2 }));
      const { out } = await cap(['migrate'], dir);
      expect(out).toContain('migrated');
      const dest = join(dir, '.mugiwara', 'missions', 'alpha', 'state.json');
      expect(existsSync(dest)).toBe(true);
      const j = JSON.parse(readFileSync(dest, 'utf8'));
      expect(j.schema_version).toBe(CURRENT_SCHEMA_VERSION);
      expect(existsSync(join(sRoot, 'state.json'))).toBe(false);
      expect(existsSync(join(dir, '.mugiwara', 'state'))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('migrate handles continue member naming (state → continue.json, member → continue-<member>.json)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-mig-naming-'));
    try {
      const cRoot = join(dir, '.mugiwara', 'continue', 'team-m');
      mkdirSync(cRoot, { recursive: true });
      writeFileSync(join(cRoot, 'state.json'), JSON.stringify({ mission: 'team-m' }));
      writeFileSync(join(cRoot, 'nami.json'), JSON.stringify({ mission: 'team-m', member: 'nami' }));
      await cap(['migrate'], dir);
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'team-m', 'continue.json'))).toBe(true);
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'team-m', 'continue-nami.json'))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('migrate falls back to renameSync when JSON parse fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-mig-badjson-'));
    try {
      const sRoot = join(dir, '.mugiwara', 'state', 'bad');
      mkdirSync(sRoot, { recursive: true });
      writeFileSync(join(sRoot, 'state.json'), 'not-json{{{');
      const { out } = await cap(['migrate'], dir);
      expect(out).toContain('migrated');
      expect(existsSync(join(dir, '.mugiwara', 'missions', 'bad', 'state.json'))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('migrate via direct exported function', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-mig-direct-'));
    try {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        migrateCmd({ dryRun: false, project: dir } as any);
        expect(log.mock.calls.join(' ')).toContain('no legacy layout');
      } finally { log.mockRestore(); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('heal: legacyWarning and schemaWarnings', () => {
  test('list triggers legacyWarning when .mugiwara/state exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-legacy-'));
    try {
      mkdirSync(join(dir, '.mugiwara', 'state'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'state', 'dummy.json'), '{}');
      mkdirSync(join(dir, '.mugiwara', 'missions', 'dummy',), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'missions', 'dummy', 'state.json'), JSON.stringify({ mission: 'dummy', flow: 1, schema_version: CURRENT_SCHEMA_VERSION, updated_at: new Date().toISOString() }));
      const { err } = await cap(['list'], dir);
      expect(err).toContain('legacy layout detected');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('status triggers schema warning when state has old schema_version', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-schema-'));
    try {
      const m = join(dir, '.mugiwara', 'missions', 'old');
      mkdirSync(m, { recursive: true });
      writeFileSync(join(m, 'state.json'), JSON.stringify({ mission: 'old', flow: 1, schema_version: 1, updated_at: new Date().toISOString(), lane: 'full', branch: 'main', actor: 'x', tasks_done: 1, tasks_total: 1, blockers_open: 0, heal_cycle: 0, heal_max_cycles: 3, heal_halt: false, files_touched: 1, evidence: [] }));
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      const { err } = await cap(['status'], dir);
      expect(err).toContain('state written by v1');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('continue triggers both warnings', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-both-'));
    try {
      mkdirSync(join(dir, '.mugiwara', 'state'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'state', 'x.json'), '{}');
      const m = join(dir, '.mugiwara', 'missions', 'both');
      mkdirSync(m, { recursive: true });
      writeFileSync(join(m, 'state.json'), JSON.stringify({ mission: 'both', flow: 1, schema_version: '', updated_at: new Date().toISOString(), lane: 'full', branch: 'main', actor: 'x', tasks_done: 1, tasks_total: 1, blockers_open: 0, heal_cycle: 0, heal_max_cycles: 3, heal_halt: false, files_touched: 1, evidence: [] }));
      writeFileSync(join(m, 'continue.json'), JSON.stringify({ mission: 'both', member: null, flow: 1, updated_at: new Date().toISOString(), actor: 'x', branch: 'main', tasks_done: 1, tasks_total: 1, lane: 'full', mode: 'auto', next_action: 'x', next_session_prompt: '' }));
      mkdirSync(join(dir, '.mugiwara'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      const { err } = await cap(['continue', 'both'], dir);
      expect(err).toContain('legacy layout');
      expect(err).toContain('state written by vunknown');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('heal: harness bypass and enforcement branch', () => {
  test('install bypasses harness check even when policy requires enforcement', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-harness-bypass-'));
    try {
      mkdirSync(join(dir, '.mugiwara'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      // policy requires enforcement, but install should not exit 1
      writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: true\n');
      const prev = process.env.CLAUDECODE;
      process.env.CLAUDECODE = '1';
      delete process.env.OPENCODE;
      try {
        const { out, err } = await cap(['install', '--yes', '--target', 'claude', '--dry-run'], dir);
        expect(err).not.toContain('harness enforcement required');
        expect(out).not.toContain('harness enforcement');
      } finally {
        if (prev === undefined) delete process.env.CLAUDECODE; else process.env.CLAUDECODE = prev;
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('status enforces harness when policy requires it (rules-based → exit 1)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-harness-enforce-'));
    try {
      mkdirSync(join(dir, '.mugiwara'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: true\n');
      const prevC = process.env.CLAUDECODE;
      const prevO = process.env.OPENCODE;
      process.env.CLAUDECODE = '1';
      delete process.env.OPENCODE;
      try {
        const { err } = await cap(['status'], dir);
        expect(err).toContain('harness enforcement required');
        expect(exitSpy).toHaveBeenCalledWith(1);
        exitSpy.mockClear();
      } finally {
        if (prevC === undefined) delete process.env.CLAUDECODE; else process.env.CLAUDECODE = prevC;
        if (prevO === undefined) delete process.env.OPENCODE; else process.env.OPENCODE = prevO;
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('heal: clean edge branches', () => {
  test('clean with missing missions dir prints nothing to clean', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-clean-missing-'));
    try {
      mkdirSync(join(dir, '.mugiwara'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      const { out } = await cap(['clean'], dir);
      expect(out).toContain('nothing to clean');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('clean with invalid --before exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-clean-before-'));
    try {
      mkdirSync(join(dir, '.mugiwara', 'missions'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      const { err } = await cap(['clean', '--before', 'not-a-date'], dir);
      expect(err).toContain('invalid --before date');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('clean with no candidates prints nothing to clean', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-clean-empty-'));
    try {
      mkdirSync(join(dir, '.mugiwara', 'missions', 'empty'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      const { out } = await cap(['clean'], dir);
      expect(out).toContain('nothing to clean');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('heal: status/cost/continue/cover remaining branches', () => {
  test('cost without mission and no state exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cost-nomission-'));
    try {
      mkdirSync(join(dir, '.mugiwara'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      const { err } = await cap(['cost'], dir);
      expect(err).toContain('usage: mugiwara cost');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('cost with stale registry still shows envelope', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-cost-registry-'));
    try {
      const m = join(dir, '.mugiwara', 'missions', 'with-reg');
      mkdirSync(m, { recursive: true });
      writeFileSync(join(m, 'state.json'), JSON.stringify({ mission: 'with-reg', flow: 1, lane: 'full', budget: 10000, tokens_est: 500, evidence: [], updated_at: new Date().toISOString() }));
      writeFileSync(join(m, 'context-registry.jsonl'), 'not-json\n');
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      const { out } = await cap(['cost', '--mission', 'with-reg'], dir);
      expect(out).toContain('Cost envelope');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('stalenessLine returns null for unknown base and non-repo', () => {
    expect(stalenessLine('/tmp', 'unknown')).toBeNull();
    expect(stalenessLine('/nonexistent-xyz', 'abc123')).toBeNull();
  });

  test('run without script name exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-run-noarg-'));
    try {
      mkdirSync(join(dir, '.mugiwara'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      const { err } = await cap(['run'], dir);
      expect(err).toContain('usage: mugiwara run');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('sign with no mission arg exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-sign-noarg-'));
    try {
      mkdirSync(join(dir, '.mugiwara'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
      const { err } = await cap(['sign'], dir);
      expect(err).toContain('usage: mugiwara sign');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
