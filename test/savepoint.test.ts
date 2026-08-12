// test/savepoint.test.ts — G3: every state.json field has a non-trivial assertion.
import { test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SAVEPOINT = join(import.meta.dirname, '..', 'scripts', 'savepoint.sh');

function runSavepoint(dir: string, args: string, envExtra?: Record<string, string>) {
  const env = {
    ...process.env,
    MUGIWARA_DIR: join(dir, '.mugiwara'),
    ...envExtra,
  };
  execSync(`bash "${SAVEPOINT}" ${args}`, { cwd: dir, env });
}

function setupGit(dir: string) {
  execSync('git init && git config user.email test@test.com && git config user.name Test', { cwd: dir });
  execSync('git commit --allow-empty -m base', { cwd: dir });
}

test('savepoint writes all state fields with non-trivial values (lane direct, no diff)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-savepoint-'));
  try {
    setupGit(dir);
    // single empty commit — HEAD=main, no diff, lane=direct
    runSavepoint(dir, 'test-mission "" "" 3 guided');

    const state = JSON.parse(readFileSync(join(dir, '.mugiwara', 'state.json'), 'utf8'));

    expect(state.mission).toBe('test-mission');
    expect(typeof state.actor).toBe('string');
    expect(['direct', 'lean', 'standard', 'full', 'spike']).toContain(state.lane);
    expect(typeof state.lane_reason).toBe('string');
    expect(state.wave).toBe(3);
    expect(state.mode).toBe('guided');
    expect(typeof state.files_touched).toBe('number');
    expect(state.files_touched).toBeGreaterThanOrEqual(0);
    expect(typeof state.loc_delta).toBe('number');
    expect(Array.isArray(state.sensitive_paths)).toBe(true);
    expect(typeof state.tasks.done).toBe('number');
    expect(typeof state.tasks.total).toBe('number');
    expect(state.blockers_open).toBe(0);
    expect(state.heal_cycle).toBe(1);
    expect(state.tokens_est).toBeGreaterThanOrEqual(0);
    expect(state.budget).toBeGreaterThanOrEqual(0);
    expect(['ok', 'warn', 'stop']).toContain(state.budget_status);
    expect(typeof state.skill_version).toBe('string');
    expect(state.skill_version.length).toBeGreaterThan(0);
    expect(Array.isArray(state.evidence)).toBe(true);
    expect(typeof state.updated_at).toBe('string');
    expect(state.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('savepoint state.json has correct structure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-savepoint-struct-'));
  try {
    setupGit(dir);
    runSavepoint(dir, 'test "" "" 1 guided');

    const state = JSON.parse(readFileSync(join(dir, '.mugiwara', 'state.json'), 'utf8'));
    expect(state.mission).toBeTruthy();
    expect(state.wave).toBeGreaterThanOrEqual(1);
    expect(state.mode).toBe('guided');
    expect(typeof state.files_touched).toBe('number');
    expect(typeof state.loc_delta).toBe('number');
    expect(Array.isArray(state.sensitive_paths)).toBe(true);
    expect(typeof state.blockers_open).toBe('number');
    expect(typeof state.heal_cycle).toBe('number');
    expect(typeof state.budget).toBe('number');
    expect(typeof state.skill_version).toBe('string');
    expect(typeof state.updated_at).toBe('string');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('savepoint --branch mode writes state to branch-specific file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-savepoint-br-'));
  try {
    setupGit(dir);
    execSync(`bash "${SAVEPOINT}" --branch test "" feature-fix 1 guided`, {
      cwd: dir,
      env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });

    const stateFile = join(dir, '.mugiwara', 'state-feature-fix.json');
    expect(existsSync(stateFile)).toBe(true);
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    expect(state.mission).toBe('test');
    expect(state.branch).toBe('feature-fix');
    expect(state.mode).toBe('guided');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
