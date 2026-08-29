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

function buildMission(opts: { mission?: string; state: StateShape; files?: Record<string, string> }): string {
  const name = opts.mission ?? 'demo';
  const missionDir = join(dir, '.mugiwara', 'missions', name);
  mkdirSync(join(missionDir, 'flows'), { recursive: true });
  mkdirSync(join(dir, '.mugiwara'), { recursive: true });
  writeFileSync(join(missionDir, 'plan.md'), '# Plan\n');
  writeFileSync(join(missionDir, 'flows', '06-closure.md'), 'closure summary');
  writeFileSync(join(missionDir, 'state.json'), JSON.stringify({ mission: name, ...opts.state }));
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
        actor: 'tester', tasks_done: 1, tasks_total: 2, evidence: ['flows/06-closure.md'],
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
    expect(rep).toContain('Context footprint');
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

  it('provenance note lists unique models from per-stage state files', () => {
    const m1 = buildMission({ mission: 'alpha', state: { branch: 'feat-a', base_sha: 'unknown', evidence: [], model: 'claude-x' } });
    writeFileSync(join(m1, 'zoro.json'), JSON.stringify({ mission: 'alpha', member: 'zoro', model: 'fallback-y', branch: 'feat-a', base_sha: 'unknown', evidence: [] }));
    archiveMission(dir, 'alpha');
    const prov = readFileSync(join(dir, '.mugiwara', 'missions', 'alpha', 'provenance.md'), 'utf8');
    expect(prov).toContain('model(s): claude-x, fallback-y');
  });

  it('parallel archives of distinct missions both land in index.md (×20 for flake)', async () => {
    for (let i = 0; i < 20; i++) {
      rmSync(join(dir, '.mugiwara'), { recursive: true, force: true });
      buildMission({ mission: 'alpha', state: { branch: 'feat-a', base_sha: 'unknown', evidence: [] } });
      buildMission({ mission: 'beta', state: { branch: 'feat-b', base_sha: 'unknown', evidence: [] } });
      await Promise.all([archiveMission(dir, 'alpha'), archiveMission(dir, 'beta')]);
      const idx = readFileSync(join(dir, '.mugiwara', 'index.md'), 'utf8');
      expect(idx).toContain('- alpha —');
      expect(idx).toContain('- beta —');
    }
  }, 30000);
});

describe('pr-verdict survives archive (pr-verdict-standalone)', () => {
  it('flows/07-pr-verdict.md is copied to pr-verdict.md at root and not folded', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', lane: 'standard', mode: 'auto', actor: 't', tasks_done: 1, tasks_total: 1, evidence: [] },
      files: { 'flows/07-pr-verdict.md': '# PR verdict\n\n**GO** — ship it.\n' },
    });
    const r = archiveMission(dir, 'demo');
    const root = join(dir, '.mugiwara', 'missions', 'demo');
    expect(existsSync(join(root, 'pr-verdict.md'))).toBe(true);
    expect(readFileSync(join(root, 'pr-verdict.md'), 'utf8')).toContain('PR verdict');
    expect(existsSync(join(root, 'flows', '07-pr-verdict.md'))).toBe(false);
    // not folded into report.md
    const rep = readFileSync(join(root, 'report.md'), 'utf8');
    expect(rep).not.toContain('Archived: 07-pr-verdict.md');
    expect(r.kept.some(k => k.endsWith('pr-verdict.md'))).toBe(true);
  });

  it('archive without a pr-verdict file keeps working (no crash)', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', lane: 'standard', mode: 'auto', actor: 't', tasks_done: 1, tasks_total: 1, evidence: [] },
    });
    expect(() => archiveMission(dir, 'demo')).not.toThrow();
  });
});

describe('cost-events.jsonl folds at archive (Phase 1 cost governor)', () => {
  it('records a closure event and folds it into report.md, then removes the file', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', lane: 'standard', mode: 'auto', actor: 't', tokens_est: 14200, tasks_done: 1, tasks_total: 1, evidence: [] },
    });
    const root = join(dir, '.mugiwara', 'missions', 'demo');
    archiveMission(dir, 'demo');
    const rep = readFileSync(join(root, 'report.md'), 'utf8');
    expect(rep).toContain('## Archived: cost-events.jsonl');
    expect(rep).toContain('"kind":"closure"');
    expect(rep).toContain('"mission":"demo"');
    // folded + removed — nothing survives loose
    expect(existsSync(join(root, 'cost-events.jsonl'))).toBe(false);
  });

  it('dry-run does not write a cost event', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', lane: 'standard', mode: 'auto', actor: 't', tokens_est: 14200, tasks_done: 1, tasks_total: 1, evidence: [] },
    });
    const root = join(dir, '.mugiwara', 'missions', 'demo');
    archiveMission(dir, 'demo', { dryRun: true });
    expect(existsSync(join(root, 'cost-events.jsonl'))).toBe(false);
  });
});

describe('Phase 2 — C2/Q1/Q2 + context efficiency (context governor)', () => {
  // C2: closure event `status` gates on the LANE token budget, never on the
  // context char budget. Old code used effBudget = budget || laneBudget, so a
  // configured char budget (150000) swallowed the token gate. New code gates
  // status on laneBudget (25000 for standard) and reports context separately.
  it('status gates on lane token budget, not context char budget; context reported separately', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', lane: 'standard', mode: 'auto', actor: 't', tokens_est: 40000, tasks_done: 1, tasks_total: 1, evidence: [] },
    });
    writeFileSync(join(dir, '.mugiwara', 'config'), 'context_budget_chars=150000\n');
    const root = join(dir, '.mugiwara', 'missions', 'demo');
    archiveMission(dir, 'demo');
    const rep = readFileSync(join(root, 'report.md'), 'utf8');
    // lane standard budget 25000, warn 37500 → 40000 is warn on the lane token budget
    expect(rep).toMatch(/Budget status[\s\S]*warn/i);
    // context chars are well under 150000 → context status ok
    expect(rep).toMatch(/Context footprint/);
    // closure event status = warn (lane budget), context_status = ok
    const evLine = readFileSync(join(root, 'report.md'), 'utf8').split(/\r?\n/).find((l) => l.includes('"kind":"closure"'));
    expect(evLine).toBeTruthy();
    expect(JSON.parse(evLine ?? '{}')).toMatchObject({ status: 'warn', context_status: 'ok' });
  });

  // Q2: status computed once — the closure event `status` and the report
  // `Budget status` must be identical (no double/recomputed gate).
  it('computes status once — event status matches the report Budget status', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', lane: 'full', mode: 'auto', actor: 't', tokens_est: 160000, tasks_done: 1, tasks_total: 1, evidence: [] },
    });
    const root = join(dir, '.mugiwara', 'missions', 'demo');
    archiveMission(dir, 'demo');
    const rep = readFileSync(join(root, 'report.md'), 'utf8');
    const ev = JSON.parse(rep.split(/\r?\n/).find((l) => l.includes('"kind":"closure"')) ?? '{}') as { status: string };
    // full lane budget 50000, stop 150000 → 160000 is stop on the lane token budget
    expect(ev.status).toBe('stop');
    expect(rep).toMatch(/Budget status[\s\S]*stop/i);
  });

  // Q1 + metrics: Cost section renders from the envelope and a Context
  // efficiency row appears; zeros + a note when no registry exists.
  it('renders a Context efficiency row with zeros and a no-registry note when absent', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', lane: 'standard', mode: 'auto', actor: 't', tokens_est: 1000, tasks_done: 1, tasks_total: 1, evidence: [] },
    });
    const root = join(dir, '.mugiwara', 'missions', 'demo');
    archiveMission(dir, 'demo');
    const rep = readFileSync(join(root, 'report.md'), 'utf8');
    expect(rep).toContain('Context efficiency');
    expect(rep).toContain('no registry — reads not tracked');
    expect(rep).toMatch(/reuse_rate[\s\S]*0/);
    expect(rep).toMatch(/files_loaded[\s\S]*0/);
  });

  // Q1 + metrics: with a registry present, the row reports the measured values.
  it('renders context metrics from a present registry', () => {
    buildMission({
      state: { branch: 'feat-x', base_sha: 'unknown', lane: 'standard', mode: 'auto', actor: 't', tokens_est: 1000, tasks_done: 1, tasks_total: 1, evidence: [] },
      files: {
        'context-registry.jsonl': [
          JSON.stringify({ fingerprint: 'f1', kind: 'file', file: 'src/a.ts', id: 'E001', reads: 2, ref: 'E001 src/a.ts' }),
          JSON.stringify({ fingerprint: 'f2', kind: 'file', file: 'src/b.ts', id: 'E002', reads: 1, ref: 'E002 src/b.ts' }),
        ].join('\n') + '\n',
      },
    });
    const root = join(dir, '.mugiwara', 'missions', 'demo');
    archiveMission(dir, 'demo');
    const rep = readFileSync(join(root, 'report.md'), 'utf8');
    expect(rep).toContain('Context efficiency');
    // 2 reads total, 1 repeat (E001 read twice) → reuse 1/2
    expect(rep).toContain('repeated_reads');
  });
});
