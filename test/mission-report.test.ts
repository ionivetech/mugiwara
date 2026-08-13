// test/mission-report.test.ts — mission-report.sh enriched output.
// Covers: full fixture (state.json + results dir + closure) → exit 0 with
// report written containing header/budget/tasks/evidence; no results dir →
// graceful degraded report; missing state.json → still exit 0.
// Temp MUGIWARA_DIR keeps the real repo .mugiwara untouched.
import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPORT = join(import.meta.dirname, '..', 'scripts', 'mission-report.sh');

const today = () => new Date().toISOString().slice(0, 10);

function runReport(mugiDir: string, mission: string): { status: number | null; stdout: string; stderr: string } {
  return spawnSync('bash', [REPORT, mission], {
    encoding: 'utf8',
    env: { ...process.env, MUGIWARA_DIR: mugiDir },
  });
}

// Realistic state.json in savepoint.sh's exact shape (computed fields).
const fixtureState = {
  mission: 'test-mission',
  actor: 'tester',
  branch: 'feat/test-mission',
  lane: 'standard',
  lane_reason: '3 files',
  lane_prev: null,
  lane_rose: false,
  wave: 4,
  mode: 'auto',
  base_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  head_sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  files_touched: 3,
  loc_delta: 120,
  sensitive_paths: [],
  tasks: { done: 3, total: 5 },
  blockers_open: 1,
  heal_cycle: 1,
  tokens_est: 8000,
  tokens_source: 'computed',
  budget: 10000,
  budget_status: 'ok',
  skill_version: '1',
  evidence: ['.mugiwara/results/test-mission/01-execution.md'],
  updated_at: '2026-08-13T00:00:00Z',
};

const closureFixture = `# Closure Report

## Gate verdicts

- Quality: PASS — typecheck green.
- Gates: PASS — bun run gate exit 0; 133/133 tests.

## Tests

- Unit/integration: 133 pass. New: test/harness.test.ts.
- Coverage audit: t5-coverage-audit.md — 23 families.

## Next steps

- PR material.
`;

const newMugiDir = (tag: string) => mkdtempSync(join(tmpdir(), `mugi-report-${tag}-`));

test('mission-report: full fixture writes enriched report (exit 0)', { timeout: 20000 }, () => {
  const dir = newMugiDir('full');
  try {
    const mugi = join(dir, '.mugiwara');
    const resDir = join(mugi, 'results', 'test-mission');
    mkdirSync(resDir, { recursive: true });
    writeFileSync(join(mugi, 'state.json'), JSON.stringify(fixtureState, null, 2) + '\n');
    writeFileSync(join(resDir, '01-execution.md'), '# Execution\n\nT1: PASS\n');
    writeFileSync(join(resDir, '06-closure.md'), closureFixture);

    const r = runReport(mugi, 'test-mission');
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);

    const reportFile = join(mugi, 'reports', `${today()}-test-mission.md`);
    expect(existsSync(reportFile)).toBe(true);
    const report = readFileSync(reportFile, 'utf8');

    // mission name + header fields
    expect(report).toContain('test-mission');
    expect(report).toContain('| Branch | feat/test-mission |');
    expect(report).toContain('| Lane | standard |');
    expect(report).toContain('| Lane reason | 3 files |');
    expect(report).toContain('| Mode | auto |');
    expect(report).toContain('| Wave | 4 |');

    // token budget section with fields
    expect(report).toContain('## Token budget');
    expect(report).toContain('| Budget status | ok |');
    expect(report).toContain('8,000');

    // tasks section from state.json
    expect(report).toContain('## Tasks');
    expect(report).toContain('| Done | 3 |');
    expect(report).toContain('| Total | 5 |');
    expect(report).toContain('state.json');

    // gate/quality excerpt from 06-closure.md
    expect(report).toContain('## Gate & quality');
    expect(report).toContain('## Gate verdicts');
    expect(report).toContain('133/133');

    // evidence file list includes 01-execution.md
    expect(report).toContain('## Evidence files');
    expect(report).toContain('01-execution.md');

    // existing wave table + verdict sniffing intact
    expect(report).toContain('## Waves');
    expect(report).toContain('Execute (Wave 3)');
    expect(report).toContain('PASS');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mission-report: no results dir → graceful degraded report (exit 0)', { timeout: 20000 }, () => {
  const dir = newMugiDir('nores');
  try {
    const mugi = join(dir, '.mugiwara');
    mkdirSync(mugi, { recursive: true });
    writeFileSync(join(mugi, 'state.json'), JSON.stringify(fixtureState, null, 2) + '\n');

    const r = runReport(mugi, 'test-mission');
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);

    const reportFile = join(mugi, 'reports', `${today()}-test-mission.md`);
    expect(existsSync(reportFile)).toBe(true);
    const report = readFileSync(reportFile, 'utf8');
    expect(report).toContain('test-mission');
    expect(report).toContain('## Evidence files');
    expect(report).toContain('n/a');
    expect(report).toContain('(no wave artifacts found');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mission-report: state.json missing → still exit 0 with degraded report', { timeout: 20000 }, () => {
  const dir = newMugiDir('nostate');
  try {
    const mugi = join(dir, '.mugiwara');
    mkdirSync(mugi, { recursive: true });

    const r = runReport(mugi, 'test-mission');
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);

    const reportFile = join(mugi, 'reports', `${today()}-test-mission.md`);
    expect(existsSync(reportFile)).toBe(true);
    const report = readFileSync(reportFile, 'utf8');
    expect(report).toContain('test-mission');
    expect(report).toContain('| Lane | n/a |');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
