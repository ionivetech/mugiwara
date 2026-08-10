// test/validate-content.test.ts
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

const run = (args: string[]) => execFileSync('bun', ['scripts/validate-content.ts', ...args], { stdio: 'pipe' });

test('full content validation passes', () => {
  expect(() => run([])).not.toThrow();
});

test('single-file check passes on a valid file', () => {
  expect(() => run(['--check', 'content/skills/mugiwara-workflow/SKILL.md'])).not.toThrow();
});
