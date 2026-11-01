// src/active-mission.ts
// Active-mission resolution, shared by the Stop hook (auto-savepoint) and the
// PostToolUse marker (review-dispatch ledger), plus the ledger reader shared by
// the archive fold and the pipeline guard. Fail-soft: never throws.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SAFE = /^[A-Za-z0-9._-]+$/;

export type Active = { mission: string; member: string; wave: string; mode: string; updated: number };

/**
 * Name the mission when it has artifacts but no state, then seed the strongest
 * artifact flow: plan.md = 2, spec.md = 1, otherwise 0. Existing state remains
 * authoritative in activeMission().
 */
function bootstrapMission(cwd: string): Active | null {
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
    // `mugiwara archive` removes state on purpose and leaves report.md.
    // Without this, "artifacts, no state" reads as "never started" and a
    // merged mission reappears as in-flight.
    const closed = files.includes('report.md') || files.includes('pr-verdict.md');
    const hasArtifacts = ['plan.md', 'spec.md', 'decisions.md'].some((f) => files.includes(f));
    if (!hasState && hasArtifacts && !closed) {
      const wave = files.includes('plan.md') ? '2' : files.includes('spec.md') ? '1' : '0';
      return { mission: e.name, member: '', wave, mode: readMode(cwd), updated: 0 };
    }
  }
  return null;
}

function readMode(cwd: string): string {
  const file = join(cwd, '.mugiwara', 'config');
  if (!existsSync(file)) return 'guided';
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const [k, v] = line.split('=').map((s) => s.trim());
    if (k === 'mode' && ['guided', 'semi', 'auto'].includes(v)) return v;
  }
  return 'guided';
}

export function activeMission(cwd: string): Active | null {
  const base = join(cwd, '.mugiwara', 'missions');
  if (!existsSync(base)) return bootstrapMission(cwd);
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
  return best ?? bootstrapMission(cwd);
}

/** Ledger of independent review dispatches, appended by hooks/engagement-marker.ts. */
export const REVIEW_LEDGER = 'review-dispatch.jsonl';

/**
 * Agents (plain names, e.g. robin-reviewer) the ledger records for `mission`.
 * Matching rule: entry.mission must equal the mission exactly. An entry with an
 * empty mission (no active mission resolvable at dispatch time) is NOT counted:
 * attributing it by timestamp would be a guess, and a wrong guess would let one
 * mission's review vouch for another. Failing toward "inline" is the safe side.
 */
export function dispatchedAgents(cwd: string, mission: string): Set<string> {
  const out = new Set<string>();
  if (!mission) return out;
  try {
    const file = join(cwd, '.mugiwara', REVIEW_LEDGER);
    if (!existsSync(file)) return out;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as { agent?: unknown; mission?: unknown };
        if (e.mission === mission && typeof e.agent === 'string') out.add(e.agent);
      } catch { /* torn line — skip */ }
    }
  } catch { /* unreadable ledger = no dispatch */ }
  return out;
}

/**
 * A mission that reached its closing files (flows/06-closure.md or
 * flows/07-pr-verdict.md) and still has live state but no report.md, i.e. it was
 * never archived. Returns the most recently touched one, else null. Never throws.
 */
export function closingPending(cwd: string): string | null {
  const base = join(cwd, '.mugiwara', 'missions');
  let best: { name: string; at: number } | null = null;
  try {
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name)) continue;
      const dir = join(base, e.name);
      const files = readdirSync(dir);
      const live = files.some((f) => f.endsWith('.json') && f !== 'continue.json' && !f.startsWith('continue-'));
      if (!live || files.includes('report.md')) continue;
      const marks = ['06-closure.md', '07-pr-verdict.md'].map((f) => join(dir, 'flows', f)).filter((f) => existsSync(f));
      if (!marks.length) continue;
      const at = Math.max(...marks.map((f) => statSync(f).mtimeMs));
      if (!best || at > best.at) best = { name: e.name, at };
    }
  } catch { /* no missions dir or unreadable: no opinion */ }
  return best?.name ?? null;
}
