// src/mission.ts
// Mission-state helpers for the mugiwara CLI (installer + reset only).
import { existsSync, rmSync, readFileSync, readdirSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

function activeActor(projectDir: string): string | null {
  const stateFile = join(projectDir, '.mugiwara', 'state.json');
  if (!existsSync(stateFile)) return null;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    return state.actor || null;
  } catch { return null; }
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
  // mission state files — state.json + branch-specific state-*.json
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
  // mission allowlist — same as savepoint.sh / mission-report.sh
  if (!mission || /[^a-zA-Z0-9._-]/.test(mission)) throw new Error(`invalid mission name "${mission}" (allowlist: [a-zA-Z0-9._-])`);
  const removed: string[] = [];
  const kept: string[] = [];

  // locate the report (the archive target that must survive)
  let report: string | null = null;
  const reportsDir = join(root, 'reports');
  if (existsSync(reportsDir)) {
    const f = readdirSync(reportsDir).find(n => n.endsWith(`-${mission}.md`));
    if (f) report = join('reports', f);
  }

  // remove per-mission wave intermediates from results/<mission>/, EXCEPT
  // 06-closure.md and 07-pr-verdict.md (PR material + closure stay)
  const resultsDir = join(root, 'results', mission);
  if (existsSync(resultsDir)) {
    for (const f of readdirSync(resultsDir)) {
      if (f === '06-closure.md' || f === '07-pr-verdict.md') { kept.push(join('results', mission, f)); continue; }
      const p = join(resultsDir, f);
      if (!dryRun) rmSync(p, { force: true });
      removed.push(join('results', mission, f));
    }
  }

  // spec, review, issues, per-mission decision log, continue.md
  const spec = join(root, 'spec', `${mission}.md`);
  if (existsSync(spec)) { if (!dryRun) rmSync(spec); removed.push(join('spec', `${mission}.md`)); }

  for (const dir of ['review', 'issues']) {
    const d = join(root, dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (!f.startsWith(`${mission}-`)) continue;
      const p = join(d, f);
      if (!dryRun) rmSync(p, { force: true });
      removed.push(join(dir, f));
    }
  }

  const decisionLog = join(root, 'logs', `${mission}.md`);
  if (existsSync(decisionLog)) { if (!dryRun) rmSync(decisionLog); removed.push(join('logs', `${mission}.md`)); }

  const cont = join(root, 'continue.md');
  if (existsSync(cont)) { if (!dryRun) rmSync(cont); removed.push('continue.md'); }

  // kept: report + the audit-trail survivors
  if (report) kept.push(report);
  for (const k of ['plans', 'config', 'state.json', join('logs', 'lessons.md')]) {
    if (existsSync(join(root, k))) kept.push(k);
  }

  // summary index: append one line per archived mission (retention aid)
  let index: string | undefined;
  const indexFile = join(root, 'reports', 'index.md');
  const line = `- ${mission} — ${new Date().toISOString().slice(0, 10)}${report ? ` → ${report}` : ''}\n`;
  if (!dryRun) {
    mkdirSync(join(root, 'reports'), { recursive: true });
    const header = existsSync(indexFile) ? '' : '# Mission index\n\n';
    appendFileSync(indexFile, header + line);
    index = join('reports', 'index.md');
  }
  return { report, removed, kept, index };
}
