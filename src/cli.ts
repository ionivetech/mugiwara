#!/usr/bin/env node
// src/cli.ts
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, type FlagValue, type Args } from './args.ts';
import { createRl, choose, multiChoose, confirm } from './prompt.ts';
import { targets, TARGET_IDS } from './targets/index.ts';
import { installTo, removeInstalled, VERSION } from './installer.ts';
import { manifestPath, readManifest, writeManifest, type Scope } from './manifest.ts';
import { resetMission } from './mission.ts';

const str = (v: FlagValue): string | undefined => (typeof v === 'string' ? v : undefined);
const flag = (v: FlagValue): boolean => v === true;

export async function run(argv: string[]): Promise<void> {
  const { command, flags } = parseArgs(argv);
  if (flag(flags.help) || command === 'help') return help();
  if (flag(flags.version)) { console.log(`mugiwara ${VERSION}`); return; }
  switch (command) {
    case 'install': return install(flags);
    case 'update': return install({ ...flags, force: true });
    case 'uninstall': return uninstall(flags);
    case 'list': return list(flags);
    case 'reset': return resetCmd(flags);
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
  if (!flag(flags.dryRun)) {
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

function help(): void {
  console.log(`mugiwara ${VERSION} — the Straw Hat crew for AI agents

Usage:
  mugiwara [install]     install the crew (wizard; with --yes uses project + all)
  mugiwara update        replace existing files (backs up differences first)
  mugiwara uninstall     remove installed files via manifest
  mugiwara list          show installations
  mugiwara list --check  health check: show installations + missing files
  mugiwara reset         wipe mission state (spec/plans/results/review/issues[/logs])
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
  --keep-logs            with reset: keep .mugiwara/logs (lessons ledger survives)`);
}

let entry = process.argv[1] !== undefined ? resolve(process.argv[1]) : undefined;
if (entry !== undefined) {
  try {
    entry = realpathSync(entry);
  } catch {
    // ponytail: realpath can throw on a missing/odd path — fall back to the raw resolve
  }
}
const isMain = entry !== undefined && import.meta.url === pathToFileURL(entry).href;
if (isMain) {
  run(process.argv.slice(2)).catch(err => {
    console.error(`mugiwara: ${err.message}`);
    process.exit(1);
  });
}
