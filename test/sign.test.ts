import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { pureSign, pureVerify, generatePureKey, ensurePureKey, resolveBackend, type BackendChoice } from '../src/sign.ts';

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

  it('signs and verifies round-trip with correct mission/commit/ts fields', () => {
    const { key, pub } = generatePureKey();
    const content = '# report\n\nsigned content';
    const sig = pureSign(content, key, { mission: 'm1', commit: 'abc123', ts: '2026-08-29T00:00:00Z', pub });
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
    expect(pureVerify('tampered content', sig)).toBe(false);
  });

  it('writes .mugisig JSON file beside report', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-mission-'));
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'report.md'), '# report');
      const { key, pub } = generatePureKey();
      const r = pureSign('report.md', key, { mission: 'm1', commit: 'c', ts: 't', pub, outputPath: join(dir, 'report.md.mugisig') });
      expect(existsSync(join(dir, 'report.md.mugisig'))).toBe(true);
      const parsed = JSON.parse(readFileSync(join(dir, 'report.md.mugisig'), 'utf8'));
      expect(parsed.algo).toBe('ed25519-pure');
      expect(parsed.mission).toBe('m1');
      expect('ok' in r).toBe(false); // success = PureSig, not {ok:false} error
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
