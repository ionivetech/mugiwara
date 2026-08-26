// src/mission.ts
// Mission-state helpers for the mugiwara CLI (installer + reset only).
import { existsSync, rmSync, readFileSync, readdirSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function isStateFile(f: string): boolean {
  // state.json (solo) or <member>.json (team) — never continue*.json
  const stem = f.replace(/\.json$/, '');
  return f.endsWith('.json') && stem !== 'continue' && !stem.startsWith('continue-');
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
  const files = readdirSync(dir);

  // Fold order: narrative artifacts first, wave evidence last (chronological).
  const FOLD_TOP = ['decisions.md', 'blockers.md', 'review.md', 'security.md', 'spec.md'];
  const fold: string[] = [];
  for (const f of FOLD_TOP) {
    if (files.includes(f)) fold.push(f);
  }
  const wavesDir = join(dir, 'waves');
  if (existsSync(wavesDir)) {
    for (const f of readdirSync(wavesDir).sort()) fold.push(join('waves', f));
  }

  // The report survives: an existing report.md wins; otherwise the closure
  // wave seeds it; otherwise it starts empty.
  let report = '';
  const reportPath = join(dir, 'report.md');
  if (files.includes('report.md')) report = readFileSync(reportPath, 'utf8');
  else if (existsSync(join(wavesDir, '06-closure.md'))) report = readFileSync(join(wavesDir, '06-closure.md'), 'utf8');

  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    if (fold.length) {
      const sections = fold.map((f) => {
        const body = readFileSync(join(dir, f), 'utf8').trim();
        const name = f.includes('/') ? (f.split('/').pop() ?? f) : f;
        return `\n\n## Archived: ${name}\n\n${body}`;
      }).join('');
      writeFileSync(reportPath, report.trimEnd() + sections + '\n');
    }
    for (const f of fold) {
      rmSync(join(dir, f), { force: true, recursive: true });
      removed.push(join('missions', mission, f));
    }
    // session state dies with the mission
    for (const f of files.filter((f) => f.endsWith('.json'))) rmSync(join(dir, f), { force: true });
    // waves/ may now be empty — remove the folder
    if (existsSync(wavesDir) && readdirSync(wavesDir).length === 0) rmSync(wavesDir, { recursive: true, force: true });
  } else {
    for (const f of fold) removed.push(join('missions', mission, f));
  }
  removed.push(join('missions', mission, '<session state>'));
  if (files.includes('plan.md')) kept.push(join('missions', mission, 'plan.md'));
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
