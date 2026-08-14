// src/targets/opencode.ts
import { existsSync, readdirSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringifyFrontmatter, type FrontmatterData } from '../frontmatter.ts';
import type { Target } from '../installer.ts';

const here = dirname(fileURLToPath(import.meta.url));
const COMMANDS_SRC = join(here, '..', '..', '.opencode', 'commands');
const BANNER_TABLE = join(here, '..', '..', 'references', 'wave-banners.md');

type CrewConfig = {
  color: string;
  temperature: number;
  steps: number;
  permission?: Record<string, string>;
};

// Colors are fallbacks — the wave-banners table is the source of truth.
// Temperature/steps stay here (runtime tuning, not banner material).
const CREW: Record<string, CrewConfig> = {
  'luffy-orchestrator': { color: '#ef4444', temperature: 0.2, steps: 15 },
  'usopp-brainstorm': { color: '#f59e0b', temperature: 0.6, steps: 15 },
  'nami-planner': { color: '#f97316', temperature: 0.2, steps: 15 },
  'zoro-execution': { color: '#22c55e', temperature: 0.1, steps: 30 },
  'chopper-checkpoint': { color: '#3b82f6', temperature: 0.1, steps: 15 },
  'sanji-quality': { color: '#a855f7', temperature: 0.1, steps: 10 },
  'franky-gates': { color: '#06b6d4', temperature: 0.1, steps: 10 },
  'robin-reviewer': { color: '#8b5cf6', temperature: 0.2, steps: 15 },
  'jinbe-security': { color: '#6366f1', temperature: 0.2, steps: 15 },
  'brook-healing': { color: '#ec4899', temperature: 0.1, steps: 20 },
  'skeptic-verifier': { color: '#64748b', temperature: 0.1, steps: 12 },
  'eval-runner': { color: '#14b8a6', temperature: 0.2, steps: 15 },
  'resume-coordinator': { color: '#d97706', temperature: 0.2, steps: 10 },
  'memory-keeper': { color: '#d946ef', temperature: 0.2, steps: 8 },
};

// Crew colors from the wave-banners table (single source of truth). Returns
// {} on any failure — callers fall back to the CREW map. Same table shape as
// the opencode plugin parses: | agent-id | role | hex | ansi-256 | emoji |
function readBannerColors(): Record<string, string> {
  try {
    if (!existsSync(BANNER_TABLE)) return {};
    const text = readFileSync(BANNER_TABLE, 'utf8');
    // null-prototype + CRLF-tolerant: agent ids are trusted repo content, but
    // a future `__proto__` id must never write the object's prototype
    const colors: Record<string, string> = Object.create(null);
    for (const m of text.matchAll(/^\| ([\w-]+) \| [^|]+ \| (#[0-9a-f]{6}) \| (\d+) \| (\S+) \|\r?$/gm)) {
      colors[m[1]] = m[2];
    }
    return colors;
  } catch {
    return {};
  }
}

const BANNER_COLORS = readBannerColors();

// write-scope is the single source of truth (content/agents/*.md frontmatter),
// but it is a RULE for user-facing crew agents: they run inline in the main
// thread, so a runtime permission bound to the active-agent identity would
// force tab-switching per wave and break auto mode + resume. Runtime
// enforcement stays for internal subagent-only agents (internal: true) — the
// path boundary IS expressible in opencode: permission.edit accepts
// glob/pattern -> action, last match wins. Artifacts internal agents get
// deny-all-edit except .mugiwara/**; source internal agents get full edit
// allow. Derived at install time from the frontmatter field.
function permissionFromScope(scope: string | undefined): Record<string, string | Record<string, string>> | undefined {
  if (scope === 'source') return { edit: 'allow' };
  if (scope === 'artifacts') return { edit: { '*': 'deny', '.mugiwara/**': 'allow' } };
  return undefined;
}

function agentFrontmatter(name: string, description: string, internal: boolean, writeScope?: string) {
  const crew = CREW[name];
  const lines = [`description: ${description}`, `mode: all`];
  // color: wave-banners table wins; CREW fallback for agents the table lacks.
  // temperature/steps only exist for CREW members (runtime tuning).
  const color = BANNER_COLORS[name] ?? crew?.color;
  if (color) lines.push(`color: '${color}'`);
  if (crew) {
    lines.push(`temperature: ${crew.temperature}`, `steps: ${crew.steps}`);
    const perm = internal ? permissionFromScope(writeScope) : undefined;
    if (perm) {
      lines.push('permission:');
      for (const [k, v] of Object.entries(perm)) {
        if (typeof v === 'string') {
          lines.push(`  ${k}: ${v}`);
        } else {
          lines.push(`  ${k}:`);
          for (const [pk, pv] of Object.entries(v)) lines.push(`    "${pk}": ${pv}`);
        }
      }
    }
  }
  return lines.join('\n');
}

export const target: Target = {
  id: 'opencode',
  label: 'opencode',
  native: true,
  refPointerPrefix: '../',
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.config', 'opencode') : join(projectDir, '.opencode');
    return { skillsDir: join(root, 'skills'), agentsDir: join(root, 'agents') };
  },
  transformSkill(data: FrontmatterData, body: string) {
    return {
      relPath: join(data.name, 'SKILL.md'),
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
  transformAgent(data: FrontmatterData, body: string) {
    const desc = data['internal-agent'] === 'true' ? `[INTERNAL] ${data.description}` : data.description;
    const fm = agentFrontmatter(data.name, desc, data['internal-agent'] === 'true', data['write-scope']);
    return { relPath: `${data.name}.md`, text: `---\n${fm}\n---\n${body}` };
  },
  refsDir({ scope, projectDir, home }, skillName: string) {
    const root = scope === 'global' ? join(home, '.config', 'opencode') : join(projectDir, '.opencode');
    return join(root, 'skills', skillName, 'references');
  },
  postInstall({ scope, projectDir, home, dryRun }) {
    const root = scope === 'global' ? join(home, '.config', 'opencode') : join(projectDir, '.opencode');
    const dstDir = join(root, 'commands');
    if (dryRun) return { written: [], notes: [] };
    if (!existsSync(COMMANDS_SRC)) return { written: [], notes: [] };
    mkdirSync(dstDir, { recursive: true });
    const written: string[] = [];
    for (const f of readdirSync(COMMANDS_SRC)) {
      if (!f.endsWith('.md')) continue;
      const src = join(COMMANDS_SRC, f);
      const dst = join(dstDir, f);
      copyFileSync(src, dst);
      written.push(dst);
    }
    return { written, notes: [] };
  },
};
