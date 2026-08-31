import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatePureKey, pureSign, verifyReport } from '../src/sign.ts';
import { loadPolicy, extractAttestation, parsePolicyYaml } from '../src/policy.ts';
import { archiveMission } from '../src/mission.ts';

function tmpProj(): string {
  return mkdtempSync(join(tmpdir(), 'mugi-trust-proj-'));
}

describe('attestation policy parsing', () => {
  it('parses inline trusted_keys and revoked', () => {
    const yml = `
attestation:
  required: true
  trusted_keys:
    - { id: "farid", pubkey: "ed25519:AAAA", added: "2026-08-31" }
    - { id: "ci", pubkey: "ed25519:BBBB", added: "2026-08-31" }
  revoked:
    - { id: "old-ci", revoked: "2026-08-15", reason: "key rotation" }
`;
    const att = extractAttestation(yml);
    expect(att?.required).toBe(true);
    expect(att?.trusted_keys?.length).toBe(2);
    expect(att?.trusted_keys?.[0].id).toBe('farid');
    expect(att?.trusted_keys?.[0].pubkey).toBe('ed25519:AAAA');
    expect(att?.revoked?.[0].id).toBe('old-ci');
  });

  it('parses multiline trusted_keys', () => {
    const yml = `
attestation:
  required: false
  trusted_keys:
    - id: farid
      pubkey: ed25519:AAAA
      added: 2026-08-31
    - id: ci
      pubkey: ed25519:BBBB
  revoked:
    - id: old-ci
      revoked: 2026-08-15
      reason: key rotation
`;
    const att = extractAttestation(yml);
    expect(att?.required).toBe(false);
    expect(att?.trusted_keys?.length).toBe(2);
    expect(att?.trusted_keys?.[1].id).toBe('ci');
    expect(att?.revoked?.[0].reason).toBe('key rotation');
  });

  it('loadPolicy normalizes attestation', () => {
    const dir = tmpProj();
    try {
      const yml = `attestation:
  required: true
  trusted_keys:
    - { id: "farid", pubkey: "ed25519:AAAA", added: "2026-08-31" }
  revoked:
    - { id: "old-ci", revoked: "2026-08-15", reason: "rotation" }
`;
      writeFileSync(join(dir, 'mugiwara.policy.yml'), yml);
      const p = loadPolicy(dir);
      expect(p?.attestation?.required).toBe(true);
      expect(p?.attestation?.trusted_keys?.[0].id).toBe('farid');
      expect(p?.attestation?.revoked?.[0].id).toBe('old-ci');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('throws on unknown root key', () => {
    const dir = tmpProj();
    try {
      writeFileSync(join(dir, 'mugiwara.policy.yml'), 'unknown: 1\n');
      let threw = '';
      try { loadPolicy(dir); } catch (e) { threw = (e as Error).message; }
      expect(threw).toContain('unknown policy key');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('sign --verify trust checks', () => {
  let proj: string;
  let mdir: string;
  beforeEach(() => {
    proj = tmpProj();
    mdir = join(proj, '.mugiwara', 'missions', 'demo');
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, 'report.md'), '# demo report\n');
  });
  afterEach(() => { rmSync(proj, { recursive: true, force: true }); });

  it('verifies ok when signer in trusted_keys', () => {
    const { pub, key } = generatePureKey();
    const content = readFileSync(join(mdir, 'report.md'), 'utf8');
    const sig = pureSign(content, key, { mission: 'demo', commit: 'abc', ts: new Date().toISOString(), pub, outputPath: join(mdir, 'report.md.mugisig') });
    expect(sig.ok).toBe(true);

    const yml = `attestation:
  required: true
  trusted_keys:
    - { id: "farid", pubkey: "ed25519:${pub}", added: "2026-08-31" }
`;
    writeFileSync(join(proj, 'mugiwara.policy.yml'), yml);
    const v = verifyReport(proj, mdir);
    expect(v.ok).toBe(true);
    expect(v.message).toContain('verifies');
  });

  it('fails untrusted when pub not in trusted_keys', () => {
    const { pub, key } = generatePureKey();
    const { pub: otherPub } = generatePureKey();
    const content = readFileSync(join(mdir, 'report.md'), 'utf8');
    pureSign(content, key, { mission: 'demo', commit: 'abc', ts: new Date().toISOString(), pub, outputPath: join(mdir, 'report.md.mugisig') });

    const yml = `attestation:
  trusted_keys:
    - { id: "ci", pubkey: "ed25519:${otherPub}", added: "2026-08-31" }
`;
    writeFileSync(join(proj, 'mugiwara.policy.yml'), yml);
    const v = verifyReport(proj, mdir);
    expect(v.ok).toBe(false);
    expect(v.message).toContain('untrusted');
  });

  it('fails revoked when id in revoked list', () => {
    const { pub, key } = generatePureKey();
    const content = readFileSync(join(mdir, 'report.md'), 'utf8');
    pureSign(content, key, { mission: 'demo', commit: 'abc', ts: new Date().toISOString(), pub, outputPath: join(mdir, 'report.md.mugisig') });

    const yml = `attestation:
  trusted_keys:
    - { id: "farid", pubkey: "ed25519:${pub}", added: "2026-08-31" }
  revoked:
    - { id: "farid", revoked: "2026-08-15", reason: "key rotation" }
`;
    writeFileSync(join(proj, 'mugiwara.policy.yml'), yml);
    const v = verifyReport(proj, mdir);
    expect(v.ok).toBe(false);
    expect(v.message).toContain('revoked');
  });

  it('fails revoked by pubkey even if trusted', () => {
    const { pub, key } = generatePureKey();
    const content = readFileSync(join(mdir, 'report.md'), 'utf8');
    pureSign(content, key, { mission: 'demo', commit: 'abc', ts: new Date().toISOString(), pub, outputPath: join(mdir, 'report.md.mugisig') });
    const yml = `attestation:
  trusted_keys:
    - { id: "farid", pubkey: "ed25519:${pub}" }
  revoked:
    - { id: "farid", pubkey: "ed25519:${pub}", revoked: "2026-08-15" }
`;
    writeFileSync(join(proj, 'mugiwara.policy.yml'), yml);
    const v = verifyReport(proj, mdir);
    expect(v.ok).toBe(false);
    expect(v.message).toContain('revoked');
  });

  it('passes when no trusted_keys configured (signature only)', () => {
    const { pub, key } = generatePureKey();
    const content = readFileSync(join(mdir, 'report.md'), 'utf8');
    pureSign(content, key, { mission: 'demo', commit: 'abc', ts: new Date().toISOString(), pub, outputPath: join(mdir, 'report.md.mugisig') });
    // no policy
    const v = verifyReport(proj, mdir);
    expect(v.ok).toBe(true);
  });
});

describe('attestation.required archive gate', () => {
  it('fails archive when required but not signed', () => {
    const proj = tmpProj();
    try {
      const mdir = join(proj, '.mugiwara', 'missions', 'demo');
      mkdirSync(join(mdir, 'flows'), { recursive: true });
      writeFileSync(join(mdir, 'plan.md'), '# plan');
      writeFileSync(join(mdir, 'flows', '01-execution.md'), 'exec');
      writeFileSync(join(mdir, 'report.md'), '# report');
      writeFileSync(join(mdir, 'state.json'), JSON.stringify({ mission: 'demo', lane: 'standard', flow: 3 }));
      writeFileSync(join(proj, 'mugiwara.policy.yml'), 'attestation:\n  required: true\n');
      let threw = '';
      try { archiveMission(proj, 'demo'); } catch (e) { threw = (e as Error).message; }
      expect(threw).toContain('attestation required but report not signed/trusted');
      expect(threw).toContain('closure integrity gate failed');
    } finally { rmSync(proj, { recursive: true, force: true }); }
  });

  it('fails archive when required and signer untrusted', () => {
    const proj = tmpProj();
    try {
      const mdir = join(proj, '.mugiwara', 'missions', 'demo');
      mkdirSync(join(mdir, 'flows'), { recursive: true });
      writeFileSync(join(mdir, 'plan.md'), '# plan');
      writeFileSync(join(mdir, 'flows', '01-execution.md'), 'exec');
      writeFileSync(join(mdir, 'report.md'), '# report');
      writeFileSync(join(mdir, 'state.json'), JSON.stringify({ mission: 'demo', lane: 'standard' }));
      const { pub, key } = generatePureKey();
      const { pub: other } = generatePureKey();
      const content = readFileSync(join(mdir, 'report.md'), 'utf8');
      pureSign(content, key, { mission: 'demo', commit: 'abc', ts: new Date().toISOString(), pub, outputPath: join(mdir, 'report.md.mugisig') });
      writeFileSync(join(proj, 'mugiwara.policy.yml'), `attestation:\n  required: true\n  trusted_keys:\n    - { id: "other", pubkey: "ed25519:${other}" }\n`);
      let threw = '';
      try { archiveMission(proj, 'demo'); } catch (e) { threw = (e as Error).message; }
      expect(threw).toContain('attestation required');
      expect(threw).toContain('untrusted');
    } finally { rmSync(proj, { recursive: true, force: true }); }
  });

  it('passes archive when required and signed with trusted key', () => {
    const proj = tmpProj();
    try {
      const mdir = join(proj, '.mugiwara', 'missions', 'demo');
      mkdirSync(join(mdir, 'flows'), { recursive: true });
      writeFileSync(join(mdir, 'plan.md'), '# plan');
      writeFileSync(join(mdir, 'flows', '01-execution.md'), 'exec');
      writeFileSync(join(mdir, 'report.md'), '# report');
      writeFileSync(join(mdir, 'state.json'), JSON.stringify({ mission: 'demo', lane: 'standard' }));
      const { pub, key } = generatePureKey();
      const content = readFileSync(join(mdir, 'report.md'), 'utf8');
      pureSign(content, key, { mission: 'demo', commit: 'abc', ts: new Date().toISOString(), pub, outputPath: join(mdir, 'report.md.mugisig') });
      writeFileSync(join(proj, 'mugiwara.policy.yml'), `attestation:\n  required: true\n  trusted_keys:\n    - { id: "farid", pubkey: "ed25519:${pub}" }\n`);
      const r = archiveMission(proj, 'demo');
      expect(r.report).toBeTruthy();
      expect(existsSync(join(mdir, 'report.md'))).toBe(true);
    } finally { rmSync(proj, { recursive: true, force: true }); }
  });

  it('dryRun does not enforce attestation gate', () => {
    const proj = tmpProj();
    try {
      const mdir = join(proj, '.mugiwara', 'missions', 'demo');
      mkdirSync(join(mdir, 'flows'), { recursive: true });
      writeFileSync(join(mdir, 'plan.md'), '# plan');
      writeFileSync(join(mdir, 'flows', '01-execution.md'), 'exec');
      writeFileSync(join(mdir, 'report.md'), '# report');
      writeFileSync(join(mdir, 'state.json'), JSON.stringify({ mission: 'demo', lane: 'standard' }));
      writeFileSync(join(proj, 'mugiwara.policy.yml'), 'attestation:\n  required: true\n');
      const r = archiveMission(proj, 'demo', { dryRun: true });
      expect(r.report).toBeTruthy(); // not thrown
    } finally { rmSync(proj, { recursive: true, force: true }); }
  });
});
