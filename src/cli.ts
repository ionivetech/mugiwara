#!/usr/bin/env node
// src/cli.ts
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, type FlagValue, type Args } from './args.ts';
import { createRl, choose, multiChoose, confirm } from './prompt.ts';
import { targets, TARGET_IDS } from './targets/index.ts';
import { installTo, removeInstalled, VERSION, ensureProjectGitignore, removeProjectGitignore } from './installer.ts';
import { manifestPath, readManifest, writeManifest, type Scope } from './manifest.ts';
import { resetMission, archiveMission, closureBlockers, rosterAssignees } from './mission.ts';
import { knownMembers } from './continue.ts';
import { runScript, RUNNABLE } from './run.ts';
import { readContinue, readState, resolveContinue, formatTable, formatResume, gitActor, hasLegacyLayout, CURRENT_SCHEMA_VERSION, unreadableStateFiles } from './continue.ts';
import { blamePath } from './provenance.ts';
import { signReport, verifyReport, ensurePureKey, hasMinisign } from './sign.ts';
import { ensureConfig } from './config.ts';
import { costEnvelope } from './cost.ts';
import { computeLiveSlop } from './slop.ts';
import { loadRegistry } from './evidence.ts';
import { runInitiative } from './initiative.ts';
import { buildCostLedger, toCostJSON } from './reporting.ts';
import { enforceHarnessPolicy } from './policy.ts';

const str = (v: FlagValue): string | undefined => (typeof v === 'string' ? v : undefined);
const flag = (v: FlagValue): boolean => v === true;

// Anchor to the repo root so running from a package subdirectory does not
// create a shadow .mugiwara/ there. (B4)
function resolveProjectDir(explicit?: string): string {
  if (explicit) return resolve(explicit);
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    if (root) return root;
  } catch { /* not a git repo — fall through */ }
  return process.cwd();
}

export async function run(argv: string[]): Promise<void> {
  const { command, flags, _ } = parseArgs(argv);
  if (flag(flags.help) || command === 'help') return help();
  if (flag(flags.version)) { console.log(`mugiwara ${VERSION}`); return; }
  // harness.require_enforcement — enterprise gate: refuse rules-based harnesses
  // (only opencode is runtime-enforced). Covers run/savepoint/archive/status
  // + other workflow commands; install/update/uninstall/list are setup and bypass.
  {
    const bypass = new Set(['install', 'update', 'uninstall', 'list']);
    if (!bypass.has(command)) {
      const projectDirForHarness = resolveProjectDir(str(flags.project));
      enforceHarnessPolicy(projectDirForHarness);
    }
  }
  // Bootstrap default .mugiwara/config on any command when missing — including
  // `continue`/`status` — so tier-3 agents that only mkdir .mugiwara still get
  // a config. Also covered by readConfig() auto-create for non-CLI entry.
  // Skipped for install/update --dry-run: a dry run must not mutate the project.
  const isDryRunInstall = (command === 'install' || command === 'update') && flag(flags.dryRun);
  if (!isDryRunInstall) {
    const projectDir = resolveProjectDir(str(flags.project));
    if (ensureConfig(projectDir)) {
      console.log(`default .mugiwara/config written at ${join(projectDir, '.mugiwara', 'config')} (edit it to customise)`);
    }
  }
  if (command === 'continue' || command === 'status') {
    return command === 'continue' ? continueCmd(flags, _) : statusCmd(flags);
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
    case 'cost': return costCmd(flags, _);
    case 'run': return runCmd(flags, _);
    case 'savepoint': return savepointCmd(flags, _);
    case 'join': return joinCmd(flags, _);
    case 'blame': return blameCmd(flags, _);
    case 'handoff': return handoffCmd(flags, _);
    case 'sign': return signCmd(flags, _);
    case 'migrate': return migrateCmd(flags, _);
    case 'lesson': return lessonCmd(flags, _);
    case 'initiative': return initiativeCmd(flags, _);
    default: throw new Error(`Unknown command: ${command}`);
  }
}

function savepointCmd(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolveProjectDir(str(flags.project));
  const flowFlag = str(flags.flow) ?? (flag(flags.flow) ? '' : undefined);
  // Short form: mugiwara savepoint --flow N with everything else inferred
  if (flowFlag !== undefined || flag(flags.flow)) {
    const flowVal = str(flags.flow) ?? '';
    // flow may be boolean true if passed as --flow without value? Treat as error
    if (!flowVal) {
      console.error('usage: mugiwara savepoint --flow <N>  (or positional: savepoint <mission> [member] [flow] [mode])');
      process.exit(1);
    }
    const flowNum = Number(flowVal);
    if (!Number.isFinite(flowNum)) {
      console.error(`invalid --flow value "${flowVal}"`);
      process.exit(1);
    }
    // Mission inference: single active mission on disk, error if several
    const missionsRoot = join(projectDir, '.mugiwara', 'missions');
    let mission: string | null = null;
    if (positionals[1]) mission = positionals[1];
    else {
      if (!existsSync(missionsRoot)) {
        console.error('no mission on disk — specify <mission>');
        process.exit(1);
      }
      const all = readdirSync(missionsRoot, { withFileTypes: true }).filter((e) => e.isDirectory() && /^[A-Za-z0-9._-]+$/.test(e.name) && !/^\.+$/.test(e.name)).map((e) => e.name);
      if (all.length === 0) {
        console.error('no mission on disk — specify <mission>');
        process.exit(1);
      }
      if (all.length > 1) {
        console.error(`multiple missions on disk: ${all.join(', ')} — specify <mission>`);
        process.exit(1);
      }
      mission = all[0];
    }
    // Member from active-member cache (empty means solo)
    let member = positionals[2] ?? '';
    if (!member) {
      const cache = join(projectDir, '.mugiwara', 'active-member');
      if (existsSync(cache)) {
        try { member = readFileSync(cache, 'utf8').trim().split(/\s+/)[0] ?? ''; } catch { member = ''; }
      }
    }
    // Mode from config (project then global) — default guided
    let mode = positionals[3] ?? '';
    if (!mode) {
      try {
        const cfg = readFileSync(join(projectDir, '.mugiwara', 'config'), 'utf8');
        const m = cfg.split(/\r?\n/).find((l) => l.trim().startsWith('mode='));
        if (m) mode = m.split('=')[1].split('#')[0].trim();
      } catch {}
      if (!mode) mode = 'guided';
    }
    const args = [mission!, member, String(flowNum), mode].filter((a) => a !== undefined) as string[];
    // member may be empty solo → pass '' as placeholder so flow lands correctly
    // runScript expects positional args: mission, member, flow, mode
    // For solo, we pass '' as second arg so that $2 is empty and $3 is flow
    const code = runScript('savepoint.sh', args, projectDir);
    if (code !== 0) process.exit(code);
    return;
  }
  // Long positional form: mugiwara savepoint <mission> [member] [flow] [mode] — hooks depend on it
  const code = runScript('savepoint.sh', positionals.slice(1), projectDir);
  if (code !== 0) process.exit(code);
}

function joinCmd(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolveProjectDir(str(flags.project));
  const mission = positionals[1];
  const member = positionals[2];
  const area = str(flags.area);
  const files = str(flags.files);
  if (!mission || !member || !area) {
    console.error('usage: mugiwara join <mission> <member> --area "<area>" [--files "a.ts,b.ts"]');
    process.exit(1);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(member) || /^\.+$/.test(member) || member === 'state' || member === 'continue') {
    console.error(`invalid member name "${member}" (allowlist: [a-zA-Z0-9._-], not a dot-path, not state/continue)`);
    process.exit(1);
  }
  const missionDir = join(projectDir, '.mugiwara', 'missions', mission);
  const planPath = join(missionDir, 'plan.md');
  if (!existsSync(planPath)) {
    console.error(`no plan for mission "${mission}"`);
    process.exit(1);
  }
  const roster = rosterAssignees(missionDir);
  if (roster.includes(member)) {
    console.error(`member "${member}" already in roster`);
    process.exit(1);
  }
  let planText = readFileSync(planPath, 'utf8');
  const lines = planText.split('\n');
  let insertIdx = -1;
  let maxId = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\|\s*S(\d+)\s*\|/);
    if (m) {
      maxId = Math.max(maxId, Number(m[1]));
      insertIdx = i;
    }
  }
  if (insertIdx === -1) {
    console.error('no sub-mission table found in plan.md');
    process.exit(1);
  }
  const newId = `S${maxId + 1}`;
  const branch = `feat/${member}`;
  const touched = files ? files.split(',').map((s) => s.trim()).filter(Boolean).join(', ') : `${area.replace(/\s+/g, '-')}/`;
  const newRow = `| ${newId} | ${area} | ${member} | ${branch} | [ ] | - | ${touched} |`;
  lines.splice(insertIdx + 1, 0, newRow);
  writeFileSync(planPath, lines.join('\n'));
  const decPath = join(missionDir, 'decisions.md');
  let decText = '';
  try { decText = readFileSync(decPath, 'utf8'); } catch { decText = '# Decisions\n\n| # | Decision | By | Why |\n|---|---|---|---|\n'; }
  const actor = (() => {
    try {
      const name = execFileSync('git', ['config', 'user.name'], { cwd: projectDir, encoding: 'utf8' }).trim();
      const email = execFileSync('git', ['config', 'user.email'], { cwd: projectDir, encoding: 'utf8' }).trim();
      return name && email ? `${name} <${email}>` : name || 'unknown';
    } catch { return 'unknown'; }
  })();
  const date = new Date().toISOString().slice(0, 10);
  const decRow = `| ${Date.now()} | Join: ${member} (${area}) added to ${mission} via mugiwara join | ${actor} | ${date} |`;
  if (!decText.endsWith('\n')) decText += '\n';
  writeFileSync(decPath, decText + decRow + '\n');
  const cache = join(projectDir, '.mugiwara', 'active-member');
  mkdirSync(join(projectDir, '.mugiwara'), { recursive: true });
  writeFileSync(cache, member + '\n');
  console.log(`joined ${mission} as ${member} (${area}) — plan updated, decisions logged, active-member set`);
}

function resetCmd(flags: Args['flags']): void {
  const projectDir = resolveProjectDir(str(flags.project));
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
  const projectDir = resolveProjectDir(str(flags.project));
  const mission = positionals[1];
  if (!mission) { console.error('usage: mugiwara archive <mission> [--project <dir>] [--dry-run]'); process.exit(1); }
  const result = archiveMission(projectDir, mission, { dryRun: flag(flags.dryRun), force: flag(flags.force) });
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
  const projectDir = resolveProjectDir(str(flags.project));
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
    const blocked: string[] = [];
    for (const m of candidates) {
      const dir = join(root, m);
      try {
        const b = closureBlockers(dir, m);
        if (b.length) blocked.push(`mission "${m}" is not finished:\n${b.join('\n')}`);
      } catch { /* ignore */ }
    }
    if (live.length || blocked.length) {
      if (blocked.length) {
        for (const msg of blocked) console.error(`mugiwara: closure blocked — ${msg}\n\n  Every assignee must reach Flow 9. Run \`mugiwara status\` to check.\n  Use --force to archive anyway — in-flight resume points will be lost.`);
      }
      if (live.length && !blocked.length) {
        console.error(`✗ in-flight mission(s): ${live.join(', ')}. Use --force to archive them anyway.`);
      }
      process.exit(1);
    }
  }
  if (!candidates.length) { console.log('nothing to clean.'); return; }
  for (const m of candidates) {
    const r = archiveMission(projectDir, m, { dryRun, force: flag(flags.force) });
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
    const projectDir = resolveProjectDir(str(flags.project));
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
    const MARKETPLACE = new Set(['cursor', 'kimi', 'pi']);
    for (const id of targetIds) {
      if (MARKETPLACE.has(id)) {
        console.error(`mugiwara: ${id} installs through its marketplace manifest, not --target.`);
        console.error('  See docs/reference/harness-matrix.md — marketplace row.');
        process.exit(1);
      }
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
  console.log('CLI: run `npm i -g @ionivetech/mugiwara` so the crew can call `mugiwara savepoint/archive/continue`.');
  console.log('     Without it the crew degrades to inline-only — no state, no resume, no closure gate.');
  // A fresh install writes a default .mugiwara/config — point at it directly.
  console.log('\nNext: edit .mugiwara/config to customise (mode, branch, coverage, depths).');
}

async function uninstall(flags: Args['flags']): Promise<void> {
  const scope: Scope = flag(flags.global) ? 'global' : 'project';
  const projectDir = resolveProjectDir(str(flags.project));
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

function legacyWarning(projectDir: string): void {
  if (hasLegacyLayout(projectDir)) {
    console.error('⚠ legacy layout detected (v0.6 .mugiwara/state/ — run `mugiwara migrate` to move to missions/)');
  }
}

function schemaWarnings(projectDir: string): void {
  const states = readState(projectDir);
  for (const s of states) {
    const v = s.schema_version;
    if (v !== CURRENT_SCHEMA_VERSION) {
      const wrote = v === null || v === undefined || v === '' ? 'unknown' : String(v);
      console.error(`⚠ state written by v${wrote} (mission ${s.mission}${s.member ? `/${s.member}` : ''}) — current expects v${CURRENT_SCHEMA_VERSION} — run \`mugiwara migrate\``);
    }
  }
}

function list(flags: Args['flags']): void {
  const home = homedir();
  const projectDir = resolveProjectDir(str(flags.project));
  legacyWarning(projectDir);
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
function parseRoster(missionDir: string): Array<{ id: string; name: string; assignee: string }> {
  const plan = join(missionDir, 'plan.md');
  if (!existsSync(plan)) return [];
  const text = readFileSync(plan, 'utf8');
  const out: Array<{ id: string; name: string; assignee: string }> = [];
  let inTable = false;
  for (const line of text.split('\n')) {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith('| id ') && lower.includes('| name ')) { inTable = true; continue; }
    if (inTable) {
      if (!line.trim().startsWith('|')) break;
      if (/^\|[\s:-]+\|/.test(line)) continue;
      const cols = line.split('|').map((c) => c.trim());
      if (cols.length < 4) continue;
      const id = cols[1];
      const name = cols[2];
      const assignee = cols[3];
      if (id && assignee && assignee !== '-') out.push({ id, name, assignee });
    }
  }
  return out;
}

async function continueCmd(flags: Args['flags'], positionals: string[]): Promise<void> {
  const projectDir = resolveProjectDir(str(flags.project));
  legacyWarning(projectDir);
  schemaWarnings(projectDir);
  const [mission, member] = positionals.slice(1);
  let entries = readContinue(projectDir);

  // If the requested member's state file is unreadable, refuse rather than
  // resuming from continue-<member>.json alone. A resume point without its
  // state is a guess. (B6)
  if (mission) {
    // readState populates unreadableStateFiles for state files; entries already captured
    readState(projectDir);
    const badState = unreadableStateFiles();
    const target = member ? `${mission}/${member}.json` : `${mission}/state.json`;
    if (badState.includes(target)) {
      console.error(`✗ mission "${mission}"${member ? ` member "${member}"` : ''} has unreadable state: ${target}`);
      process.exit(1);
    }
    // re-read continue entries after the state scan cleared unreadable (preserve original entries)
    // entries already holds the correct continue data, no need to re-read
  }

  // Task 2.1: member list = state ∪ continue (union). A deleted continue file must not erase a member whose state is intact.
  // Merge state-derived entries into the continue list so the members table shows all known members.
  {
    const states = readState(projectDir);
    for (const s of states) {
      if (!entries.some((e) => e.mission === s.mission && e.member === s.member)) {
        entries.push({
          mission: s.mission,
          member: s.member,
          actor: s.actor,
          branch: s.branch,
          flow: s.flow,
          mode: s.mode,
          tasks_done: s.tasks_done,
          tasks_total: s.tasks_total,
          lane: s.lane,
          next_action: s.next_action,
          next_session_prompt: s.next_session_prompt,
          updated_at: s.updated_at,
        });
      }
    }
  }

  // default to this actor's work; --all crosses actors on a shared checkout
  if (!flag(flags.all)) {
    const actor = gitActor(projectDir);
    const mine = entries.filter((e) => e.actor === actor);
    // an actor-less savepoint (older file, or git identity unset) is still the
    // only thing on disk — showing nothing would look like "no missions"
    if (mine.length) entries = mine;
  }

  // Task 3.1: roster picker — continue starts as well as resumes, picks member by number from roster
  // Determine effective mission for roster handling (single mission inference)
  let effectiveMission = mission;
  if (!effectiveMission) {
    const uniqMissions = [...new Set(entries.map((e) => e.mission))];
    if (uniqMissions.length === 1) effectiveMission = uniqMissions[0];
    else if (uniqMissions.length === 0) {
      // also check state-only missions (when continue empty but state exists)
      const stateMissions = [...new Set(readState(projectDir).map((s) => s.mission))];
      if (stateMissions.length === 1) effectiveMission = stateMissions[0];
    }
  }
  if (effectiveMission) {
    const missionDirForRoster = join(projectDir, '.mugiwara', 'missions', effectiveMission);
    const roster = parseRoster(missionDirForRoster);
    if (roster.length) {
      const cachePath = join(projectDir, '.mugiwara', 'active-member');
      const cached = existsSync(cachePath) ? readFileSync(cachePath, 'utf8').trim().split(/\s+/)[0] : '';
      const cachedInRoster = cached && roster.some((r) => r.assignee === cached);
      // If mission resolved and cache exists and is in roster → resume that member immediately, no prompt
      if (cachedInRoster && !member) {
        const targetMember = cached;
        // merge already done; check if we can resume directly
        const direct = entries.find((e) => e.mission === effectiveMission && e.member === targetMember);
        if (direct) {
          const rCached = resolveContinue(entries, effectiveMission, targetMember);
          if (rCached.kind === 'resume') {
            const memberState = readState(projectDir).find((s) => s.mission === rCached.entry.mission && s.member === rCached.entry.member);
            if (!memberState) {
              console.error(`✗ mission "${rCached.entry.mission}" member "${rCached.entry.member}" has a resume point but no state file.`);
              console.error('  Run `mugiwara savepoint` to write state, or delete the orphan:');
              console.error(`    rm .mugiwara/missions/${rCached.entry.mission}/continue-${rCached.entry.member}.json`);
              process.exit(1);
            }
            console.log(formatResume(rCached.entry));
            const st = readState(projectDir).find((s) => s.mission === rCached.entry.mission && s.member === rCached.entry.member);
            const stale = st ? stalenessLine(projectDir, st.base_sha) : null;
            if (stale) console.log(stale);
            return;
          }
        } else {
          // cached member has no entry yet — not started, create initial state
          try {
            writeFileSync(cachePath, targetMember + '\n');
          } catch {}
          // create initial savepoint Flow 0
          try {
            runScript('savepoint.sh', [effectiveMission, targetMember, '0'], projectDir);
          } catch {}
          console.log(`Started: ${effectiveMission} [${targetMember}], Flow 0 — state created.`);
          return;
        }
      }
      // No cached member, roster present, no explicit member → show roster picker
      if (!member && !cachedInRoster) {
        // Build STATE column from entries
        console.log(`Mission: ${effectiveMission}\n`);
        console.log(`  #  ID  AREA           ASSIGNEE  STATE`);
        roster.forEach((row, idx) => {
          const st = entries.find((e) => e.mission === effectiveMission && e.member === row.assignee);
          const stateStr = st ? `Flow ${st.flow}` : '— not started';
          const line = `  ${String(idx + 1).padEnd(2)} ${row.id.padEnd(3)} ${row.name.padEnd(14)} ${row.assignee.padEnd(9)} ${stateStr}`;
          console.log(line);
        });
        console.log(`\nWhich one are you? [1-${roster.length}]`);
        // Interactive prompt if TTY, otherwise exit 2 after printing (verify case)
        if (!process.stdin.isTTY) {
          process.exit(2);
        }
        const rl = createRl();
        const answer: string = await rl.question('');
        rl.close();
        const n = Number(answer.trim());
        if (!Number.isInteger(n) || n < 1 || n > roster.length) {
          console.error(`Invalid selection "${answer.trim()}"`);
          process.exit(2);
        }
        const chosen = roster[n - 1];
        const chosenMember = chosen.assignee;
        try {
          mkdirSync(join(projectDir, '.mugiwara'), { recursive: true });
          writeFileSync(cachePath, chosenMember + '\n');
        } catch {}
        const hasState = readState(projectDir).some((s) => s.mission === effectiveMission && s.member === chosenMember);
        if (hasState) {
          const rChosen = resolveContinue(entries, effectiveMission, chosenMember);
          if (rChosen.kind === 'resume') {
            console.log(formatResume(rChosen.entry));
            const st = readState(projectDir).find((s) => s.mission === rChosen.entry.mission && s.member === rChosen.entry.member);
            const stale = st ? stalenessLine(projectDir, st.base_sha) : null;
            if (stale) console.log(stale);
            return;
          }
        } else {
          try {
            runScript('savepoint.sh', [effectiveMission, chosenMember, '0'], projectDir);
          } catch {}
          console.log(`Started: ${effectiveMission} [${chosenMember}], Flow 0 — state created.`);
          return;
        }
      }
      // If member was explicitly provided and roster present, ensure cache is set
      if (member && roster.some((r) => r.assignee === member)) {
        try {
          mkdirSync(join(projectDir, '.mugiwara'), { recursive: true });
          writeFileSync(cachePath, member + '\n');
        } catch {}
      }
    }
  }

  const r = resolveContinue(entries, mission, member);
  if (r.kind === 'resume') {
    // Task 2.2: refuse to resume a TEAM member when state is missing (an
    // orphan continue-<member>.json is a guess). Solo continue.json without
    // state.json still resumes — it is the mission's only resume point.
    const memberState = readState(projectDir).find((s) => s.mission === r.entry.mission && s.member === r.entry.member);
    if (!memberState && r.entry.member !== null) {
      console.error(`✗ mission "${r.entry.mission}" member "${r.entry.member}" has a resume point but no state file.`);
      console.error('  Run `mugiwara savepoint` to write state, or delete the orphan:');
      console.error(`    rm .mugiwara/missions/${r.entry.mission}/continue-${r.entry.member}.json`);
      process.exit(1);
    }
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
  const projectDir = resolveProjectDir(str(flags.project));
  legacyWarning(projectDir);
  schemaWarnings(projectDir);
  const states = readState(projectDir);
  const bad = unreadableStateFiles();
  if (bad.length) {
    console.error(`⚠ ${bad.length} unreadable state file(s): ${bad.join(', ')}`);
    console.error('  These are not "no mission" — they are corrupt. Inspect or delete them.');
  }
  if (!states.length) {
    console.log(bad.length ? 'No readable mission state on disk.' : 'No mission state on disk.');
    return;
  }
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

/** `mugiwara cost [--mission <id>] [--json] [--ledger]` — show cost ledger, avoided work, efficiency, trail. */
function costCmd(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolveProjectDir(str(flags.project));
  const mission = str(flags.mission) ?? positionals[1] ?? (() => {
    const states = readState(projectDir);
    if (states.length === 1) return states[0].mission;
    if (states.length > 1) {
      console.error('multiple missions in flight — specify --mission <id>');
      process.exit(1);
    }
    return null;
  })();
  if (!mission) {
    console.error('usage: mugiwara cost [--mission <id>] [--json] [--ledger] [--project <dir>]');
    process.exit(1);
  }
  const missionDir = join(projectDir, '.mugiwara', 'missions', mission);
  if (!existsSync(missionDir)) {
    console.error(`No cost ledger found for mission "${mission}"`);
    process.exit(1);
  }
  const states = readState(projectDir).filter((s) => s.mission === mission);
  const envelope = states.length
    ? costEnvelope({ lane: (states[0] as unknown as { lane?: string }).lane, budget: (states[0] as unknown as { budget?: number }).budget, tokens_est: (states[0] as unknown as { tokens_est?: number }).tokens_est })
    : costEnvelope({ lane: 'full', tokens_est: 0 });
  // live slop (§3.3): run existing detectors over state already available
  // (heal cycle, context registry repeated reads) so slop_interventions is real.
  const state0 = states[0] as unknown as { heal_cycle?: number };
  let repeatedReads = 0;
  try {
    const reg = loadRegistry(missionDir);
    repeatedReads = reg.reduce((s, e) => s + Math.max(e.reads - 1, 0), 0);
  } catch {
    repeatedReads = 0;
  }
  const liveSlop = computeLiveSlop({ heal_cycle: state0?.heal_cycle ?? 0, repeated_reads: repeatedReads });
  const ledger = buildCostLedger({ missionDir, envelope, slopSummary: { interventions: liveSlop.interventions } });
  if (flag(flags.json)) {
    console.log(toCostJSON(ledger));
    return;
  }
  console.log(`Cost envelope: ${ledger.envelope.status} ${ledger.envelope.pct}% (${ledger.envelope.used}/${ledger.envelope.planned})`);
  console.log(`Avoided: ${ledger.avoided.stages_avoided} stages, ${ledger.avoided.contexts_avoided} contexts, ~${ledger.avoided.tokens_avoided_est} tokens`);
  console.log(`Efficiency: reuse ${ledger.efficiency.reuse_rate}, dup ${ledger.efficiency.duplicate_avoidance_chars} chars, budget ${ledger.efficiency.budget_efficiency_pct}%`);
  if (ledger.avoided.slop_interventions > 0) {
    const roles = Object.entries(liveSlop.perRole).map(([r, n]) => `${r}:${n}`).join(', ');
    console.log(`Slop: ${ledger.avoided.slop_interventions} intervention(s) — ${roles}`);
  }
  console.log(`Trail: ${ledger.trail.length} decisions`);
  if (flag(flags.ledger) && ledger.trail.length) {
    for (const t of ledger.trail.slice(0, 20)) console.log(`- ${t.ts} — ${t.actor}: ${t.decision} — reason: ${t.reason}${t.evidence ? ` — evidence: ${t.evidence}` : ''}`);
    if (ledger.trail.length > 20) console.log(`… ${ledger.trail.length - 20} more`);
  }
}

/** `mugiwara run <script.sh> [args]` — run a bundled harness script here. */
function runCmd(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolveProjectDir(str(flags.project));
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
  const projectDir = resolveProjectDir(str(flags.project));
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
  const projectDir = resolveProjectDir(str(flags.project));
  const mission = positionals[1];
  if (!mission) { console.error('usage: mugiwara handoff <mission> [--project <dir>]'); process.exit(1); }
  const states = readState(projectDir).filter((s) => s.mission === mission);
  const bad = unreadableStateFiles().filter((p) => p.startsWith(`${mission}/`));
  if (bad.length) {
    console.error(`✗ mission "${mission}" has unreadable state: ${bad.join(', ')}`);
    process.exit(1);
  }
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

function lessonCmd(flags: Args['flags'], positionals: string[]): void {
  const projectDir = resolveProjectDir(str(flags.project));
  const text = positionals.slice(1).join(' ').trim();
  if (!text) { console.error('usage: mugiwara lesson "<text>" [--project <dir>]'); process.exit(1); }
  const file = join(projectDir, '.mugiwara', 'lessons.md');
  const date = new Date().toISOString().slice(0, 10);
  const sanitized = text.replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim();
  const line = `| ${date} | manual | general | ${sanitized} |`;
  const header = '| Date | Mission | Area | Lesson |\n|---|---|---|---|';
  let existing = '';
  try { existing = readFileSync(file, 'utf8'); } catch {}
  if (!existing) {
    mkdirSync(join(projectDir, '.mugiwara'), { recursive: true });
    writeFileSync(file, header + '\n' + line + '\n');
  } else {
    // ensure file ends with newline
    const needsNewline = !existing.endsWith('\n');
    writeFileSync(file, existing + (needsNewline ? '\n' : '') + line + '\n');
  }
  console.log(`lesson appended: ${line}`);
}

/** `mugiwara initiative <status|conflict-check> <plan>` — sub-mission checks. */
function initiativeCmd(_flags: Args['flags'], positionals: string[]): void {
  const r = runInitiative(positionals[1], positionals[2]);
  process.stdout.write(r.output);
  if (r.code !== 0) process.exit(r.code);
}

export function migrateCmd(flags: Args['flags'], positionals: string[] = []): void {
  const projectDir = resolveProjectDir(str(flags.project));
  const dryRun = flag(flags.dryRun);
  // --to-team / --to-solo: solo<->team layout switch (W4). Moves, not copies.
  const toTeam = str(flags.toTeam);
  const toSolo = str(flags.toSolo);
  if (toTeam || toSolo) {
    const member = (toTeam ?? toSolo) as string;
    if (!/^[A-Za-z0-9._-]+$/.test(member) || /^\.+$/.test(member) || member === 'state' || member === 'continue') {
      console.error(`invalid member name "${member}" (allowlist: [a-zA-Z0-9._-], not a dot-path, not state/continue)`);
      process.exit(1);
    }
    if (toTeam && toSolo) {
      console.error('use either --to-team or --to-solo, not both');
      process.exit(1);
    }
    const missionsRootInner = join(projectDir, '.mugiwara', 'missions');
    let mission = str(flags.mission) ?? (positionals[1] ? String(positionals[1]) : null);
    const inferMission = (): string | null => {
      if (!existsSync(missionsRootInner)) return null;
      const all = readdirSync(missionsRootInner, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
      if (mission && all.includes(mission)) return mission;
      if (mission) return mission;
      // try to find candidate missions for the requested operation
      if (toTeam) {
        const candidates = all.filter(m => existsSync(join(missionsRootInner, m, 'state.json')));
        if (candidates.length === 1) return candidates[0];
        if (candidates.length === 0) {
          console.error('no solo mission with state.json found for --to-team');
          process.exit(1);
        }
        console.error(`multiple solo missions: ${candidates.join(', ')} — specify --mission <id>`);
        process.exit(1);
      } else {
        const candidates = all.filter(m => existsSync(join(missionsRootInner, m, `${member}.json`)));
        if (candidates.length === 1) return candidates[0];
        if (candidates.length === 0) {
          console.error(`no mission with ${member}.json found for --to-solo`);
          process.exit(1);
        }
        console.error(`multiple missions with ${member}.json: ${candidates.join(', ')} — specify --mission <id>`);
        process.exit(1);
      }
      return null;
    };
    const targetMission = inferMission();
    if (!targetMission) {
      console.error('could not infer mission — specify --mission <id>');
      process.exit(1);
    }
    const dir = join(missionsRootInner, targetMission);
    if (toTeam) {
      const srcState = join(dir, 'state.json');
      const srcContinue = join(dir, 'continue.json');
      const destState = join(dir, `${member}.json`);
      const destContinue = join(dir, `continue-${member}.json`);
      if (!existsSync(srcState)) {
        console.error(`mission "${targetMission}" has no state.json — already team or not found`);
        process.exit(1);
      }
      if (existsSync(destState)) {
        console.error(`destination ${destState} already exists`);
        process.exit(1);
      }
      const toMove: Array<{ src: string; dest: string }> = [{ src: srcState, dest: destState }];
      if (existsSync(srcContinue)) toMove.push({ src: srcContinue, dest: destContinue });
      for (const m of toMove) {
        console.log(`${dryRun ? 'would migrate' : 'migrated'} ${m.src} → ${m.dest}`);
        if (!dryRun) {
          mkdirSync(dirname(m.dest), { recursive: true });
          try { renameSync(m.src, m.dest); } catch { /* fallback copy */ 
            try { writeFileSync(m.dest, readFileSync(m.src)); rmSync(m.src, { force: true }); } catch {}
          }
        }
      }
      console.log(`${dryRun ? 'would migrate' : 'migrated'} ${toMove.length} file(s)${dryRun ? ' (dry run)' : ''}`);
      return;
    } else {
      // --to-solo
      const srcState = join(dir, `${member}.json`);
      const srcContinue = join(dir, `continue-${member}.json`);
      const destState = join(dir, 'state.json');
      const destContinue = join(dir, 'continue.json');
      if (!existsSync(srcState)) {
        console.error(`mission "${targetMission}" has no ${member}.json`);
        process.exit(1);
      }
      const files = readdirSync(dir).filter(f => {
        const stem = f.replace(/\.json$/, '');
        return f.endsWith('.json') && stem !== 'continue' && !stem.startsWith('continue-');
      });
      const members = files.filter(f => f !== 'state.json');
      if (members.length > 1) {
        console.error(`mission "${targetMission}" has ${members.length} members (${members.join(', ')}) — refusing --to-solo (would orphan)`);
        process.exit(1);
      }
      if (existsSync(destState)) {
        console.error(`destination ${destState} already exists`);
        process.exit(1);
      }
      const toMove: Array<{ src: string; dest: string }> = [{ src: srcState, dest: destState }];
      if (existsSync(srcContinue)) toMove.push({ src: srcContinue, dest: destContinue });
      for (const m of toMove) {
        console.log(`${dryRun ? 'would migrate' : 'migrated'} ${m.src} → ${m.dest}`);
        if (!dryRun) {
          mkdirSync(dirname(m.dest), { recursive: true });
          try { renameSync(m.src, m.dest); } catch {
            try { writeFileSync(m.dest, readFileSync(m.src)); rmSync(m.src, { force: true }); } catch {}
          }
        }
      }
      console.log(`${dryRun ? 'would migrate' : 'migrated'} ${toMove.length} file(s)${dryRun ? ' (dry run)' : ''}`);
      return;
    }
  }
  const legacyState = join(projectDir, '.mugiwara', 'state');
  const legacyContinue = join(projectDir, '.mugiwara', 'continue');
  const missionsRoot = join(projectDir, '.mugiwara', 'missions');
  const moves: Array<{ src: string; dest: string }> = [];

  const collect = (srcRoot: string, isContinue: boolean) => {
    if (!existsSync(srcRoot)) return;
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.isFile() && e.name.endsWith('.json')) {
          const rel = full.slice(srcRoot.length + 1);
          let destRel: string;
          if (isContinue) {
            const parts = rel.split('/');
            const file = parts.pop()!;
            const mission = parts.join('/');
            const stem = file.slice(0, -'.json'.length);
            let destFile: string;
            if (stem === 'state') destFile = 'continue.json';
            else destFile = `continue-${stem}.json`;
            destRel = mission ? join(mission, destFile) : destFile;
          } else {
            destRel = rel;
          }
          moves.push({ src: full, dest: join(missionsRoot, destRel) });
        }
      }
    };
    walk(srcRoot);
  };
  collect(legacyState, false);
  collect(legacyContinue, true);

  // legacy flat: .mugiwara/state.json style? treat any top-level .mugiwara/state*.json as not legacy missions but still warn
  // Already covered by state/ dir; nothing more to collect.

  if (!moves.length) {
    if (!existsSync(legacyState) && !existsSync(legacyContinue)) {
      console.log('no legacy layout found (.mugiwara/state/ does not exist)');
    } else {
      console.log('no legacy state files to migrate');
    }
    return;
  }

  for (const m of moves) {
    console.log(`${dryRun ? 'would migrate' : 'migrated'} ${m.src} → ${m.dest}`);
    if (!dryRun) {
      mkdirSync(dirname(m.dest), { recursive: true });
      try {
        const raw = JSON.parse(readFileSync(m.src, 'utf8')) as Record<string, unknown>;
        raw.schema_version = CURRENT_SCHEMA_VERSION;
        writeFileSync(m.dest, JSON.stringify(raw, null, 2) + '\n');
        rmSync(m.src, { force: true });
      } catch {
        try { renameSync(m.src, m.dest); } catch { /* ignore */ }
      }
    }
  }
  if (!dryRun) {
    const prune = (root: string) => {
      if (!existsSync(root)) return;
      const walkPrune = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          if (e.isDirectory()) walkPrune(join(dir, e.name));
        }
        try { if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
      };
      walkPrune(root);
      try { if (existsSync(root) && readdirSync(root).length === 0) rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
    };
    prune(legacyState);
    prune(legacyContinue);
  }
  console.log(`${dryRun ? 'would migrate' : 'migrated'} ${moves.length} file(s)${dryRun ? ' (dry run)' : ''}`);
}

/** `mugiwara sign <mission>` / `--verify` / `--gen-key` — optional attestation. */
function signCmd(flags: Args['flags'], _: string[]): void {
  const projectDir = resolveProjectDir(str(flags.project));
  if (flag(flags.genKey)) {
    const backend = str(flags.backend) ?? 'auto';
    const home = homedir();
    if (backend === 'minisign') {
      if (!hasMinisign()) { console.error('✗ minisign not installed — cannot generate keys with this backend'); process.exit(1); }
      try {
        execFileSync('minisign', ['-G'], { stdio: 'inherit' });
        console.log('✓ minisign key pair generated in ~/.mugiwara/');
        return;
      } catch { console.error('✗ key generation failed'); process.exit(1); }
    }
    // pure (default)
    const dir = ensurePureKey(home);
    console.log(`✓ pure ed25519 key pair ready: ${join(dir, 'mugiwara.key')} / ${join(dir, 'mugiwara.pub')}`);
    return;
  }
  const mission = _[1];
  if (!mission) { console.error('usage: mugiwara sign <mission> [--verify] [--gen-key [--backend pure|minisign]] [--project <dir>]'); process.exit(1); }
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
  mugiwara cost [--mission <id>] [--json] [--ledger]
                         show cost ledger, avoided work, efficiency, trail (human + JSON)
  mugiwara blame <path>  provenance note on the last commit touching <path>
                         (fetch notes first: git fetch origin 'refs/notes/mugiwara:refs/notes/mugiwara')
  mugiwara handoff <m>   write .mugiwara/missions/<m>/handoff.md — a report the next
                         engineer can act on (computed state + staleness check)
  mugiwara sign <m>      attestation: sign report.md (auto/minisign/pure/off; --verify to check)
  mugiwara sign --gen-key [--backend pure|minisign]
                         create signing keys (pure ed25519 default)
  mugiwara migrate [--dry-run] [--project <dir>]
                           move legacy .mugiwara/state/ layout to .mugiwara/missions/
  mugiwara migrate --to-team <member> [--mission <id>] [--dry-run]
                           move state.json -> <member>.json (solo -> team)
  mugiwara migrate --to-solo <member> [--mission <id>] [--dry-run]
                           move <member>.json -> state.json (team -> solo; refuses if >1 member)
  mugiwara lesson "<text>" append a dated row to .mugiwara/lessons.md
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
