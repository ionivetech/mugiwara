// mugiwara helpers — extracted from mugiwara.mjs so the plugin module has a
// single export. OpenCode's legacy loader calls every exported function as a
// plugin; keeping helpers in a separate module avoids them being invoked with
// the plugin context as first argument (same pattern ponytail uses).

import { existsSync, readFileSync, mkdirSync, writeFileSync, appendFileSync, lstatSync, renameSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const VALID_MODES = new Set(['guided', 'semi', 'auto']);

export function readMode({ projectDir = process.cwd(), home = homedir() } = {}) {
  const readValue = (dir) => {
    const file = join(dir, '.mugiwara', 'config');
    if (!existsSync(file)) return undefined;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const [k, v] = line.split('=').map((s) => s.trim());
      if (k !== 'mode') continue;
      return VALID_MODES.has(v) ? v : 'INVALID';
    }
    return undefined;
  };
  const proj = readValue(projectDir);
  if (proj === 'INVALID') return 'guided';
  if (proj) return proj;
  const glob = readValue(home);
  if (glob === 'INVALID') return 'guided';
  if (glob) return glob;
  return 'guided';
}

export function parseModeChange(promptRaw) {
  if (typeof promptRaw !== 'string') return null;
  let prompt = promptRaw.trim();
  const wrapped = /^(["'`])([\s\S]*)\1$/.exec(prompt);
  if (wrapped) prompt = wrapped[2].trim();
  prompt = prompt.toLowerCase();
  if (!prompt) return null;

  const tplSet = /^(?:set |)mugiwara mode:[ \t]*(\S*)/.exec(prompt);
  if (tplSet && VALID_MODES.has(tplSet[1])) return tplSet[1];

  const slash = /^\/(?:mugiwara[-\s]?)?mode[ \t]+(\S*)/.exec(prompt);
  if (slash && VALID_MODES.has(slash[1])) return slash[1];

  const slashMain = /^\/mugiwara[ \t]+(\S*)/.exec(prompt);
  if (slashMain && VALID_MODES.has(slashMain[1])) return slashMain[1];

  const natural = /^mugiwara mode[ \t]+(\S*)/.exec(prompt);
  if (natural && VALID_MODES.has(natural[1])) return natural[1];

  return null;
}

function assertNotSymlink(file) {
  if (!existsSync(file)) return;
  try {
    const st = lstatSync(file);
    if (st.isSymbolicLink()) throw new Error(`refusing to follow symlink: ${file}`);
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
}

export function applyModeChange(mode, { projectDir = process.cwd(), home = homedir() } = {}) {
  if (!VALID_MODES.has(mode)) return;
  const dir = join(projectDir, '.mugiwara');
  const file = join(dir, 'config');
  assertNotSymlink(file);
  mkdirSync(dir, { recursive: true });
  const lines = [];
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith('mode=')) continue;
      lines.push(line);
    }
  }
  lines.push(`mode=${mode}`);
  const body = lines.filter((l, i) => !(l === '' && (i === lines.length - 1 || i === 0))).join('\n') + '\n';
  const tmp = join(tmpdir(), `mugiwara-config-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(tmp, body);
  renameSync(tmp, file);
  const log = join(dir, 'logs', `${new Date().toISOString().slice(0, 10)}-mode-flip.md`);
  mkdirSync(dirname(log), { recursive: true });
  appendFileSync(log, `| ${new Date().toISOString()} | mode flip | guided/semi/auto -> ${mode} | user |\n`);
}

export const DEFAULT_CONFIG_LINES = [
  'mode=guided',
  'branch=feature/{type}-{issue}-{slug}',
  'commit=conventional',
  'base=main',
  'coverage_new=90',
  'coverage_modified=80',
  'review_depth=full',
  'quality_depth=full',
];

// Idempotent: writes the full default config only when .mugiwara/config is
// absent (a fresh repo's first use). Never overwrites an existing config —
// mode=guided is the safe default; the user's later edits win.
export function ensureDefaultConfig({ projectDir = process.cwd() } = {}) {
  const dir = join(projectDir, '.mugiwara');
  const file = join(dir, 'config');
  if (existsSync(file)) return false;
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, DEFAULT_CONFIG_LINES.join('\n') + '\n');
  return true;
}
