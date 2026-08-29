// src/config.ts
// Shared .mugiwara/config handling — single source of truth for the default
// body and key lookup, consumed by the installer, the CLI bootstrap, and
// script readers. Shell tools (savepoint.sh, lane.sh) read the file directly;
// this module serves TypeScript consumers (src/ and scripts/*.ts).
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The default config body, identical to what the installer has always written. */
export const DEFAULT_CONFIG = [
  'mode=guided',
  'branch=feature/{type}-{issue}-{slug}',
  'commit=conventional',
  'auto_commit=on',
  'coverage_new=90',
  'coverage_modified=80',
  'review_depth=full',
  'quality_depth=full',
  'verify_merged=off',
  'delegate_threshold=60',
  'heal_max_cycles=3',
  'verbosity=normal',
  '# context_budget_chars=150000  # optional: fail archive if trail exceeds this (measured in report Cost section)',
  '# investigation_max_passes=2  # optional: cap investigation passes (spec §13)',
  '# investigation_max_unrelated_files=5',
  '# investigation_repeated_read_threshold=2',
].join('\n') + '\n';

/** Config file path candidates: project first, then user home. */
function configPaths(projectDir: string): string[] {
  return [join(projectDir, '.mugiwara', 'config'), join(homedir(), '.mugiwara', 'config')];
}

/**
 * Parse the config as a flat key=value map. Project config wins over the
 * user-level one (per-key, first-wins across the two files). Comments and
 * blank lines are skipped; values are trimmed.
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
      out[key] = t.slice(eq + 1).trim();
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

// ── Investigation limits (§13) ──────────────────────────────────────────────
// Three flat policy keys, all optional (commented in DEFAULT_CONFIG per §52).
// Defaults: max_passes 2, max_unrelated_files 5, repeated_read_threshold 2.

export type InvestigationConfig = {
  max_passes: number;
  max_unrelated_files: number;
  repeated_read_threshold: number;
};

const INVESTIGATION_DEFAULTS: InvestigationConfig = {
  max_passes: 2,
  max_unrelated_files: 5,
  repeated_read_threshold: 2,
};

/** Parse a flat config value as a positive integer; invalid/absent → default. */
function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Read the three investigation limit keys via readConfig; non-numeric/zero → default. */
export function readInvestigationConfig(projectDir: string): InvestigationConfig {
  const cfg = readConfig(projectDir);
  return {
    max_passes: positiveInt(cfg.investigation_max_passes, INVESTIGATION_DEFAULTS.max_passes),
    max_unrelated_files: positiveInt(cfg.investigation_max_unrelated_files, INVESTIGATION_DEFAULTS.max_unrelated_files),
    repeated_read_threshold: positiveInt(cfg.investigation_repeated_read_threshold, INVESTIGATION_DEFAULTS.repeated_read_threshold),
  };
}
