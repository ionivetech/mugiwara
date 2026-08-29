import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync, statSync, chmodSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { pureSign, pureVerify, generatePureKey, ensurePureKey, resolveBackend, signReport, verifyReport, type BackendChoice } from '../src/sign.ts';

function tmpHome(): string {
  return mkdtempSync(join(tmpdir(), 'mugi-home-'));
}

describe('pure ed25519 backend', () => {
  let home: string;
  beforeEach(() => { home = tmpHome(); });
  afterEach(() => { rmSync(home, { recursive: true, force: true }); });

  it('generates a 32-byte seed key pair (key + pub, base64)', () => {
    const { key, pub } = generatePureKey();
    expect(Buffer.from(key, 'base64').length).toBe(32);
    expect(Buffer.from(pub, 'base64').length).toBe(32);
  });

  it('ensurePureKey writes ~/.mugiwara/mugiwara.key + .pub and is idempotent', () => {
    const dir = ensurePureKey(home);
    expect(dir).toBe(join(home, '.mugiwara'));
    const key = readFileSync(join(home, '.mugiwara', 'mugiwara.key'), 'utf8');
    const pub = readFileSync(join(home, '.mugiwara', 'mugiwara.pub'), 'utf8');
    expect(Buffer.from(key.trim(), 'base64').length).toBe(32);
    expect(Buffer.from(pub.trim(), 'base64').length).toBe(32);
    const again = ensurePureKey(home);
    expect(again).toBe(join(home, '.mugiwara'));
    expect(readdirSync(join(home, '.mugiwara')).length).toBe(2); // never duplicated
  });

  it('ensurePureKey secures the seed key to 0600 (never world-readable)', () => {
    const dir = ensurePureKey(home);
    const mode = statSync(join(dir, 'mugiwara.key')).mode & 0o777;
    expect(mode).toBe(0o600);
    // idempotent hardening: pre-existing loose file gets tightened
    const keyPath = join(dir, 'mugiwara.key');
    chmodSync(keyPath, 0o644);
    ensurePureKey(home);
    expect(statSync(keyPath).mode & 0o777).toBe(0o600);
  });

  it('signs and verifies round-trip with correct mission/commit/ts fields', () => {
    const { key, pub } = generatePureKey();
    const content = '# report\n\nsigned content';
    const sig = pureSign(content, key, { mission: 'm1', commit: 'abc123', ts: '2026-08-29T00:00:00Z', pub });
    if (!sig.ok) throw new Error('expected pureSign success');
    expect(sig.algo).toBe('ed25519-pure');
    expect(sig.mission).toBe('m1');
    expect(sig.commit).toBe('abc123');
    expect(sig.ts).toBe('2026-08-29T00:00:00Z');
    expect(sig.pub).toBe(pub);
    expect(Buffer.from(sig.sig, 'base64').length).toBe(64); // ed25519 sig
    expect(pureVerify(content, sig)).toBe(true);
  });

  it('rejects tampered content', () => {
    const { key, pub } = generatePureKey();
    const sig = pureSign('original content', key, { mission: 'm1', commit: 'abc', ts: 't', pub });
    if (!sig.ok) throw new Error('expected pureSign success');
    expect(pureVerify('tampered content', sig)).toBe(false);
  });

  it('writes .mugisig JSON file beside report', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-mission-'));
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'report.md'), '# report');
      const { key, pub } = generatePureKey();
      const r = pureSign('report.md', key, { mission: 'm1', commit: 'c', ts: 't', pub, outputPath: join(dir, 'report.md.mugisig') });
      if (!r.ok) throw new Error('expected pureSign success');
      expect(existsSync(join(dir, 'report.md.mugisig'))).toBe(true);
      const parsed = JSON.parse(readFileSync(join(dir, 'report.md.mugisig'), 'utf8'));
      expect(parsed.algo).toBe('ed25519-pure');
      expect(parsed.mission).toBe('m1');
      expect(r.mission).toBe('m1');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('resolveBackend', () => {
  it('off → skip signing', () => {
    expect(resolveBackend('off', { hasMinisign: true, hasKey: true })).toBe('off');
  });
  it('minisign → force binary (fail loud when missing)', () => {
    expect(resolveBackend('minisign', { hasMinisign: true, hasKey: false })).toBe('minisign');
    expect(resolveBackend('minisign', { hasMinisign: false, hasKey: true })).toBe('minisign-fail');
  });
  it('pure → force node:crypto', () => {
    expect(resolveBackend('pure', { hasMinisign: false, hasKey: false })).toBe('pure');
  });
  it('auto → minisign when installed+key, else pure', () => {
    expect(resolveBackend('auto', { hasMinisign: true, hasKey: true })).toBe('minisign');
    expect(resolveBackend('auto', { hasMinisign: true, hasKey: false })).toBe('pure');
    expect(resolveBackend('auto', { hasMinisign: false, hasKey: false })).toBe('pure');
  });
  it('unknown → pure fallback (never silent off)', () => {
    expect(resolveBackend('weird', { hasMinisign: false, hasKey: false })).toBe('pure');
  });
});

describe('signReport end-to-end (pure backend)', () => {
  let home: string;
  let project: string;
  beforeEach(() => {
    home = tmpHome();
    project = mkdtempSync(join(tmpdir(), 'mugi-proj-'));
    // isolate homedir so pure keys land in the temp home, never the real one
    const prev = process.env.HOME;
    process.env.HOME = home;
    process.env.MUGIWARA_HOME_OVERRIDE = home;
  });
  afterEach(() => {
    delete process.env.HOME;
    delete process.env.MUGIWARA_HOME_OVERRIDE;
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
  });

  it('signs with auto backend (no minisign → pure), verifies round-trip, detects tamper', () => {
    // auto-generate keys first (as --gen-key would)
    const dir = ensurePureKey(home);
    const key = readFileSync(join(dir, 'mugiwara.key'), 'utf8');
    const pub = readFileSync(join(dir, 'mugiwara.pub'), 'utf8');

    const mdir = join(project, '.mugiwara', 'missions', 'demo');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'report.md'), '# demo report\n');

    const r = signReport(project, mdir);
    expect(r.ok).toBe(true);
    expect(r.message).toContain('mugisig');

    const ok = verifyReport(project, mdir);
    expect(ok.ok).toBe(true);
    expect(ok.message).toContain('verifies');

    // tamper → INVALID
    writeFileSync(join(mdir, 'report.md'), '# tampered\n');
    const bad = verifyReport(project, mdir);
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain('INVALID');
    void key; void pub;
  });

  it('sign=off refuses to sign', () => {
    mkdirSync(join(project, '.mugiwara'), { recursive: true });
    writeFileSync(join(project, '.mugiwara', 'config'), 'sign=off\n');
    const mdir = join(project, '.mugiwara', 'missions', 'demo');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'report.md'), '# demo\n');
    const r = signReport(project, mdir);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('signing disabled');
  });

  it('sign=minisign without minisign → loud failure', () => {
    mkdirSync(join(project, '.mugiwara'), { recursive: true });
    writeFileSync(join(project, '.mugiwara', 'config'), 'sign=minisign\n');
    const mdir = join(project, '.mugiwara', 'missions', 'demo');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'report.md'), '# demo\n');
    const r = signReport(project, mdir);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('sign=minisign but minisign not installed');
  });

  it('verify: .mugisig verifies even when minisign binary is absent (tries both)', () => {
    // pure-sign a report
    const mdir = join(project, '.mugiwara', 'missions', 'demo');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'report.md'), '# demo\n');
    const signed = signReport(project, mdir);
    expect(signed.ok).toBe(true);

    // minisign not installed on this machine (hasMinisign false) — the
    // .mugisig path must still verify without the binary
    const v = verifyReport(project, mdir);
    expect(v.ok).toBe(true);
    expect(v.message).toContain('mugisig');
  });

  it('verify: missing both signatures says not signed', () => {
    const mdir = join(project, '.mugiwara', 'missions', 'demo');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'report.md'), '# demo\n');
    const v = verifyReport(project, mdir);
    expect(v.ok).toBe(false);
    expect(v.message).toContain('not signed');
  });
});
