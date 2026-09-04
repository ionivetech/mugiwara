// mugiwara — OpenCode plugin.
//
// Registers skills/agents via config hook (superpowers pattern: one plugin,
// zero file-copy) and handles runtime mode switching. Deliberately silent at
// session start: mugiwara activates only when its skills/agents are used.
// Helpers live in mugiwara-helpers.mjs — this module has a
// single export because OpenCode's legacy loader calls every exported function
// as a plugin (same constraint ponytail documents).
//
// Crew COLORS come from references/wave-banners.md (single source, shared
// references dir); the CREW map below is the cold-path
// fallback only. Temperature/steps stay here (runtime tuning, not banner
// material).
//
// Install: add to opencode.json
//   { "plugin": ["@ionivetech/mugiwara"] }
// or from the git repo:
//   { "plugin": ["mugiwara@git+https://github.com/ionivetech/mugiwara.git"] }

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  'usopp-brainstorm': { color: '#b45309', temperature: 0.6, steps: 30 },
  'nami-planner': { color: '#f97316', temperature: 0.2, steps: 30 },
  'zoro-execution': { color: '#22c55e', temperature: 0.1, steps: 50 },
  'chopper-checkpoint': { color: '#60a5fa', temperature: 0.1, steps: 30 },
  'sanji-quality': { color: '#facc15', temperature: 0.1, steps: 40 },
  'franky-gates': { color: '#06b6d4', temperature: 0.1, steps: 40 },
  'robin-reviewer': { color: '#8b5cf6', temperature: 0.2, steps: 30 },
  'jinbe-security': { color: '#6366f1', temperature: 0.2, steps: 30 },
  'brook-healing': { color: '#2dd4bf', temperature: 0.1, steps: 30 },
  'skeptic-verifier': { color: '#64748b', temperature: 0.1, steps: 30 },
  'eval-runner': { color: '#14b8a6', temperature: 0.2, steps: 30 },
  'resume-coordinator': { color: '#d97706', temperature: 0.2, steps: 30 },
  'memory-keeper': { color: '#d946ef', temperature: 0.2, steps: 30 },
};

// Read the crew color table (single source of truth, shared references/).
// Returns {} on any failure — callers fall back to the CREW map. The regex
// anchors the exact table shape: | agent-id | role | hex | ansi-256 | emoji |
function readBannerColors() {
  try {
    const path = join(__dirname, '..', '..', 'references', 'wave-banners.md');
    if (!existsSync(path)) return {};
    const text = readFileSync(path, 'utf8');
    // null-prototype: agent ids are trusted repo content, but a future
    // `__proto__` id must never write the object's prototype
    const colors = Object.create(null);
    for (const m of text.matchAll(/^\| ([\w-]+) \| [^|]+ \| (#[0-9a-f]{6}) \| (\d+) \| (\S+) \|\r?$/gm)) {
      colors[m[1]] = m[2];
    }
    return colors;
  } catch {
    return {};
  }
}

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

// Enforcement mirrors (E5, Stage B). The FORBIDDEN table is a copy of
// src/guards.ts between the GUARDS-TABLE markers — plugin.test.ts asserts the
// two blocks are byte-identical, so edit the source, never just this copy.
// The tool hook surface is binary (throw = deny): enforce=warn degrades to
// allow here, documented in docs/reference/harness-matrix.md.

const FORBIDDEN = [
// GUARDS-TABLE-START
  [/\bgh\s+pr\s+(create|merge|ready)\b/, 'opening or merging a PR'],
  [/\bgh\s+release\s+create\b/, 'creating a release'],
  [/\bgit\s+merge\b/, 'merging a branch'],
  [/\bgit\s+push\b[^|;&]*\b(main|master|production|release)\b/, 'pushing to a protected branch'],
  [/\bgit\s+push\b[^|;&]*--force/, 'force-pushing'],
  [/\bnpm\s+publish\b|\byarn\s+publish\b|\bpnpm\s+publish\b/, 'publishing a package'],
  [/\bkubectl\s+(apply|delete|rollout)\b/, 'changing a cluster'],
  [/\bterraform\s+(apply|destroy)\b/, 'changing infrastructure'],
  [/\bdocker\s+push\b/, 'pushing an image'],
  [/\baws\s+\w+\s+(create|delete|update|put)\b/, 'changing cloud resources'],
// GUARDS-TABLE-END
];

function checkCommand(command) {
  for (const [re, action] of FORBIDDEN) {
    if (re.test(command)) return action;
  }
  return null;
}

function refusalMessage(action) {
  return (
    `Mugiwara: refusing to ${action}. The crew never creates a PR, merges, or ` +
    `deploys — the human does, from the branch and the verdict the crew hands over. ` +
    `Run it yourself, or set enforce=off in .mugiwara/config.`
  );
}

function readEnforce(cwd) {
  for (const base of [cwd, process.env.HOME || '']) {
    if (!base) continue;
    const file = join(base, '.mugiwara', 'config');
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const [k, v] = line.split('=').map((s) => s.trim());
      if (k !== 'enforce') continue;
      if (v === 'off' || v === 'warn' || v === 'block') return v;
      return 'block';
    }
  }
  return 'block';
}

function markEngaged(cwd) {
  try {
    const dir = join(cwd, '.mugiwara');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, '.engaged');
    let firstSeen = new Date().toISOString();
    try {
      const prev = JSON.parse(readFileSync(file, 'utf8'));
      if (prev && typeof prev.first_seen === 'string') firstSeen = prev.first_seen;
    } catch { /* fresh marker */ }
    writeFileSync(file, JSON.stringify({ first_seen: firstSeen, touched_at: new Date().toISOString() }, null, 2) + '\n');
  } catch { /* fail open — no marker, no policing */ }
}

// Git working tree changed outside .mugiwara/, or null when git is unreadable
// (no opinion — the caller treats null as "cannot tell", never as clean).
function gitSourceChanged(cwd) {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(/\r?\n/).map((l) => l.slice(3).trim()).filter(Boolean).some((p) => !p.startsWith('.mugiwara/'));
  } catch { return null; }
}

function markerStart(cwd) {
  try {
    const marker = JSON.parse(readFileSync(join(cwd, '.mugiwara', '.engaged'), 'utf8'));
    return Date.parse(marker.first_seen ?? '') || Date.parse(marker.touched_at ?? '') || 0;
  } catch { return 0; }
}

function artifactWorkSince(cwd, start) {
  try {
    const stack = ['missions', 'spec', 'plans'].map((s) => join(cwd, '.mugiwara', s)).filter((p) => existsSync(p));
    while (stack.length) {
      const cur = stack.pop();
      for (const e of readdirSync(cur, { withFileTypes: true })) {
        const full = join(cur, e.name);
        try {
          // Symlinks never resolve: a dirent symlink reports isDirectory()
          // false, so the symlink check must come first, not nested inside.
          if (e.isSymbolicLink()) continue;
          if (e.isDirectory()) { stack.push(full); continue; }
          if (statSync(full).mtimeMs + 1000 >= start) return true;
        } catch { /* skip */ }
      }
    }
  } catch { /* no artifact opinion */ }
  return false;
}

function triageOnDisk(cwd) {
  const base = join(cwd, '.mugiwara', 'missions');
  if (!existsSync(base)) return false;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    for (const f of readdirSync(join(base, e.name))) {
      const stem = f.replace(/\.json$/, '');
      if (!f.endsWith('.json') || stem === 'continue' || stem.startsWith('continue-')) continue;
      try {
        const s = JSON.parse(readFileSync(join(base, e.name, f), 'utf8'));
        if (s && typeof s.mission === 'string' && s.mission) return true;
      } catch { /* corrupt savepoint is not triage */ }
    }
  }
  return false;
}

// Check-1 port: engaged + (source or artifact work) + no triage on disk.
// Crisp on-disk facts only, mirroring hooks/pipeline-guard.ts. Fail open:
// any error returns null (no opinion), never a false accusation.
function sessionWorkNoTriage(cwd) {
  try {
    if (readEnforce(cwd) === 'off') return null;
    if (!existsSync(join(cwd, '.mugiwara', '.engaged'))) return null;
    const source = gitSourceChanged(cwd);
    if (source === null) return null;
    const start = markerStart(cwd);
    const artifacts = start ? artifactWorkSince(cwd, start) : false;
    if (!source && !artifacts) return null;
    if (triageOnDisk(cwd)) return null;
    return (
      'Mugiwara: this session did work (source and/or .mugiwara artifacts) but no ' +
      'Flow 0 triage is on disk. Run Flow 0 (classify, size the lane, write the decision log).'
    );
  } catch { return null; }
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

  'tool.execute.before': async (input, output) => {
    // E4 port: refuse irreversible bash commands before they run (throw =
    // deny). Engagement for the session-end check is recorded here too: any
    // tool call mentioning the crew marks the session engaged.
    try {
      const cwd = process.cwd();
      let shape = '';
      try { shape = JSON.stringify(input); } catch { /* unshaped — skip marking */ }
      if (shape.toLowerCase().includes('mugiwara')) markEngaged(cwd);
      if (input && input.tool === 'bash') {
        const command = output && output.args && typeof output.args.command === 'string' ? output.args.command : '';
        const action = checkCommand(command);
        if (action && readEnforce(cwd) === 'block') throw new Error(refusalMessage(action));
      }
    } catch (e) {
      if (e && /Mugiwara: refusing/.test(e.message)) throw e;
      // fail open — never wedge a tool call
    }
  },

  event: async ({ event }) => {
    // Check-1 port at session end: work with no triage surfaces loudly here.
    // Advisory, not preventive — the work already happened; prevention on this
    // harness is the tool hook above. Fail open.
    try {
      if (!event || event.type !== 'session.idle') return;
      const reason = sessionWorkNoTriage(process.cwd());
      if (reason) throw new Error(reason);
    } catch (e) {
      if (e && /Mugiwara: this session did work/.test(e.message)) throw e;
    }
  },
});
