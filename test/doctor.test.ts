// `mugiwara doctor`, the version pin check and the install warning. All
// in-process; doctor must never write a file.
import { describe, test, expect, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cap } from './helpers/cli-capture.ts';
import { initBaseRepo } from './helpers/git-fixture.ts';
import { doctor, renderDoctor, commandPins, pinMismatch, CLAUDE_HOOKS } from '../src/doctor.ts';
import { VERSION } from '../src/installer.ts';
import { duplicateKeys, modeNote } from '../src/config.ts';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function repo(): string {
  const d = mkdtempSync(join(tmpdir(), 'mugi-doctor-'));
  dirs.push(d);
  initBaseRepo(d);
  return d;
}
async function installed(): Promise<string> {
  const d = repo();
  const r = await cap(['install', '--yes', '--target', 'claude', '--project', d]);
  expect(r.code).toBe(0);
  return d;
}
const find = (d: string, name: string, lane = false) => doctor(d, d, { lane }).find((c) => c.name === name);
const snapshot = (d: string): string[] => readdirSync(d, { recursive: true }).map(String).sort();
const cmdFile = (d: string): string => join(d, '.claude', 'commands', 'mugiwara.md');

describe('doctor on a fresh install', () => {
  test('passes with only warnings, exit 0, and writes nothing', async () => {
    const d = await installed();
    const before = snapshot(d);
    const r = await cap(['doctor', '--project', d]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('All checks passed.');
    expect(r.out).toContain(`[ok  ] version: CLI ${VERSION} matches pin ${VERSION}`);
    expect(r.out).toContain('[ok  ] hooks wired (claude)');
    expect(r.out).toContain('[ok  ] config mode: guided (default)'.replace(' (default)', ''));
    expect(r.out).toContain('[warn] engaged marker');
    expect(r.out).toContain('[warn] review ledger');
    expect(snapshot(d)).toEqual(before);
  });
  test('--json is machine readable', async () => {
    const d = await installed();
    const j = JSON.parse((await cap(['doctor', '--json', '--project', d])).out);
    expect(j.ok).toBe(true);
    expect(j.version).toBe(VERSION);
    expect(j.checks.find((c: { name: string }) => c.name === 'config enforce').detail).toBe('warn (default)');
  });
  test('engaged marker and review ledger present', async () => {
    const d = await installed();
    writeFileSync(join(d, '.mugiwara', '.engaged'), '{}');
    writeFileSync(join(d, '.mugiwara', 'review-dispatch.jsonl'), '');
    expect(find(d, 'engaged marker')?.status).toBe('ok');
    expect(find(d, 'review ledger')?.status).toBe('ok');
  });
  test('in-flight missions are listed', async () => {
    const d = await installed();
    const m = join(d, '.mugiwara', 'missions', 'alpha');
    mkdirSync(m, { recursive: true });
    writeFileSync(join(m, 'state.json'), JSON.stringify({ mission: 'alpha', flow: 2 }));
    expect(find(d, 'missions')?.detail).toBe('1 in flight: alpha');
  });
  test('lane is reported for the current diff', async () => {
    const d = await installed();
    expect(find(d, 'lane', true)?.detail).toMatch(/^\w+ \(\d+ file\(s\) changed;/);
  });
});

describe('doctor failures', () => {
  test('no install: exit 1 with the fix', async () => {
    const d = repo();
    const r = await cap(['doctor', '--project', d]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('[FAIL] install: no project install found');
    expect(r.out).toContain('fix: run `mugiwara install --yes`');
    expect(existsSync(join(d, '.mugiwara'))).toBe(false);
  });
  test('corrupt manifest', () => {
    const d = repo(); mkdirSync(join(d, '.mugiwara'));
    writeFileSync(join(d, '.mugiwara', 'manifest.json'), '{');
    expect(find(d, 'install')?.detail).toBe('.mugiwara/manifest.json is not valid JSON');
  });
  test('unknown target, missing skills dir and missing manifest files', async () => {
    const d = await installed();
    rmSync(join(d, '.claude', 'skills'), { recursive: true });
    const m = JSON.parse(readFileSync(join(d, '.mugiwara', 'manifest.json'), 'utf8'));
    m.targets.push('nope');
    writeFileSync(join(d, '.mugiwara', 'manifest.json'), JSON.stringify(m));
    expect(find(d, 'host files (claude)')?.status).toBe('fail');
    expect(find(d, 'host files (nope)')?.detail).toBe('unknown target in manifest');
    expect(find(d, 'manifest files')?.status).toBe('fail');
  });
  test('hooks unwired in settings.json', async () => {
    const d = await installed();
    writeFileSync(join(d, '.claude', 'settings.json'), '{}');
    const c = find(d, 'hooks wired (claude)');
    expect(c?.status).toBe('fail');
    expect(c?.detail).toBe(`settings.json does not wire: ${CLAUDE_HOOKS.join(', ')}`);
  });
  test('settings.json invalid, absent with hooks dir, absent without hooks dir', async () => {
    const d = await installed();
    const s = join(d, '.claude', 'settings.json');
    writeFileSync(s, '{');
    expect(find(d, 'hooks wired (claude)')?.detail).toBe('.claude/settings.json is not valid JSON');
    rmSync(s);
    expect(find(d, 'hooks wired (claude)')?.detail).toContain('does not wire it');
    rmSync(join(d, '.claude', 'hooks'), { recursive: true });
    expect(find(d, 'hooks wired (claude)')?.status).toBe('warn');
  });
  test('bad config values fail with the default as the fix', async () => {
    const d = await installed();
    writeFileSync(join(d, '.mugiwara', 'config'), 'mode=wild\nenforce=maybe\nindependent_review=sometimes\n');
    const checks = doctor(d, d, { lane: false });
    for (const [k, def] of [['mode', 'guided'], ['enforce', 'warn'], ['independent_review', 'on']]) {
      const c = checks.find((x) => x.name === `config ${k}`);
      expect(c?.status).toBe('fail');
      expect(c?.fix).toBe(`set ${k}=${def} in .mugiwara/config`);
    }
  });
  test('missing config is a warning', async () => {
    const d = await installed();
    rmSync(join(d, '.mugiwara', 'config'));
    expect(find(d, 'config')?.status).toBe('warn');
  });
  test('corrupt mission state fails per file', async () => {
    const d = await installed();
    const m = join(d, '.mugiwara', 'missions', 'a');
    mkdirSync(m, { recursive: true });
    writeFileSync(join(m, 'state.json'), '{"mi');
    const c = find(d, `state ${join('.mugiwara', 'missions', 'a', 'state.json')}`);
    expect(c?.status).toBe('fail');
    expect(find(d, 'missions')).toBeUndefined();
  });
  test('lane outside a git repo is a warning, not a failure', async () => {
    const d = mkdtempSync(join(tmpdir(), 'mugi-nogit-')); dirs.push(d);
    expect(find(d, 'lane', true)?.status).toBe('warn');
  });
});

describe('version pin', () => {
  test('older pin: doctor fails with the fix, install warns on one line', async () => {
    const d = await installed();
    const f = cmdFile(d);
    writeFileSync(f, readFileSync(f, 'utf8').replaceAll(`mugiwara@${VERSION}`, 'mugiwara@0.0.1'));
    expect(commandPins(d)).toEqual(['0.0.1']);
    expect(pinMismatch(d)).toContain('pins older version 0.0.1');
    const r = await cap(['doctor', '--project', d]);
    expect(r.code).toBe(1);
    expect(r.out).toContain(`[FAIL] version: installed command pins older version 0.0.1 but this CLI is ${VERSION}`);
    expect(r.out).toContain('fix: delete .claude/commands/mugiwara.md and run `mugiwara update`');
    const i = await cap(['install', '--yes', '--target', 'claude', '--project', d]);
    expect(i.out.split('\n').filter((l) => l.startsWith('! installed command pins'))).toHaveLength(1);
  });
  test('newer pin is reported as different', async () => {
    const d = await installed();
    writeFileSync(cmdFile(d), 'run `npx -y @ionivetech/mugiwara@99.0.0 <cmd>`');
    expect(pinMismatch(d)).toContain('pins different version 99.0.0');
  });
  test('no warning when pins match, no pin, or no command file', async () => {
    const d = await installed();
    expect(pinMismatch(d)).toBeNull();
    writeFileSync(cmdFile(d), 'no pin here');
    expect(pinMismatch(d)).toBeNull();
    expect(find(d, 'version')?.status).toBe('warn');
    rmSync(cmdFile(d));
    expect(commandPins(d)).toBeNull();
    expect(find(d, 'version')?.detail).toContain('no installed command file');
  });
  test('install prints no warning on a clean install', async () => {
    const d = repo();
    const r = await cap(['install', '--yes', '--target', 'claude', '--project', d]);
    expect(r.out).not.toContain('installed command pins');
  });
});

describe('renderDoctor', () => {
  test('fix line only for non-ok checks', () => {
    expect(renderDoctor([
      { name: 'a', status: 'ok', detail: 'fine', fix: 'ignored' },
      { name: 'b', status: 'fail', detail: 'bad', fix: 'do x' },
    ])).toBe('[ok  ] a: fine\n[FAIL] b: bad\n       fix: do x');
  });
});

describe('config conflicts', () => {
  test('doctor warns when a key is set twice with different values, and the first wins', () => {
    const d = repo();
    mkdirSync(join(d, '.mugiwara'), { recursive: true });
    writeFileSync(join(d, '.mugiwara', 'config'), 'mode=guided\nenforce=warn\nmode=auto\n');
    const c = find(d, 'config mode', false);
    expect(c?.status).toBe('warn');
    expect(c?.detail).toContain('lines 1 and 3');
    expect(c?.detail).toContain('guided');
    expect(duplicateKeys(d)).toEqual([{ key: 'mode', lines: [1, 3], winner: 'guided' }]);
  });

  test('the same value twice is not a conflict, and a missing file has none', () => {
    const d = repo();
    expect(duplicateKeys(d)).toEqual([]);
    mkdirSync(join(d, '.mugiwara'), { recursive: true });
    writeFileSync(join(d, '.mugiwara', 'config'), 'mode=auto\nmode=auto # again\n# mode=guided\n');
    expect(duplicateKeys(d)).toEqual([]);
  });

  test('modeNote names both modes only when they differ', () => {
    expect(modeNote('guided', 'auto')).toContain('mugiwara mode auto');
    expect(modeNote('auto', 'auto')).toBeNull();
    expect(modeNote('guided', undefined)).toBeNull();
  });

  test('doctor warns about a mission started in another mode than the config', () => {
    const d = repo();
    mkdirSync(join(d, '.mugiwara', 'missions', 'm1'), { recursive: true });
    writeFileSync(join(d, '.mugiwara', 'config'), 'mode=auto\n');
    writeFileSync(join(d, '.mugiwara', 'missions', 'm1', 'state.json'), JSON.stringify({ mission: 'm1', flow: 2, lane: 'full', mode: 'guided', tasks_done: 0, tasks_total: 0 }));
    const c = find(d, 'mission m1 mode', false);
    expect(c?.status).toBe('warn');
    expect(c?.fix).toContain('mugiwara mode auto');
  });
});

describe('global CLI check', () => {
  const d = () => mkdtempSync(join(tmpdir(), 'mugi-doc-cli-'));
  test('warns, with the install command, when no mugiwara is on PATH', () => {
    const c = doctor(d(), d(), { lane: false, globalCli: () => null }).find((x) => x.name === 'global CLI');
    expect(c?.status).toBe('warn');
    expect(c?.fix).toContain('npm i -g @ionivetech/mugiwara');
  });
  test('ok when a binary answers', () => {
    const c = doctor(d(), d(), { lane: false, globalCli: () => '2.0.0' }).find((x) => x.name === 'global CLI');
    expect(c).toMatchObject({ status: 'ok', detail: 'mugiwara 2.0.0 on PATH' });
  });
});
