// test/mission.test.ts
import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetMission } from '../src/mission.ts';

test('resetMission removes mission state, keeps config/manifest/backup', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-reset-'));
  const root = join(dir, '.mugiwara');
  for (const sub of ['spec', 'plans', 'results', 'review', 'issues', 'logs', 'backup']) {
    mkdirSync(join(root, sub), { recursive: true });
    writeFileSync(join(root, sub, 'x.md'), 'x');
  }
  writeFileSync(join(root, 'config'), 'mode=guided\n');
  const { removed, kept } = resetMission(dir, false);
  expect(removed).toContain('plans');
  expect(removed).toContain('logs');
  expect(kept).toContain('config');
  expect(kept).toContain('backup');
  expect(existsSync(join(root, 'plans'))).toBe(false);
  expect(existsSync(join(root, 'config'))).toBe(true);
});

test('resetMission --keep-logs preserves logs (lessons ledger)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-resetkl-'));
  const root = join(dir, '.mugiwara');
  mkdirSync(join(root, 'logs'), { recursive: true });
  writeFileSync(join(root, 'logs', 'lessons.md'), 'lessons');
  const { removed, kept } = resetMission(dir, true);
  expect(removed).not.toContain('logs');
  expect(kept).toContain('logs');
  expect(existsSync(join(root, 'logs', 'lessons.md'))).toBe(true);
});

test('resetMission is a no-op without .mugiwara/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-resetnone-'));
  const { removed, kept } = resetMission(dir, false);
  expect(removed).toEqual([]);
  expect(kept).toEqual([]);
});
