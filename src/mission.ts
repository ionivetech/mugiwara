// src/mission.ts
// Mission-state helpers for the mugiwara CLI (installer + reset only).
import { existsSync, rmSync, readFileSync, readdirSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

function activeActor(projectDir: string): string | null {
  // state now lives at .mugiwara/state/<mission>/[member].json — scan the
  // latest state file for its actor
  const stateDir = join(projectDir, '.mugiwara', 'state');
  if (!existsSync(stateDir)) return null;
  const missions = readdirSync(stateDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
  let latest: { actor: string; updated: number } | null = null;
  for (const mission of missions) {
    const d = join(stateDir, mission);
    for (const f of readdirSync(d).filter(f => f.endsWith('.json'))) {
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
  for (const dir of ['spec', 'plans', 'results', 'review', 'issues', 'reports']) {
    const p = join(root, dir);
    if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push(dir); }
  }
  // mission state + continue folders — state/<mission>/, continue/<mission>/
  for (const dir of ['state', 'continue']) {
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
  if (!keepLogs) {
    const p = join(root, 'logs');
    if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push('logs'); }
  } else if (existsSync(join(root, 'logs'))) {
    kept.push('logs');
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

  // A file belongs to this mission when stripping the optional YYYY-MM-DD-
  // prefix leaves `<mission>.md` or `<mission>-<suffix>.md`. Covers both the
  // bare names and the date-prefixed names the prose writes (audit-trail.md).
  const belongs = (f: string): boolean => {
    const base = f.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    return base === `${mission}.md` || base.startsWith(`${mission}-`);
  };

  // locate the report (the archive target that must survive). Reports are
  // date-prefixed (`reports/YYYY-MM-DD-<mission>.md`); compare the stripped
  // mission name so `bar-foo.md` is not mistaken for mission `foo`.
  let report: string | null = null;
  const reportsDir = join(root, 'reports');
  if (existsSync(reportsDir)) {
    const f = readdirSync(reportsDir).find(n => {
      const m = n.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
      return !!m && m[2] === mission;
    });
    if (f) report = join('reports', f);
  }

  // step results 01..05 + todos.md are evidence — kept; archive removes
  // step results 01..05 + todos.md are evidence — kept; archive removes
  // only spec/review/issues/logs + continue/<mission>/ + state/<mission>/
  const resultsDir = join(root, 'results', mission);
  if (existsSync(resultsDir)) {
    for (const f of readdirSync(resultsDir)) {
      kept.push(join('results', mission, f));
    }
  }

  // spec, review, issues, per-mission decision log — bare + date-prefixed
  const specDir = join(root, 'spec');
  if (existsSync(specDir)) {
    for (const f of readdirSync(specDir)) {
      if (!belongs(f)) continue;
      const p = join(specDir, f);
      if (!dryRun) rmSync(p);
      removed.push(join('spec', f));
    }
  }

  for (const dir of ['review', 'issues']) {
    const d = join(root, dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (!belongs(f)) continue;
      const p = join(d, f);
      if (!dryRun) rmSync(p, { force: true });
      removed.push(join(dir, f));
    }
  }

  const logsDir = join(root, 'logs');
  if (existsSync(logsDir)) {
    for (const f of readdirSync(logsDir)) {
      if (!belongs(f)) continue;
      const p = join(logsDir, f);
      if (!dryRun) rmSync(p);
      removed.push(join('logs', f));
    }
  }

  // continue/<mission>/ is a session handoff — remove this mission's folder
  const contDir = join(root, 'continue', mission);
  if (existsSync(contDir)) {
    if (!dryRun) rmSync(contDir, { recursive: true, force: true });
    removed.push(join('continue', mission));
  }
  // state/<mission>/ — remove this mission's computed state (archived)
  const stateDir = join(root, 'state', mission);
  if (existsSync(stateDir)) {
    if (!dryRun) rmSync(stateDir, { recursive: true, force: true });
    removed.push(join('state', mission));
  }

  // kept: report + the audit-trail survivors
  if (report) kept.push(report);
  for (const k of ['plans', 'config', join('logs', 'lessons.md')]) {
    if (existsSync(join(root, k))) kept.push(k);
  }

  // summary index: append one line per archived mission (retention aid),
  // idempotently — never duplicate a line for an already-indexed mission.
  let index: string | undefined;
  const indexFile = join(root, 'reports', 'index.md');
  const line = `- ${mission} — ${new Date().toISOString().slice(0, 10)}${report ? ` → ${report}` : ''}\n`;
  if (!dryRun) {
    mkdirSync(join(root, 'reports'), { recursive: true });
    const existing = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
    if (!existing.split(/\r?\n/).some(l => l.startsWith(`- ${mission} —`))) {
      const header = existing ? '' : '# Mission index\n\n';
      appendFileSync(indexFile, header + line);
    }
    index = join('reports', 'index.md');
  }
  return { report, removed, kept, index };
}
