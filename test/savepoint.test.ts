// test/savepoint.test.ts — G3: every state.json field has a non-trivial assertion.
import { test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
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

test('savepoint writes all state fields with non-trivial values (lane direct, no diff)', { timeout: 30000 }, () => {
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
    expect(state.lane_prev).toBeNull();
    expect(state.lane_rose).toBe(false);
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
    expect(['computed', 'reported']).toContain(state.tokens_source);
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

test('savepoint state.json has correct structure', { timeout: 30000 }, () => {
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
    expect(['computed', 'reported']).toContain(state.tokens_source);
    expect(typeof state.skill_version).toBe('string');
    expect(typeof state.updated_at).toBe('string');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('F7: tokens_est is a deterministic non-zero proxy; MUGIWARA_TOKENS overrides as reported', { timeout: 15000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-tokens-'));
  try {
    setupGit(dir);
    // diverge HEAD from main so the diff (and thus loc_delta) is non-empty
    execSync('git checkout -b feature-x', { cwd: dir });
    // known loc: commit a file with exactly 10 inserted lines
    const src = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
    writeFileSync(join(dir, 'src.ts'), src);
    execSync('git add src.ts && git commit -m wip', { cwd: dir });
    // known evidence words: exactly 20 words in the mission results dir
    const evDir = join(dir, '.mugiwara', 'results', 'test-mission');
    mkdirSync(evDir, { recursive: true });
    writeFileSync(join(evDir, '01-execution.md'), 'word '.repeat(20));

    runSavepoint(dir, 'test-mission "" "" 3 guided');
    const state = JSON.parse(readFileSync(join(dir, '.mugiwara', 'state.json'), 'utf8'));

    // lane is derived from the diff. HEAD is on `feature-x`, one commit ahead
    // of `main`, so `git merge-base HEAD main` is the base commit and the
    // 10-insertion commit yields LOC_DELTA = 10. lane = direct (1 file, base 0).
    // expected = 0 + floor(20*135/100) + (10*12) = 0 + 27 + 120 = 147
    expect(state.lane).toBe('direct');
    expect(state.loc_delta).toBe(10);
    expect(state.tokens_est).toBe(147);
    expect(state.tokens_source).toBe('computed');

    // override → reported
    runSavepoint(dir, 'test-mission "" "" 3 guided', { MUGIWARA_TOKENS: '12345' });
    const state2 = JSON.parse(readFileSync(join(dir, '.mugiwara', 'state.json'), 'utf8'));
    expect(state2.tokens_est).toBe(12345);
    expect(state2.tokens_source).toBe('reported');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('savepoint --branch mode writes state to branch-specific file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-savepoint-br-'));
  try {
    setupGit(dir);
    execSync(`bash "${SAVEPOINT}" --branch test feature-fix 1 guided`, {
      cwd: dir,
      env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });

    const stateFile = join(dir, '.mugiwara', 'state-feature-fix.json');
    expect(existsSync(stateFile)).toBe(true);
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    expect(state.mission).toBe('test');
    expect(state.branch).toBe('feature-fix');
    expect(state.mode).toBe('guided');
    // actor auto-resolves from git identity, never a positional (D7)
    expect(state.actor).toBe('Test <test@test.com>');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D10: savepoint writes continue.md position block at wave boundary', { timeout: 20000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-cont-'));
  try {
    setupGit(dir);
    // a crew-written next_session_prompt must survive across savepoints
    const mugi = join(dir, '.mugiwara');
    mkdirSync(join(mugi, 'plans'), { recursive: true });
    writeFileSync(join(mugi, 'continue.md'),
      '# Continue — test-mission\n\n- mission: test-mission\n- wave: 2\n- next_session_prompt: "Run T1-T5 then waves 4-9"\n');

    runSavepoint(dir, 'test-mission "" "" 3 guided');
    const text = readFileSync(join(dir, '.mugiwara', 'continue.md'), 'utf8');
    expect(text).toContain('- mission: test-mission');
    expect(text).toContain('- wave: 3');
    expect(text).toContain('- tasks_done: 0');
    expect(text).toContain('- mode: guided');
    // next_session_prompt is crew-written, preserved not invented
    expect(text).toContain('Run T1-T5 then waves 4-9');

    // next wave boundary rewrites the position fields
    runSavepoint(dir, 'test-mission "" "" 4 guided');
    const text2 = readFileSync(join(dir, '.mugiwara', 'continue.md'), 'utf8');
    expect(text2).toContain('- wave: 4');
    expect(text2).toContain('- next_session_prompt: "Run T1-T5 then waves 4-9"');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D10: continue.md is branch-scoped in --branch mode (multi-actor)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-contbr-'));
  try {
    setupGit(dir);
    execSync(`bash "${SAVEPOINT}" --branch test feature/dark-mode 3 guided`, {
      cwd: dir,
      env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });
    // branch-scoped file, not the shared one
    expect(existsSync(join(dir, '.mugiwara', 'continue-feature-dark-mode.md'))).toBe(true);
    expect(existsSync(join(dir, '.mugiwara', 'continue.md'))).toBe(false);
    const text = readFileSync(join(dir, '.mugiwara', 'continue-feature-dark-mode.md'), 'utf8');
    expect(text).toContain('- mission: test');
    expect(text).toContain('- wave: 3');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D10: continue.md branch slug sanitizes unsafe branch chars', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-contbr2-'));
  try {
    setupGit(dir);
    // branch with a newline would previously corrupt the line format
    execSync(`bash "${SAVEPOINT}" --branch test 'evil/branch' 1 guided`, {
      cwd: dir,
      env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });
    const files = readdirSync(join(dir, '.mugiwara')).filter(f => f.startsWith('continue-'));
    expect(files).toEqual(['continue-evil-branch.md']);
    const text = readFileSync(join(dir, '.mugiwara', 'continue-evil-branch.md'), 'utf8');
    // writer sanitizes / → - in the branch field (informational; state.json holds truth)
    expect(text).toContain('- branch: evil-branch');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D10: continue.md writer sanitizes branch/wave/mode fields (N2)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-contn2-'));
  try {
    setupGit(dir);
    // newline injection in branch + non-numeric wave + bad mode via env
    execSync(`bash "${SAVEPOINT}" --branch 'test' "evil$(printf '\\n-injected: pwned')" 1 guided`, {
      cwd: dir,
      env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });
    const text = readFileSync(join(dir, '.mugiwara', 'continue-evil-injectedpwned.md'), 'utf8');
    // the injected line must not appear as its own field
    expect(text).not.toContain('-injected: pwned');
    // branch line is sanitized (newline stripped, no separate line)
    expect(text).toContain('- branch: evil');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('budget_status: warn at 1.5x budget, stop at 3x (case 12)', { timeout: 15000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-budget-'));
  try {
    setupGit(dir);
    // diverge HEAD from main so the 2-file diff is non-empty (merge-base issue)
    execSync('git checkout -b feature-b', { cwd: dir });
    // 2 files → lane lean, budget 12000 → warn at 18000, stop at 36000
    writeFileSync(join(dir, 'a.ts'), 'a\n');
    writeFileSync(join(dir, 'b.ts'), 'b\n');
    execSync('git add a.ts b.ts && git commit -m wip', { cwd: dir });
    runSavepoint(dir, 'test-mission "" "" 3 guided', { MUGIWARA_TOKENS: '18000' });
    let state = JSON.parse(readFileSync(join(dir, '.mugiwara', 'state.json'), 'utf8'));
    expect(state.lane).toBe('lean');
    expect(state.tokens_est).toBe(18000);
    expect(state.budget_status).toBe('warn');
    runSavepoint(dir, 'test-mission "" "" 3 guided', { MUGIWARA_TOKENS: '36000' });
    state = JSON.parse(readFileSync(join(dir, '.mugiwara', 'state.json'), 'utf8'));
    expect(state.budget_status).toBe('stop');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
