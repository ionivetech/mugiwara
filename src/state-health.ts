// src/state-health.ts
// Read-only inspection of mission files for `continue`, `status`, `cost`,
// `archive` and `doctor`. A truncated or hand-edited file must produce a named
// file plus an exact fix, never a stack trace or a silent "no mission".
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type StateProblem = { file: string; problem: string; fix: string };

const SAFE = /^[A-Za-z0-9._-]+$/;
const NUMERIC = ['flow', 'wave', 'tasks_done', 'tasks_total', 'tokens_est', 'budget'];

const rel = (mission: string, f = ''): string =>
  mission ? join('.mugiwara', 'missions', mission, f) : join('.mugiwara', f);

/** Inspect one JSON file in a mission dir. Returns null when it is sound. */
function inspectFile(dir: string, mission: string, name: string): StateProblem | null {
  const file = rel(mission, name);
  const bad = (problem: string, fix: string): StateProblem => ({ file, problem, fix });
  const remove = `delete ${file} (the next savepoint rewrites it), or restore it with git`;
  let raw: unknown;
  try {
    const body = readFileSync(join(dir, name), 'utf8');
    try { raw = JSON.parse(body); } catch { return bad('not valid JSON (truncated or corrupt)', remove); }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? 'error';
    return bad(`cannot be read (${code})`, `chmod u+r ${file}, or delete it`);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return bad('expected a JSON object', remove);
  if (name === 'tokens.json') return null;
  const r = raw as Record<string, unknown>;
  if (r.mission !== mission) return bad(`"mission" field is ${JSON.stringify(r.mission ?? null)}, expected "${mission}"`, remove);
  if (r.tasks !== undefined && (r.tasks === null || typeof r.tasks !== 'object' || Array.isArray(r.tasks))) {
    return bad('"tasks" must be an object with done and total', remove);
  }
  for (const k of NUMERIC) {
    const v = r[k];
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v))) return bad(`"${k}" must be a number`, remove);
  }
  return null;
}

/**
 * Problems across every mission, or one mission when named. An empty mission
 * dir is only a problem when the mission is named: a bare `mkdir` before the
 * first savepoint is normal and must not break `status`.
 */
export function inspectMissions(projectDir: string, mission?: string): StateProblem[] {
  const base = join(projectDir, '.mugiwara', 'missions');
  const out: StateProblem[] = [];
  // the project-level token snapshot savepoint reads; absent is normal
  if (existsSync(join(projectDir, '.mugiwara', 'tokens.json'))) {
    const t = inspectFile(join(projectDir, '.mugiwara'), '', 'tokens.json');
    if (t) out.push(t);
  }
  if (!existsSync(base)) return out;
  let names: string[];
  try {
    names = mission ? [mission] : readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [...out, { file: join('.mugiwara', 'missions'), problem: 'cannot be listed', fix: 'chmod u+rx .mugiwara/missions' }];
  }
  for (const m of names) {
    if (!SAFE.test(m) || /^\.+$/.test(m)) continue;
    const dir = join(base, m);
    if (!existsSync(dir)) continue;
    let files: string[];
    try { files = readdirSync(dir); } catch {
      out.push({ file: rel(m), problem: 'cannot be listed', fix: `chmod u+rx ${rel(m)}` });
      continue;
    }
    if (mission && !files.length) {
      out.push({ file: rel(m), problem: 'mission dir is empty', fix: `rmdir ${rel(m)}, then start the mission again` });
    }
    for (const f of files.filter((n) => n.endsWith('.json')).sort()) {
      const p = inspectFile(dir, m, f);
      if (p) out.push(p);
    }
  }
  return out;
}

/** One block per problem: which file, what is wrong, the exact fix. */
export function formatProblems(problems: StateProblem[]): string {
  return problems.map((p) => `✗ ${p.file}: ${p.problem}\n  fix: ${p.fix}`).join('\n');
}
