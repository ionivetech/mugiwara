// test/validate-content.test.ts
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (args: string[]) => execFileSync('bun', ['scripts/validate-content.ts', ...args], { stdio: 'pipe' });

test('full content validation passes', () => {
  expect(() => run([])).not.toThrow();
});

test('single-file check passes on a valid file', () => {
  expect(() => run(['--check', 'content/skills/mugiwara-workflow/SKILL.md'])).not.toThrow();
});

// --- gate_artifact (roadmap item 2) ---
const skill = (gate: string | undefined) => `---
name: gate-test
description: A skill used to test the gate_artifact validator in this test file.
gate_artifact: ${gate ?? ''}
---

# Gate Test

## Skip when

- Diff is a test artifact (1 bullet).

## Red flags

- Test fixture (1 bullet).
`;

test('gate_artifact pointing to an existing references/ file passes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-gate-'));
  try {
    // --check derives the expected name from the parent dir — mirror it
    mkdirSync(join(dir, 'skills', 'gate-test', 'references'), { recursive: true });
    writeFileSync(join(dir, 'skills', 'gate-test', 'references', 'evidence.md'), '# evidence\n');
    writeFileSync(join(dir, 'skills', 'gate-test', 'SKILL.md'), skill('references/evidence.md — evidence'));
    expect(() => run(['--check', join(dir, 'skills', 'gate-test', 'SKILL.md')])).not.toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('gate_artifact referencing a missing references/ file fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-gate-'));
  try {
    mkdirSync(join(dir, 'skills', 'gate-test', 'references'), { recursive: true });
    writeFileSync(join(dir, 'skills', 'gate-test', 'SKILL.md'), skill('references/missing.md — evidence'));
    let failed = false;
    try { run(['--check', join(dir, 'skills', 'gate-test', 'SKILL.md')]); } catch { failed = true; }
    expect(failed).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('gate_artifact naming a flows/ path passes (mission evidence lives at runtime)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-gate-'));
  try {
    mkdirSync(join(dir, 'skills', 'gate-test'), { recursive: true });
    writeFileSync(join(dir, 'skills', 'gate-test', 'SKILL.md'), skill('flows/01-execution.md — evidence'));
    expect(() => run(['--check', join(dir, 'skills', 'gate-test', 'SKILL.md')])).not.toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('gate_artifact with a non-path value fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-gate-'));
  try {
    mkdirSync(join(dir, 'skills', 'gate-test'), { recursive: true });
    writeFileSync(join(dir, 'skills', 'gate-test', 'SKILL.md'), skill('evidence in the report'));
    let failed = false;
    try { run(['--check', join(dir, 'skills', 'gate-test', 'SKILL.md')]); } catch { failed = true; }
    expect(failed).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
