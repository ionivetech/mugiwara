// src/auto-close.ts — last-resort closing for an unattended mission (mode=auto).
// The Stop hook calls this only after the model was told once to run `mugiwara close`
// and stopped anyway. It records the evidence the CLI can see and archives, so a
// headless run always ends with report.md. Guided and semi missions are never touched:
// a person is there to decide.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { recordStage } from './record.ts';
import { archiveMission } from './mission.ts';
import { dispatchCounts } from './active-mission.ts';

/** The mode frozen in the mission's state file, or '' when unreadable. */
export function missionMode(cwd: string, mission: string): string {
  const dir = join(cwd, '.mugiwara', 'missions', mission);
  try {
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.json') || f === 'continue.json' || f.startsWith('continue-')) continue;
      const m = (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { mode?: unknown }).mode;
      if (typeof m === 'string') return m;
    }
  } catch { /* unreadable state: no mode, so no auto-close */ }
  return '';
}

/** Close `mission` when it is mode=auto. Never throws; `message` says what happened. */
export function autoCloseIfAuto(cwd: string, mission: string): { closed: boolean; message: string } {
  const mode = missionMode(cwd, mission);
  if (mode !== 'auto') return { closed: false, message: `not auto-closed: mission mode is ${mode || 'unknown'}, a person decides.` };
  const dir = join(cwd, '.mugiwara', 'missions', mission);
  try {
    for (const stage of ['execution', 'closure'] as const) {
      if (!existsSync(join(dir, 'flows', `0${stage === 'execution' ? 1 : 6}-${stage}.md`))) recordStage(cwd, mission, stage);
    }
    const unplanned = !existsSync(join(dir, 'plan.md'));
    archiveMission(cwd, mission, { unplanned });
    return { closed: true, message: `closed mission "${mission}" automatically (mode auto): report.md written${unplanned ? ', plan listed as Not verified' : ''}.` };
  } catch (e) {
    return { closed: false, message: `automatic close failed: ${(e as Error).message}` };
  }
}

const FAILING = /verdict[^\n]*\b(fail(ed|s)?|changes requested|needs? (fixes|changes)|blocked)\b/i;

/**
 * The first failing verdict line in review.md or security.md ("Verdict: FAIL (2 open High)"), else null.
 * ASSUMPTION: a rough match on the word; reviewers do not share one verdict format yet.
 */
export function openFindings(cwd: string, mission: string): string | null {
  const dir = join(cwd, '.mugiwara', 'missions', mission);
  for (const f of ['security.md', 'review.md']) {
    try {
      const line = readFileSync(join(dir, f), 'utf8').split('\n').find((l) => FAILING.test(l));
      if (line) return `${f}: ${line.replace(/[*#`]/g, '').trim().slice(0, 120)}`;
    } catch { /* file not written yet */ }
  }
  return null;
}

/** Heal cycles used so far (a review dispatched again after the first) and the cap from state (default 3). */
export function healProgress(cwd: string, mission: string): { cycles: number; max: number } {
  const robin = dispatchCounts(cwd, mission).get('robin-reviewer') ?? 0;
  let max = 3;
  try {
    const dir = join(cwd, '.mugiwara', 'missions', mission);
    const f = readdirSync(dir).find((x) => x.endsWith('.json') && x !== 'continue.json' && !x.startsWith('continue-'));
    const m = f ? (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { heal_max_cycles?: unknown }).heal_max_cycles : undefined;
    if (typeof m === 'number' && m > 0) max = m;
  } catch { /* default cap */ }
  return { cycles: Math.max(0, robin - 1), max };
}
