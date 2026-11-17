// src/record.ts — `mugiwara record <stage>`: write flows/NN-<stage>.md from facts the CLI
// can see (git diff, a command it ran itself, the review ledger), so the model never has
// to invent the file format. Refuses when there is nothing real to record.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { dispatchedAgents } from './active-mission.ts';
import { readState } from './continue.ts';
import { stripGitignoreBlock } from './gitignore.ts';
import { readManifest } from './manifest.ts';
import { unwireHooks } from './targets/claude.ts';
import { riskPathsIn } from './risk.ts';

export const STAGES = ['execution', 'audit', 'quality', 'gates', 'healing', 'closure'] as const;
export type Stage = (typeof STAGES)[number];

export interface RecordOpts { cmd?: string; note?: string; timeoutMs?: number }

function git(projectDir: string, args: string[]): string {
  try { return execFileSync('git', args, { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}

/** Files mugiwara itself installed (from the manifest), relative to the project. */
function installedFiles(projectDir: string): Set<string> {
  try {
    const m = readManifest(join(projectDir, '.mugiwara', 'manifest.json'));
    const root = realpathSync(projectDir);
    return new Set((m?.files ?? []).map((f) => (isAbsolute(f) ? relative(root, existsSync(f) ? realpathSync(f) : f) : f)));
  } catch {
    return new Set();
  }
}

/**
 * Shared files install edits in place but does not own, so they are not in the manifest.
 * Each maps to the uninstall logic that removes mugiwara's own edits (null = unparseable).
 */
const MERGED: Record<string, (text: string) => string | null> = {
  '.gitignore': (t) => stripGitignoreBlock(t)?.trim() ?? null,
  '.claude/settings.json': (t) => {
    try { const s = JSON.parse(t || '{}'); unwireHooks(s); return JSON.stringify(s); } catch { return null; }
  },
};

/** True when a merged file differs from every base only by mugiwara's install edits. A real mission edit stays listed. */
function installEditOnly(projectDir: string, f: string, bases: string[]): boolean {
  const strip = MERGED[f];
  const p = join(projectDir, f);
  if (!strip || !existsSync(p)) return false;
  const now = strip(readFileSync(p, 'utf8'));
  return now !== null && bases.every((b) => strip(git(projectDir, ['show', `${b}:${f}`])) === now);
}

/**
 * The files this mission changed: each member's diff from its base_sha to the working
 * tree (committed and uncommitted), plus untracked files, minus mugiwara's install
 * footprint and the .mugiwara/ trail. Diffing against HEAD hid committed work and listed
 * install files instead (R1). No known base is an error, never a working-tree guess.
 */
export function missionFiles(projectDir: string, mission: string): { files: string[]; bases: string[] } | { error: string } {
  const states = readState(projectDir).filter((s) => s.mission === mission);
  if (!states.length) return { error: `no state for mission '${mission}' — run \`mugiwara savepoint\` first.` };
  const bases = [...new Set(states.map((s) => s.base_sha).filter((b) => b && b !== 'unknown'))];
  if (!bases.length) return { error: `mission '${mission}' has no base_sha in state — cannot tell what the mission changed.` };
  const installed = installedFiles(projectDir);
  const out = new Set<string>();
  for (const base of bases) for (const f of git(projectDir, ['diff', '--name-only', base]).split('\n')) if (f) out.add(f);
  for (const f of git(projectDir, ['ls-files', '--others', '--exclude-standard']).split('\n')) if (f) out.add(f);
  const files = [...out].filter((f) => !f.startsWith('.mugiwara/') && !installed.has(f) && !installEditOnly(projectDir, f, bases));
  return { files: files.sort(), bases };
}

const tail = (s: string, n = 20): string => s.split('\n').slice(-n).join('\n').trim();

/** Stages that may run a command. Any other stage refuses --cmd rather than ignore it. */
const RUNS_CMD: readonly Stage[] = ['gates', 'quality', 'healing'];

/** Run a command the CLI owns, and render its real exit code and output tail. */
function commandBlock(projectDir: string, cmd: string, timeoutMs?: number): string {
  const r = spawnSync(cmd, { cwd: projectDir, shell: true, encoding: 'utf8', timeout: timeoutMs ?? 600_000 });
  const code = r.status === null ? `no exit (${r.signal ?? 'timeout'})` : String(r.status);
  return `Command: \`${cmd}\`\nExit code: ${code} (${r.status === 0 ? 'pass' : 'fail'})\n\n\`\`\`\n${tail(`${r.stdout ?? ''}\n${r.stderr ?? ''}`)}\n\`\`\`\n`;
}

/** Build the file body for a stage, or return an error string when nothing real exists to record. */
export function buildStage(projectDir: string, mission: string, stage: Stage, o: RecordOpts): { body: string } | { error: string } {
  const note = o.note ? `\n## Note\n\n${o.note.trim()}\n` : '';
  // A flag the stage would ignore is a silent gap in the trail. Refuse it. (R2)
  if (o.cmd && !RUNS_CMD.includes(stage)) {
    return { error: `${stage} does not run commands — drop --cmd. Commands are recorded by: ${RUNS_CMD.join(', ')}.` };
  }
  // Only execution and audit describe changed files, resolved from the mission's base. (R1)
  let files: string[] = [];
  let bases: string[] = [];
  if (stage === 'execution' || stage === 'audit') {
    const mf = missionFiles(projectDir, mission);
    if ('error' in mf) return mf;
    ({ files, bases } = mf);
  }
  switch (stage) {
    case 'execution': {
      if (!files.length) return { error: 'no changed files to record — the mission diff from its base is empty.' };
      const stat = bases.map((b) => git(projectDir, ['diff', '--stat', b, '--', ...files])).filter(Boolean).join('\n\n');
      return { body: `# Execution\n\nChanged files (${files.length}):\n\n${files.map((f) => `- ${f}`).join('\n')}\n\n\`\`\`\n${stat}\n\`\`\`\n${note}` };
    }
    case 'audit': {
      const risky = riskPathsIn(files);
      return { body: `# Audit\n\nFiles in scope: ${files.length}.\nRisky paths: ${risky.length ? risky.join(', ') : 'none found'}.\n${note}` };
    }
    case 'gates': {
      if (!o.cmd) return { error: 'gates needs --cmd "<command>": the CLI runs it and records the real exit code.' };
      return { body: `# Gates\n\n${commandBlock(projectDir, o.cmd, o.timeoutMs)}${note}` };
    }
    case 'closure': {
      const ran = dispatchedAgents(projectDir, mission);
      const rev = ['robin-reviewer', 'jinbe-security'].map((a) => `- ${a}: ${ran.has(a) ? 'dispatched as a separate agent' : 'not dispatched'}`).join('\n');
      return { body: `# Closure\n\nIndependent review (from the dispatch ledger):\n\n${rev}\n${note}` };
    }
    default: {
      // quality, healing: a command the CLI runs is a fact, a note is the model's account.
      // Record whichever exists; the old branch dropped --cmd without a word. (R2)
      if (!o.cmd && !o.note) return { error: `${stage} needs --cmd "<command>" or --note "<what happened>"; nothing is recorded without one.` };
      const ran = o.cmd ? `\n${commandBlock(projectDir, o.cmd, o.timeoutMs)}` : '';
      return { body: `# ${stage[0].toUpperCase()}${stage.slice(1)}\n${ran}${note}` };
    }
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
