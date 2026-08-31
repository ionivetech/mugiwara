// test/migrate.test.ts — D5: legacy layout detection + migrate + schema_version
import { test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { hasLegacyLayout, CURRENT_SCHEMA_VERSION, readState } from '../src/continue.ts';

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'mugi-migrate-'));
}

function legacyState(dir: string, mission: string, member: string | null, body: Record<string, unknown> = {}): string {
  const base = join(dir, '.mugiwara', 'state', mission);
  mkdirSync(base, { recursive: true });
  const file = member ? join(base, `${member}.json`) : join(base, 'state.json');
  const payload = { mission, member, ...body };
  // intentionally omit schema_version to simulate v0.6
  writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function legacyContinue(dir: string, mission: string, member: string | null, body: Record<string, unknown> = {}): string {
  const base = join(dir, '.mugiwara', 'continue', mission);
  mkdirSync(base, { recursive: true });
  const file = member ? join(base, `${member}.json`) : join(base, 'state.json'); // v0.6 used state.json for solo continue
  const payload = { mission, ...body };
  writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

test('hasLegacyLayout detects .mugiwara/state/**', () => {
  const dir = tmp();
  try {
    expect(hasLegacyLayout(dir)).toBe(false);
    legacyState(dir, 'alpha', null, { flow: 1 });
    expect(hasLegacyLayout(dir)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hasLegacyLayout detects .mugiwara/continue/**', () => {
  const dir = tmp();
  try {
    legacyContinue(dir, 'beta', 'alice', { flow: 2 });
    expect(hasLegacyLayout(dir)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migrate moves state/<m>/<member>.json → missions/<m>/<member>.json and adds schema_version', () => {
  const dir = tmp();
  try {
    legacyState(dir, 'demo', null, { flow: 3, actor: 'a', branch: 'main' });
    legacyState(dir, 'demo', 'zoro', { flow: 3, actor: 'a', branch: 'main' });
    // run migrate via CLI (built file may not exist, use bun src/cli.ts)
    const r = spawnSync('bun', [join(import.meta.dirname, '..', 'src', 'cli.ts'), 'migrate', '--project', dir], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain('migrated');
    // legacy removed, missions present
    expect(existsSync(join(dir, '.mugiwara', 'state'))).toBe(false);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'demo', 'state.json'))).toBe(true);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'demo', 'zoro.json'))).toBe(true);
    const solo = JSON.parse(readFileSync(join(dir, '.mugiwara', 'missions', 'demo', 'state.json'), 'utf8'));
    expect(solo.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    const team = JSON.parse(readFileSync(join(dir, '.mugiwara', 'missions', 'demo', 'zoro.json'), 'utf8'));
    expect(team.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    // readState now sees them
    const states = readState(dir);
    expect(states.length).toBe(2);
    expect(hasLegacyLayout(dir)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migrate --dry-run does not move, reports would migrate', () => {
  const dir = tmp();
  try {
    legacyState(dir, 'dry', null, { flow: 1 });
    const r = spawnSync('bun', [join(import.meta.dirname, '..', 'src', 'cli.ts'), 'migrate', '--dry-run', '--project', dir], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain('would migrate');
    expect(existsSync(join(dir, '.mugiwara', 'state', 'dry', 'state.json'))).toBe(true);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'dry', 'state.json'))).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migrate maps continue/<m>/state.json → missions/<m>/continue.json and continue/<m>/<member>.json → continue-<member>.json', () => {
  const dir = tmp();
  try {
    legacyContinue(dir, 'cont-m', null, { flow: 2, branch: 'main' });
    legacyContinue(dir, 'cont-m', 'sanji', { flow: 2 });
    const r = spawnSync('bun', [join(import.meta.dirname, '..', 'src', 'cli.ts'), 'migrate', '--project', dir], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'cont-m', 'continue.json'))).toBe(true);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'cont-m', 'continue-sanji.json'))).toBe(true);
    expect(existsSync(join(dir, '.mugiwara', 'continue'))).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migrate with no legacy prints no legacy layout found', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    const r = spawnSync('bun', [join(import.meta.dirname, '..', 'src', 'cli.ts'), 'migrate', '--project', dir], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain('no legacy layout found');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('status and continue warn on legacy layout', () => {
  const dir = tmp();
  try {
    legacyState(dir, 'warn-m', null, { mission: 'warn-m', flow: 1 });
    const status = spawnSync('bun', [join(import.meta.dirname, '..', 'src', 'cli.ts'), 'status', '--project', dir], { encoding: 'utf8' });
    expect((status.stdout + status.stderr).toLowerCase()).toContain('legacy layout detected');
    expect(status.stdout + status.stderr).toContain('mugiwara migrate');

    const cont = spawnSync('bun', [join(import.meta.dirname, '..', 'src', 'cli.ts'), 'continue', '--project', dir], { encoding: 'utf8' });
    expect((cont.stdout + cont.stderr).toLowerCase()).toContain('legacy layout detected');
    expect(cont.stdout + cont.stderr).toContain('mugiwara migrate');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('status warns on schema_version mismatch (missing or old)', () => {
  const dir = tmp();
  try {
    // create missions state without schema_version (old) to trigger mismatch warning
    const mDir = join(dir, '.mugiwara', 'missions', 'old-m');
    mkdirSync(mDir, { recursive: true });
    writeFileSync(join(mDir, 'state.json'), JSON.stringify({ mission: 'old-m', flow: 1, lane: 'direct', branch: 'main', actor: 'a' }));
    const r = spawnSync('bun', [join(import.meta.dirname, '..', 'src', 'cli.ts'), 'status', '--project', dir], { encoding: 'utf8' });
    const out = r.stdout + r.stderr;
    expect(out.toLowerCase()).toContain('state written by v');
    expect(out).toContain('mugiwara migrate');
    expect(out).toContain(`v${CURRENT_SCHEMA_VERSION}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('savepoint writes schema_version 2', { timeout: 30000 }, () => {
  const dir = tmp();
  try {
    execFileSync('git', ['init', '-q', dir]);
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'base'], { cwd: dir });
    const SAVEPOINT = join(import.meta.dirname, '..', 'scripts', 'savepoint.sh');
    execFileSync('bash', [SAVEPOINT, 'schema-mission', '', '1', 'guided'], { cwd: dir, env: { ...process.env, MUGIWARA_DIR: join(dir, '.mugiwara') } });
    const state = JSON.parse(readFileSync(join(dir, '.mugiwara', 'missions', 'schema-mission', 'state.json'), 'utf8'));
    expect(state.schema_version).toBe(CURRENT_SCHEMA_VERSION);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
