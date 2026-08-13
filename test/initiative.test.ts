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
