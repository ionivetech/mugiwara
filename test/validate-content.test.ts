// test/validate-content.test.ts
import { test, expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { memoryTemplateErrors } from '../scripts/validate-content.ts';

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

// --- memory-template (repo-memory T3) ---
const VALID_MEMORY = [
  '# Repo memory',
  '',
  '## Facts',
  '',
  '- `bun run gate` is the full CI gate.',
  '',
  '## Conventions',
  '',
  '- Conventional Commits.',
  '',
  '## Preferences',
  '',
  '- Boring diffs over clever abstractions.',
  '',
  '## Never',
  '',
  '- Never store secrets in MEMORY.md.',
  '',
].join('\n');

const readFixture = (dir: string, name: string, text: string): string => {
  const p = join(dir, name);
  writeFileSync(p, text);
  return readFileSync(p, 'utf8');
};

test('memory-template valid fixture passes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-mem-'));
  try {
    const text = readFixture(dir, 'memory.md', VALID_MEMORY);
    expect(memoryTemplateErrors(text, join(dir, 'memory.md'))).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('memory-template oversized fixture fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-mem-'));
  try {
    const rows = Array.from({ length: 41 }, (_, i) => `- fact row ${i}`).join('\n');
    const text = readFixture(dir, 'memory.md', `${VALID_MEMORY}\n${rows}\n`);
    const errs = memoryTemplateErrors(text, join(dir, 'memory.md'));
    expect(errs.some((e) => e.includes('exceeds 40 lines'))).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('memory-template secret-bearing fixture fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-mem-'));
  try {
    const text = readFixture(dir, 'memory.md', `${VALID_MEMORY}\n- token sk-abc123\n`);
    const errs = memoryTemplateErrors(text, join(dir, 'memory.md'));
    expect(errs.some((e) => e.includes('secret'))).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('memory-template missing-section fixture fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-mem-'));
  try {
    const text = readFixture(dir, 'memory.md', VALID_MEMORY.replace('## Never\n', ''));
    const errs = memoryTemplateErrors(text, join(dir, 'memory.md'));
    expect(errs.some((e) => e.includes('## Never'))).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('orchestration handoff requires four semantic blocks and exact resume command', () => {
  const skill = readFileSync(join(import.meta.dirname, '..', 'content', 'skills', 'mugiwara-orchestration', 'SKILL.md'), 'utf8');
  expect(skill).toMatch(/\*\*Result\*\*/);
  expect(skill).toMatch(/\*\*Next\*\*/);
  expect(skill).toMatch(/\*\*Choices\*\*/);
  expect(skill).toMatch(/\*\*New session\*\*/);
  expect(skill).toContain('/mugiwara continue <mission>');
});
