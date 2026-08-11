// mugiwara — OpenCode plugin.
//
// Registers the Mugiwara crew (25 skills + 15 agents) with OpenCode from the
// npm/git package, and announces the crew at session start. No runtime, no
// deps — reads the markdown source of truth (content/) at config load.
//
// Install: add to opencode.json
//   { "plugin": ["@ionivetech/mugiwara"] }
// or from the git repo:
//   { "plugin": ["mugiwara@git+https://github.com/ionivetech/mugiwara.git"] }

import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, appendFileSync, lstatSync, renameSync } from 'node:fs';
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

const contentDir = join(__dirname, '..', '..', 'content');
const skillsDir = join(contentDir, 'skills');
const agentsDir = join(contentDir, 'agents');

const ANNOUNCE =
  "Mugiwara crew available. The workflow auto-activates for non-trivial requests — no need to call `/using-mugiwara` at session start (it remains an optional router). Run the crew pipeline inline in the main conversation: embody ONE crew role at a time using its skill, wait for its report, then move to the next. Never Task-dispatch a crew member — the crew runs in the main thread; subagents only for [PARALLEL] task batches, concurrent review/security, and independent re-run checks. Progress shows as checkpoint reports at wave/stage boundaries, pausing on failure or risk. Switch mode with `/mugiwara-mode` (guided|semi|auto). See skills/mugiwara-workflow.";

// OpenCode per-agent tuning. Content stays portable markdown; these knobs
// (color, temperature, permission, steps) are opencode-only.
const CREW = {
  'using-mugiwara': { color: '#84cc16', temperature: 0.2, steps: 10 },
  'luffy-orchestrator': { color: '#ef4444', temperature: 0.2, steps: 15 },
  'usopp-brainstorm': { color: '#f59e0b', temperature: 0.6, steps: 15 },
  'nami-planner': { color: '#f97316', temperature: 0.2, steps: 15 },
  'zoro-execution': { color: '#22c55e', temperature: 0.1, steps: 30 },
  'chopper-checkpoint': { color: '#3b82f6', temperature: 0.1, permission: { edit: 'deny' }, steps: 15 },
  'sanji-quality': { color: '#a855f7', temperature: 0.1, permission: { edit: 'deny' }, steps: 10 },
  'franky-gates': { color: '#06b6d4', temperature: 0.1, permission: { edit: 'deny' }, steps: 10 },
  'robin-reviewer': { color: '#8b5cf6', temperature: 0.2, permission: { edit: 'deny' }, steps: 15 },
  'jinbe-security': { color: '#6366f1', temperature: 0.2, permission: { edit: 'deny' }, steps: 15 },
  'brook-healing': { color: '#ec4899', temperature: 0.1, steps: 20 },
  'skeptic-verifier': { color: '#64748b', temperature: 0.1, permission: { edit: 'deny' }, steps: 12 },
  'eval-runner': { color: '#14b8a6', temperature: 0.2, steps: 15 },
  'resume-coordinator': { color: '#d97706', temperature: 0.2, steps: 10 },
  'memory-keeper': { color: '#d946ef', temperature: 0.2, steps: 8 },
};

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) throw new Error('Missing frontmatter fence (---)');
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf(':');
    if (i === -1) continue;
    data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { data, body: text.slice(m[0].length) };
}

function readAgents() {
  const agents = {};
  let files;
  try {
    files = readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
  } catch {
    return agents;
  }
  for (const f of files) {
    const name = f.replace(/\.md$/, '');
    let parsed;
    try {
      parsed = parseFrontmatter(readFileSync(join(agentsDir, f), 'utf8'));
    } catch {
      continue;
    }
    if (!parsed.data.description || !parsed.body) continue;
    agents[name] = { description: parsed.data.description, mode: 'all', prompt: parsed.body };
    if (CREW[name]) agents[name] = { ...agents[name], ...CREW[name] };
  }
  return agents;
}

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
  config: (config) => {
    config.skills = config.skills || {};
    config.skills.paths = config.skills.paths || [];
    if (!config.skills.paths.includes(skillsDir)) config.skills.paths.push(skillsDir);

    config.agent = config.agent || {};
    for (const [name, agent] of Object.entries(readAgents())) {
      if (config.agent[name]) continue;
      config.agent[name] = agent;
    }
  },

  // Intercept user messages to detect `/mugiwara-mode` and natural-language
  // mode toggles; write `.mugiwara/config` so the next wave reads the new level.
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

  // ponytail-proven hook; appends the announce string to the system prompt.
  // Dedupes: repeated transforms (model switch/compaction) must not grow the
  // prompt unbounded — only append once per string content.
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
