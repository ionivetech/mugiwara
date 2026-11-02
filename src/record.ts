// src/record.ts — `mugiwara record <stage>`: write flows/NN-<stage>.md from facts the CLI
// can see (git diff, a command it ran itself, the review ledger), so the model never has
// to invent the file format. Refuses when there is nothing real to record.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dispatchedAgents } from './active-mission.ts';
import { riskPathsIn } from './risk.ts';

export const STAGES = ['execution', 'audit', 'quality', 'gates', 'healing', 'closure'] as const;
export type Stage = (typeof STAGES)[number];

export interface RecordOpts { cmd?: string; note?: string; timeoutMs?: number }

function git(projectDir: string, args: string[]): string {
  try { return execFileSync('git', args, { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}

/** Files changed against HEAD plus untracked files. */
export function changedFiles(projectDir: string): string[] {
  const tracked = git(projectDir, ['diff', '--name-only', 'HEAD']).split('\n');
  const fresh = git(projectDir, ['ls-files', '--others', '--exclude-standard']).split('\n');
  return [...new Set([...tracked, ...fresh].filter((f) => f && !f.startsWith('.mugiwara/')))];
}

const tail = (s: string, n = 20): string => s.split('\n').slice(-n).join('\n').trim();

/** Build the file body for a stage, or return an error string when nothing real exists to record. */
export function buildStage(projectDir: string, mission: string, stage: Stage, o: RecordOpts): { body: string } | { error: string } {
  const note = o.note ? `\n## Note\n\n${o.note.trim()}\n` : '';
  const files = changedFiles(projectDir);
  switch (stage) {
    case 'execution': {
      if (!files.length) return { error: 'no changed files to record (git shows no diff).' };
      return { body: `# Execution\n\nChanged files (${files.length}):\n\n${files.map((f) => `- ${f}`).join('\n')}\n\n\`\`\`\n${git(projectDir, ['diff', '--stat', 'HEAD'])}\n\`\`\`\n${note}` };
    }
    case 'audit': {
      const risky = riskPathsIn(files);
      return { body: `# Audit\n\nFiles in scope: ${files.length}.\nRisky paths: ${risky.length ? risky.join(', ') : 'none found'}.\n${note}` };
    }
    case 'gates': {
      if (!o.cmd) return { error: 'gates needs --cmd "<command>": the CLI runs it and records the real exit code.' };
      const r = spawnSync(o.cmd, { cwd: projectDir, shell: true, encoding: 'utf8', timeout: o.timeoutMs ?? 600_000 });
      const code = r.status === null ? `no exit (${r.signal ?? 'timeout'})` : String(r.status);
      return { body: `# Gates\n\nCommand: \`${o.cmd}\`\nExit code: ${code} (${r.status === 0 ? 'pass' : 'fail'})\n\n\`\`\`\n${tail(`${r.stdout ?? ''}\n${r.stderr ?? ''}`)}\n\`\`\`\n${note}` };
    }
    case 'closure': {
      const ran = dispatchedAgents(projectDir, mission);
      const rev = ['robin-reviewer', 'jinbe-security'].map((a) => `- ${a}: ${ran.has(a) ? 'dispatched as a separate agent' : 'not dispatched'}`).join('\n');
      return { body: `# Closure\n\nIndependent review (from the dispatch ledger):\n\n${rev}\n${note}` };
    }
    default: // quality, healing: only the model knows; a note is the only honest input
      if (!o.note) return { error: `${stage} needs --note "<what happened>"; nothing is recorded without it.` };
      return { body: `# ${stage[0].toUpperCase()}${stage.slice(1)}\n${note}` };
  }
}

/** Write flows/NN-<stage>.md. Returns the path or an error. */
export function recordStage(projectDir: string, mission: string, stage: Stage, o: RecordOpts = {}): { path: string } | { error: string } {
  const dir = join(projectDir, '.mugiwara', 'missions', mission);
  if (!existsSync(dir)) return { error: `no mission named '${mission}'.` };
  const built = buildStage(projectDir, mission, stage, o);
  if ('error' in built) return built;
  const flows = join(dir, 'flows');
  mkdirSync(flows, { recursive: true });
  const path = join(flows, `0${STAGES.indexOf(stage) + 1}-${stage}.md`);
  writeFileSync(path, built.body);
  return { path };
}
