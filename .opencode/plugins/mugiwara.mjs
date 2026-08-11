// mugiwara — OpenCode plugin.
//
// Registers skills/agents via config hook (superpowers pattern: one plugin,
// zero file-copy), announces the crew at session start, and handles runtime
// mode switching. Helpers live in mugiwara-helpers.mjs — this module has a
// single export because OpenCode's legacy loader calls every exported function
// as a plugin (same constraint ponytail documents).
//
// Install: add to opencode.json
//   { "plugin": ["@ionivetech/mugiwara"] }
// or from the git repo:
//   { "plugin": ["mugiwara@git+https://github.com/ionivetech/mugiwara.git"] }

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMode, parseModeChange, applyModeChange } from './mugiwara-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const contentDir = join(__dirname, '..', '..', 'content');
const skillsDir = join(contentDir, 'skills');
const agentsDir = join(contentDir, 'agents');

const ANNOUNCE =
  "Mugiwara crew available. The workflow auto-activates for non-trivial requests — no need to call `/using-mugiwara` at session start (it remains an optional router). Run the crew pipeline inline in the main conversation: embody ONE crew role at a time using its skill, wait for its report, then move to the next. Never Task-dispatch a crew member — the crew runs in the main thread; subagents only for [PARALLEL] task batches, concurrent review/security, and independent re-run checks. Progress shows as checkpoint reports at wave/stage boundaries, pausing on failure or risk. Switch mode with `/mugiwara-mode` (guided|semi|auto). See skills/mugiwara-workflow.";

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

export default async () => ({
  dispose: () => {},

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
