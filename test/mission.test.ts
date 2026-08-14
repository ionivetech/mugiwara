// test/mission.test.ts
import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetMission, archiveMission } from '../src/mission.ts';

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

test('resetMission removes branch-specific state-*.json files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-resetbr-'));
  const root = join(dir, '.mugiwara');
  mkdirSync(join(root, 'logs'), { recursive: true });
  writeFileSync(join(root, 'state.json'), '{"actor":"test"}');
  writeFileSync(join(root, 'state-feat-fix.json'), '{"actor":"other"}');
  writeFileSync(join(root, 'state-other-branch.json'), '{"actor":"third"}');
  writeFileSync(join(root, 'config'), 'mode=guided');
  const { removed } = resetMission(dir, false, true);
  expect(removed).toContain('state.json');
  expect(removed).toContain('state-feat-fix.json');
  expect(removed).toContain('state-other-branch.json');
  expect(existsSync(join(root, 'state.json'))).toBe(false);
  expect(existsSync(join(root, 'state-feat-fix.json'))).toBe(false);
  expect(existsSync(join(root, 'state-other-branch.json'))).toBe(false);
  expect(existsSync(join(root, 'config'))).toBe(true);
});

function buildArchiveFixture(dir: string): string {
  const root = join(dir, '.mugiwara');
  const mk = (p: string) => { mkdirSync(join(root, p), { recursive: true }); };
  mk('reports');
  mk('results/demo');
  mk('spec');
  mk('review');
  mk('issues');
  mk('logs');
  writeFileSync(join(root, 'reports', '2026-01-01-demo.md'), 'report');
  writeFileSync(join(root, 'results', 'demo', '01-execution.md'), 'exec');
  writeFileSync(join(root, 'results', 'demo', '02-quality.md'), 'quality');
  writeFileSync(join(root, 'results', 'demo', '03-checkpoint.md'), 'checkpoint');
  writeFileSync(join(root, 'results', 'demo', '04-review.md'), 'review');
  writeFileSync(join(root, 'results', 'demo', '05-healing.md'), 'healing');
  writeFileSync(join(root, 'results', 'demo', 'todos.md'), 'todos');
  writeFileSync(join(root, 'results', 'demo', '06-closure.md'), 'closure');
  writeFileSync(join(root, 'results', 'demo', '07-pr-verdict.md'), 'verdict');
  writeFileSync(join(root, 'spec', 'demo.md'), 'spec');
  writeFileSync(join(root, 'spec', '2026-08-13-demo.md'), 'spec');
  writeFileSync(join(root, 'review', 'demo-review.md'), 'review');
  writeFileSync(join(root, 'review', '2026-08-13-demo-review.md'), 'review');
  writeFileSync(join(root, 'issues', 'demo-blockers.md'), 'issues');
  writeFileSync(join(root, 'logs', 'demo.md'), 'log');
  writeFileSync(join(root, 'logs', '2026-08-13-demo.md'), 'log');
  writeFileSync(join(root, 'logs', 'lessons.md'), 'lessons');
  mk('continue/demo');
  writeFileSync(join(root, 'continue', 'demo', 'state.json'), '{"mission":"demo","wave":3}\n');
  mk('state/demo');
  writeFileSync(join(root, 'state', 'demo', 'state.json'), '{"mission":"demo","wave":3}\n');
  writeFileSync(join(root, 'config'), 'mode=guided\n');
  return root;
}

test('archiveMission keeps step results as evidence, removes consumed cross-artifacts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-archive-'));
  const root = buildArchiveFixture(dir);
  const { removed, kept, index } = archiveMission(dir, 'demo');

  expect(removed).not.toContain(join('results', 'demo', '01-execution.md'));
  expect(removed).toContain(join('spec', 'demo.md'));
  expect(removed).toContain(join('spec', '2026-08-13-demo.md'));
  expect(removed).toContain(join('review', 'demo-review.md'));
  expect(removed).toContain(join('review', '2026-08-13-demo-review.md'));
  expect(removed).toContain(join('issues', 'demo-blockers.md'));
  expect(removed).toContain(join('logs', 'demo.md'));
  expect(removed).toContain(join('logs', '2026-08-13-demo.md'));
  expect(removed).toContain(join('continue', 'demo'));
  expect(removed).toContain(join('state', 'demo'));

  expect(kept).toContain(join('results', 'demo', '01-execution.md'));
  expect(kept).toContain(join('results', 'demo', '02-quality.md'));
  expect(kept).toContain(join('results', 'demo', '03-checkpoint.md'));
  expect(kept).toContain(join('results', 'demo', '04-review.md'));
  expect(kept).toContain(join('results', 'demo', '05-healing.md'));
  expect(kept).toContain(join('results', 'demo', 'todos.md'));
  expect(kept).toContain(join('results', 'demo', '06-closure.md'));
  expect(kept).toContain(join('results', 'demo', '07-pr-verdict.md'));
  expect(kept).toContain(join('reports', '2026-01-01-demo.md'));
  expect(kept).toContain(join('logs', 'lessons.md'));
  expect(kept).toContain('config');

  expect(existsSync(join(root, 'results', 'demo', '01-execution.md'))).toBe(true);
  expect(existsSync(join(root, 'results', 'demo', '05-healing.md'))).toBe(true);
  expect(existsSync(join(root, 'results', 'demo', 'todos.md'))).toBe(true);
  expect(existsSync(join(root, 'spec', 'demo.md'))).toBe(false);
  expect(existsSync(join(root, 'spec', '2026-08-13-demo.md'))).toBe(false);
  expect(existsSync(join(root, 'review', 'demo-review.md'))).toBe(false);
  expect(existsSync(join(root, 'review', '2026-08-13-demo-review.md'))).toBe(false);
  expect(existsSync(join(root, 'logs', 'demo.md'))).toBe(false);
  expect(existsSync(join(root, 'logs', '2026-08-13-demo.md'))).toBe(false);
  expect(existsSync(join(root, 'results', 'demo', '06-closure.md'))).toBe(true);
  expect(existsSync(join(root, 'results', 'demo', '07-pr-verdict.md'))).toBe(true);
  expect(existsSync(join(root, 'reports', '2026-01-01-demo.md'))).toBe(true);
  expect(existsSync(join(root, 'logs', 'lessons.md'))).toBe(true);
  expect(existsSync(join(root, 'config'))).toBe(true);

  expect(index).toBe(join('reports', 'index.md'));
  const idx = readFileSync(join(root, 'reports', 'index.md'), 'utf8');
  expect(idx).toContain('- demo —');
});

test('archiveMission --dry-run removes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-archive-dry-'));
  const root = buildArchiveFixture(dir);
  const { index } = archiveMission(dir, 'demo', { dryRun: true });

  expect(existsSync(join(root, 'results', 'demo', '01-execution.md'))).toBe(true);
  expect(existsSync(join(root, 'spec', 'demo.md'))).toBe(true);
  expect(existsSync(join(root, 'logs', 'demo.md'))).toBe(true);
  expect(existsSync(join(root, 'continue', 'demo', 'state.json'))).toBe(true);
  expect(existsSync(join(root, 'state', 'demo', 'state.json'))).toBe(true);
  expect(index).toBeUndefined();
  expect(existsSync(join(root, 'reports', 'index.md'))).toBe(false);
});
