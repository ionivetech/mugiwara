// src/mission.ts
// Mission-state helpers for the mugiwara CLI (installer + reset only).
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export function resetMission(projectDir: string, keepLogs: boolean): { removed: string[]; kept: string[] } {
  const root = join(projectDir, '.mugiwara');
  if (!existsSync(root)) return { removed: [], kept: [] };
  const removed: string[] = [];
  const kept: string[] = [];
  for (const dir of ['spec', 'plans', 'results', 'review', 'issues']) {
    const p = join(root, dir);
    if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push(dir); }
  }
  if (!keepLogs) {
    const p = join(root, 'logs');
    if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push('logs'); }
  } else if (existsSync(join(root, 'logs'))) {
    kept.push('logs');
  }
  for (const f of ['config', 'manifest.json', 'backup']) {
    if (existsSync(join(root, f))) kept.push(f);
  }
  return { removed, kept };
}
