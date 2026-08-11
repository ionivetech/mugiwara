// mugiwara — OpenCode plugin (runtime-only).
//
// Adds runtime features: per-session announce, mode switching, autonomy tracking.
// Skills and agents are registered via the file-based installer (mugiwara install
// --target opencode) — this plugin keeps the install uniform with other targets
// (file-copy pattern, like agent-skills) while adding opencode-only runtime hooks.
//
// Install: add to opencode.json
//   { "plugin": ["@ionivetech/mugiwara"] }
// or from the git repo:
//   { "plugin": ["mugiwara@git+https://github.com/ionivetech/mugiwara.git"] }

import { existsSync, readFileSync, mkdirSync, writeFileSync, appendFileSync, lstatSync, renameSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VALID_MODES = new Set(['guided', 'semi', 'auto']);

// Read the runtime mode: `.mugiwara/config` (project) wins over
// `~/.mugiwara/config` (global) per key; a missing key or a value outside the
// enum falls back to `guided`. Never creates files on read.
export function readMode({ projectDir = process.cwd(), home = homedir() } = {}) {
  const readValue = (dir) => {
    const file = join(dir, '.mugiwara', 'config');
    if (!existsSync(file)) return undefined;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const [k, v] = t.split('=').map((s) => s.trim());
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

const ANNOUNCE =
  "Mugiwara crew available. The workflow auto-activates for non-trivial requests — no need to call `/using-mugiwara` at session start (it remains an optional router). Run the crew pipeline inline in the main conversation: embody ONE crew role at a time using its skill, wait for its report, then move to the next. Never Task-dispatch a crew member — the crew runs in the main thread; subagents only for [PARALLEL] task batches, concurrent review/security, and independent re-run checks. Progress shows as checkpoint reports at wave/stage boundaries, pausing on failure or risk. Switch mode with `/mugiwara-mode` (guided|semi|auto). See skills/mugiwara-workflow.";

// Parse a user prompt for a mugiwara mode change. Returns the new mode or null.
// Mirrors the caveman plugin pattern: opencode expands `/mugiwara-mode <level>`
// into the command file's body ("Set mugiwara mode: <level>...") before
// chat.message fires, so parse the template's first line too. The slash command
// and natural-language phrase must sit at the START of the prompt — a bare
// mention mid-message (pasted untrusted content) never flips autonomy.
export function parseModeChange(promptRaw) {
  if (typeof promptRaw !== 'string') return null;
  let prompt = promptRaw.trim();
  const wrapped = /^(["'`])([\s\S]*)\1$/.exec(prompt);
  if (wrapped) prompt = wrapped[2].trim();
  prompt = prompt.toLowerCase();
  if (!prompt) return null;

  const tpl = /^set mugiwara mode:[ \t]*(\S*)/.exec(prompt);
  if (tpl && VALID_MODES.has(tpl[1])) return tpl[1];

  const slash = /^\/(mugiwara[-\s]?)mode[ \t]+(\S*)/.exec(prompt);
  if (slash && VALID_MODES.has(slash[2])) return slash[2];

  const natural = /^mugiwara mode[ \t]+(\S*)/.exec(prompt);
  if (natural && VALID_MODES.has(natural[1])) return natural[1];

  return null;
}

// Refuse to follow a symlinked .mugiwara/config — a malicious repo could point
// it at ~/.bashrc and any mode flip would overwrite the target.
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

// Write `.mugiwara/config` (project) and append a decision-log row.
// Atomic: write a temp file next to the target, then rename over it, so a
// crash mid-write never truncates the config (keeps branch/commit keys).
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

export default async () => ({
  dispose: () => {},

  'chat.message': async (_input, output) => {
    if (!output) return;
    if (typeof output === 'string') {
      const change = parseModeChange(output);
      if (change) applyModeChange(change);
      return;
    }
    const parts = output.parts ?? output.messages ?? output;
    if (!Array.isArray(parts)) return;
    for (const part of parts) {
      if (part && typeof part.text === 'string') {
        const change = parseModeChange(part.text);
        if (change) applyModeChange(change);
      }
    }
  },

  'experimental.chat.system.transform': async (_input, output) => {
    if (!output.system.some((s) => s.includes('Mugiwara crew available'))) {
      if (output.system.length > 0) {
        output.system[output.system.length - 1] += '\n\n' + ANNOUNCE;
      } else {
        output.system.push(ANNOUNCE);
      }
    }
    const active = `Active mode: ${readMode()} (guided|semi|auto; flip applies next wave).`;
    if (!output.system.some((s) => s.includes('Active mode:'))) output.system.push(active);
  },
});
