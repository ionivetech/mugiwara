// test/harness.test.ts — QA hardening guards (mission mugiwara-qa-hardening).
// Covers scenario families that had NO automated coverage:
//   lane.sh boundary matrix, sensitive-vs-docs conflict, mission-name
//   allowlist/traversal, heal_cycle counting, blockers_open rows,
//   standard/full budget boundaries, savepoint/lane.sh lane parity,
//   lane_rose escalation.
import { test, expect } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LANE = join(import.meta.dirname, '..', 'scripts', 'lane.sh');
const SAVEPOINT = join(import.meta.dirname, '..', 'scripts', 'savepoint.sh');

function setupGit(dir: string) {
  execSync('git init && git config user.email test@test.com && git config user.name Test', { cwd: dir });
  execSync('git commit --allow-empty -m base', { cwd: dir });
  execSync('git checkout -b feat-w', { cwd: dir });
}

function commitFiles(dir: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  execSync('git add -A && git commit -m wip', { cwd: dir });
}

function runLane(dir: string): { status: number | null; stdout: string; stderr: string } {
  return spawnSync('bash', [LANE, 'HEAD~1', '--json'], { cwd: dir, encoding: 'utf8' });
}

function runSavepoint(dir: string, args: string, envExtra: Record<string, string> = {}): { status: number | null; stdout: string; stderr: string } {
  return spawnSync('bash', [SAVEPOINT, ...args.split(' ')], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara'), ...envExtra },
  });
}

function readState(dir: string, file = 'state.json') {
  return JSON.parse(readFileSync(join(dir, '.mugiwara', file), 'utf8'));
}

const newRepo = (tag: string) => {
  const dir = mkdtempSync(join(tmpdir(), `mugi-harness-${tag}-`));
  setupGit(dir);
  return dir;
};

// ---------- lane.sh boundary matrix ----------

test('lane.sh: file-count and LOC boundaries map to lanes', { timeout: 20000 }, () => {
  const cases: { files: number; locPerFile: number; expectLane: string }[] = [
    { files: 0, locPerFile: 0, expectLane: 'direct' },
    { files: 1, locPerFile: 10, expectLane: 'direct' },
    { files: 1, locPerFile: 25, expectLane: 'lean' },
    { files: 2, locPerFile: 2, expectLane: 'lean' },
    { files: 5, locPerFile: 2, expectLane: 'standard' },
    { files: 10, locPerFile: 2, expectLane: 'full' },
  ];
  for (const c of cases) {
    const dir = newRepo('lane');
    try {
      const files: Record<string, string> = {};
      for (let i = 0; i < c.files; i++) {
        files[`src/f${i}.ts`] = Array.from({ length: c.locPerFile }, (_, k) => `l${k}`).join('\n') + '\n';
      }
      if (c.files > 0) commitFiles(dir, files);
      else execSync('git commit --allow-empty -m empty', { cwd: dir });

      const r = runLane(dir);
      expect(r.status).toBe(0);
      const json = JSON.parse(r.stdout);
      expect(json.lane, `files=${c.files} loc=${c.locPerFile} (got: ${r.stdout})`).toBe(c.expectLane);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('lane.sh: sensitive path escalates to full', { timeout: 20000 }, () => {
  const dir = newRepo('lane-sens');
  try {
    commitFiles(dir, { 'src/a.ts': 'a\n', 'src/b.ts': 'b\n', 'src/auth/login.ts': 'x\n' });
    const r = runLane(dir);
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.lane).toBe('full');
    expect(json.reason).toContain('sensitive');
    expect(json.sensitive_paths.join(',')).toContain('auth/');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lane.sh: docs-only change downgrades full by count to standard', { timeout: 20000 }, () => {
  const dir = newRepo('lane-docs');
  try {
    const files: Record<string, string> = {};
    for (let i = 0; i < 10; i++) files[`docs/d${i}.md`] = '# doc\n';
    commitFiles(dir, files);
    const r = runLane(dir);
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.lane).toBe('standard');
    expect(json.reason).toContain('docs-only');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lane.sh: sensitive escalation WINS over docs-only downgrade', { timeout: 20000 }, () => {
  // Regression guard for bug C9: 10 docs + prod/.env was downgraded to
  // standard despite the sensitive path. Sensitive-path escalation must win.
  const dir = newRepo('lane-sensdocs');
  try {
    const files: Record<string, string> = { 'prod/.env': 'KEY=1\n' };
    for (let i = 0; i < 9; i++) files[`docs/d${i}.md`] = '# doc\n';
    commitFiles(dir, files);
    const r = runLane(dir);
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.lane).toBe('full');
    expect(json.reason).toContain('sensitive');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lane.sh: not a git repository exits 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-harness-lane-nogit-'));
  try {
    const r = spawnSync('bash', [LANE, 'HEAD~1', '--json'], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('not a git repository');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- savepoint mission-name allowlist ----------

test('savepoint: mission-name allowlist rejects traversal, dots, unicode, metachars', { timeout: 20000 }, () => {
  const dir = newRepo('guard');
  // each name passed as ONE argv element via spawnSync — no split-args helper,
  // no quoting layer — the allowlist itself must reject, not the wrapper.
  const bad = ['bad name', '../evil', '../../etc/passwd', '.', '..', '...', 'misiün', 'a&b', 'a|b', 'a*b', 'a$b', '', 'a\nb', 'a`b', '$(rm -rf /)', 'a;b', 'a&&b'];
  try {
    for (const name of bad) {
      const r = spawnSync('bash', [SAVEPOINT, name, '', '', '1', 'guided'], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
      });
      expect(r.status, `mission ${JSON.stringify(name)} should be rejected`).not.toBe(0);
      expect(r.stderr, `mission ${JSON.stringify(name)}`).toContain('invalid mission name');
    }
    const ok = spawnSync('bash', [SAVEPOINT, 'qa-mission_1.v2', '', '', '1', 'guided'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') },
    });
    expect(ok.status).toBe(0);
    expect(existsSync(join(dir, '.mugiwara', 'state.json'))).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- savepoint sensitive-vs-docs conflict ----------

test('savepoint: sensitive escalation WINS over docs-only downgrade (twin of lane.sh C9)', { timeout: 20000 }, () => {
  const dir = newRepo('sp-sensdocs');
  try {
    const files: Record<string, string> = { 'prod/.env': 'KEY=1\n' };
    for (let i = 0; i < 9; i++) files[`docs/d${i}.md`] = '# doc\n';
    commitFiles(dir, files);
    const r = runSavepoint(dir, 'sensdocs "" "" 1 guided');
    expect(r.status).toBe(0);
    const state = readState(dir);
    expect(state.lane).toBe('full');
    expect(state.lane_reason).toContain('sensitive');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- heal_cycle counting ----------

test('savepoint: heal_cycle counts Wave-8 banners; heal prose does not inflate or error', { timeout: 20000 }, () => {
  const dir = newRepo('heal');
  try {
    const evDir = join(dir, '.mugiwara', 'results', 'healtest');
    mkdirSync(evDir, { recursive: true });

    // no trace file -> 1
    runSavepoint(dir, 'healtest "" "" 1 guided');
    expect(readState(dir).heal_cycle).toBe(1);

    // one banner -> 2
    writeFileSync(join(evDir, '01-trace.md'), 'some text\n## Wave 8 — heal\nmore\n');
    runSavepoint(dir, 'healtest "" "" 1 guided');
    expect(readState(dir).heal_cycle).toBe(2);

    // two banners -> 3
    writeFileSync(join(evDir, '01-trace.md'), '## Wave 8 — heal\n## Wave 8 — heal\n');
    runSavepoint(dir, 'healtest "" "" 1 guided');
    expect(readState(dir).heal_cycle).toBe(3);

    // "heal" prose WITHOUT "Wave 8" banner: must stay 1 and emit no syntax error
    // (regression guard for bug F1: grep -c zero-match double-emit)
    writeFileSync(join(evDir, '01-trace.md'), 'heal workers healed the bug\n');
    const r = runSavepoint(dir, 'healtest "" "" 1 guided');
    expect(readState(dir).heal_cycle).toBe(1);
    expect(r.stderr).not.toContain('syntax error');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- blockers_open ----------

test('savepoint: blockers_open counts data rows, not header or separator', { timeout: 20000 }, () => {
  const dir = newRepo('blk');
  try {
    const issuesDir = join(dir, '.mugiwara', 'issues');
    mkdirSync(issuesDir, { recursive: true });
    writeFileSync(
      join(issuesDir, 'blktest-blockers.md'),
      '| wave | task | symptom | attempted | help-needed |\n|---|---|---|---|---|\n' +
        '| 3 | t1 | segfault | restart | review |\n| 3 | t2 | timeout | retry | owner |\n| 4 | t3 | oom | grow | owner |\n',
    );
    runSavepoint(dir, 'blktest "" "" 1 guided');
    expect(readState(dir).blockers_open).toBe(3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- budget warn/stop for standard + full lanes ----------

test('savepoint: budget warn/stop boundaries for standard (10000) and full (20000)', { timeout: 20000 }, () => {
  const dir = newRepo('budget');
  try {
    // 3 files -> standard
    commitFiles(dir, { 'a.ts': 'a\n', 'b.ts': 'b\n', 'c.ts': 'c\n' });
    runSavepoint(dir, 'm "" "" 1 guided', { MUGIWARA_TOKENS: '14999' });
    expect(readState(dir).budget_status).toBe('ok');
    runSavepoint(dir, 'm "" "" 1 guided', { MUGIWARA_TOKENS: '15000' });
    expect(readState(dir).budget_status).toBe('warn');
    runSavepoint(dir, 'm "" "" 1 guided', { MUGIWARA_TOKENS: '30000' });
    expect(readState(dir).budget_status).toBe('stop');

    // 9 files -> full
    const files: Record<string, string> = {};
    for (let i = 0; i < 9; i++) files[`src/s${i}.ts`] = 'x\n';
    commitFiles(dir, files);
    runSavepoint(dir, 'm "" "" 1 guided', { MUGIWARA_TOKENS: '29999' });
    expect(readState(dir).budget_status).toBe('ok');
    runSavepoint(dir, 'm "" "" 1 guided', { MUGIWARA_TOKENS: '30000' });
    expect(readState(dir).budget_status).toBe('warn');
    runSavepoint(dir, 'm "" "" 1 guided', { MUGIWARA_TOKENS: '60000' });
    expect(readState(dir).budget_status).toBe('stop');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- savepoint/lane.sh lane parity ----------

test('savepoint: single 25-LOC file is lean, matching lane.sh', { timeout: 20000 }, () => {
  // Regression guard for drift: savepoint.sh had no "1 file >=20 LOC -> lean"
  // rule, so a 25-LOC single-file change got lane direct (budget 0 -> the
  // token budget could never warn/stop on a lean-size change).
  const dir = newRepo('parity');
  try {
    commitFiles(dir, { 'src/big.ts': Array.from({ length: 25 }, (_, i) => `line ${i}`).join('\n') + '\n' });
    const lane = runLane(dir);
    expect(JSON.parse(lane.stdout).lane).toBe('lean');
    runSavepoint(dir, 'm "" "" 1 guided');
    expect(readState(dir).lane).toBe('lean');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- lane_rose escalation ----------

test('savepoint: lane rise direct -> full sets lane_rose with lane_prev', { timeout: 20000 }, () => {
  const dir = newRepo('rose');
  try {
    runSavepoint(dir, 'm "" "" 1 guided');
    let state = readState(dir);
    expect(state.lane).toBe('direct');
    expect(state.lane_rose).toBe(false);

    const files: Record<string, string> = {};
    for (let i = 0; i < 9; i++) files[`src/s${i}.ts`] = 'x\n';
    commitFiles(dir, files);
    runSavepoint(dir, 'm "" "" 1 guided');
    state = readState(dir);
    expect(state.lane).toBe('full');
    expect(state.lane_prev).toBe('direct');
    expect(state.lane_rose).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- evidence.sh ----------

test('evidence.sh: exit-code passthrough, log written, -- separator, label allowlist', { timeout: 20000 }, () => {
  const EVIDENCE = join(import.meta.dirname, '..', 'scripts', 'evidence.sh');
  const dir = mkdtempSync(join(tmpdir(), 'mugi-harness-evidence-'));
  const mugiDir = join(dir, '.mugiwara');
  const run = (args: string[]) =>
    spawnSync('bash', [EVIDENCE, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, MUGIWARA_DIR: mugiDir } });
  try {
    // exit-code passthrough with explicit -- separator; log written
    const pass = run(['evtest', 'ev-pass', '--', 'sh', '-c', 'exit 3']);
    expect(pass.status, `stderr: ${pass.stderr}`).toBe(3);
    const passLog = pass.stdout.trim();
    expect(passLog).toMatch(/ev-pass-[0-9a-f]{12}\.log$/);
    expect(existsSync(passLog)).toBe(true);
    const body = readFileSync(passLog, 'utf8');
    expect(body).toContain('# Evidence: ev-pass');
    expect(body).toContain('# Command: sh -c exit 3');
    expect(body).toContain('# ---');

    // failing command: same passthrough (no -- separator)
    const fail = run(['evtest', 'ev-fail', 'sh', '-c', 'exit 7']);
    expect(fail.status, `stderr: ${fail.stderr}`).toBe(7);
    expect(existsSync(fail.stdout.trim())).toBe(true);

    // traversal label rejected by allowlist
    const evil = run(['evtest', '../evil', 'true']);
    expect(evil.status, `stderr: ${evil.stderr}`).not.toBe(0);
    expect(evil.stderr).toContain('invalid label');
    expect(readdirSync(join(mugiDir, 'results', 'evtest')).some((f) => f.includes('..'))).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
