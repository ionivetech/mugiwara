// src/config.ts
// Shared .mugiwara/config handling — single source of truth for the default
// body and key lookup, consumed by the installer, the CLI bootstrap, and
// script readers. Shell tools (savepoint.sh, lane.sh) read the file directly;
// this module serves TypeScript consumers (src/ and scripts/*.ts).
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homeDir } from './home.ts';
import { join } from 'node:path';

/** The default config body, identical to what the installer has always written. */
export const DEFAULT_CONFIG = [
  'mode=guided',
  'verbosity=normal',
  'branch=feature/{type}-{issue}-{slug}',
  'commit=conventional',
  'auto_commit=off',
  // One threshold for new and modified files. Legacy coverage_new /
  // coverage_modified are still honored when present (they win per kind).
  'coverage=85',
  'review_depth=full',
  'quality_depth=full',
  'delegate_threshold=60',
  'heal_max_cycles=3',
  'independent_review=on',
  '# lane_scope_glob=packages/api/**',
  '# context_budget_chars=150000',
  '# team=off',
  '# sign=auto',
  '# features=core+auto',
  '# enforce=warn',
].join('\n') + '\n';

/** Config file path candidates: project first, then user home. */
function configPaths(projectDir: string): string[] {
  return [join(projectDir, '.mugiwara', 'config'), join(homeDir(), '.mugiwara', 'config')];
}

/**
 * Parse the config as a flat key=value map. Project config wins over the
 * user-level one (per-key, first-wins across the two files). Comments and
 * blank lines are skipped; values are trimmed. Side-effect free: never creates
 * the file (callers that want a default config call ensureConfig explicitly).
 */
export function readConfig(projectDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of configPaths(projectDir)) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      if (!key) continue;
      if (key in out) continue; // project value already set — keep it
      let rawVal = t.slice(eq + 1).trim();
      const hash = rawVal.indexOf('#');
      if (hash !== -1) rawVal = rawVal.slice(0, hash).trim();
      out[key] = rawVal;
    }
  }
  return out;
}

/**
 * Write the default config into <project>/.mugiwara/config when it is missing.
 * Never overwrites an existing file, never follows a symlink (defense-in-depth
 * against pre-created symlinked configs — same guard as the installer).
 * Returns true when a config was written.
 */
export function ensureConfig(projectDir: string): boolean {
  const file = join(projectDir, '.mugiwara', 'config');
  let exists = false;
  try { exists = lstatSync(file).isFile() || lstatSync(file).isSymbolicLink(); } catch { exists = false; }
  if (exists) return false;
  mkdirSync(join(projectDir, '.mugiwara'), { recursive: true });
  writeFileSync(file, DEFAULT_CONFIG);
  return true;
}
