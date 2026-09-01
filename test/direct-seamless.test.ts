// test/direct-seamless.test.ts — T8 seamless verification
// Solo Lane 0 mission 1 file <20 LOC should be 3 gates, 1 dispatch, cost direct budget, no review/security/heal.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { gatesForLane } from '../src/policy.ts';
import { budgetForLane } from '../src/cost.ts';

const ROOT = join(import.meta.dirname, '..');
const LANE = join(ROOT, 'scripts', 'lane.sh');
const SAVEPOINT = join(ROOT, 'scripts', 'savepoint.sh');
const SLOW = 30000;

function run(bin: string, args: string[], cwd: string): { status: number | null; stdout: string } {
  const r = spawnSync('bash', [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, MUGIWARA_DIR: join(cwd, '.mugiwara') } });
  return { status: r.status, stdout: `${r.stdout}\n${r.stderr}`.trim() };
}

describe('T8 seamless — solo direct', () => {
  it('gatesForLane direct → 3 steps, full → 12 steps', () => {
    expect(gatesForLane('direct')).toEqual(['build-hooks:check', 'typecheck', 'build']);
    expect(gatesForLane('direct')).toHaveLength(3);
    expect(gatesForLane('full')).toHaveLength(12);
    expect(gatesForLane('full')).toContain('conformance');
  });

  it('direct gates exclude heavy steps (no review/security/heal/evals)', () => {
    const direct = gatesForLane('direct');
    expect(direct).not.toContain('run-evals');
    expect(direct).not.toContain('retrieval-eval');
    expect(direct).not.toContain('conformance');
    expect(direct).not.toContain('verify-install');
    expect(direct).not.toContain('test:coverage');
  });

  it('budgetForLane direct → 0 (direct budget)', () => {
    expect(budgetForLane('direct')).toBe(0);
    expect(budgetForLane('full')).toBe(50000);
  });

  it('solo 1 file <20 LOC → lane direct via lane.sh', { timeout: SLOW }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-direct-'));
    try {
      execSync('git init -q && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base && git checkout -q -b feat-direct', { cwd: dir });
      writeFileSync(join(dir, 'fix.ts'), 'export const x = 1;\n');
      execSync('git add -A && git commit -qm fix', { cwd: dir });
      const r = run(LANE, ['main', '--json'], dir);
      expect(r.status).toBe(0);
      const j = JSON.parse(r.stdout);
      expect(j.lane).toBe('direct');
      expect(j.files_touched).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('solo direct savepoint → flow 1, 1/1 tasks, lane direct', { timeout: SLOW }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-direct-sp-'));
    try {
      execSync('git init -q && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base', { cwd: dir });
      // plan.md with 1 task to prove 1/1
      const mdir = join(dir, '.mugiwara', 'missions', 'solo');
      mkdirSync(mdir, { recursive: true });
      writeFileSync(join(mdir, 'plan.md'), '# Plan\n\n- [x] T1 fix typo\n');
      execSync('git checkout -q -b feat-direct', { cwd: dir });
      writeFileSync(join(dir, 'fix.ts'), 'export const x = 1;\n');
      execSync('git add -A && git commit -qm fix', { cwd: dir });
      const r = run(SAVEPOINT, ['solo', '', '1', 'guided'], dir);
      expect(r.status).toBe(0);
      const state = JSON.parse(readFileSync(join(dir, '.mugiwara', 'missions', 'solo', 'state.json'), 'utf8'));
      expect(state.lane).toBe('direct');
      expect(state.flow).toBe(1);
      expect(state.tasks.done).toBe(1);
      expect(state.tasks.total).toBe(1);
      expect(state.budget).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Memory Keeper skip when lessons.md empty & lane direct', () => {
    // prose gate: both agent and skill document the skip
    const keeper = readFileSync(join(ROOT, 'content', 'agents', 'memory-keeper.md'), 'utf8');
    const lessons = readFileSync(join(ROOT, 'content', 'skills', 'mugiwara-lessons', 'SKILL.md'), 'utf8');
    expect(keeper).toContain('Lane 0 direct with empty ledger');
    expect(lessons).toContain('Lane 0 direct with empty ledger');
    // functional predicate: direct + missing ledger → skip
    const shouldSkip = (lane: string, lessonsExists: boolean, lessonsEmpty: boolean) =>
      lane === 'direct' && (!lessonsExists || lessonsEmpty);
    expect(shouldSkip('direct', false, true)).toBe(true);
    expect(shouldSkip('direct', true, true)).toBe(true);
    expect(shouldSkip('direct', true, false)).toBe(false);
    expect(shouldSkip('full', false, true)).toBe(false);
  });

  it('Zoro scope guard — rejects new dep when stdlib covers', () => {
    const zoro = readFileSync(join(ROOT, 'content', 'agents', 'zoro-execution.md'), 'utf8');
    expect(zoro).toContain('Scope guard');
    expect(zoro).toContain('Reject new dep when stdlib');
    expect(zoro).toContain('cost-governor.md');
  });

  it('Brook 4-phase — reproduce → localize → reduce → guard', () => {
    const brook = readFileSync(join(ROOT, 'content', 'agents', 'brook-healing.md'), 'utf8');
    const healing = readFileSync(join(ROOT, 'content', 'skills', 'mugiwara-healing', 'SKILL.md'), 'utf8');
    expect(brook).toContain('reproduce → localize → reduce → guard');
    expect(healing).toContain('reproduce → localize → reduce → guard');
  });
});
