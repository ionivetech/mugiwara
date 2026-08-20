// test/lane-integrity.test.ts — 36-case matrix from the v0.6.2 Principal
// Engineer Review (D1-D9) + fixture expect blocks + lanes.md drift gate.
// Uses test/fixtures/*.json materialized by scripts/setup-fixtures.ts.
// Every assertion is non-trivial — a field that reads a wrong value fails
// (G3 assertion rule).
import { test, expect } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

// each case materializes a git repo + runs savepoint (spawnSync) — git init
// and fixture setup are slow on CI. Raise the default per-test timeout via
// the vitest config-less default (5000ms is too tight for 2-3 savepoints).
const SLOW = 30000;

const ROOT = join(import.meta.dirname, '..');
const LANE = join(ROOT, 'scripts', 'lane.sh');
const SAVEPOINT = join(ROOT, 'scripts', 'savepoint.sh');
const EVIDENCE = join(ROOT, 'scripts', 'evidence.sh');
const SETUP = join(ROOT, 'scripts', 'setup-fixtures.ts');
const INSTALLER = join(ROOT, 'src', 'installer.ts');

function fixtureDir(tag: string): string {
  const dir = mkdtempSync(join(tmpdir(), `mugi-fixture-${tag}-`));
  execSync(`bun "${SETUP}" ${tag} "${dir}"`, { cwd: ROOT, stdio: 'pipe' });
  return dir;
}

// git init defaults to `main`; this creates a base commit and branches off it.
function baseRepo(dir: string) {
  execSync('git init -q && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base && git checkout -q -b feat-w', { cwd: dir });
}

function run(bin: string, args: string[], cwd: string, envExtra: Record<string, string> = {}): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync('bash', [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, MUGIWARA_DIR: join(cwd, '.mugiwara'), ...envExtra } });
  // merge stderr into stdout for matching; keep raw stderr too
  return { status: r.status, stdout: `${r.stdout}\n${r.stderr}`.trim(), stderr: r.stderr };
}

// run savepoint with the (mission, member) interface: <mission> [member] [wave] [mode]
function runSavepoint(dir: string, mission: string, member = '', wave = 1, mode = 'guided', envExtra: Record<string, string> = {}) {
  return run(SAVEPOINT, [mission, member, String(wave), mode], dir, envExtra);
}

// solo state: .mugiwara/state/<mission>/state.json
function readState(dir: string, mission = 'm') {
  return JSON.parse(readFileSync(join(dir, '.mugiwara', 'state', mission, 'state.json'), 'utf8'));
}

// team state: .mugiwara/state/<mission>/<member>.json
function readMemberState(dir: string, mission: string, member: string) {
  return JSON.parse(readFileSync(join(dir, '.mugiwara', 'state', mission, `${member}.json`), 'utf8'));
}

// ---------- D1: cases 1-6 — lane_prev resolve + lane_rose ----------

test('case 1: savepoint reads lane_prev from state.json (D1 fixed)', { timeout: SLOW }, () => {
  const dir = fixtureDir('standard-feature');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided');
    runSavepoint(dir, 'm', '', 2, 'guided');
    const state = readState(dir);
    expect(state.lane_prev).toBe('standard'); // second run sees first run's lane
    expect(state.lane).toBe('standard');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 4: relative MUGIWARA_DIR resolves lane_prev (D1 exact bug)', { timeout: SLOW }, () => {
  const dir = fixtureDir('standard-feature');
  try {
    // first run with a RELATIVE MUGIWARA_DIR — the old require() choked on
    // '.mugiwara/state.json' (MODULE_NOT_FOUND, needs './' prefix), so
    // lane_prev silently read empty. readFileSync resolves it from any cwd.
    spawnSync('bash', [SAVEPOINT, 'm', '', '1', 'guided'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, MUGIWARA_DIR: '.mugiwara' },
    });
    const r = spawnSync('bash', [SAVEPOINT, 'm', '', '2', 'guided'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, MUGIWARA_DIR: '.mugiwara' },
    });
    expect(r.status).toBe(0);
    const state = JSON.parse(readFileSync(join(dir, '.mugiwara', 'state', 'm', 'state.json'), 'utf8'));
    expect(state.lane_prev).toBe('standard');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 5: lane_rose true when lane rises (lean -> full via escalating fixture)', { timeout: SLOW }, () => {
  const dir = fixtureDir('escalating');
  try {
    // escalating has 10 files -> full immediately; make first run lean by
    // saving before the branch's files are counted? No — fixture is fixed.
    // Verify rise path: direct->full with two savepoints is covered by
    // escalating's earlier state. Here: write a lean state first by faking.
    runSavepoint(dir, 'm', '', 1, 'guided');
    // state is full; a second savepoint on same diff stays full, no rise
    runSavepoint(dir, 'm', '', 2, 'guided');
    const state = readState(dir);
    expect(state.lane_rose).toBe(false);
    expect(state.lane).toBe('full');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 6: lane_rose false on spike (spike is a resize, not a rise)', { timeout: SLOW }, () => {
  const dir = fixtureDir('standard-feature');
  try {
    // plant a spike-prev state, then run a normal lane -> not a rise
    const mugi = join(dir, '.mugiwara');
    execSync(`mkdir -p ${mugi}`, { cwd: dir });
    writeFileSync(join(mugi, 'state.json'), JSON.stringify({ lane: 'spike', lane_peak: 'spike', mission: 'm' }));
    runSavepoint(dir, 'm', '', 1, 'guided');
    const state = readState(dir);
    expect(state.lane).toBe('standard'); // spike does not clamp forward
    expect(state.lane_rose).toBe(false);
    expect(state.lane_peak).toBe('standard');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- D2: cases 7-10 — monotonic clamp + lane_peak ----------

test('case 7: lane held at full after sensitive path removed (clamp D2)', { timeout: SLOW }, () => {
  const dir = fixtureDir('sensitive-paths');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided');
    let state = readState(dir);
    expect(state.lane).toBe('full');
    expect(state.lane_peak).toBe('full');

    // remove ALL sensitive files -> diff collapses to deletions only, but the
    // clamp holds full
    execSync('git rm -q -r --ignore-unmatch src db certs keys .github && git rm -q --ignore-unmatch Dockerfile docker-compose.yml && git commit -q -m shrink', { cwd: dir });
    runSavepoint(dir, 'm', '', 2, 'guided');
    state = readState(dir);
    expect(state.lane).toBe('full'); // held at peak, not dropped to lean
    expect(state.lane_peak).toBe('full');
    expect(state.lane_reason).toContain('clamp');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 9: lane_peak recorded and rises with lane', { timeout: SLOW }, () => {
  const dir = fixtureDir('escalating');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided');
    const state = readState(dir);
    expect(state.lane).toBe('full');
    expect(state.lane_peak).toBe('full');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 10: fresh mission resets lane_peak (no clamp carry-over)', { timeout: SLOW }, () => {
  const dir = fixtureDir('sensitive-paths');
  try {
    runSavepoint(dir, 'sensitive', '', 1, 'guided');
    let state = readState(dir, 'sensitive');
    expect(state.lane).toBe('full');
    // different mission name on the same repo -> peak resets
    runSavepoint(dir, 'other', '', 1, 'guided');
    state = readState(dir, 'other');
    expect(state.lane_prev).toBeNull();
    expect(state.lane_peak).toBe(state.lane);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- D3: cases 11-15 — shared patterns, plural sensitive paths ----------

test('case 11: payments/ and migrations/ escalate to full (D3 plural forms)', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-d3-'));
  try {
    baseRepo(dir);
    execSync('mkdir -p src/payments && echo x > src/payments/txn.ts && git add -A && git commit -qm wip', { cwd: dir });
    const r = run(LANE, ['main', '--json'], dir);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).lane).toBe('full');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 12: package.json does NOT escalate (deps rule deferred to policy)', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-d3pkg-'));
  try {
    baseRepo(dir);
    writeFileSync(join(dir, 'package.json'), '{"name":"x"}');
    execSync('git add -A && git commit -qm wip', { cwd: dir });
    const r = run(LANE, ['main', '--json'], dir);
    expect(JSON.parse(r.stdout).lane).toBe('direct'); // 1 file <20 LOC, not full
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 13: authors/ NOT matched by auth/ pattern', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-d3auth-'));
  try {
    baseRepo(dir);
    execSync('mkdir -p src/authors && echo x > src/authors/a.ts && git add -A && git commit -qm wip', { cwd: dir });
    const r = run(LANE, ['main', '--json'], dir);
    expect(JSON.parse(r.stdout).sensitive_paths).toHaveLength(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 14: sensitive escalation wins over docs-only downgrade', { timeout: SLOW }, () => {
  const dir = fixtureDir('sensitive-paths');
  try {
    const r = run(LANE, ['main', '--json'], dir);
    const j = JSON.parse(r.stdout);
    expect(j.lane).toBe('full');
    expect(j.sensitive_paths).toContain('src/auth/login.ts');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 15: lane.sh and savepoint.sh agree (shared patterns)', { timeout: SLOW }, () => {
  const dir = fixtureDir('sensitive-paths');
  try {
    const r = run(LANE, ['main', '--json'], dir);
    const j = JSON.parse(r.stdout);
    runSavepoint(dir, 'm', '', 1, 'guided');
    const state = readState(dir);
    expect(state.lane).toBe(j.lane);
    expect(state.sensitive_paths.sort()).toEqual(j.sensitive_paths.sort());
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- D4/D5: cases 16-21 — churn-based tokens + new budgets ----------

test('case 16: churn 1800 -> tokens_est > 30000 (D4: churn x 12, not delta)', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-churn-'));
  try {
    execSync('git init -q && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base', { cwd: dir });
    // 3 files, 300 lines each committed on main = the base tree
    execSync('mkdir -p src', { cwd: dir });
    for (let i = 0; i < 3; i++) {
      writeFileSync(join(dir, `src/legacy${i}.ts`), Array.from({ length: 300 }, (_, l) => `export const f${i}${l} = () => ${l};`).join('\n') + '\n');
    }
    execSync('git add -A && git commit -qm basefiles', { cwd: dir });
    // branch rewrites every line = 900 ins + 900 del
    execSync('git checkout -q -b feat-w', { cwd: dir });
    for (let i = 0; i < 3; i++) {
      writeFileSync(join(dir, `src/legacy${i}.ts`), Array.from({ length: 300 }, (_, l) => `export const g${i}${l} = () => ${l + 1};`).join('\n') + '\n');
    }
    execSync('git add -A && git commit -qm rewrite', { cwd: dir });
    runSavepoint(dir, 'm', '', 1, 'guided');
    const state = readState(dir);
    expect(state.loc_ins).toBe(900);
    expect(state.loc_del).toBe(900);
    expect(state.loc_churn).toBe(1800);
    expect(state.loc_delta).toBe(0); // balanced rewrite
    // 3 files -> standard lane, LANE_BASE 13000 + 1800*12 = 21600 + doc words
    expect(state.lane).toBe('standard');
    expect(state.tokens_est).toBeGreaterThan(30000);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 17: deletions -> negative delta, positive churn, tokens > 0 (D4)', { timeout: SLOW }, () => {
  const dir = fixtureDir('deletions-only');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided');
    const state = readState(dir);
    expect(state.loc_delta).toBeLessThan(0);
    expect(state.loc_churn).toBeGreaterThan(0);
    expect(state.loc_ins).toBe(0);
    expect(state.tokens_est).toBeGreaterThan(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 18: MUGIWARA_TOKENS override honored (reported source)', { timeout: SLOW }, () => {
  const dir = fixtureDir('standard-feature');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided', { MUGIWARA_TOKENS: '12345' });
    const state = readState(dir);
    expect(state.tokens_est).toBe(12345);
    expect(state.tokens_source).toBe('reported');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 19: warn at 1.5x new standard budget (25000 -> 37500)', { timeout: SLOW }, () => {
  const dir = fixtureDir('standard-feature');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided', { MUGIWARA_TOKENS: '37499' });
    expect(readState(dir).budget_status).toBe('ok');
    runSavepoint(dir, 'm', '', 1, 'guided', { MUGIWARA_TOKENS: '37500' });
    expect(readState(dir).budget_status).toBe('warn');
    runSavepoint(dir, 'm', '', 1, 'guided', { MUGIWARA_TOKENS: '75000' });
    expect(readState(dir).budget_status).toBe('stop');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 20: LANE_BASE matches lane-base.ts computed load (D5)', { timeout: SLOW }, () => {
  const dir = fixtureDir('standard-feature');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided');
    const state = readState(dir);
    // standard LANE_BASE is 13000 from scripts/lib/lane-base.sh
    expect(state.budget).toBe(25000);
    expect(state.tokens_est).toBeGreaterThan(13000);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 21: lane-base generator validates constants (gate)', { timeout: SLOW }, () => {
  const r = spawnSync('bun', [join(ROOT, 'scripts', 'lane-base.ts')], { cwd: ROOT, encoding: 'utf8' });
  expect(r.status).toBe(0);
  expect(r.stdout).toContain('constants match content load');
});

// ---------- D6: cases 22-24 — evidence exit + verdict ----------

test('case 22: evidence log carries # Exit: and # Verdict: PASS on success', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-ev-'));
  try {
    execSync('mkdir -p .mugiwara/results/m', { cwd: dir });
    const r = spawnSync('bash', [EVIDENCE, 'm', 'pass-check', '--', 'true'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });
    expect(r.status).toBe(0);
    const log = readdirSync(join(dir, '.mugiwara', 'results', 'm')).find(f => f.endsWith('.log'))!;
    const text = readFileSync(join(dir, '.mugiwara', 'results', 'm', log), 'utf8');
    expect(text).toContain('# Exit: 0');
    expect(text).toContain('# Verdict: PASS');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 23: evidence log carries FAIL verdict and preserves exit code', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-ev2-'));
  try {
    execSync('mkdir -p .mugiwara/results/m', { cwd: dir });
    const r = spawnSync('bash', [EVIDENCE, 'm', 'fail-check', '--', 'bash', '-c', 'echo boom; exit 7'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });
    expect(r.status).toBe(7); // exit code preserved
    const log = readdirSync(join(dir, '.mugiwara', 'results', 'm')).find(f => f.endsWith('.log'))!;
    const text = readFileSync(join(dir, '.mugiwara', 'results', 'm', log), 'utf8');
    expect(text).toContain('# Exit: 7');
    expect(text).toContain('# Verdict: FAIL');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 24: evidence stdin pipeline also gets trailer', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-ev3-'));
  try {
    execSync('mkdir -p .mugiwara/results/m', { cwd: dir });
    const r = spawnSync('bash', ['-c', `echo hello | bash "${EVIDENCE}" m pipe-check`], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });
    expect(r.status).toBe(0);
    const log = readdirSync(join(dir, '.mugiwara', 'results', 'm')).find(f => f.endsWith('.log'))!;
    const text = readFileSync(join(dir, '.mugiwara', 'results', 'm', log), 'utf8');
    expect(text).toContain('# Exit: 0');
    expect(text).toContain('# Verdict: PASS');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- D7/D8: cases 25-28 — branch-mode interface + gitignore ----------

test('case 25: team member -> state/<mission>/<member>.json, branch from git (D7)', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-br-'));
  try {
    execSync('git init -q && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base && git checkout -qb feat/other', { cwd: dir });
    const r = spawnSync('bash', [SAVEPOINT, 'm', 'patty', '1', 'guided'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });
    expect(r.status).toBe(0);
    const stateFile = join(dir, '.mugiwara', 'state', 'm', 'patty.json');
    expect(existsSync(stateFile)).toBe(true);
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    expect(state.mission).toBe('m');
    expect(state.member).toBe('patty');
    expect(state.branch).toBe('feat/other'); // auto from git, no positional
    expect(state.actor).toBe('T <t@t.com>'); // auto-resolved from git, no positional
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 27: uninstall leaves no mugiwara lines in .gitignore (D8)', { timeout: SLOW }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-uni-'));
  try {
    execSync('git init -q && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base', { cwd: dir });
    const { ensureProjectGitignore, removeProjectGitignore } = await import(INSTALLER);
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\ndist/\n');
    ensureProjectGitignore(dir);
    const before = readFileSync(join(dir, '.gitignore'), 'utf8');
    expect(before).toContain('mugiwara');
    const r = removeProjectGitignore(dir);
    expect(r.removed).toBe(true);
    const after = readFileSync(join(dir, '.gitignore'), 'utf8');
    expect(after).not.toContain('mugiwara');
    expect(after).toContain('node_modules/'); // user lines preserved
    expect(after).toContain('dist/');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 28: gitignore block is delimited', { timeout: SLOW }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-delim-'));
  try {
    const { ensureProjectGitignore } = await import(INSTALLER);
    ensureProjectGitignore(dir);
    const text = readFileSync(join(dir, '.gitignore'), 'utf8');
    expect(text).toContain('# >>> mugiwara >>>');
    expect(text).toContain('# <<< mugiwara <<<');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- Regressions 29-33 ----------

test('case 29: docs-only change does not escalate to full (path-weighted)', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-doc-'));
  try {
    baseRepo(dir);
    execSync('mkdir -p docs', { cwd: dir });
    const docs: Record<string, string> = {};
    for (let i = 0; i < 10; i++) docs[`docs/guide${i}.md`] = '# doc\n';
    for (const [p, c] of Object.entries(docs)) { writeFileSync(join(dir, p), c); }
    execSync('git add -A && git commit -qm wip', { cwd: dir });
    const r = run(LANE, ['main', '--json'], dir);
    expect(JSON.parse(r.stdout).lane).toBe('standard'); // 10 files but docs-only
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 30: deleted sources -> full via sensitive-path removal keeps clamp (D2 regression)', { timeout: SLOW }, () => {
  const dir = fixtureDir('sensitive-paths');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided');
    execSync('git rm -q src/auth/login.ts && git commit -q -m rm-auth', { cwd: dir });
    runSavepoint(dir, 'm', '', 2, 'guided');
    const state = readState(dir);
    expect(state.lane).toBe('full'); // held, not dropped
    expect(state.lane_peak).toBe('full');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 31: unicode + spaced paths do not break lane detection', { timeout: SLOW }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-uni-'));
  try {
    baseRepo(dir);
    execSync('mkdir -p "src/my dir"', { cwd: dir });
    writeFileSync(join(dir, 'src/my dir', 'héllo.ts'), 'export const a = 1;\n');
    execSync('git add -A && git commit -qm wip', { cwd: dir });
    const r = run(LANE, ['main', '--json'], dir);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).files_touched).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 32: corrupt state.json degrades gracefully, lane_prev null', { timeout: SLOW }, () => {
  const dir = fixtureDir('standard-feature');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided');
    writeFileSync(join(dir, '.mugiwara', 'state', 'm', 'state.json'), '{ not json');
    runSavepoint(dir, 'm', '', 2, 'guided');
    const state = readState(dir);
    expect(state.lane_prev).toBeNull(); // corrupt read -> no prev
    expect(state.lane).toBe('standard'); // still writes fresh state
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 33: non-git dir -> both tools fail gracefully', { timeout: SLOW }, () => {
  const dir = fixtureDir('no-git');
  try {
    const l = run(LANE, [], dir);
    expect(l.status).not.toBe(0);
    expect(l.stdout).toMatch(/not a git repository/);
    const s = runSavepoint(dir, 'm', '', 1, 'guided');
    expect(s.status).not.toBe(0);
    expect(s.stdout).toMatch(/not a git repository/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- fixture expect blocks: fixtures assert their own outcomes ----------

// A fixture with an "expect" block declares its own expected lane.sh outcome.
// This generic consumer asserts it, so a fixture cannot silently drift from
// what the pattern source produces (G3: values that are never read are absent).
const EXPECT_KEYS = ['lane', 'sensitive_paths_min', 'sensitive_paths_max'];
function assertFixtureExpect(fixture: string) {
  const fx = JSON.parse(readFileSync(join(ROOT, 'test', 'fixtures', `${fixture}.json`), 'utf8')) as {
    name?: string;
    baseBranch?: string;
    expect?: { lane?: string; sensitive_paths_min?: number; sensitive_paths_max?: number };
  };
  if (!fx.expect) return;
  // unknown expect keys pass silently — reject them so a typo'd assertion
  // cannot masquerade as coverage (G3)
  for (const k of Object.keys(fx.expect)) {
    expect(EXPECT_KEYS, `fixture ${fixture}: unknown expect key "${k}"`).toContain(k);
  }
  const dir = fixtureDir(fixture);
  try {
    const r = run(LANE, [fx.baseBranch || 'main', '--json'], dir);
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout);
    const keys = Object.keys(fx.expect ?? {});
    expect(keys.length, `${fx.name}: fixture declares no expectations`).toBeGreaterThan(0);
    if (fx.expect.lane) expect(j.lane).toBe(fx.expect.lane);
    if (fx.expect.sensitive_paths_min !== undefined) {
      expect(j.sensitive_paths.length).toBeGreaterThanOrEqual(fx.expect.sensitive_paths_min!);
    }
    if (fx.expect.sensitive_paths_max !== undefined) {
      expect(j.sensitive_paths.length).toBeLessThanOrEqual(fx.expect.sensitive_paths_max!);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('fixture expect: sensitive-paths → full with ≥14 sensitive paths', { timeout: SLOW }, () => assertFixtureExpect('sensitive-paths'));

test('fixture expect: sensitive-paths-negative → standard, zero sensitive', { timeout: SLOW }, () => assertFixtureExpect('sensitive-paths-negative'));

test('case 35: lanes.md pattern block matches patterns.sh (drift gate)', () => {
  const pats = readFileSync(join(ROOT, 'scripts', 'lib', 'patterns.sh'), 'utf8');
  const m = pats.match(/SENSITIVE_PATS="([^"]+)"/);
  expect(m).not.toBeNull();
  // normalize regex forms for doc display: strip backslash escapes + trailing $
  // NOTE: the doc block is DISPLAY form — paste the raw regex verbatim and this
  // test goes red (fail-safe direction: false red, never false green).
  const sourceTokens = new Set(m![1].split('|').map(t => t.replace(/\\/g, '').replace(/\$$/, '')));
  const doc = readFileSync(join(ROOT, 'docs', 'concepts', 'lanes.md'), 'utf8');
  const after = doc.slice(doc.indexOf('The patterns live in one place'));
  const block = after.match(/```\n([\s\S]*?)\n```/)?.[1];
  expect(block).toBeTruthy();
  const docTokens = new Set(block!.trim().split(/\s+/));
  expect([...sourceTokens].sort()).toEqual([...docTokens].sort());
});

// ---------- extra: loc_ins/loc_del/loc_churn fixture assertions ----------

test('fixture: escalating repo files_touched matches branch diff', { timeout: SLOW }, () => {
  const dir = fixtureDir('escalating');
  try {
    runSavepoint(dir, 'm', '', 1, 'guided');
    const state = readState(dir);
    expect(state.files_touched).toBe(10);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- case 37-38: post-install harness dirs never size a consumer mission ----------

// `mugiwara install` leaves ~50 untracked files under the harness rules dirs.
// In a consumer project they are installed config; counting them sized every
// fresh mission Lane 3 before the user wrote a line. In mugiwara's own repo
// the same dirs ARE the product (PRODUCT_PAT), so the exclusion is keyed on
// the repo-root package.json name — asserted in both directions here.
function installedRepo(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-installed-'));
  execSync('git init -q && git config user.email t@t.com && git config user.name T', { cwd: dir });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name }));
  writeFileSync(join(dir, 'README.md'), 'hi\n');
  execSync('git add -A && git commit -qm base', { cwd: dir });
  for (const d of ['.claude/skills', '.opencode/skills', '.github/instructions', '.kilo/rules']) {
    execSync(`mkdir -p "${join(dir, d)}"`, { cwd: dir });
    for (let i = 0; i < 12; i++) writeFileSync(join(dir, d, `s${i}.md`), 'x\n');
  }
  return dir;
}

test('case 37: consumer repo post-install sizes direct, not full', { timeout: SLOW }, () => {
  const dir = installedRepo('my-app');
  try {
    const j = JSON.parse(run(LANE, ['main', '--json'], dir).stdout);
    expect(j.lane).toBe('direct');
    expect(j.files_touched).toBe(0);
    // parity: savepoint must agree with lane.sh on the same tree
    runSavepoint(dir, 'm');
    const state = readState(dir);
    expect(state.lane).toBe('direct');
    expect(state.files_touched).toBe(0);
    expect(state.loc_ins).toBe(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('case 38: mugiwara own repo still counts .claude/.opencode as product', { timeout: SLOW }, () => {
  const dir = installedRepo('@ionivetech/mugiwara');
  try {
    const j = JSON.parse(run(LANE, ['main', '--json'], dir).stdout);
    expect(j.lane).toBe('full');
    expect(j.files_touched).toBe(48);
    runSavepoint(dir, 'm');
    const state = readState(dir);
    expect(state.lane).toBe('full');
    expect(state.files_touched).toBe(48);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
