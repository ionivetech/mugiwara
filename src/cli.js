// src/cli.js
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from './args.js';
import { createRl, choose, multiChoose, confirm } from './prompt.js';
import { targets, TARGET_IDS } from './targets/index.js';
import { installTo, removeInstalled, VERSION } from './installer.js';
import { manifestPath, readManifest, writeManifest } from './manifest.js';

const TYPES = ['frontend', 'backend', 'fullstack', 'general'];

export async function run(argv) {
  const { command, flags } = parseArgs(argv);
  if (flags.help || command === 'help') return help();
  if (flags.version) { console.log(`mugiwara ${VERSION}`); return; }
  switch (command) {
    case 'install': return install(flags);
    case 'update': return install({ ...flags, force: true });
    case 'uninstall': return uninstall(flags);
    case 'list': return list(flags);
    default: throw new Error(`Unknown command: ${command}`);
  }
}

async function resolveOptions(flags) {
  const interactive = !flags.yes;
  const rl = interactive ? createRl() : null;
  try {
    let scope = flags.global ? 'global' : flags.project ? 'project' : null;
    if (!scope) {
      if (!interactive) throw new Error('Specify --global or --project <dir> with --yes');
      scope = (await choose(rl, 'Install scope?', ['global (user-wide)', 'project (this repo)'])) === 0 ? 'global' : 'project';
    }
    const projectDir = resolve(flags.project ?? process.cwd());
    if (scope === 'project' && !existsSync(projectDir)) throw new Error(`Project dir not found: ${projectDir}`);

    let targetIds = flags.target ? flags.target.split(',').map(s => s.trim()) : null;
    if (targetIds && targetIds.includes('all')) targetIds = [...TARGET_IDS];
    if (!targetIds) {
      if (!interactive) throw new Error('Specify --target <ids|all> with --yes');
      const idx = await multiChoose(rl, 'Target AI agents?', ['all targets', ...TARGET_IDS]);
      targetIds = idx.includes(0) ? [...TARGET_IDS] : idx.map(i => TARGET_IDS[i - 1]);
    }
    for (const id of targetIds) {
      if (!targets[id]) throw new Error(`Unknown target: ${id} (valid: ${TARGET_IDS.join(', ')}, all)`);
    }

    let type = flags.type ?? null;
    if (!type) {
      if (!interactive) throw new Error('Specify --type with --yes');
      type = TYPES[await choose(rl, 'Project type?', TYPES)];
    }
    if (!TYPES.includes(type)) throw new Error(`Unknown type: ${type} (valid: ${TYPES.join(', ')})`);
    return { scope, projectDir, targetIds, type };
  } finally {
    if (rl) rl.close();
  }
}

async function install(flags) {
  const { scope, projectDir, targetIds, type } = await resolveOptions(flags);
  const home = homedir();
  const allFiles = [];
  const allNotes = [];
  for (const id of targetIds) {
    const t = targets[id];
    if (scope === 'global' && !t.native) {
      console.log(`! ${t.label}: project scope only — skipped for global install`);
      continue;
    }
    console.log(`\n-> ${t.label} (${scope})`);
    const r = installTo(t, { scope, projectDir, type, home, dryRun: !!flags.dryRun, force: !!flags.force });
    console.log(`   written ${r.written.length}, skipped ${r.skipped.length}, backed up ${r.backedUp.length}`);
    for (const n of r.notes) console.log(`   note: ${n}`);
    allFiles.push(...r.written);
    allNotes.push(...r.notes);
  }
  if (flags.dryRun) { console.log('\nDry run — nothing written.'); return; }
  const file = manifestPath({ scope, projectDir, home });
  const prev = readManifest(file);
  writeManifest(file, {
    version: VERSION,
    scope,
    type,
    installedAt: new Date().toISOString(),
    targets: [...new Set([...(prev?.targets ?? []), ...targetIds])],
    files: [...new Set([...(prev?.files ?? []), ...allFiles])],
  });
  console.log(`\nOK mugiwara ${VERSION} installed (manifest: ${file})`);
  if (allNotes.length) console.log(`${allNotes.length} note(s) above may need attention.`);
}

async function uninstall(flags) {
  const scope = flags.global ? 'global' : 'project';
  const projectDir = resolve(flags.project ?? process.cwd());
  const home = homedir();
  const file = manifestPath({ scope, projectDir, home });
  const manifest = readManifest(file);
  if (!manifest) { console.log('Nothing installed (no manifest found).'); return; }
  console.log(`Will remove ${manifest.files.length} files (targets: ${manifest.targets.join(', ')}).`);
  if (!flags.yes) {
    const rl = createRl();
    const ok = await confirm(rl, 'Proceed?');
    rl.close();
    if (!ok) { console.log('Aborted.'); return; }
  }
  const removed = removeInstalled(manifest, { dryRun: !!flags.dryRun });
  if (!flags.dryRun) rmSync(file);
  console.log(`OK removed ${removed.length} files`);
}

function list() {
  const home = homedir();
  const projectDir = resolve(process.cwd());
  let found = false;
  for (const [label, file] of [
    ['project', manifestPath({ scope: 'project', projectDir, home })],
    ['global', manifestPath({ scope: 'global', projectDir, home })],
  ]) {
    const m = readManifest(file);
    if (!m) continue;
    found = true;
    console.log(`${label}: v${m.version} targets=${m.targets.join(',')} files=${m.files.length} installed=${m.installedAt}`);
  }
  if (!found) console.log('No mugiwara installation found.');
}

function help() {
  console.log(`mugiwara ${VERSION} — the Straw Hat crew for AI agents

Usage:
  mugiwara [install]     install the crew (default; wizard when flags missing)
  mugiwara update        replace existing files (backs up differences first)
  mugiwara uninstall     remove installed files via manifest
  mugiwara list          show installations
  mugiwara --help        this help
  mugiwara --version     print version

Flags:
  --global               user-wide install
  --project <dir>        project install (default: cwd)
  --target <ids|all>     comma-separated: ${TARGET_IDS.join(', ')}
  --type <t>             frontend | backend | fullstack | general
  --yes, -y              non-interactive (needs --global/--project, --target, --type)
  --force                overwrite differing files (with backup)
  --dry-run              print actions without writing`);
}
