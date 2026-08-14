// mugiwara — OpenCode plugin.
//
// Registers skills/agents via config hook (superpowers pattern: one plugin,
// zero file-copy), announces the crew at session start, and handles runtime
// mode switching. Helpers live in mugiwara-helpers.mjs — this module has a
// single export because OpenCode's legacy loader calls every exported function
// as a plugin (same constraint ponytail documents).
//
// Crew COLORS come from content/skills/mugiwara-workflow/references/
// wave-banners.md (single source); the CREW map below is the cold-path
// fallback only. Temperature/steps stay here (runtime tuning, not banner
// material).
//
// Install: add to opencode.json
//   { "plugin": ["@ionivetech/mugiwara"] }
// or from the git repo:
//   { "plugin": ["mugiwara@git+https://github.com/ionivetech/mugiwara.git"] }

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMode, parseModeChange, applyModeChange, ensureDefaultConfig } from '../mugiwara-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const contentDir = join(__dirname, '..', '..', 'content');
const skillsDir = join(contentDir, 'skills');
const agentsDir = join(contentDir, 'agents');

// Colors are fallbacks — the wave-banners table is the source of truth.
const CREW = {
  'luffy-orchestrator': { color: '#ef4444', temperature: 0.2, steps: 30 },
  'usopp-brainstorm': { color: '#f59e0b', temperature: 0.6, steps: 30 },
  'nami-planner': { color: '#f97316', temperature: 0.2, steps: 30 },
  'zoro-execution': { color: '#22c55e', temperature: 0.1, steps: 50 },
  'chopper-checkpoint': { color: '#3b82f6', temperature: 0.1, steps: 30 },
  'sanji-quality': { color: '#a855f7', temperature: 0.1, steps: 40 },
  'franky-gates': { color: '#06b6d4', temperature: 0.1, steps: 40 },
  'robin-reviewer': { color: '#8b5cf6', temperature: 0.2, steps: 30 },
  'jinbe-security': { color: '#6366f1', temperature: 0.2, steps: 30 },
  'brook-healing': { color: '#ec4899', temperature: 0.1, steps: 30 },
  'skeptic-verifier': { color: '#64748b', temperature: 0.1, steps: 30 },
  'eval-runner': { color: '#14b8a6', temperature: 0.2, steps: 30 },
  'resume-coordinator': { color: '#d97706', temperature: 0.2, steps: 30 },
  'memory-keeper': { color: '#d946ef', temperature: 0.2, steps: 30 },
};

// Read the crew color table (single source of truth). Returns {} on any
// failure — callers fall back to the CREW map. The regex anchors the exact
// table shape: | agent-id | role | hex | ansi-256 | emoji |
function readBannerColors() {
  try {
    const path = join(skillsDir, 'mugiwara-workflow', 'references', 'wave-banners.md');
    if (!existsSync(path)) return {};
    const text = readFileSync(path, 'utf8');
    const colors = {};
    for (const m of text.matchAll(/^\| ([\w-]+) \| [^|]+ \| (#[0-9a-f]{6}) \| \d+ \| \S+ \|$/gm)) {
      colors[m[1]] = m[2];
    }
    return colors;
  } catch {
    return {};
  }
}

const ANNOUNCE =
  "Mugiwara crew available. The workflow auto-activates for non-trivial requests — no need to call `/using-mugiwara` at session start (it is an optional router). Run the crew pipeline inline in the main conversation: embody ONE crew role at a time using its skill, wait for its report, then move to the next. Never Task-dispatch a crew member — the crew runs in the main thread; subagents only for [PARALLEL] task batches, concurrent review/security, and independent re-run checks. Progress shows as checkpoint reports at wave/stage boundaries, pausing on failure or risk. Switch mode with `/mugiwara` (guided|semi|auto). See skills/mugiwara-workflow.";

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

// write-scope is a RULE for user-facing crew agents (mode 'all'): they run
// inline in the main thread, so binding permission to active-agent identity
// would force tab-switching per wave and break auto mode + resume. Runtime
// enforcement stays for internal subagent-only agents (mode 'subagent'), where
// the permission actually binds at dispatch time.
function permissionFromScope(scope) {
  if (scope === 'source') return { edit: 'allow' };
  if (scope === 'artifacts') return { edit: { '*': 'deny', '.mugiwara/**': 'allow' } };
  return undefined;
}

function readAgents(stepsEnabled = true) {
  const agents = {};
  const bannerColors = readBannerColors();
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
    const internal = parsed.data.internal === 'true';
    agents[name] = {
      description: internal ? `[INTERNAL] ${parsed.data.description}` : parsed.data.description,
      mode: internal ? 'subagent' : 'all',
      prompt: parsed.body,
    };
    if (CREW[name]) {
      // steps caps per-agent agentic iterations. In auto mode the crew runs
      // the pipeline without check-in pauses, so a hard steps cap truncates
      // mid-wave — the crew relies on the continue file at wave boundaries instead
      // of opencode's per-agent step limit. Guided/semi keep the cap so a
      // paused human session cannot loop unbounded.
      const { steps, ...rest } = CREW[name];
      agents[name] = { ...agents[name], ...rest };
      if (stepsEnabled) agents[name] = { ...agents[name], steps };
    }
    // color comes from the wave-banners table (single source); CREW fallback
    // covers agents the table does not list (and vice versa)
    if (bannerColors[name] || CREW[name]) {
      agents[name] = { ...agents[name], color: bannerColors[name] ?? CREW[name].color };
    }
    const perm = permissionFromScope(parsed.data['write-scope']);
    if (perm && agents[name].mode === 'subagent') agents[name].permission = perm;
  }
  return agents;
}

export default async () => ({
  dispose: () => {},

  config: (config) => {
    // only seed .mugiwara/config when the cwd looks like a project — a global
    // install must not create .mugiwara/ in an arbitrary non-project dir.
    if (existsSync(join(process.cwd(), '.git'))) ensureDefaultConfig();
    config.skills = config.skills || {};
    config.skills.paths = config.skills.paths || [];
    if (!config.skills.paths.includes(skillsDir)) config.skills.paths.push(skillsDir);

    config.agent = config.agent || {};
    const stepsEnabled = readMode() !== 'auto';
    for (const [name, agent] of Object.entries(readAgents(stepsEnabled))) {
      if (config.agent[name]) continue;
      config.agent[name] = agent;
    }
  },

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
    if (!output?.system || !Array.isArray(output.system)) return;
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
