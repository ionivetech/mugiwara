// test/validate-content.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('full content validation passes', () => {
  execFileSync(process.execPath, ['scripts/validate-content.mjs'], { stdio: 'pipe' });
});

test('single-file check passes on a valid file', () => {
  execFileSync(process.execPath, ['scripts/validate-content.mjs', '--check', 'content/skills/mugiwara-workflow/SKILL.md'], { stdio: 'pipe' });
});
