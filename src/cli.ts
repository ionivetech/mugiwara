#!/usr/bin/env node
// src/cli.ts
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, type FlagValue, type Args } from './args.ts';
import { createRl, choose, multiChoose, confirm } from './prompt.ts';
import { targets, TARGET_IDS } from './targets/index.ts';
import { installTo, removeInstalled, VERSION, ensureProjectGitignore, removeProjectGitignore } from './installer.ts';
import { manifestPath, readManifest, writeManifest, type Scope } from './manifest.ts';
import { resetMission, archiveMission } from './mission.ts';
import { runScript, RUNNABLE } from './run.ts';
import { readContinue, readState, resolveContinue, formatTable, formatResume, gitActor } from './continue.ts';
import { blamePath } from './provenance.ts';
import { signReport, verifyReport } from './sign.ts';
import { ensureConfig } from './config.ts';

const str = (v: FlagValue): string | undefined => (typeof v === 'string' ? v : undefined);
const flag = (v: FlagValue): boolean => v === true;

export async function run(argv: string[]): Promise<void> {
  const { command, flags, _ } = parseArgs(argv);
  if (flag(flags.help) || command === 'help') return help();
  if (flag(flags.version)) { console.log(`mugiwara ${VERSION}`); return; }
  // A command on a fresh project must be immediately usable — bootstrap the
  // default .mugiwara/config when it is missing (not only at install time).
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  if (ensureConfig(projectDir)) {
    console.log(`default .mugiwara/config written at ${join(projectDir, '.mugiwara', 'config')} (edit it to customise)`);
  }
  switch (command) {
    case 'install': return install(flags);
    case 'update': return install({ ...flags, force: true });
    case 'uninstall': return uninstall(flags);
    case 'list': return list(flags);
    case 'reset': return resetCmd(flags);
    case 'archive': return archive(flags, _);
    case 'clean': return cleanCmd(flags);
    case 'continue': return continueCmd(flags, _);
    case 'status': return statusCmd(flags);
    case 'run': return runCmd(flags, _);
    case 'savepoint': return runCmd(flags, ['run', 'savepoint.sh', ..._.slice(1)]);
    case 'blame': return blameCmd(flags, _);
    case 'handoff': return handoffCmd(flags, _);
    case 'sign': return signCmd(flags, _);
    default: throw new Error(`Unknown command: ${command}`);
  }
}

function resetCmd(flags: Args['flags']): void {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const force = flag(flags.force);
  const result = resetMission(projectDir, flag(flags.keepLogs), force);
  if (result.blocked) {
    console.error(`✗ ${result.blocked}`);
    process.exit(1);
  }
  if (result.removed.length) console.log(`removed: ${result.removed.join(', ')}`);
  else console.log('nothing to remove.');
  if (result.kept.length) console.log(`kept: ${result.kept.join(', ')}`);
}

function archive(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const mission = positionals[1];
  if (!mission) { console.error('usage: mugiwara archive <mission> [--project <dir>] [--dry-run]'); process.exit(1); }
  const result = archiveMission(projectDir, mission, { dryRun: flag(flags.dryRun) });
  if (result.report) console.log(`archive target: ${result.report}`);
  else console.error(`no mission dir for "${mission}" under .mugiwara/missions/`);
  if (result.removed.length) console.log(`${flag(flags.dryRun) ? 'would remove' : 'removed'}: ${result.removed.join(', ')}`);
  if (result.kept.length) console.log(`kept: ${result.kept.join(', ')}`);
  if (result.index) console.log(`index updated: ${result.index}`);
}

/**
 * `mugiwara clean` — batch-archive every closed mission. A mission is closed
 * when its dir holds a report.md and no live state.json/<member>.json. With
 * --all, missions with live state are included too (--force overrides the
 * safety stop). --before <date> restricts to missions whose state was last
 * touched before that date.
 */
function cleanCmd(flags: Args['flags']): void {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const dryRun = flag(flags.dryRun);
  const root = join(projectDir, '.mugiwara', 'missions');
  if (!existsSync(root)) { console.log('nothing to clean (.mugiwara/missions/ does not exist).'); return; }
  const before = str(flags.before);
  const beforeMs = before ? Date.parse(before) : NaN;
  if (before && !Number.isFinite(beforeMs)) { console.error(`invalid --before date: ${before}`); process.exit(1); }

  let candidates = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[A-Za-z0-9._-]+$/.test(e.name) && !/^\.+$/.test(e.name))
    .map((e) => e.name);
  // default: CLOSED missions only — a report.md present and no live session
  // state. --all widens to every mission dir, including in-flight ones.
  // --before additionally treats an in-flight mission as closable when its
  // newest state was last touched before the date: untouched work is safe to
  // fold even without a report.md yet.
  const stateFiles = (m: string): string[] =>
    readdirSync(join(root, m)).filter((f) => {
      const stem = f.replace(/\.json$/, '');
      return f.endsWith('.json') && stem !== 'continue' && !stem.startsWith('continue-');
    });
  const hasLiveState = (m: string): boolean => stateFiles(m).length > 0;
  const staleBefore = (m: string): boolean => {
    if (!Number.isFinite(beforeMs)) return false;
    for (const f of stateFiles(m)) {
      try {
        const ts = Date.parse(JSON.parse(readFileSync(join(root, m, f), 'utf8')).updated_at ?? '') || 0;
        if (ts === 0 || ts >= beforeMs) return false; // unknown freshness → never assume stale
      } catch { return false; }
    }
    return true;
  };
  if (!flag(flags.all)) {
    candidates = candidates.filter((m) =>
      (existsSync(join(root, m, 'report.md')) && !hasLiveState(m))
      || staleBefore(m),
    );
  } else if (!flag(flags.force)) {
    const live = candidates.filter((m) => hasLiveState(m) && !staleBefore(m));
    if (live.length) {
      console.error(`✗ in-flight mission(s): ${live.join(', ')}. Use --force to archive them anyway.`);
      process.exit(1);
    }
  }
  if (!candidates.length) { console.log('nothing to clean.'); return; }
  for (const m of candidates) {
    const r = archiveMission(projectDir, m, { dryRun });
    console.log(`${dryRun ? 'would clean' : 'cleaned'} ${m}${r.report ? ` → ${r.report}` : ''}`);
    if (r.index) console.log(`index updated: ${r.index}`);
  }
}



async function resolveOptions(flags: Args['flags']): Promise<{ scope: Scope; projectDir: string; targetIds: string[] }> {
  const interactive = !flag(flags.yes);
  if (interactive && !process.stdin.isTTY) {
    throw new Error('Not a terminal. Run with --yes and --global or --project <dir> --target <ids|all>');
  }
  const rl = interactive ? createRl() : null;
  try {
    let scope: Scope | null = flag(flags.global) ? 'global' : str(flags.project) ? 'project' : null;
    if (!scope) {
      if (!interactive) { scope = 'project'; }
      else scope = (await choose(rl!, 'Install scope?', ['global (user-wide)', 'project (this repo)'])) === 0 ? 'global' : 'project';
    }
    const projectDir = resolve(str(flags.project) ?? process.cwd());
    if (scope === 'project' && !existsSync(projectDir)) throw new Error(`Project dir not found: ${projectDir}`);

    let targetIds = str(flags.target)?.split(',').map(s => s.trim()) ?? null;
    if (targetIds && targetIds.includes('all')) targetIds = [...TARGET_IDS];
    if (!targetIds) {
      if (!interactive) { targetIds = [...TARGET_IDS]; }
      else {
        const idx = await multiChoose(rl!, 'Target AI agents?', ['all targets', ...TARGET_IDS]);
        targetIds = idx.includes(0) ? [...TARGET_IDS] : idx.map(i => TARGET_IDS[i - 1]);
      }
    }
    for (const id of targetIds) {
      if (!targets[id]) throw new Error(`Unknown target: ${id} (valid: ${TARGET_IDS.join(', ')}, all)`);
    }

    return { scope, projectDir, targetIds };
  } finally {
    if (rl) rl.close();
  }
}

async function install(flags: Args['flags']): Promise<void> {
  const { scope, projectDir, targetIds } = await resolveOptions(flags);
  const home = homedir();
  const allFiles: string[] = [];
  const allNotes: string[] = [];
  const installed: string[] = [];
  for (const id of targetIds) {
    const t = targets[id];
    if (scope === 'global' && !t.native) {
      console.log(`! ${t.label}: project scope only — skipped for global install`);
      continue;
    }
    installed.push(id);
    console.log(`\n-> ${t.label} (${scope})`);
    const r = installTo(t, { scope, projectDir, home, dryRun: flag(flags.dryRun), force: flag(flags.force) });
    console.log(`   written ${r.written.length}, skipped ${r.skipped.length}, backed up ${r.backedUp.length}`);
    for (const n of r.notes) console.log(`   note: ${n}`);
    allFiles.push(...r.written);
    allNotes.push(...r.notes);
  }
  if (scope === 'project') {
    const gi = ensureProjectGitignore(projectDir, { dryRun: flag(flags.dryRun) });
    allNotes.push(...gi.notes);
  }
  if (flag(flags.dryRun)) { console.log('\nDry run — nothing written.'); return; }
  const file = manifestPath({ scope, projectDir, home });
  const prev = readManifest(file);
  writeManifest(file, {
    version: VERSION,
    scope,
    installedAt: new Date().toISOString(),
    targets: [...new Set([...(prev?.targets ?? []), ...installed])],
    files: [...new Set([...(prev?.files ?? []), ...allFiles])],
  });
  console.log(`\nOK mugiwara ${VERSION} installed (manifest: ${file})`);
  if (allNotes.length) console.log(`${allNotes.length} note(s) above may need attention.`);
  // A fresh install writes a default .mugiwara/config — point at it directly.
  console.log('\nNext: edit .mugiwara/config to customise (mode, branch, coverage, depths).');
}

async function uninstall(flags: Args['flags']): Promise<void> {
  const scope: Scope = flag(flags.global) ? 'global' : 'project';
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const home = homedir();
  const file = manifestPath({ scope, projectDir, home });
  const manifest = readManifest(file);
  if (!manifest) {
    if (scope === 'project') {
      const globalFile = manifestPath({ scope: 'global', projectDir, home });
      if (existsSync(globalFile)) {
        console.log('No project manifest found, but a global install exists. Try:\n  mugiwara uninstall --global');
        return;
      }
    }
    console.log('Nothing installed (no manifest found).');
    return;
  }
  console.log(`Will remove ${manifest.files.length} files (targets: ${manifest.targets.join(', ')}).`);
  if (!flag(flags.yes)) {
    const rl = createRl();
    const ok = await confirm(rl, 'Proceed?');
    rl.close();
    if (!ok) { console.log('Aborted.'); return; }
  }
  const removed = removeInstalled(manifest, { dryRun: flag(flags.dryRun) });
  // Un-merge anything we injected into files the user owns. These are
  // deliberately absent from the manifest — deleting them would destroy the
  // user's own configuration alongside ours.
  for (const id of manifest.targets) {
    const t = targets[id];
    if (!t?.postUninstall) continue;
    const post = t.postUninstall({ scope, projectDir, home, dryRun: flag(flags.dryRun) });
    for (const f of post.changed) console.log(`   unwired mugiwara hooks from ${f}`);
    for (const n of post.notes) console.log(`   note: ${n}`);
  }
  if (!flag(flags.dryRun)) {
    if (scope === 'project') {
      const gi = removeProjectGitignore(projectDir);
      for (const n of gi.notes) console.log(`   note: ${n}`);
    }
    rmSync(file);
    const mugiDir = join(scope === 'global' ? home : projectDir, '.mugiwara');
    if (existsSync(mugiDir) && readdirSync(mugiDir).length === 0) {
      rmSync(mugiDir, { recursive: true, force: true });
    }
    if (manifest.targets.includes('opencode')) {
      const opencodeCache = join(home, '.cache', 'opencode', 'packages', '@ionivetech');
      if (existsSync(opencodeCache)) {
        rmSync(opencodeCache, { recursive: true, force: true });
        console.log('   cleared opencode npm cache (stale plugin versions)');
      }
    }
  }
  console.log(`OK removed ${removed.length} files`);
}

function list(flags: Args['flags']): void {
  const home = homedir();
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  let found = false;
  for (const [label, file] of [
    ['project', manifestPath({ scope: 'project', projectDir, home })],
    ['global', manifestPath({ scope: 'global', projectDir, home })],
  ]) {
    const m = readManifest(file);
    if (!m) continue;
    found = true;
    if (flag(flags.check)) {
      const missing = m.files.filter(f => !existsSync(f));
      console.log(`${label}: v${m.version} targets=${m.targets.join(',')} files=${m.files.length} missing=${missing.length} installed=${m.installedAt}`);
    } else {
      console.log(`${label}: v${m.version} targets=${m.targets.join(',')} files=${m.files.length} installed=${m.installedAt}`);
    }
  }
  if (!found) console.log('No mugiwara installation found.');
}

/**
 * `mugiwara continue [mission] [member]` — the deterministic half of resume.
 *
 * Selecting which mission/member to resume is a directory scan, not a judgement
 * call, so it runs here instead of costing the host model a reasoning turn.
 * Only the last step (verifying next_action against the plan) needs a model,
 * and that happens after this prints.
 *
 * Exit codes: 0 = a single resume point was printed; 2 = ambiguous or absent,
 * the caller must stop and let the user pick.
 */
function continueCmd(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const [mission, member] = positionals.slice(1);
  let entries = readContinue(projectDir);

  // default to this actor's work; --all crosses actors on a shared checkout
  if (!flag(flags.all)) {
    const actor = gitActor(projectDir);
    const mine = entries.filter((e) => e.actor === actor);
    // an actor-less savepoint (older file, or git identity unset) is still the
    // only thing on disk — showing nothing would look like "no missions"
    if (mine.length) entries = mine;
  }

  const r = resolveContinue(entries, mission, member);
  if (r.kind === 'resume') {
    console.log(formatResume(r.entry));
    const st = readState(projectDir).find((s) => s.mission === r.entry.mission && s.member === r.entry.member);
    const stale = st ? stalenessLine(projectDir, st.base_sha) : null;
    if (stale) console.log(stale);
    return;
  }

  if (r.kind === 'none') {
    console.log('No mission in flight. Start one with Flow 0 triage (mugiwara-orchestration).');
  } else if (r.kind === 'missions') {
    console.log(`${new Set(r.entries.map((e) => e.mission)).size} missions in flight:\n`);
    console.log(formatTable(r.entries));
    console.log('\nPick one: mugiwara continue <mission> [member]');
  } else if (r.kind === 'members') {
    console.log(`Mission "${r.mission}" has ${r.entries.length} members in flight:\n`);
    console.log(formatTable(r.entries));
    console.log(`\nPick one: mugiwara continue ${r.mission} <member>`);
  } else if (r.kind === 'unknown-mission') {
    console.error(`No in-flight mission "${r.mission}". Known: ${r.known.join(', ') || '(none)'}`);
  } else {
    console.error(`Mission "${r.mission}" has no member "${r.member}". Known: ${r.known.join(', ')}`);
  }
  process.exit(2);
}

/** `mugiwara status` — one screen of computed mission state, no model needed. */
function statusCmd(flags: Args['flags']): void {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const states = readState(projectDir);
  if (!states.length) { console.log('No mission state on disk.'); return; }
  const actor = flag(flags.all) ? null : gitActor(projectDir);
  const rows = actor ? (states.filter((s) => s.actor === actor).length ? states.filter((s) => s.actor === actor) : states) : states;
  for (const s of rows) {
    const scope = s.member ? ` [${s.member}]` : '';
    console.log(`${s.mission}${scope}`);
    console.log(`  flow ${s.flow} · ${s.tasks_done}/${s.tasks_total} tasks · lane ${s.lane}${s.lane_rose ? ' ⬆ ROSE' : ''}${s.lane_reason ? ` (${s.lane_reason})` : ''} · mode ${s.mode}`);
    console.log(`  blockers ${s.blockers_open} · heal cycle ${s.heal_cycle}/${s.heal_max_cycles}${s.heal_halt ? ' — HALT' : ''} · files touched ${s.files_touched}`);
    if (s.budget) console.log(`  tokens ${s.tokens_est}/${s.budget} (${s.budget_status})${s.delegate_due ? ' · delegate due' : ''}`);
    console.log(`  branch ${s.branch} · updated ${s.updated_at}`);
    if (s.evidence.length) console.log(`  evidence: ${s.evidence.join(', ')}`);
  }
}

/** `mugiwara run <script.sh> [args]` — run a bundled harness script here. */
function runCmd(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const name = positionals[1];
  if (!name) {
    console.error(`usage: mugiwara run <script> [args...]\n  scripts: ${RUNNABLE.join(', ')}`);
    process.exit(1);
  }
  const code = runScript(name, positionals.slice(2), projectDir);
  if (code !== 0) process.exit(code);
}

/** `mugiwara blame <path>` — provenance note on the last commit touching path. */
function blameCmd(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const path = positionals[1];
  if (!path) { console.error('usage: mugiwara blame <file-path>'); process.exit(1); }
  console.log(blamePath(projectDir, path));
}

/**
 * Staleness: has main moved since the mission's recorded base?
 * N commits behind = the ground this mission started from has shifted.
 */
export function stalenessLine(projectDir: string, baseSha: string): string | null {
  if (!baseSha || baseSha === 'unknown') return null;
  const git = (args: string[]): string => {
    try {
      return execFileSync('git', args, { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { return ''; }
  };
  let main = '';
  for (const ref of ['main', 'master']) {
    main = git(['rev-parse', '--verify', ref]);
    if (main) break;
  }
  if (!main) return null;
  try {
    const behind = Number(git(['rev-list', '--count', `${baseSha}..${main}`])) || 0;
    return behind > 0
      ? `⚠ stale base: main is ${behind} commit(s) ahead of this mission's base ${baseSha.slice(0, 7)} — rebase check before continuing`
      : null;
  } catch { return null; }
}

/** `mugiwara handoff <mission>` — a report the next engineer can act on. */
function handoffCmd(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const mission = positionals[1];
  if (!mission) { console.error('usage: mugiwara handoff <mission> [--project <dir>]'); process.exit(1); }
  const states = readState(projectDir).filter((s) => s.mission === mission);
  if (!states.length) { console.error(`no in-flight mission "${mission}"`); process.exit(1); }
  const lines = [
    `# Handoff: ${mission}`,
    '',
    `Generated ${new Date().toISOString()} by \`mugiwara handoff\`.`,
    '',
    '| | |',
    '|---|---|',
  ];
  for (const s of states) {
    const scope = s.member ? ` [${s.member}]` : '';
    lines.push(`| Mission${scope} | flow ${s.flow}, tasks ${s.tasks_done}/${s.tasks_total}, lane ${s.lane}${s.lane_rose ? ' (rose)' : ''}, mode ${s.mode} |`);
    lines.push(`| Branch | \`${s.branch}\` |`);
    lines.push(`| Actor | ${s.actor || '(unknown)'} |`);
    if (s.next_action) lines.push(`| Next action | ${s.next_action} |`);
    if (s.blockers_open) lines.push(`| Open blockers | ${s.blockers_open} |`);
    if (s.heal_cycle) lines.push(`| Heal cycles | ${s.heal_cycle}/${s.heal_max_cycles}${s.heal_halt ? ' — HALTED' : ''} |`);
    if (s.evidence.length) lines.push(`| Evidence | ${s.evidence.join(', ')} |`);
    const stale = stalenessLine(projectDir, s.base_sha);
    if (stale) lines.push(`| Staleness | ${stale.replace('⚠ stale base: ', '')} |`);
  }
  lines.push('', '## Resuming', '', `\`mugiwara continue ${mission}\` prints the exact resume point.`);
  lines.push('Verify `next_action` against plan.md before executing — the table above is computed state, not judgement.');
  const out = join('.mugiwara', 'missions', mission, 'handoff.md');
  writeFileSync(resolve(projectDir, out), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log(`\nwritten: ${out}`);
}

/** `mugiwara sign <mission>` / `--verify` — optional minisign attestation. */
function signCmd(flags: Args['flags'], _: string[]): void {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  const mission = _[1];
  if (!mission) { console.error('usage: mugiwara sign <mission> [--verify] [--project <dir>]'); process.exit(1); }
  const missionDir = join(projectDir, '.mugiwara', 'missions', mission);
  if (!existsSync(missionDir)) { console.error(`no mission dir: ${missionDir}`); process.exit(1); }
  const r = flag(flags.verify) ? verifyReport(projectDir, missionDir) : signReport(projectDir, missionDir);
  console.log(`${r.ok ? '✓' : '✗'} ${r.message}`);
  if (!r.ok) process.exit(1);
}

function help(): void {
  console.log(`mugiwara ${VERSION} — the Straw Hat crew for AI agents

Usage:
  mugiwara [install]     install the crew (wizard; with --yes uses project + all)
  mugiwara update        replace existing files (backs up differences first)
  mugiwara uninstall     remove installed files via manifest
  mugiwara list          show installations
  mugiwara list --check  health check: show installations + missing files
  mugiwara reset         wipe mission state (missions/ + legacy dirs)
  mugiwara archive <m>   fold a closed mission's waves into its report, then remove loose files
  mugiwara clean [--all] [--before <date>]
                         batch-archive every closed mission (report.md present, no live state)
  mugiwara continue      list in-flight missions (exit 2 = pick one, nothing resumed)
  mugiwara continue <m> [member]
                         print the exact resume point for that mission/member
  mugiwara status        computed mission state: wave, tasks, lane, blockers, budget
  mugiwara blame <path>  provenance note on the last commit touching <path>
                         (fetch notes first: git fetch origin 'refs/notes/mugiwara:refs/notes/mugiwara')
  mugiwara handoff <m>   write .mugiwara/missions/<m>/handoff.md — a report the next
                         engineer can act on (computed state + staleness check)
  mugiwara sign <m>      optional attestation: minisign-sign report.md (--verify to check)
  mugiwara run <script> [args...]
                         run a bundled harness script here (${RUNNABLE.join(', ')})
  mugiwara savepoint <mission> [member] [flow] [mode]
                         shorthand for: mugiwara run savepoint.sh ...
  mugiwara --help        this help
  mugiwara --version     print version

Flags:
  --global               user-wide install
  --project <dir>        project install (default: cwd)
  --target <ids|all>     comma-separated: ${TARGET_IDS.join(', ')}
  --yes, -y              non-interactive (defaults: project, all targets)
  --force                overwrite differing files (with backup)
  --dry-run              print actions without writing
  --check                with list: report missing files (health check)
   --all                  with continue/status: every actor; with clean: include in-flight missions
   --force                with clean --all: archive in-flight missions anyway
   --before <date>        with clean: also archive missions untouched since this date
   --keep-logs            with reset: keep lessons.md (lessons ledger survives)`);
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  run(process.argv.slice(2)).catch(err => {
    console.error(`mugiwara: ${err.message}`);
    process.exit(1);
  });
}
