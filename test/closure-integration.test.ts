import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

vi.setConfig({ testTimeout: 30000 });
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { archiveMission } from '../src/mission.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mugi-close-e2e-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

type StateShape = Record<string, unknown>;

function buildMission(opts: { state: StateShape; files?: Record<string, string> }): string {
  const missionDir = join(dir, '.mugiwara', 'missions', 'demo');
  mkdirSync(join(missionDir, 'waves'), { recursive: true });
  mkdirSync(join(dir, '.mugiwara'), { recursive: true });
  writeFileSync(join(missionDir, 'plan.md'), '# Plan\n');
  writeFileSync(join(missionDir, 'waves', '06-closure.md'), 'closure summary');
  writeFileSync(join(missionDir, 'state.json'), JSON.stringify({ mission: 'demo', ...opts.state }));
  for (const [name, body] of Object.entries(opts.files ?? {})) {
    const p = join(missionDir, name);
    mkdirSync(p.slice(0, p.lastIndexOf('/')), { recursive: true });
    writeFileSync(p, body);
  }
  return missionDir;
}

describe('archive closure artifacts', () => {
  it('writes provenance.md; no git repo → no commit line, no rollback.sh', () => {
    buildMission({
      state: {
        branch: 'feat-x', base_sha: 'unknown', lane: 'standard', mode: 'auto',
        actor: 'tester', tasks_done: 1, tasks_total: 2, evidence: ['waves/06-closure.md'],
      },
    });
    const r = archiveMission(dir, 'demo');
    expect(r.kept).toContain(join('missions', 'demo', 'provenance.md'));
    const prov = readFileSync(join(dir, '.mugiwara', 'missions', 'demo', 'provenance.md'), 'utf8');
    expect(prov).toContain('# Provenance');
    expect(prov).toContain('lane standard');
    expect(prov).toContain('Commit: not recorded');
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'demo', 'rollback.sh'))).toBe(false);
    // durable set grows by exactly the provenance file
    const left = readdirSync(join(dir, '.mugiwara', 'missions', 'demo')).sort();
    expect(left).toEqual(['plan.md', 'provenance.md', 'report.md']);
  });

  it('appends review routing + context footprint to the folded report', async () => {
    // real git repo so changedFiles resolves
    execSync('git init -q -b main && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base && git checkout -q -b feat-w', { cwd: dir });
    mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
    writeFileSync(join(dir, 'src', 'auth', 'gate.ts'), 'export {};\n');
    execSync('git add -A && git commit -qm work', { cwd: dir });
    const base = execSync('git rev-parse main', { cwd: dir, encoding: 'utf8' }).trim();

    buildMission({
      state: {
        branch: 'feat-w', base_sha: base, lane: 'full', mode: 'auto',
        actor: 't', tasks_done: 1, tasks_total: 1, evidence: [],
        sensitive_paths: ['src/auth/**'],
      },
    });
    archiveMission(dir, 'demo');
    const rep = readFileSync(join(dir, '.mugiwara', 'missions', 'demo', 'report.md'), 'utf8');
    expect(rep).toContain('## Review routing');
    expect(rep).toMatch(/1\. `src\/auth\/gate\.ts`[^\n]*sensitive path/);
    expect(rep).toContain('Context footprint:');
    // provenance note attaches to branch head (git present)
    expect(readFileSync(join(dir, '.mugiwara', 'missions', 'demo', 'provenance.md'), 'utf8'))
      .not.toContain('Commit: not recorded');
  }, 20000);

  it('rollback.sh is generated with revert list when git history exists', () => {
    execSync('git init -q -b main && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base && git checkout -q -b feat-w', { cwd: dir });
    writeFileSync(join(dir, 'a.txt'), 'x\n');
    execSync('git add -A && git commit -qm one', { cwd: dir });
    writeFileSync(join(dir, 'b.txt'), 'y\n');
    execSync('git add -A && git commit -qm two', { cwd: dir });
    const base = execSync('git rev-parse main', { cwd: dir, encoding: 'utf8' }).trim();
    buildMission({ state: { branch: 'feat-w', base_sha: base, evidence: [] } });
    archiveMission(dir, 'demo');
    const rb = join(dir, '.mugiwara', 'missions', 'demo', 'rollback.sh');
    expect(existsSync(rb)).toBe(true);
    const body = readFileSync(rb, 'utf8');
    expect(body).toContain('# Rollback map for mission "demo"');
    expect(body).toMatch(/git revert --no-edit \\/);
    expect(statSync(rb).mode & 0o111).toBeTruthy(); // executable bit
  }, 20000);

  it('integrity gate blocks archive on a planted secret and passes once removed', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', evidence: [] },
      files: { 'review.md': 'key = ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456' },
    });
    let msg = '';
    try { archiveMission(dir, 'demo'); } catch (e) { msg = (e as Error).message; }
    expect(msg).toContain('closure integrity gate failed');
    expect(msg).toContain('GitHub token');
    rmSync(join(dir, '.mugiwara', 'missions', 'demo', 'review.md'));
    expect(() => archiveMission(dir, 'demo')).not.toThrow();
  });

  it('context budget over ceiling fails the archive when configured', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', evidence: [] },
      files: { 'notes.md': 'x'.repeat(500) },
    });
    writeFileSync(join(dir, '.mugiwara', 'config'), 'context_budget_chars=10\n');
    let msg = '';
    try { archiveMission(dir, 'demo'); } catch (e) { msg = (e as Error).message; }
    expect(msg).toContain('context budget failed');
  });
});
