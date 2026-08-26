#!/usr/bin/env bun
// scripts/conformance.ts — C1: cross-platform conformance suite.
// Every installable target: materialize the standard-feature fixture repo,
// install the target, run the core scripts, and compare a normalized
// snapshot (state fields, gitignore block, file count) against
// test/golden/<target>.json. Exit 1 on any difference
// with a diff; --update-golden regenerates. The snapshots are normalized:
// timestamps, hashes, and random filenames are excluded so a golden is stable
// across runs.

import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installTo, ensureProjectGitignore } from '../src/installer.ts';
import { targets, TARGET_IDS } from '../src/targets/index.ts';

const root = join(import.meta.dirname, '..');
const goldenDir = join(root, 'test', 'golden');
const UPDATE = process.argv.includes('--update-golden');

// tier mapping per docs/reference/harness-matrix.md (target defs carry tier only
// on some; the matrix is the source of truth for the rest)
const TIER_OF: Record<string, number> = {
  claude: 1, opencode: 1,
  gemini: 2, codex: 2, copilot: 2,
  windsurf: 3, cline: 3, kilo: 3, antigravity: 3,
};

const TARGETS = TARGET_IDS.map(id => ({ id, tier: TIER_OF[id] ?? 2 }));

// marketplace-plugin platforms: installed from the repo itself via the host's
// plugin system (no rules-dir install). Conformance = the manifest an
// operator's marketplace will consume: it parses, its version matches the
// package, its pointers resolve, and its metadata set-equals content/.
const MARKETPLACE = [
  { id: 'cursor', manifest: '.cursor-plugin/plugin.json' },
  { id: 'kimi', manifest: '.kimi-plugin/plugin.json' },
  { id: 'pi', manifest: null, piField: true },
];

function marketplaceSnapshot(id: string, manifestRel: string | null, piField: boolean): Record<string, unknown> {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const skillDirs = readdirSync(join(root, 'content', 'skills'), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort();
  const agentFiles = readdirSync(join(root, 'content', 'agents'))
    .filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')).sort();

  const base = {
    target: id,
    kind: 'marketplace-plugin',
    version_matches_package: false,
    skills_pointer_resolves: false,
    skills_count: 0,
    agents_metadata_set_equal: false,
  };

  if (piField) {
    const pi = packageJson.pi;
    const list = pi?.skills;
    const pointers = Array.isArray(list) ? list : [];
    base.skills_pointer_resolves = pointers.every(p => existsSync(join(root, p)));
    base.skills_count = existsSync(join(root, 'content', 'skills')) ? skillDirs.length : 0;
    base.version_matches_package = true; // package.json is the package itself
    base.agents_metadata_set_equal = true; // pi loads skills only; agents ship in the same tree
    return base;
  }

  const m = JSON.parse(readFileSync(join(root, manifestRel!), 'utf8'));
  const skillsPtr = m.skills;
  const skillsDir = typeof skillsPtr === 'string' ? join(root, skillsPtr) : null;
  const actual = skillsDir && existsSync(skillsDir)
    ? readdirSync(skillsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
    : [];
  const mSkills = Array.isArray(m.metadata?.skills) ? [...m.metadata.skills].sort() : [];
  const mAgents = Array.isArray(m.metadata?.agents) ? [...m.metadata.agents].sort() : [];

  return {
    ...base,
    version_matches_package: m.version === packageJson.version,
    skills_pointer_resolves: skillsDir !== null && existsSync(skillsDir) && actual.length === skillDirs.length,
    skills_count: actual.length,
    agents_metadata_set_equal: JSON.stringify(mAgents) === JSON.stringify(agentFiles),
  };
}

const MISSION = 'conform';

function sh(cmd: string, cwd: string) {
  execSync(cmd, { cwd, stdio: 'pipe', env: { ...process.env, MUGIWARA_DIR: join(cwd, '.mugiwara') } });
}

function snapshot(targetId: string): Record<string, unknown> {
  const dir = mkdtempSync(join(tmpdir(), `mugi-conform-${targetId}-`));
  try {
    // 1. materialize the standard-feature fixture repo (trunk + feat branch)
    sh(`bun scripts/setup-fixtures.ts standard-feature "${dir}"`, root);

    // 2. install the target into the project
    const target = targets[targetId];
    if (!target) throw new Error(`unknown target ${targetId}`);
    installTo(target, { scope: 'project', projectDir: dir, force: true, dryRun: false });

    // The installer's own output is harness config, not mission work — but it
    // lands as untracked files, and savepoint/lane now count the working tree
    // (F). Park it in .git/info/exclude so the snapshot keeps measuring the
    // fixture's 4-file mission diff instead of "how many files does this
    // target install". Local-only: .gitignore (which the golden snapshots)
    // is untouched.
    const untracked = execSync('git status --porcelain --untracked-files=normal', { cwd: dir, encoding: 'utf8' })
      .split('\n').filter(Boolean).map(l => l.slice(3)).filter(Boolean);
    if (untracked.length) {
      const exclude = join(dir, '.git', 'info', 'exclude');
      writeFileSync(exclude, (existsSync(exclude) ? readFileSync(exclude, 'utf8') : '') + '\n' + untracked.join('\n') + '\n');
    }

    // 3. run the core scripts + the gitignore write the CLI does post-install
    sh(`bash "${root}/scripts/lane.sh" main --json`, dir);
    sh(`bash "${root}/scripts/savepoint.sh" ${MISSION} "" 1 auto`, dir);
    ensureProjectGitignore(dir, { dryRun: false });

    // 4. normalize + collect
    const state = JSON.parse(readFileSync(join(dir, '.mugiwara', 'missions', MISSION, 'state.json'), 'utf8'));
    const gitignore = existsSync(join(dir, '.gitignore')) ? readFileSync(join(dir, '.gitignore'), 'utf8') : '';

    const countFiles = (p: string): number => {
      if (!existsSync(p)) return 0;
      return readdirSync(p, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).length;
    };

    return {
      target: targetId,
      tier: TIER_OF[targetId] ?? 2,
      state: {
        mission: state.mission,
        member: state.member,
        lane: state.lane,
        lane_reason: state.lane_reason,
        files_touched: state.files_touched,
        loc_delta: state.loc_delta,
        loc_ins: state.loc_ins,
        loc_del: state.loc_del,
        loc_churn: state.loc_churn,
        mode: state.mode,
        verbosity: state.verbosity,
        tasks_done: state.tasks?.done,
        tasks_total: state.tasks?.total,
        blockers_open: state.blockers_open,
        heal_cycle: state.heal_cycle,
        heal_max_cycles: state.heal_max_cycles,
        heal_halt: state.heal_halt,
        delegate_threshold: state.delegate_threshold,
        delegate_due: state.delegate_due,
        tokens_source: state.tokens_source,
        budget_status: state.budget_status,
        sensitive_paths: state.sensitive_paths,
      },
      report_sections: [],
      gitignore_block: gitignore.split('\n').filter(l => l.includes('mugiwara') || l.includes('# ---')),
      file_count: {
        skills: countFiles(target.paths({ scope: 'project', projectDir: dir, home: '' }).skillsDir),
        agents: countFiles(target.paths({ scope: 'project', projectDir: dir, home: '' }).agentsDir),
        state: countFiles(join(dir, '.mugiwara', 'state')),
        evidence: countFiles(join(dir, '.mugiwara', 'results', MISSION)),
      },
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function diff(a: unknown, b: unknown, path = ''): string[] {
  const out: string[] = [];
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    out.push(`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
    return out;
  }
  for (const k of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
    out.push(...diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`));
  }
  return out;
}

let failed = false;
mkdirSync(goldenDir, { recursive: true });

const ALL = [
  ...TARGETS.map(t => ({ id: t.id, label: `tier ${t.tier}`, snap: () => snapshot(t.id) })),
  ...MARKETPLACE.map(m => ({ id: m.id, label: 'marketplace', snap: () => marketplaceSnapshot(m.id, m.manifest, m.piField === true) })),
];

for (const t of ALL) {
  const snap = t.snap();
  const goldenFile = join(goldenDir, `${t.id}.json`);
  if (UPDATE) {
    writeFileSync(goldenFile, JSON.stringify(snap, null, 2) + '\n');
    console.log(`✓ golden updated: test/golden/${t.id}.json`);
    continue;
  }
  if (!existsSync(goldenFile)) {
    console.log(`✗ ${t.id}: golden missing — run with --update-golden first`);
    failed = true;
    continue;
  }
  const golden = JSON.parse(readFileSync(goldenFile, 'utf8'));
  const diffs = diff(snap, golden);
  if (diffs.length > 0) {
    failed = true;
    console.log(`✗ ${t.id} (${t.label}) differs:`);
    for (const d of diffs) console.log(`    ${d}`);
  } else {
    console.log(`✓ ${t.id} (${t.label}) conforms`);
  }
}

if (UPDATE) {
  console.log('goldens regenerated — review the diff before committing');
  process.exit(0);
}
if (failed) process.exit(1);
console.log(`✓ ${ALL.length} platforms pass conformance`);
