#!/usr/bin/env bun
// scripts/coverage-gate.ts — enforce the `coverage_new` / `coverage_modified`
// thresholds declared in `.mugiwara/config` against the files THIS diff adds
// and changes, not against a global project number. Two keys exist precisely
// because the two populations are judged differently (mugiwara-gates SKILL.md
// §Coverage gate); a global percentage would collapse them into one and let an
// untested new file hide behind an old well-tested one.
//
// Run: bun scripts/coverage-gate.ts            enforce (gate step)
//      bun scripts/coverage-gate.ts --base X   compare against ref X
//      bun scripts/coverage-gate.ts --show     print per-file numbers, never fail
//
// Exit 0 = pass or recorded SKIP. Exit 1 = a threshold was missed.
// A repo with no coverage tooling or no test suite records a SKIP with its
// reason — never a fake pass (decision log row 50).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';

const root = join(import.meta.dirname, '..');
const SHOW = process.argv.includes('--show');

/** `.mugiwara/config` → project, then `~`. Returns undefined if the key is set nowhere. */
function config(key: string): string | undefined {
  for (const base of [root, homedir()]) {
    const file = join(base, '.mugiwara', 'config');
    if (!existsSync(file)) continue;
    // \r?\n: a config written on Windows is still a config
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      if (t.slice(0, eq).trim() !== key) continue;
      return t.slice(eq + 1).trim();
    }
  }
  return undefined;
}

/** Documented defaults: new >= 90, modified >= 80. A key set to 0 = no threshold. */
function threshold(key: string, fallback: number): number {
  const raw = config(key);
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    console.log(`coverage-gate: ignoring unparseable ${key}="${raw}", using ${fallback}`);
    return fallback;
  }
  return n;
}

function skip(reason: string): never {
  console.log(`coverage-gate: SKIP — ${reason}`);
  process.exit(0);
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

// ---- 1. is there anything to measure at all? -------------------------------

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
if (!deps['@vitest/coverage-v8'] && !deps['@vitest/coverage-istanbul'])
  skip('no coverage tooling installed (no @vitest/coverage-* in package.json)');
if (!existsSync(join(root, 'test')))
  skip('no test suite found (no test/ directory)');

// ---- 2. which files does this diff add and change? ------------------------

const baseArg = process.argv.indexOf('--base');
let base = baseArg !== -1 ? process.argv[baseArg + 1] : process.env.MUGIWARA_COVERAGE_BASE;
if (!base) {
  // the mission's own recorded base_sha is the truthful diff origin
  const stateDir = join(root, '.mugiwara', 'state');
  if (existsSync(stateDir)) {
    for (const m of readdirSync(stateDir)) {
      const f = join(stateDir, m, 'state.json');
      if (!existsSync(f)) continue;
      const sha = JSON.parse(readFileSync(f, 'utf8')).base_sha;
      if (sha) { base = sha; break; }
    }
  }
}
if (!base) {
  for (const ref of ['origin/main', 'main', 'origin/master', 'master']) {
    try { base = git(['merge-base', 'HEAD', ref]); break; } catch { /* next */ }
  }
}
if (!base) skip('no diff base could be resolved (no state base_sha, no main/master ref)');

let changed: Array<{ status: string; path: string }>;
try {
  changed = git(['diff', '--name-status', '--diff-filter=AMR', '-M', `${base}`, 'HEAD'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const parts = l.split('\t');
      // rename rows are `R096\told\tnew` — the new path is the one to judge
      return { status: parts[0][0], path: parts[parts.length - 1] };
    });
} catch (e) {
  skip(`git diff against ${base} failed (${(e as Error).message})`);
}

if (!changed.length) skip(`no added or modified files between ${base.slice(0, 7)} and HEAD`);

// ---- 3. measure ------------------------------------------------------------

const summaryPath = join(root, 'coverage', 'coverage-summary.json');
const needsRun =
  !existsSync(summaryPath) ||
  statSync(summaryPath).mtimeMs < Math.max(...changed
    .map((c) => join(root, c.path))
    .filter(existsSync)
    .map((p) => statSync(p).mtimeMs), 0);

if (needsRun) {
  console.log('coverage-gate: measuring (vitest run --coverage)...');
  const r = spawnSync('npx', ['vitest', 'run', '--coverage', '--silent'], {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    console.log('coverage-gate: FAIL — test run did not pass, coverage is not measurable');
    process.exit(1);
  }
}
if (!existsSync(summaryPath))
  skip('coverage run produced no coverage-summary.json (json-summary reporter not configured)');

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
// keys are absolute OS paths; normalise to repo-relative posix to match git
const measured = new Map<string, number>();
for (const [k, v] of Object.entries<any>(summary)) {
  if (k === 'total') continue;
  measured.set(relative(root, k).split(sep).join('/'), v.lines?.pct ?? 0);
}

// ---- 4. apply the two thresholds ------------------------------------------

const NEW = threshold('coverage_new', 90);
const MOD = threshold('coverage_modified', 80);

const rows = changed.map((c) => {
  const isNew = c.status === 'A';
  return {
    path: c.path,
    kind: isNew ? 'new' : 'modified',
    limit: isNew ? NEW : MOD,
    pct: measured.get(c.path),
  };
});

const scoped = rows.filter((r) => r.pct !== undefined);
const unscoped = rows.filter((r) => r.pct === undefined);

console.log(`coverage-gate: base ${base.slice(0, 7)} · thresholds new>=${NEW || 'off'} modified>=${MOD || 'off'}`);
console.log(`  ${changed.length} changed file(s), ${scoped.length} within coverage scope, ${unscoped.length} outside it`);

const failures = scoped.filter((r) => r.limit > 0 && (r.pct as number) < r.limit);

for (const r of scoped.sort((a, b) => (a.pct as number) - (b.pct as number))) {
  const bad = r.limit > 0 && (r.pct as number) < r.limit;
  if (SHOW || bad || (r.pct as number) < 100)
    console.log(`  ${bad ? '✗' : '✓'} ${r.path} — ${(r.pct as number).toFixed(2)}% ${r.kind} (limit ${r.limit || 'off'})`);
}
if (SHOW && unscoped.length)
  console.log(unscoped.map((r) => `  · ${r.path} — outside coverage scope (not a measured source file)`).join('\n'));

if (SHOW) process.exit(0);
if (failures.length) {
  console.log(`\ncoverage-gate: FAIL — ${failures.length} file(s) below their threshold`);
  console.log('Do not lower the thresholds or exclude files to pass: add the missing tests.');
  process.exit(1);
}
console.log('\ncoverage-gate: PASS');
