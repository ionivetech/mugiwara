#!/usr/bin/env bun
// hooks/auto-savepoint.ts — Stop hook: refresh the active mission's savepoint.
//
// State used to depend on the model remembering the prose instruction "run
// scripts/savepoint.sh". It forgot, so state.json and continue.json stayed
// missing and everything reading them (resume, heal_cycle cap, lane-rise
// detection, the SessionStart auto-resume) was dead. This makes the write
// happen whether or not the crew remembers.
//
// Refreshes the CURRENT flow stage — it never advances one. Flow transitions
// stay an explicit crew action; this only keeps tasks/lane/blockers honest.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// Shared with `mugiwara run` — a second copy here drifted (it lacked the PATH
// probe), so the hook found no bash where the CLI did. One definition, bundled in.
import { findBash } from '../src/run.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const SAFE = /^[A-Za-z0-9._-]+$/;

type Active = { mission: string; member: string; wave: string; mode: string; updated: number };

/**
 * Name the mission when no savepoint exists yet, so the first one can be
 * written. A missions/<name>/ dir holding plan/spec/decisions but no state
 * json means Flow 0 produced artifacts without a savepoint — exactly the
 * drift this hook exists to end.
 */
function bootstrapMission(): Active | null {
  const base = join(cwd, '.mugiwara', 'missions');
  if (!existsSync(base)) return null;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name)) continue;
    const files = readdirSync(join(base, e.name));
    const hasState = files.some((f) => {
      if (!f.endsWith('.json')) return false;
      const stem = f.slice(0, -5);
      return stem !== 'continue' && !stem.startsWith('continue-');
    });
    const hasArtifacts = ['plan.md', 'spec.md', 'decisions.md'].some((f) => files.includes(f));
    if (!hasState && hasArtifacts) {
      return { mission: e.name, member: '', wave: '0', mode: readMode(), updated: 0 };
    }
  }
  return null;
}

function readMode(): string {
  const file = join(cwd, '.mugiwara', 'config');
  if (!existsSync(file)) return 'guided';
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const [k, v] = line.split('=').map((s) => s.trim());
    if (k === 'mode' && ['guided', 'semi', 'auto'].includes(v)) return v;
  }
  return 'guided';
}

function activeMission(): Active | null {
  const base = join(cwd, '.mugiwara', 'missions');
  if (!existsSync(base)) return bootstrapMission();
  let best: Active | null = null;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name)) continue;
    for (const f of readdirSync(join(base, e.name))) {
      // state.json (solo) or <member>.json (team) — never continue*.json
      if (!f.endsWith('.json')) continue;
      const stem = f.slice(0, -5);
      if (stem === 'continue' || stem.startsWith('continue-')) continue;
      const member = stem === 'state' ? '' : stem;
      if (member && (!SAFE.test(member) || /^\.+$/.test(member))) continue;
      try {
        const s = JSON.parse(readFileSync(join(base, e.name, f), 'utf8'));
        const updated = Date.parse(s.updated_at ?? '') || 0;
        if (best && updated <= best.updated) continue;
        const wave = String(s.flow ?? s.wave ?? '').replace(/\D/g, '') || '1';
        const mode = ['guided', 'semi', 'auto'].includes(s.mode) ? s.mode : 'guided';
        best = { mission: e.name, member, wave, mode, updated };
      } catch {
        // corrupt savepoint — skip, never break the Stop hook
      }
    }
  }
  return best ?? bootstrapMission();
}

try {
  const active = activeMission();
  const script = join(root, 'scripts', 'savepoint.sh');
  const bash = findBash();
  if (active && bash && existsSync(script)) {
    spawnSync(bash, [script, active.mission, active.member, active.wave, active.mode], {
      cwd,
      stdio: 'ignore',
      timeout: 15_000,
    });
  }
} catch {
  // a Stop hook must never fail the turn
}
