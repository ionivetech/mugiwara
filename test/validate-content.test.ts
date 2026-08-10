// test/validate-content.test.ts
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

test('full content validation passes', () => {
  expect(() => execFileSync(process.execPath, ['scripts/validate-content.mjs'], { stdio: 'pipe' })).not.toThrow();
});

test('single-file check passes on a valid file', () => {
  expect(() => execFileSync(process.execPath, ['scripts/validate-content.mjs', '--check', 'content/skills/mugiwara-workflow/SKILL.md'], { stdio: 'pipe' })).not.toThrow();
});
