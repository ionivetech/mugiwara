// src/crew.ts — `mugiwara crew`: who is on the crew, in plain words.
// Name, scope and write-scope come from content/agents/*.md frontmatter; the plain
// role and "when it appears" are a built-in map (an agent missing from it still
// lists, with its frontmatter description).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_DIR } from './installer.ts';
import { parseFrontmatter } from './frontmatter.ts';

const ROLES: Record<string, { role: string; when: string }> = {
  'luffy-orchestrator': { role: 'Captain: picks the lane, runs the check-ins, closes the mission', when: 'every mission' },
  'usopp-brainstorm': { role: 'Questions the idea and recommends an approach', when: 'before planning, when the request is unclear' },
  'nami-planner': { role: 'Writes the plan', when: 'standard and full missions' },
  'zoro-execution': { role: 'Builds the plan, alone or in parallel batches', when: 'every mission that changes code' },
  'franky-gates': { role: 'Checks coverage, build and definition of done', when: 'after the build' },
  'sanji-quality': { role: 'Checks formatting, lint, duplication and tests', when: 'after the build' },
  'robin-reviewer': { role: 'Reviews the diff and rates the risk', when: 'after gates pass' },
  'jinbe-security': { role: 'Audits the diff for security problems', when: 'with the review, on sensitive changes' },
  'chopper-checkpoint': { role: 'Audits results against the plan', when: 'before closing' },
  'skeptic-verifier': { role: 'Tries to prove the result wrong', when: 'before closing, on larger missions' },
  'brook-healing': { role: 'Fixes failures found by the checks, up to a cycle limit', when: 'only when a check fails' },
  'resume-coordinator': { role: 'Rebuilds where an interrupted mission stopped', when: 'when you run continue' },
  'memory-keeper': { role: 'Keeps lessons from past missions', when: 'start and close of a mission' },
};

const WRITES: Record<string, string> = {
  artifacts: 'mission notes only (.mugiwara/)',
  source: 'source code and tests',
};

export type CrewRow = { name: string; role: string; when: string; writes: string };

export function crewRows(contentDir: string = CONTENT_DIR): CrewRow[] {
  const dir = join(contentDir, 'agents');
  const rows: CrewRow[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const { data } = parseFrontmatter(readFileSync(join(dir, f), 'utf8'));
    const name = data.name ?? f.slice(0, -3);
    const known = ROLES[name];
    rows.push({
      name,
      role: known?.role ?? (data.description ?? '').replace(/^Persona for [^.]*\.\s*/, ''),
      when: known?.when ?? 'see its skill',
      writes: WRITES[data['write-scope'] ?? ''] ?? data['write-scope'] ?? 'unknown',
    });
  }
  return rows;
}

export function renderCrew(rows: CrewRow[]): string {
  const w = (k: keyof CrewRow) => Math.max(k.length, ...rows.map((r) => r[k].length));
  const cols: (keyof CrewRow)[] = ['name', 'role', 'when', 'writes'];
  const line = (r: CrewRow) => cols.map((k) => r[k].padEnd(w(k))).join('  ').trimEnd();
  return [line({ name: 'NAME', role: 'ROLE', when: 'WHEN IT APPEARS', writes: 'WRITES' }), ...rows.map(line)].join('\n');
}
