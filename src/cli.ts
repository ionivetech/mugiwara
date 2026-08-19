#!/usr/bin/env node
// src/cli.ts
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, type FlagValue, type Args } from './args.ts';
import { createRl, choose, multiChoose, confirm } from './prompt.ts';
import { targets, TARGET_IDS } from './targets/index.ts';
import { installTo, removeInstalled, VERSION, ensureProjectGitignore, removeProjectGitignore } from './installer.ts';
import { manifestPath, readManifest, writeManifest, type Scope } from './manifest.ts';
import { resetMission, archiveMission } from './mission.ts';
import { runOnboard } from './onboard.ts';
import { runScript, RUNNABLE } from './run.ts';
import { readContinue, readState, resolveContinue, formatTable, formatResume, gitActor } from './continue.ts';

const str = (v: FlagValue): string | undefined => (typeof v === 'string' ? v : undefined);
const flag = (v: FlagValue): boolean => v === true;

export async function run(argv: string[]): Promise<void> {
  const { command, flags, _ } = parseArgs(argv);
  if (flag(flags.help) || command === 'help') return help();
  if (flag(flags.version)) { console.log(`mugiwara ${VERSION}`); return; }
  switch (command) {
    case 'install': return install(flags);
    case 'update': return install({ ...flags, force: true });
    case 'uninstall': return uninstall(flags);
    case 'list': return list(flags);
    case 'reset': return resetCmd(flags);
    case 'archive': return archive(flags, _);
    case 'onboard': return onboardCmd(flags);
    case 'continue': return continueCmd(flags, _);
    case 'status': return statusCmd(flags);
    case 'run': return runCmd(flags, _);
    case 'savepoint': return runCmd(flags, ['run', 'savepoint.sh', ..._.slice(1)]);
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
  if (result.removed.length) console.log(`${flag(flags.dryRun) ? 'would remove' : 'removed'}: ${result.removed.join(', ')}`);
  if (result.kept.length) console.log(`kept: ${result.kept.join(', ')}`);
  if (result.index) console.log(`index updated: ${result.index}`);
}

async function onboardCmd(flags: Args['flags']): Promise<void> {
  const projectDir = resolve(str(flags.project) ?? process.cwd());
  if (!existsSync(projectDir)) throw new Error(`Project dir not found: ${projectDir}`);
  await runOnboard(projectDir);
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
  if (r.kind === 'resume') { console.log(formatResume(r.entry)); return; }

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
    console.log(`  wave ${s.wave} · ${s.tasks_done}/${s.tasks_total} tasks · lane ${s.lane}${s.lane_reason ? ` (${s.lane_reason})` : ''} · mode ${s.mode}`);
    console.log(`  blockers ${s.blockers_open} · heal cycle ${s.heal_cycle}/3 · files touched ${s.files_touched}`);
    if (s.budget) console.log(`  tokens ${s.tokens_est}/${s.budget} (${s.budget_status})`);
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

function help(): void {
  console.log(`mugiwara ${VERSION} — the Straw Hat crew for AI agents

Usage:
  mugiwara [install]     install the crew (wizard; with --yes uses project + all)
  mugiwara update        replace existing files (backs up differences first)
  mugiwara uninstall     remove installed files via manifest
  mugiwara list          show installations
  mugiwara list --check  health check: show installations + missing files
  mugiwara reset         wipe mission state (spec/plans/results/review/issues[/logs])
  mugiwara archive <m>    fold a closed mission's evidence into its report, then remove loose files
  mugiwara onboard       run the zero-LLM onboarding wizard (writes .mugiwara/config)
  mugiwara continue      list in-flight missions (exit 2 = pick one, nothing resumed)
  mugiwara continue <m> [member]
                         print the exact resume point for that mission/member
  mugiwara status        computed mission state: wave, tasks, lane, blockers, budget
  mugiwara run <script> [args...]
                         run a bundled harness script here (${RUNNABLE.join(', ')})
  mugiwara savepoint <mission> [member] [wave] [mode]
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
  --all                  with continue/status: every actor, not just yours
  --keep-logs            with reset: keep .mugiwara/logs (lessons ledger survives)`);
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  run(process.argv.slice(2)).catch(err => {
    console.error(`mugiwara: ${err.message}`);
    process.exit(1);
  });
}
