// test/mission.test.ts
import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetMission, archiveMission } from '../src/mission.ts';

test('resetMission removes mission dirs, keeps config/manifest/backup', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-reset-'));
  const root = join(dir, '.mugiwara');
  mkdirSync(join(root, 'missions', 'demo', 'flows'), { recursive: true });
  writeFileSync(join(root, 'missions', 'demo', 'plan.md'), 'plan');
  writeFileSync(join(root, 'missions', 'demo', 'state.json'), '{"actor":"x"}');
  writeFileSync(join(root, 'missions', 'demo', 'flows', '01-execution.md'), 'x');
  mkdirSync(join(root, 'backup'), { recursive: true });
  writeFileSync(join(root, 'config'), 'mode=guided\n');
  const { removed, kept } = resetMission(dir, false, true);
  expect(removed).toContain('missions');
  expect(kept).toContain('config');
  expect(kept).toContain('backup');
  expect(existsSync(join(root, 'missions'))).toBe(false);
  expect(existsSync(join(root, 'config'))).toBe(true);
});

test('resetMission --keep-logs preserves lessons.md (new home and legacy home)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-resetkl-'));
  const root = join(dir, '.mugiwara');
  mkdirSync(join(root), { recursive: true });
  writeFileSync(join(root, 'lessons.md'), 'lessons');
  const { kept } = resetMission(dir, true);
  expect(kept).toContain('lessons.md');
  expect(existsSync(join(root, 'lessons.md'))).toBe(true);

  // legacy pre-0.7 layout: logs/lessons.md survives a keep-logs reset too
  const dir2 = mkdtempSync(join(tmpdir(), 'mugi-resetkl2-'));
  const root2 = join(dir2, '.mugiwara');
  mkdirSync(join(root2, 'logs'), { recursive: true });
  writeFileSync(join(root2, 'logs', 'lessons.md'), 'lessons');
  const r2 = resetMission(dir2, true);
  expect(r2.kept).toContain(join('logs', 'lessons.md'));
  expect(existsSync(join(root2, 'logs', 'lessons.md'))).toBe(true);
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
  mkdirSync(join(root, 'missions'), { recursive: true });
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
  const mission = join(root, 'missions', 'demo');
  const mk = (p: string) => { mkdirSync(p, { recursive: true }); };
  mk(join(mission, 'flows'));
  writeFileSync(join(mission, 'plan.md'), '# Plan — demo\n\n- [x] T1\n');
  writeFileSync(join(mission, 'spec.md'), 'spec body');
  writeFileSync(join(mission, 'decisions.md'), 'decision log body');
  writeFileSync(join(mission, 'blockers.md'), 'blocker rows');
  writeFileSync(join(mission, 'review.md'), 'review findings');
  writeFileSync(join(mission, 'security.md'), 'security findings');
  writeFileSync(join(mission, 'flows', '01-execution.md'), 'exec evidence');
  writeFileSync(join(mission, 'flows', '03-quality.md'), 'quality evidence');
  writeFileSync(join(mission, 'flows', '06-closure.md'), 'closure summary');
  writeFileSync(join(mission, 'flows', 'todos.md'), '- [x] T1');
  writeFileSync(join(mission, 'flows', '07-pr-verdict.md'), 'pr verdict');
  writeFileSync(join(mission, 'state.json'), JSON.stringify({ mission: 'demo', flow: 9 }) + '\n');
  writeFileSync(join(mission, 'continue.json'), JSON.stringify({ mission: 'demo', flow: 9 }) + '\n');
  writeFileSync(join(root, 'config'), 'mode=guided\n');
  return mission;
}

test('archiveMission folds flow files + findings into report.md, keeps plan.md + report.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-archive-'));
  const missionDir = buildArchiveFixture(dir);
  const root = join(dir, '.mugiwara');
  const { report, removed, kept, index } = archiveMission(dir, 'demo');

  // report survives as the fold target
  expect(report).toBe(join('missions', 'demo', 'report.md'));
  expect(kept).toContain(join('missions', 'demo', 'plan.md'));
  expect(kept).toContain(join('missions', 'demo', 'report.md'));

  // everything else was folded then removed
  expect(removed).toContain(join('missions', 'demo', 'decisions.md'));
  expect(removed).toContain(join('missions', 'demo', 'blockers.md'));
  expect(removed).toContain(join('missions', 'demo', 'review.md'));
  expect(removed).toContain(join('missions', 'demo', 'security.md'));
  expect(removed).toContain(join('missions', 'demo', 'spec.md'));
  expect(existsSync(join(missionDir, 'flows'))).toBe(false);
  expect(existsSync(join(missionDir, 'state.json'))).toBe(false);
  expect(existsSync(join(missionDir, 'continue.json'))).toBe(false);

  // the dir ends as durable files: plan.md + report.md + pr-verdict.md
  const left = readdirSync(missionDir);
  expect(left.sort()).toEqual(['plan.md', 'pr-verdict.md', 'report.md']);

  // PR verdict survives as its own file (not folded into report.md)
  expect(readFileSync(join(missionDir, 'pr-verdict.md'), 'utf8')).toBe('pr verdict');

  // report.md holds closure summary + every folded section, wave files last
  const rep = readFileSync(join(missionDir, 'report.md'), 'utf8');
  expect(rep).toContain('closure summary');
  expect(rep).toContain('## Archived: decisions.md');
  expect(rep).toContain('decision log body');
  expect(rep).toContain('## Archived: blockers.md');
  expect(rep).toContain('## Archived: review.md');
  expect(rep).toContain('## Archived: security.md');
  expect(rep).toContain('## Archived: spec.md');
  expect(rep).toContain('## Archived: 01-execution.md');
  expect(rep).toContain('exec evidence');
  // 07-pr-verdict.md is NOT folded — it survives as pr-verdict.md at root
  expect(rep).not.toContain('## Archived: 07-pr-verdict.md');

  // index line lands at .mugiwara/index.md
  expect(index).toBe('index.md');
  const idx = readFileSync(join(root, 'index.md'), 'utf8');
  expect(idx).toContain('- demo —');
  expect(existsSync(join(root, 'config'))).toBe(true);
});

test('archiveMission --dry-run folds nothing and writes no index', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-archive-dry-'));
  const missionDir = buildArchiveFixture(dir);
  const root = join(dir, '.mugiwara');
  const { index } = archiveMission(dir, 'demo', { dryRun: true });

  expect(existsSync(join(missionDir, 'flows', '01-execution.md'))).toBe(true);
  expect(existsSync(join(missionDir, 'spec.md'))).toBe(true);
  expect(existsSync(join(missionDir, 'state.json'))).toBe(true);
  expect(index).toBeUndefined();
  expect(existsSync(join(root, 'index.md'))).toBe(false);
});

test('archiveMission folds a legacy waves/ mission without splitting the trail', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-archive-legacy-'));
  const root = join(dir, '.mugiwara');
  const missionDir = join(root, 'missions', 'old');
  mkdirSync(join(missionDir, 'waves'), { recursive: true });
  writeFileSync(join(missionDir, 'waves', '06-closure.md'), 'legacy closure body');
  writeFileSync(join(missionDir, 'state.json'), JSON.stringify({ mission: 'old' }));

  const r = archiveMission(dir, 'old');
  const rep = readFileSync(join(missionDir, 'report.md'), 'utf8');
  expect(rep).toContain('## Archived: 06-closure.md');
  expect(rep).toContain('legacy closure body');
  expect(r.removed.join(',')).toContain(join('missions', 'old', 'waves', '06-closure.md'));
  expect(existsSync(join(missionDir, 'flows'))).toBe(false); // never created for a legacy mission
});

test('archiveMission returns null report for an unknown mission', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-archive-none-'));
  const r = archiveMission(dir, 'ghost');
  expect(r.report).toBeNull();
  expect(r.removed).toEqual([]);
});
