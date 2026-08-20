#!/usr/bin/env bun
// hooks/auto-savepoint.ts — Stop hook: refresh the active mission's savepoint.
//
// State used to depend on the model remembering the prose instruction "run
// scripts/savepoint.sh". It forgot, so .mugiwara/state/ and .mugiwara/continue/
// stayed empty and everything reading them (resume, heal_cycle cap, lane-rise
// detection, the SessionStart auto-resume) was dead. This makes the write
// happen whether or not the crew remembers.
//
// Refreshes the CURRENT wave — it never advances one. Wave transitions stay an
// explicit crew action; this only keeps tasks/lane/blockers honest.
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
 * written. Ordered most- to least-authoritative; returns null when nothing
 * indicates a mission is underway, which keeps this hook silent on projects
 * that never engaged the crew.
 */
function bootstrapMission(): Active | null {
  // A plan, spec, or decision log means Flow 0 produced artifacts but no
  // savepoint — exactly the drift this hook exists to end.
  for (const dir of ['plans', 'spec', 'logs']) {
    const d = join(cwd, '.mugiwara', dir);
    if (!existsSync(d)) continue;
    const files = readdirSync(d)
      .filter((f) => f.endsWith('.md') && f !== 'lessons.md')
      .sort()
      .reverse();
    for (const f of files) {
      // strip the YYYY-MM-DD- prefix the crew writes; what remains is the mission
      const name = f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
      if (name && SAFE.test(name) && !/^\.+$/.test(name)) {
        return { mission: name, member: '', wave: '0', mode: readMode(), updated: 0 };
      }
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
  const base = join(cwd, '.mugiwara', 'state');
  if (!existsSync(base)) return bootstrapMission();
  let best: Active | null = null;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name)) continue;
    for (const f of readdirSync(join(base, e.name))) {
      if (!f.endsWith('.json')) continue;
      const stem = f.slice(0, -5);
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
