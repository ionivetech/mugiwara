// test/initiative.test.ts — QA hardening guards (mission mugiwara-qa-hardening).
// Guards: initiative.ts must fail CLEANLY on missing/malformed plans (clean
// stderr, non-zero exit, NO stacktrace — no 'at ' frames, no leaked
// internals), and succeed on valid plans. All MUGIWARA-independent: explicit
// absolute plan paths, temp dirs, no repo state.
import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const INITIATIVE = join(import.meta.dirname, '..', 'scripts', 'initiative.ts');

function runInitiative(dir: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  return spawnSync('bun', [INITIATIVE, ...args], { cwd: dir, encoding: 'utf8', timeout: 30000 });
}

const newDir = (tag: string) => mkdtempSync(join(tmpdir(), `mugi-initiative-${tag}-`));

// Minimal valid plan: markdown heading + Sub-missions table (Depends column
// non-empty so the row keeps its Touched Files column after column filtering).
const VALID_PLAN = `# Test Plan

## Sub-missions

| ID | Name | Assignee | Branch | Status | Depends | Touched Files |
|----|------|----------|--------|--------|---------|---------------|
| T1 | Do thing | zoro | feat/thing | [ ] | - | scripts/x.ts |
| T2 | Other thing | sanji | feat/other | [x] | T1 | scripts/y.ts |
`;

// ---------- missing plan ----------

test('initiative: missing plan exits non-zero with clean stderr, no stacktrace', { timeout: 20000 }, () => {
  const dir = newDir('missing');
  try {
    const missing = join(dir, 'no-such-plan.md');
    const r = runInitiative(dir, ['status', missing]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Plan not found');
    expect(r.stderr).not.toMatch(/at .*initiative\.ts/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- malformed plan (garbage content) ----------

test('initiative: malformed plan exits non-zero with clean stderr, no stacktrace', { timeout: 20000 }, () => {
  const dir = newDir('malformed');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, 'this is not a plan\ngarbage text with no markdown structure\n');
    const r = runInitiative(dir, ['status', plan]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Not a valid plan');
    expect(r.stderr).not.toMatch(/at .*initiative\.ts/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- valid minimal plan ----------

test('initiative: valid minimal plan status exits 0', { timeout: 20000 }, () => {
  const dir = newDir('valid');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, VALID_PLAN);
    const r = runInitiative(dir, ['status', plan]);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toContain('1/2 done');
    expect(r.stdout).toContain('T1');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- set-status on valid plan ----------

test('initiative: set-status exits 0 and plan file reflects the change', { timeout: 20000 }, () => {
  const dir = newDir('setstatus');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, VALID_PLAN);
    const r = runInitiative(dir, ['set-status', plan, '--id', 'T1', '--status', 'done']);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toContain('T1: done');

    const updated = readFileSync(plan, 'utf8');
    expect(updated).toContain('| T1 | Do thing | zoro | feat/thing | [x]');
    expect(updated).not.toContain('| T1 | Do thing | zoro | feat/thing | [ ]');
    expect(updated).toContain('| T2 | Other thing | sanji | feat/other | [x]');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- collaboration regression cases (W4) ----------

// three sub-missions; s1+s2 in-progress share src/api/shared.ts; comma-separated
// touched files; s3 depends on s1 (pending). Header deliberately lowercase.
const TEAM_PLAN = `# Team Plan

## Sub-missions

| id | name | assignee | branch | status | depends on | touched files |
|---|---|---|---|---|---|---|
| s1 | auth | alice | fix/auth | [~] |  | src/api/auth.ts, src/api/shared.ts |
| s2 | cart | bob | feat/cart | [~] |  | src/cart.ts, src/api/shared.ts |
| s3 | ship | carol | feat/ship | [ ] | s1 | src/ship.ts |
`;

test('initiative: lowercase header parses all 3 sub-missions', { timeout: 20000 }, () => {
  const dir = newDir('lower');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, TEAM_PLAN);
    const r = runInitiative(dir, ['status', plan]);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toContain('s1');
    expect(r.stdout).toContain('s2');
    expect(r.stdout).toContain('s3');
    expect(r.stdout).toContain('0/3 done');
    // comma-split: no trailing comma, both files listed
    expect(r.stdout).not.toContain(',,');
    expect(r.stdout).toContain('src/api/auth.ts, src/api/shared.ts');
    expect(r.stdout).toContain('src/cart.ts, src/api/shared.ts');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initiative: mixed-case header (| Id | NAME |) parses all rows', { timeout: 20000 }, () => {
  const dir = newDir('mixed');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, TEAM_PLAN.replace('| id | name |', '| Id | NAME |'));
    const r = runInitiative(dir, ['status', plan]);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toContain('s1');
    expect(r.stdout).toContain('s2');
    expect(r.stdout).toContain('s3');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initiative: conflict-check exits 1 and names both IDs when files overlap', { timeout: 20000 }, () => {
  const dir = newDir('conflict');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, TEAM_PLAN);
    const r = runInitiative(dir, ['conflict-check', plan]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('1 file conflict(s) detected');
    expect(r.stdout).toContain('src/api/shared.ts');
    expect(r.stdout).toContain('s1');
    expect(r.stdout).toContain('s2');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initiative: conflict-check exits 0 when no files overlap', { timeout: 20000 }, () => {
  const dir = newDir('noconflict');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, TEAM_PLAN.replace('src/api/shared.ts', 'src/api/token.ts'));
    const r = runInitiative(dir, ['conflict-check', plan]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('No file conflicts');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initiative: Sub-missions present but malformed rows → exit 1 with header hint', { timeout: 20000 }, () => {
  const dir = newDir('malformed-table');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, `# Team Plan\n\n## Sub-missions\n\n| id | name | assignee | branch | status | depends on | touched files |\n|---|---|---|---|---|---|---|\n| s1 | auth | alice | fix/auth | [~]\n`);
    const r = runInitiative(dir, ['status', plan]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('no rows parsed');
    expect(r.stderr).toContain('| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |');
    expect(r.stdout).not.toContain('solo mission');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initiative: no Sub-missions section → exit 0, solo mission', { timeout: 20000 }, () => {
  const dir = newDir('solo');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, `# Solo Plan\n\nJust one mission here.\n`);
    const r = runInitiative(dir, ['status', plan]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('solo mission');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initiative: status flags a sub blocked by a pending dependency', { timeout: 20000 }, () => {
  const dir = newDir('blocked');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, TEAM_PLAN);
    const r = runInitiative(dir, ['status', plan]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('s3');
    expect(r.stdout).toContain('blocked-by s1');
    expect(r.stdout).not.toContain('blocked-by s2');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initiative: set-status done marks only the target row [x]', { timeout: 20000 }, () => {
  const dir = newDir('setdone');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, TEAM_PLAN);
    const r = runInitiative(dir, ['set-status', plan, '--id', 's1', '--status', 'done']);
    expect(r.status).toBe(0);
    const updated = readFileSync(plan, 'utf8');
    expect(updated).toContain('| s1 | auth | alice | fix/auth | [x]');
    expect(updated).toContain('| s2 | cart | bob | feat/cart | [~]');
    expect(updated).toContain('| s3 | ship | carol | feat/ship | [ ]');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initiative: set-status with unknown id exits 1 and names the id', { timeout: 20000 }, () => {
  const dir = newDir('unknown');
  try {
    const plan = join(dir, 'plan.md');
    writeFileSync(plan, TEAM_PLAN);
    const r = runInitiative(dir, ['set-status', plan, '--id', 'nope', '--status', 'done']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('nope');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
