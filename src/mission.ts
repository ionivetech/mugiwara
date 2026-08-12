// src/mission.ts
// Mission-state helpers for the mugiwara CLI (installer + reset only).
import { existsSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function activeActor(projectDir: string): string | null {
  const stateFile = join(projectDir, '.mugiwara', 'state.json');
  if (!existsSync(stateFile)) return null;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    return state.actor || null;
  } catch { return null; }
}

export function resetMission(projectDir: string, keepLogs: boolean, force?: boolean): { removed: string[]; kept: string[]; blocked?: string } {
  const root = join(projectDir, '.mugiwara');
  if (!existsSync(root)) return { removed: [], kept: [] };

  // safe multi-actor: refuse to wipe another actor's live mission
  if (!force) {
    const actor = activeActor(projectDir);
    if (actor) {
      return { removed: [], kept: [], blocked: `Active mission for '${actor}'. Use --force to override.` };
    }
  }

  const removed: string[] = [];
  const kept: string[] = [];
  for (const dir of ['spec', 'plans', 'results', 'review', 'issues', 'reports']) {
    const p = join(root, dir);
    if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push(dir); }
  }
  // mission state files — state.json + branch-specific state-*.json
  for (const f of readdirSync(root)) {
    if (/^state(-.+)?\.json$/.test(f)) {
      const p = join(root, f);
      if (existsSync(p)) { rmSync(p); removed.push(f); }
    }
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
