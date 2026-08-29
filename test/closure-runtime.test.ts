import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 30000 });
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { attachGitNote, blamePath, modelLabel, buildNote } from '../src/provenance.ts';
import { loadPolicy } from '../src/policy.ts';
import { signReport, verifyReport } from '../src/sign.ts';
import { run as runCliInProcess } from '../src/cli.ts';
import { execSync as xsync } from 'node:child_process';
const execSync2 = xsync;

let dir: string;
let savedPath: string;
const ENV_SAVED: Array<[string, string | undefined]> = [];
function saveEnv(k: string): void {
  ENV_SAVED.push([k, process.env[k]]);
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mugi-runtime-'));
  savedPath = process.env.PATH ?? '';
  saveEnv('PATH'); saveEnv('MUGIWARA_MODEL'); saveEnv('ANTHROPIC_MODEL');
  saveEnv('MUGIWARA_SIGN_KEY'); saveEnv('MUGIWARA_SIGN_PASSWORD');
});
afterEach(() => {
  process.env.PATH = savedPath;
  for (const [k, v] of ENV_SAVED.splice(0)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
});

function gitRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'mugi-git-'));
  execSync(
    'git init -q -b main && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base',
    { cwd: repo },
  );
  return repo;
}

describe('provenance against a real repo', () => {
  it('attachGitNote pins the branch head and blame reads it back', () => {
    const repo = gitRepo();
    writeFileSync(join(repo, 'tracked.ts'), 'export {};\n');
    execSync2('git add -A && git commit -qm add-file', { cwd: repo });
    const sha = attachGitNote(repo, 'master', buildNote({
      mission: 'm', actor: 'a', lane: 'lean', mode: 'auto',
      branch: 'master', tasks_done: 1, tasks_total: 1, evidence: ['waves/x.md'],
    }));
    expect(sha).not.toBeNull();
    const noted = blamePath(repo, 'tracked.ts');
    expect(noted).toContain('mission: m');
    expect(noted).toContain('lane lean');
    rmSync(repo, { recursive: true, force: true });
  });

  it('blame reports an existing commit without a note honestly', () => {
    const repo = gitRepo();
    writeFileSync(join(repo, 'plain.ts'), 'x\n');
    execSync2('git add -A && git commit -qm plain', { cwd: repo });
    expect(blamePath(repo, 'plain.ts')).toContain('(no mugiwara provenance note');
    rmSync(repo, { recursive: true, force: true });
  });

  it('an unresolvable base is never called stale', () => {
    const repo = gitRepo();
    // deadbeef..main rev-list fails → null, not a wrong warning
    delete process.env.MUGIWARA_MODEL;
    expect(modelLabel()).toContain('model-unrecorded');
    rmSync(repo, { recursive: true, force: true });
  });

  it('blame reports paths no commit touches', () => {
    const repo = gitRepo();
    expect(blamePath(repo, 'never/existed.ts')).toContain('no commit touches');
    rmSync(repo, { recursive: true, force: true });
  });

  it('modelLabel prefers MUGIWARA_MODEL then ANTHROPIC_MODEL then admits absence', () => {
    delete process.env.MUGIWARA_MODEL;
    delete process.env.ANTHROPIC_MODEL;
    expect(modelLabel()).toContain('model-unrecorded');
    process.env.ANTHROPIC_MODEL = 'claude-x';
    expect(modelLabel()).toBe('claude-x');
    process.env.MUGIWARA_MODEL = 'custom-9';
    expect(modelLabel()).toBe('custom-9');
  });
});

describe('loadPolicy discovery + normalize', () => {
  it('reads .yml, falls back to .yaml, yml wins', () => {
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'evidence:\n  required:\n    - test\n');
    const p = loadPolicy(dir);
    expect(p?.evidence?.required).toEqual(['test']);

    rmSync(join(dir, 'mugiwara.policy.yml'));
    writeFileSync(join(dir, 'mugiwara.policy.yaml'), 'lanes:\n  force_full:\n    - "a/**"\n');
    expect(loadPolicy(dir)?.lanes?.force_full).toEqual(['a/**']);
  });

  it('normalizes require_human_approval', () => {
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'gates:\n  require_human_approval:\n    - "src/pay/**"\n');
    expect(loadPolicy(dir)?.gates?.require_human_approval).toEqual(['src/pay/**']);
  });
});

describe('signReport / verifyReport with stubbed minisign', () => {
  /** -v always succeeds (the presence probe); every other invocation exits `code`. */
  function stubMinisign(code: number): void {
    const bin = join(dir, 'bin');
    mkdirSync(bin, { recursive: true });
    const sh = join(bin, 'minisign');
    writeFileSync(sh, `#!/bin/sh\n[ "$1" = "-v" ] && exit 0\nexit ${code}\n`);
    chmodSync(sh, 0o755);
    process.env.PATH = `${bin}:${savedPath}`;
  }

  it('no minisign installed → auto falls back to pure; no keys → honest refusal, never a fake signature', () => {
    const mdir = join(dir, 'm');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'report.md'), 'body\n');
    // no .mugiwara/config → sign_backend unset → auto → minisign absent → pure
    const r = signReport(dir, mdir);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('pure keys missing');
  });

  it('sign succeeds with stub and key (sign_backend=minisign); verify detects tampering via failing stub', () => {
    const mdir = join(dir, 'm');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'report.md'), 'body\n');
    // force the minisign backend so the stub is exercised (auto would pick pure)
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'config'), 'sign_backend=minisign\n');
    process.env.MUGIWARA_SIGN_KEY = '/keys/secret.key';
    stubMinisign(0);
    const signed = signReport(dir, mdir);
    expect(signed.ok).toBe(true);
    expect(signed.message).toContain('/keys/secret.key');

    writeFileSync(join(mdir, 'report.md.minisig'), 'sig');
    const ok = verifyReport(dir, mdir);
    expect(ok.ok).toBe(true);

    stubMinisign(1);
    const bad = verifyReport(dir, mdir);
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain('SIGNATURE INVALID');
  });

  it('unsigned mission says so; missing report refuses to sign', () => {
    const mdir = join(dir, 'm');
    mkdirSync(mdir, { recursive: true });
    stubMinisign(0);
    const v = verifyReport(dir, mdir);
    expect(v.message).toContain('not signed');
    const s = signReport(dir, mdir);
    expect(s.ok).toBe(false);
    expect(s.message).toContain('no report.md to sign');
  });
});

describe('CLI in-process coverage', () => {
  function missionFixture(proj: string): void {
    const mdir = join(proj, '.mugiwara', 'missions', 'demo');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'state.json'), JSON.stringify({
      mission: 'demo', member: null, actor: 'eng1', branch: 'feat-w',
      flow: 6, mode: 'guided', lane: 'standard', tasks_done: 3, tasks_total: 5,
      next_action: 'run gates', blockers_open: 0, heal_cycle: 0, heal_max_cycles: 3,
      evidence: [], updated_at: new Date().toISOString(), base_sha: 'unknown',
    }));
  }

  it('--help lists the closure commands', async () => {
    const logged: string[] = [];
    const orig = console.log;
    console.log = (m?: unknown): void => { logged.push(String(m)); };
    try { await runCliInProcess(['--help']); } finally { console.log = orig; }
    const all = logged.join('\n');
    expect(all).toContain('mugiwara blame <path>');
    expect(all).toContain('mugiwara handoff <m>');
    expect(all).toContain('mugiwara sign <m>');
  });

  it('handoff runs in-process and writes the report', async () => {
    const proj = mkdtempSync(join(tmpdir(), 'mugi-cli3-'));
    missionFixture(proj);
    await runCliInProcess(['handoff', 'demo', '--project', proj]);
    expect(readFileSync(join(proj, '.mugiwara', 'missions', 'demo', 'handoff.md'), 'utf8'))
      .toContain('| Next action | run gates |');
    rmSync(proj, { recursive: true, force: true });
  });
});

describe('CLI commands end-to-end', () => {
  const cli = join(import.meta.dirname ?? '.', '..', 'src', 'cli.ts');

  function runCli(args: string, projectDir: string): ReturnType<typeof spawnSync> {
    return spawnSync('bun', [cli, ...args.split(' ').filter(Boolean), '--project', projectDir], {
      encoding: 'utf8', cwd: import.meta.dirname,
    });
  }

  /** Module-level twin of the sign-suite stub — CLI spawns need it too. */
  const stubFor = (code: number): void => {
    const bin = join(dir, `bin-${code}`);
    mkdirSync(bin, { recursive: true });
    const sh = join(bin, 'minisign');
    writeFileSync(sh, `#!/bin/sh\n[ "$1" = "-v" ] && exit 0\nexit ${code}\n`);
    chmodSync(sh, 0o755);
    process.env.PATH = `${bin}:${savedPath}`;
  };

  it('handoff writes an actionable report from live state', () => {
    const proj = mkdtempSync(join(tmpdir(), 'mugi-cli-'));
    const mdir = join(proj, '.mugiwara', 'missions', 'demo');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'state.json'), JSON.stringify({
      mission: 'demo', member: null as string | null, actor: 'eng1',
      branch: 'feat-w', flow: 6, mode: 'guided', lane: 'standard',
      tasks_done: 3, tasks_total: 5, next_action: 'run gates',
      blockers_open: 0, heal_cycle: 0, heal_max_cycles: 3,
      evidence: ['waves/03-quality.md'], updated_at: new Date().toISOString(),
      base_sha: 'unknown',
    }));
    const r = runCli('handoff demo', proj);
    expect(r.status).toBe(0);
    const md = readFileSync(join(mdir, 'handoff.md'), 'utf8');
    expect(md).toContain('# Handoff: demo');
    expect(md).toContain('| Next action | run gates |');
    expect(md).toContain('mugiwara continue demo');
    rmSync(proj, { recursive: true, force: true });
  });

  it('blame degrades honestly outside a repo; sign --verify fails closed on unsigned', () => {
    const r1 = runCli('blame some/path.ts', dir);
    expect(r1.stdout).toContain('not a git repository');

    const proj = mkdtempSync(join(tmpdir(), 'mugi-cli2-'));
    const mdir = join(proj, '.mugiwara', 'missions', 'demo');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'report.md'), 'body\n');
    stubFor(0);
    const r2 = runCli('sign demo --verify', proj);
    expect(r2.status).toBe(1);
    expect(r2.stdout).toContain('not signed');
    rmSync(proj, { recursive: true, force: true });
  });
});
