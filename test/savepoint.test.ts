// test/savepoint.test.ts — G3: every state.json field has a non-trivial assertion.
// Layout: .mugiwara/state/<mission>/<member>.json (solo member=state.json) +
// .mugiwara/continue/<mission>/<member>.json (D10). Identity = (mission, member).
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

function statePath(dir: string, mission: string, member = '') {
  return join(dir, '.mugiwara', 'state', mission, member ? `${member}.json` : 'state.json');
}

function continuePath(dir: string, mission: string, member = '') {
  return join(dir, '.mugiwara', 'continue', mission, member ? `${member}.json` : 'state.json');
}

test('savepoint writes all state fields with non-trivial values (lane direct, no diff)', { timeout: 30000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-savepoint-'));
  try {
    setupGit(dir);
    // single empty commit — HEAD=main, no diff, lane=direct. Solo → state.json.
    runSavepoint(dir, 'test-mission "" 3 guided');

    const state = JSON.parse(readFileSync(statePath(dir, 'test-mission'), 'utf8'));

    expect(state.mission).toBe('test-mission');
    expect(state.member).toBeNull();
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
    expect(state.heal_max_cycles).toBe(3); // default, no config present
    expect(state.heal_halt).toBe(false);   // heal_cycle 1 < max 3
    expect(state.delegate_threshold).toBe(60); // default, no config present
    expect(state.delegate_due).toBe(false); // direct lane → budget 0 → never due
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

test('savepoint records verbosity from config (full) and defaults to normal', { timeout: 30000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-savepoint-verb-'));
  try {
    setupGit(dir);
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    // config with verbosity=full → state.verbosity === 'full'
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=guided\nverbosity=full\n');
    runSavepoint(dir, 'verb-mission "" 1 guided');
    let state = JSON.parse(readFileSync(statePath(dir, 'verb-mission'), 'utf8'));
    expect(state.verbosity).toBe('full');
    expect(state.mode).toBe('guided');

    // config without the key → state.verbosity === 'normal'
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=guided\n');
    runSavepoint(dir, 'verb-mission "" 1 guided');
    state = JSON.parse(readFileSync(statePath(dir, 'verb-mission'), 'utf8'));
    expect(state.verbosity).toBe('normal');

    // invalid value → falls back to 'normal'
    writeFileSync(join(dir, '.mugiwara', 'config'), 'verbosity=loud\n');
    runSavepoint(dir, 'verb-mission "" 1 guided');
    state = JSON.parse(readFileSync(statePath(dir, 'verb-mission'), 'utf8'));
    expect(state.verbosity).toBe('normal');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('savepoint state.json has correct structure', { timeout: 30000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-savepoint-struct-'));
  try {
    setupGit(dir);
    runSavepoint(dir, 'test "" 1 guided');

    const state = JSON.parse(readFileSync(statePath(dir, 'test'), 'utf8'));
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

test('4a: heal_cycle counts Wave-8 healing sections in the decision log, not the word "heal"', { timeout: 30000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-heal-'));
  try {
    setupGit(dir);
    mkdirSync(join(dir, '.mugiwara', 'logs'), { recursive: true });

    // no decision log → heal_cycle = 1 (no healing happened)
    runSavepoint(dir, 'heal-mission "" 3 guided');
    let state = JSON.parse(readFileSync(statePath(dir, 'heal-mission'), 'utf8'));
    expect(state.heal_cycle).toBe(1);

    // one heal cycle section → cycle 2; the word "heal" in prose does not inflate
    writeFileSync(
      join(dir, '.mugiwara', 'logs', '2026-08-19-heal-mission.md'),
      [
        '# Decision log — heal-mission',
        '## Flow 8 — healing (Brook)',
        'Fixed: heal counter wired to the decision log.',
        'The healing text mentions heal workers that never ran.',
      ].join('\n') + '\n',
    );
    runSavepoint(dir, 'heal-mission "" 3 guided');
    state = JSON.parse(readFileSync(statePath(dir, 'heal-mission'), 'utf8'));
    expect(state.heal_cycle).toBe(2);

    // two recorded cycles → cycle 3; a "Flow 8b"-style adjacent section does NOT count
    writeFileSync(
      join(dir, '.mugiwara', 'logs', '2026-08-19-heal-mission.md'),
      [
        '# Decision log — heal-mission',
        '## Flow 8 — healing (Brook)',
        'Cycle one.',
        '## Flow 8 — healing (Brook)',
        'Cycle two.',
        '## Flow 8b — unrelated enforcement section, not a heal cycle',
      ].join('\n') + '\n',
    );
    runSavepoint(dir, 'heal-mission "" 3 guided');
    state = JSON.parse(readFileSync(statePath(dir, 'heal-mission'), 'utf8'));
    expect(state.heal_cycle).toBe(3);
    // default max 3 → heal_cycle 3 >= 3 → halt, the computed cap the skills read
    expect(state.heal_max_cycles).toBe(3);
    expect(state.heal_halt).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('4f: savepoint reads heal_max_cycles and delegate_threshold from config', { timeout: 30000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-cfgwire-'));
  try {
    setupGit(dir);
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });

    // config values win; heal_cycle 1 < max 5 → no halt
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=guided\nheal_max_cycles=5\ndelegate_threshold=20\n');
    runSavepoint(dir, 'cfg-mission "" 1 guided');
    let state = JSON.parse(readFileSync(statePath(dir, 'cfg-mission'), 'utf8'));
    expect(state.heal_max_cycles).toBe(5);
    expect(state.heal_halt).toBe(false);
    expect(state.delegate_threshold).toBe(20);

    // garbage values fall back to defaults
    writeFileSync(join(dir, '.mugiwara', 'config'), 'heal_max_cycles=abc\ndelegate_threshold=0\n');
    runSavepoint(dir, 'cfg-mission "" 1 guided');
    state = JSON.parse(readFileSync(statePath(dir, 'cfg-mission'), 'utf8'));
    expect(state.heal_max_cycles).toBe(3);
    expect(state.delegate_threshold).toBe(1); // 0 clamped to the 1-100 range

    // out-of-range threshold clamps to the 1-100 range
    writeFileSync(join(dir, '.mugiwara', 'config'), 'delegate_threshold=250\n');
    runSavepoint(dir, 'cfg-mission "" 1 guided');
    state = JSON.parse(readFileSync(statePath(dir, 'cfg-mission'), 'utf8'));
    expect(state.delegate_threshold).toBe(100);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('4f: delegate_due is true when tokens_est crosses delegate_threshold% of budget', { timeout: 15000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-delegate-'));
  try {
    setupGit(dir);
    // 2 files → lane lean, budget 12000 (lane-base). threshold 20 → due at 2400.
    execSync('git checkout -b feature-d', { cwd: dir });
    writeFileSync(join(dir, 'a.ts'), 'a\n');
    writeFileSync(join(dir, 'b.ts'), 'b\n');
    execSync('git add a.ts b.ts && git commit -m wip', { cwd: dir });
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'config'), 'delegate_threshold=20\n');

    runSavepoint(dir, 'test-mission "" 3 guided', { MUGIWARA_TOKENS: '3000' });
    let state = JSON.parse(readFileSync(statePath(dir, 'test-mission'), 'utf8'));
    expect(state.lane).toBe('lean');
    expect(state.budget).toBe(12000);
    expect(state.delegate_threshold).toBe(20);
    expect(state.delegate_due).toBe(true);

    // below the bar → not due; threshold stays relative to budget
    runSavepoint(dir, 'test-mission "" 3 guided', { MUGIWARA_TOKENS: '2000' });
    state = JSON.parse(readFileSync(statePath(dir, 'test-mission'), 'utf8'));
    expect(state.delegate_due).toBe(false);
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
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'a.ts'), src);
    execSync('git add src/a.ts && git commit -m wip', { cwd: dir });
    // known evidence words: exactly 20 words in the mission results dir
    const evDir = join(dir, '.mugiwara', 'results', 'test-mission');
    mkdirSync(evDir, { recursive: true });
    writeFileSync(join(evDir, '01-execution.md'), 'word '.repeat(20));

    runSavepoint(dir, 'test-mission "" 3 guided');
    const state = JSON.parse(readFileSync(statePath(dir, 'test-mission'), 'utf8'));

    // lane is derived from the diff. HEAD is on `feature-x`, one commit ahead
    // of `main`, so `git merge-base HEAD main` is the base commit and the
    // 10-insertion commit yields LOC_DELTA = 10. lane = direct (1 file, base 0).
    // expected = 0 + floor(20*135/100) + (10*12) = 0 + 27 + 120 = 147
    expect(state.lane).toBe('direct');
    expect(state.loc_delta).toBe(10);
    expect(state.tokens_est).toBe(147);
    expect(state.tokens_source).toBe('computed');

    // override → reported
    runSavepoint(dir, 'test-mission "" 3 guided', { MUGIWARA_TOKENS: '12345' });
    const state2 = JSON.parse(readFileSync(statePath(dir, 'test-mission'), 'utf8'));
    expect(state2.tokens_est).toBe(12345);
    expect(state2.tokens_source).toBe('reported');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('savepoint team member writes state to state/<mission>/<member>.json', { timeout: 30000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-savepoint-member-'));
  try {
    setupGit(dir);
    runSavepoint(dir, 'payment-gateway patty 1 guided');

    const stateFile = statePath(dir, 'payment-gateway', 'patty');
    expect(existsSync(stateFile)).toBe(true);
    // solo state.json not created by a team run
    expect(existsSync(statePath(dir, 'payment-gateway'))).toBe(false);
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    expect(state.mission).toBe('payment-gateway');
    expect(state.member).toBe('patty');
    expect(state.wave).toBe(1);
    expect(state.mode).toBe('guided');
    // actor auto-resolves from git identity, never a positional
    expect(state.actor).toBe('Test <test@test.com>');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D10: savepoint writes continue JSON position block at wave boundary', { timeout: 20000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-cont-'));
  try {
    setupGit(dir);
    // a crew-written next_session_prompt must survive across savepoints
    const cont = continuePath(dir, 'test-mission');
    mkdirSync(join(dirname(cont)), { recursive: true });
    writeFileSync(cont, JSON.stringify({ mission: 'test-mission', wave: 2, next_session_prompt: 'Run T1-T5 then waves 4-9' }));

    runSavepoint(dir, 'test-mission "" 3 guided');
    const cont2 = JSON.parse(readFileSync(continuePath(dir, 'test-mission'), 'utf8'));
    expect(cont2.mission).toBe('test-mission');
    expect(cont2.wave).toBe(3);
    expect(cont2.mode).toBe('guided');
    expect(cont2.lane).toBeTruthy();
    // next_session_prompt is crew-written, preserved not invented
    expect(cont2.next_session_prompt).toBe('Run T1-T5 then waves 4-9');

    // next wave boundary rewrites position fields
    runSavepoint(dir, 'test-mission "" 4 guided');
    const cont3 = JSON.parse(readFileSync(continuePath(dir, 'test-mission'), 'utf8'));
    expect(cont3.wave).toBe(4);
    expect(cont3.next_session_prompt).toBe('Run T1-T5 then waves 4-9');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D10: continue is (mission, member) scoped — team members never clobber', { timeout: 20000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-contmem-'));
  try {
    setupGit(dir);
    // two members on the same mission → separate files
    runSavepoint(dir, 'payment-gateway john 3 guided');
    runSavepoint(dir, 'payment-gateway patty 3 guided');

    expect(existsSync(continuePath(dir, 'payment-gateway', 'john'))).toBe(true);
    expect(existsSync(continuePath(dir, 'payment-gateway', 'patty'))).toBe(true);
    const john = JSON.parse(readFileSync(continuePath(dir, 'payment-gateway', 'john'), 'utf8'));
    const patty = JSON.parse(readFileSync(continuePath(dir, 'payment-gateway', 'patty'), 'utf8'));
    expect(john.member).toBe('john');
    expect(patty.member).toBe('patty');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D10: branch field reflects git branch (sanitized slug)', { timeout: 20000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-contbr2-'));
  try {
    setupGit(dir);
    execSync('git checkout -b evil/branch', { cwd: dir });
    runSavepoint(dir, 'test-mission "" 3 guided');
    const cont = JSON.parse(readFileSync(continuePath(dir, 'test-mission'), 'utf8'));
    // writer sanitizes / → - in the branch field (informational; state.json holds truth)
    expect(cont.branch).toBe('evil-branch');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D10: continue writer sanitizes wave/mode fields (N2)', { timeout: 20000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-contn2-'));
  try {
    setupGit(dir);
    // non-numeric wave + bad mode via env — must not corrupt JSON
    runSavepoint(dir, 'test-mission "" "abc" "chaos"');
    const cont = JSON.parse(readFileSync(continuePath(dir, 'test-mission'), 'utf8'));
    expect(cont.wave).toBe(0); // non-numeric → 0
    expect(cont.mode).toBe('guided'); // bad enum → guided
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
    runSavepoint(dir, 'test-mission "" 3 guided', { MUGIWARA_TOKENS: '18000' });
    let state = JSON.parse(readFileSync(statePath(dir, 'test-mission'), 'utf8'));
    expect(state.lane).toBe('lean');
    expect(state.tokens_est).toBe(18000);
    expect(state.budget_status).toBe('warn');
    runSavepoint(dir, 'test-mission "" 3 guided', { MUGIWARA_TOKENS: '36000' });
    state = JSON.parse(readFileSync(statePath(dir, 'test-mission'), 'utf8'));
    expect(state.budget_status).toBe('stop');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { dirname } from 'node:path';
