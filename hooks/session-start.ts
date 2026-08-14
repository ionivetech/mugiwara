#!/usr/bin/env bun
// hooks/session-start.ts — SessionStart hook: reminds the agent the crew is
// available, and in auto mode auto-resumes an in-flight mission from the
// machine-written continue.md (D10). Never restarts — continue.md carries the
// resume point written by savepoint.sh at the last wave boundary.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cwd = process.cwd();

function readMode(dir: string): string | undefined {
  const file = join(dir, '.mugiwara', 'config');
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, v] = line.split('=').map((s) => s.trim());
    if (k === 'mode') return v;
  }
  return undefined;
}

const mode = readMode(cwd) ?? readMode(homedir()) ?? 'guided';

let resumeContext = '';
if (mode === 'auto') {
  const continueFile = join(cwd, '.mugiwara', 'continue.md');
  const stateFile = join(cwd, '.mugiwara', 'state.json');
  if (existsSync(continueFile) && existsSync(stateFile)) {
    const text = readFileSync(continueFile, 'utf8');
    const field = (k: string): string => {
      const m = text.match(new RegExp(`^-?\\s*${k}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim().replace(/^"|"$/g, '') : '';
    };
    const mission = field('mission');
    const wave = field('wave');
    const tasksDone = field('tasks_done');
    const tasksTotal = field('tasks_total');
    const nextAction = field('next_action');
    if (mission) {
      resumeContext =
        `AUTO-RESUME: mission "${mission}" is in-flight (wave ${wave}, ${tasksDone}/${tasksTotal} tasks). ` +
        `next_action: ${nextAction} — read .mugiwara/continue.md + state.json, load the ` +
        `mugiwara-resume skill, and continue from the exact point. Never restart the mission.`;
    }
  }
}

console.log(
  JSON.stringify({
    additionalContext:
      "Mugiwara crew active by default. Say \\`mugiwara off\\` for a request and the crew stands down (Luffy acknowledges, records it in the decision log). Before ANY task — load \\`mugiwara-orchestration\\` skill as gatekeeper. NEVER execute, answer, or make changes without Wave 0 triage. Classification overhead <15 seconds — cheaper than an incorrect fix. Lane 0 for trivial work (single-file/<20 LOC) skips pipeline; Lane 1+ follows full pipeline. Mode: guided / semi / auto (see .mugiwara/config). Switch with \\`/mugiwara <mode>\\` — applies from the next wave. See skills/mugiwara-workflow." +
      (resumeContext ? "\n\n" + resumeContext : "")
  })
);
