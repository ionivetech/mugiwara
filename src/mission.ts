// src/mission.ts
// Mission-state helpers for the mugiwara CLI.
import { existsSync, rmSync, readFileSync, readdirSync, mkdirSync, appendFileSync, writeFileSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { checkTrail, formatIssues } from './integrity.ts';
import { generateRollback } from './rollback.ts';
import { writeProvenance } from './provenance.ts';
import { rankFiles, renderRouting } from './routing.ts';
import { formatFootprint, measureContextChars, readBudgetConfig } from './budget.ts';

function isStateFile(f: string): boolean {
  // state.json (solo) or <member>.json (team) — never continue*.json
  const stem = f.replace(/\.json$/, '');
  return f.endsWith('.json') && stem !== 'continue' && !stem.startsWith('continue-');
}

/** Primary state for closure artifacts: solo state.json wins over members. */
function primaryState(dir: string, files: string[]): Record<string, unknown> | null {
  const name = files.includes('state.json') ? 'state.json' : files.find((f) => f.endsWith('.json') && f !== 'continue.json' && !f.startsWith('continue-'));
  if (!name) return null;
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Files the mission changed, base..branch. Empty on any git failure — routing is best-effort. */
function changedFiles(projectDir: string, state: Record<string, unknown> | null): string[] {
  const base = typeof state?.base_sha === 'string' ? state.base_sha : '';
  const branch = typeof state?.branch === 'string' ? state.branch : '';
  if (!base || base === 'unknown' || !branch) return [];
  try {
    return execFileSync('git', ['diff', '--name-only', base, branch], {
      cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function activeActor(projectDir: string): string | null {
  // state now lives at .mugiwara/missions/<mission>/[member].json — scan the
  // latest state file for its actor
  const missionsDir = join(projectDir, '.mugiwara', 'missions');
  if (!existsSync(missionsDir)) return null;
  const missions = readdirSync(missionsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
  let latest: { actor: string; updated: number } | null = null;
  for (const mission of missions) {
    const d = join(missionsDir, mission);
    for (const f of readdirSync(d).filter(isStateFile)) {
      try {
        const s = JSON.parse(readFileSync(join(d, f), 'utf8'));
        const t = Date.parse(s.updated_at || '') || 0;
        if (!latest || t > latest.updated) latest = { actor: s.actor || null, updated: t };
      } catch { /* corrupt — skip */ }
    }
  }
  return latest ? latest.actor : null;
}

export function resetMission(projectDir: string, keepLogs: boolean, force?: boolean): { removed: string[]; kept: string[]; blocked?: string } {
  const root = join(projectDir, '.mugiwara');
  if (!existsSync(root)) return { removed: [], kept: [] };

  // safe multi-actor: refuse to wipe another actor's live mission
  if (!force) {
    const actor = activeActor(projectDir);
    if (actor) {
      return { removed: [], kept: [], blocked: `Active mission for '${actor}'. Use --force to override.` };
    }
  }

  const removed: string[] = [];
  const kept: string[] = [];
  // current layout: everything lives in missions/. Legacy pre-0.7 dirs are
  // removed too so an upgraded project ends up with one layout, not two.
  for (const dir of ['missions', 'spec', 'plans', 'results', 'review', 'issues', 'reports', 'state', 'continue']) {
    const p = join(root, dir);
    if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push(dir); }
  }
  // legacy flat state files — state.json + branch-specific state-*.json
  for (const f of readdirSync(root)) {
    if (/^state(-.+)?\.json$/.test(f)) {
      const p = join(root, f);
      if (existsSync(p)) { rmSync(p); removed.push(f); }
    }
  }
  // lessons.md moved to the .mugiwara root; legacy home was logs/
  if (!keepLogs) {
    for (const p of [join(root, 'lessons.md'), join(root, 'logs')]) {
      if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push(p.startsWith(join(root, 'logs')) ? 'logs' : 'lessons.md'); }
    }
  } else {
    if (existsSync(join(root, 'lessons.md'))) kept.push('lessons.md');
    else if (existsSync(join(root, join('logs', 'lessons.md')))) kept.push(join('logs', 'lessons.md'));
  }
  for (const f of ['config', 'manifest.json', 'backup']) {
    if (existsSync(join(root, f))) kept.push(f);
  }
  return { removed, kept };
}

export function archiveMission(projectDir: string, mission: string, opts: { dryRun?: boolean } = {}): { report: string | null; removed: string[]; kept: string[]; index?: string } {
  const { dryRun = false } = opts;
  const root = join(projectDir, '.mugiwara');
  // mission allowlist — same as savepoint.sh. Dot-only
  // names (".", "..") would resolve upward through join(...,"..") and let
  // rmSync reach state.json/config outside the mission dir.
  if (!mission || /[^a-zA-Z0-9._-]/.test(mission) || /^\.+$/.test(mission)) throw new Error(`invalid mission name "${mission}" (allowlist: [a-zA-Z0-9._-], not a dot-path)`);
  const removed: string[] = [];
  const kept: string[] = [];

  const dir = join(root, 'missions', mission);
  if (!existsSync(dir)) return { report: null, removed, kept };

  // Closure integrity gate: the trail validates itself before it
  // folds. Dangling links, secrets, or missing evidence fail the archive.
  if (!dryRun) {
    const issues = checkTrail(dir, projectDir);
    if (issues.length) {
      throw new Error(`closure integrity gate failed — fix these before archiving:\n${formatIssues(issues)}`);
    }
  }

  const files = readdirSync(dir);
  const state = primaryState(dir, files);

  // Context budget: visible footprint number; over-budget fails
  // when a ceiling is configured. Unset budget = recorded only.
  let footprintLine = '';
  if (!dryRun && state) {
    const chars = measureContextChars(dir);
    const budget = readBudgetConfig(projectDir);
    footprintLine = formatFootprint(chars, budget);
    if (budget && chars > budget) {
      throw new Error(`closure context budget failed — ${footprintLine}. Trim the trail or raise context_budget_chars.`);
    }
  }

  // Fold order: narrative artifacts first, wave evidence last (chronological).
  const FOLD_TOP = ['decisions.md', 'blockers.md', 'review.md', 'security.md', 'spec.md'];
  const fold: string[] = [];
  for (const f of FOLD_TOP) {
    if (files.includes(f)) fold.push(f);
  }
  // Flow artifacts: flows/ is the current layout; a legacy mission that still
  // keeps waves/ folds from there so an upgrade never strands a trail.
  const flowsDir = join(dir, 'flows');
  const legacyWavesDir = join(dir, 'waves');
  const artDir = existsSync(flowsDir) ? flowsDir : existsSync(legacyWavesDir) ? legacyWavesDir : flowsDir;
  const artRel = artDir === legacyWavesDir ? 'waves' : 'flows';
  if (existsSync(artDir)) {
    for (const f of readdirSync(artDir).sort()) fold.push(join(artRel, f));
  }

  // The report survives: an existing report.md wins; otherwise the closure
  // wave seeds it; otherwise it starts empty.
  let report = '';
  const reportPath = join(dir, 'report.md');
  if (files.includes('report.md')) report = readFileSync(reportPath, 'utf8');
  else if (existsSync(join(artDir, '06-closure.md'))) report = readFileSync(join(artDir, '06-closure.md'), 'utf8');

  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    if (fold.length) {
      const sections = fold.map((f) => {
        const body = readFileSync(join(dir, f), 'utf8').trim();
        const name = f.includes('/') ? (f.split('/').pop() ?? f) : f;
        return `\n\n## Archived: ${name}\n\n${body}`;
      }).join('');
      // atomic: write the folded report to a temp file, then rename over the
      // target. A crash mid-write must never leave a truncated report — the
      // fold deletes the wave files right after, so a partial write loses them.
      const tmp = `${reportPath}.tmp`;
      const routingSection = state
        ? renderRouting(rankFiles(changedFiles(projectDir, state), {
            mission,
            evidence: Array.isArray(state.evidence) ? (state.evidence as string[]) : [],
            sensitive_paths: Array.isArray(state.sensitive_paths) ? (state.sensitive_paths as string[]) : [],
          } as never), mission)
        : '';
      writeFileSync(tmp, report.trimEnd() + sections + (routingSection || '') + (footprintLine ? `\n${footprintLine}\n` : '') + '\n');
      renameSync(tmp, reportPath);
    }
    for (const f of fold) {
      rmSync(join(dir, f), { force: true, recursive: true });
      removed.push(join('missions', mission, f));
    }
    // session state dies with the mission
    for (const f of files.filter((f) => f.endsWith('.json'))) rmSync(join(dir, f), { force: true });
    // flows/ may now be empty — remove the folder
    if (existsSync(artDir) && readdirSync(artDir).length === 0) rmSync(artDir, { recursive: true, force: true });
    // report.md must exist after archive — the closed marker `mugiwara clean`
    // filters on. A stale in-flight mission folds nothing, so seed a stub.
    if (!existsSync(reportPath)) {
      writeFileSync(reportPath, `# Mission: ${mission}\n\nArchived before closure — no wave artifacts were present.\n`);
    }
    // Closure artifacts: executable rollback map and the
    // two-layer provenance record. Best-effort — absent git/base degrades.
    if (state && typeof state.branch === 'string') {
      const rb = generateRollback(projectDir, dir, {
        mission,
        branch: state.branch,
        baseSha: typeof state.base_sha === 'string' ? state.base_sha : 'unknown',
      });
      if (rb) kept.push(join('missions', mission, rb.file));
      try {
        writeProvenance(projectDir, dir, {
          mission,
          actor: typeof state.actor === 'string' ? state.actor : '',
          lane: typeof state.lane === 'string' ? state.lane : '',
          mode: typeof state.mode === 'string' ? state.mode : '',
          branch: state.branch,
          tasks_done: Number(state.tasks_done) || 0,
          tasks_total: Number(state.tasks_total) || 0,
          evidence: Array.isArray(state.evidence) ? (state.evidence as string[]) : [],
        });
        kept.push(join('missions', mission, 'provenance.md'));
      } catch { /* provenance is additive; archive proceeds */ }
    }
  } else {
    for (const f of fold) removed.push(join('missions', mission, f));
  }
  removed.push(join('missions', mission, '<session state>'));
  if (files.includes('plan.md')) kept.push(join('missions', mission, 'plan.md'));
  if (files.includes('handoff.md')) kept.push(join('missions', mission, 'handoff.md'));
  kept.push(join('missions', mission, 'report.md'));

  // summary index: append one line per archived mission (retention aid),
  // idempotently — never duplicate a line for an already-indexed mission.
  let index: string | undefined;
  const indexFile = join(root, 'index.md');
  const line = `- ${mission} — ${new Date().toISOString().slice(0, 10)}\n`;
  if (!dryRun) {
    const existing = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
    if (!existing.split(/\r?\n/).some(l => l.startsWith(`- ${mission} —`))) {
      const header = existing ? '' : '# Mission index\n\n';
      appendFileSync(indexFile, header + line);
    }
    index = 'index.md';
  }
  return { report: join('missions', mission, 'report.md'), removed, kept, index };
}
