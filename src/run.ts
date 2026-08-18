// src/run.ts
// `mugiwara run <script> [args...]` — runs a bundled harness script against the
// current project.
//
// Why this exists: the skills tell the crew to run `scripts/savepoint.sh`, but
// the installer only ever copied `content/` and `references/` into a project.
// That path resolved against the project's cwd, where the file does not exist,
// so every savepoint / lane / evidence / mission-report call silently did
// nothing. Resolving from the package root fixes it for every install target at
// once.
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// src/ during dev, dist/ once bundled — scripts/ sits beside both
export const SCRIPTS_DIR = join(here, '..', 'scripts');

/** Scripts a project is meant to call. Anything else stays internal tooling. */
export const RUNNABLE = ['savepoint.sh', 'lane.sh', 'evidence.sh', 'mission-report.sh'] as const;

/**
 * Locate a POSIX shell. Windows has none natively, but Git for Windows ships
 * one and mugiwara is git-backed anyway — savepoint reads git to compute state,
 * so a git-less machine cannot run a mission regardless.
 */
export function findBash(): string | null {
  const explicit = process.env.MUGIWARA_BASH?.trim();
  if (explicit) return existsSync(explicit) ? explicit : null;
  if (process.platform !== 'win32') return '/bin/bash';
  for (const p of [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Git', 'bin', 'bash.exe'),
  ]) {
    if (p && existsSync(p)) return p;
  }
  // last resort: whatever is on PATH (Git Bash, WSL, MSYS)
  const probe = spawnSync('where', ['bash'], { encoding: 'utf8' });
  const first = probe.stdout?.split(/\r?\n/).find((l) => l.trim());
  return first?.trim() || null;
}

export function runScript(name: string, args: string[], projectDir: string): number {
  // no path separators: `run` takes a script name, never an arbitrary path
  if (!/^[a-z0-9-]+\.sh$/.test(name)) {
    throw new Error(`invalid script name "${name}" (expected one of: ${RUNNABLE.join(', ')})`);
  }
  const script = join(SCRIPTS_DIR, name);
  if (!existsSync(script)) {
    const have = existsSync(SCRIPTS_DIR) ? readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith('.sh')) : [];
    throw new Error(`script not found: ${name}${have.length ? ` (available: ${have.join(', ')})` : ''}`);
  }
  const bash = findBash();
  if (!bash) {
    throw new Error(
      'no bash found. Install Git for Windows (which ships bash), or set MUGIWARA_BASH to a bash executable.',
    );
  }
  const r = spawnSync(bash, [script, ...args], {
    cwd: resolve(projectDir),
    stdio: 'inherit',
    env: process.env,
  });
  if (r.error) throw r.error;
  return r.status ?? 1;
}
