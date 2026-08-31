import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findSecrets, SECRET_PATTERNS, checkTrail } from '../src/integrity.ts';
import { archiveMission } from '../src/mission.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mugi-integrity-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const POSITIVES: Array<{ payload: string; label: string; severity: 'block' | 'warn' }> = [
  // 4 old — must still block (split to avoid GitHub secret scanning)
  { payload: 'AKIA' + '1234567890ABCDEF', label: 'AWS access key', severity: 'block' },
  { payload: 'ghp_' + '1234567890123456789012345678901234', label: 'GitHub token', severity: 'block' },
  { payload: 'sk-' + '1234567890123456789012345678901234', label: 'API key', severity: 'block' },
  { payload: 'password = "hunter2xyz123"', label: 'credential assignment', severity: 'block' },
  // 6+ new block
  { payload: 'AIza' + 'A'.repeat(35), label: 'Google API key', severity: 'block' },
  { payload: 'ya29.' + 'a0AfH6SMB12345678901234567890EXTRA', label: 'Google OAuth token', severity: 'block' },
  { payload: 'AC' + '0123456789abcdef0123456789abcdef', label: 'Twilio account SID', severity: 'block' },
  { payload: 'SK' + '0123456789abcdef0123456789abcdef', label: 'Twilio API key', severity: 'block' },
  { payload: 'glpat-' + '12345678901234567890XYZ', label: 'GitLab token', severity: 'block' },
  { payload: 'npm_' + '123456789012345678901234567890123456', label: 'npm token', severity: 'block' },
  { payload: 'dop_v1_' + '0123456789abcdef'.repeat(4), label: 'DigitalOcean token', severity: 'block' },
  { payload: 'postgres://bob:hunter2xyz@db.example.com/mydb', label: 'connection string', severity: 'block' },
  // card shape — warn not block
  { payload: '4111111111111111', label: 'card-number', severity: 'warn' },
];

const NEGATIVES: string[] = [
  'da39a3ee5e6b4b0d3255bfef95601890afd80709', // git SHA 40-char hex
  '1.2.3', // semver
  '550e8400-e29b-41d4-a716-446655440000', // UUID
  '2026-08-29T12:00:00Z', // timestamp
];

describe('integrity — secret patterns', () => {
  it('has 16 patterns (7 existing + 9 new) with severity', () => {
    expect(SECRET_PATTERNS.length).toBe(16);
    const labels = SECRET_PATTERNS.map(([, l]) => l);
    expect(labels).toContain('Google API key');
    expect(labels).toContain('Google OAuth token');
    expect(labels).toContain('Twilio account SID');
    expect(labels).toContain('card-number shape (verify before committing)');
    const card = SECRET_PATTERNS.find(([, l]) => l.includes('card-number'));
    expect(card?.[2]).toBe('warn');
    const blocks = SECRET_PATTERNS.filter(([, , sev]) => sev === 'block');
    expect(blocks.length).toBe(15);
  });

  it('findSecrets catches all positives table-driven with correct severity', () => {
    for (const { payload, label, severity } of POSITIVES) {
      const hits = findSecrets(payload);
      expect(hits.length, `payload "${payload}" should hit ${label}`).toBeGreaterThan(0);
      const hit = hits.find((h) => h.label.includes(label.split(' ')[0]) || h.label === label);
      // fuzzy: at least one hit label contains expected substring
      const matched = hits.some((h) => h.label.toLowerCase().includes(label.toLowerCase().split(' ')[0]) || h.label === label);
      expect(matched, `payload "${payload}" label mismatch, got ${hits.map((h) => h.label).join(', ')}`).toBe(true);
      const sevHit = hits.find((h) => h.severity === severity);
      expect(sevHit, `payload "${payload}" should be ${severity}, got ${hits.map((h) => h.severity).join(', ')}`).toBeTruthy();
    }
  });

  it('findSecrets does NOT fire on 4 negatives', () => {
    for (const payload of NEGATIVES) {
      const hits = findSecrets(payload);
      expect(hits.length, `negative "${payload}" must not fire, got ${hits.map((h) => h.label).join(', ')}`).toBe(0);
    }
  });

  it('checkTrail flags block secrets and warn for card shape', () => {
    const missionDir = join(dir, 'trail');
    mkdirSync(missionDir, { recursive: true });
    writeFileSync(join(missionDir, 'state.json'), JSON.stringify({ evidence: [] }));
    // block secret (split to avoid GitHub secret scanning)
    writeFileSync(join(missionDir, 'notes.md'), `token ${'AIza' + 'A'.repeat(35)} here`);
    let issues = checkTrail(missionDir, dir);
    expect(issues.some((i) => i.kind === 'secret' && i.detail.includes('Google API key'))).toBe(true);

    // card shape should be warn not block
    writeFileSync(join(missionDir, 'notes.md'), `card 4111111111111111 in file`);
    issues = checkTrail(missionDir, dir);
    const cardIssues = issues.filter((i) => i.detail.includes('card-number'));
    expect(cardIssues.length).toBeGreaterThan(0);
    expect(cardIssues[0].kind).toBe('secret-warn');
    expect(cardIssues[0].severity).toBe('warn');
    expect(issues.some((i) => i.kind === 'secret' && i.detail.includes('card-number'))).toBe(false);
  });

  it('allow marker whitelists line (existing behavior)', () => {
    const hits = findSecrets('ghp_' + '1234567890123456789012345678901234' + ' <!-- mugiwara:allow-secret -->');
    expect(hits.length).toBe(0);
  });

  it('card shape warning does not block archive (mission gate)', () => {
    const project = mkdtempSync(join(tmpdir(), 'mugi-archive-card-'));
    try {
      const mission = 'demo';
      const missionDir = join(project, '.mugiwara', 'missions', mission);
      mkdirSync(join(missionDir, 'flows'), { recursive: true });
      writeFileSync(join(missionDir, 'plan.md'), '# plan');
      writeFileSync(join(missionDir, 'state.json'), JSON.stringify({ mission, flow: 3 }));
      writeFileSync(join(missionDir, 'flows', '01-execution.md'), 'card 4111111111111111 present but warn');
      writeFileSync(join(missionDir, 'report.md'), 'report');
      // should NOT throw for warn-only
      expect(() => archiveMission(project, mission, { dryRun: false })).not.toThrow();
      // but a blocking secret must still fail (separate mission)
      const mission2 = 'demo2';
      const m2 = join(project, '.mugiwara', 'missions', mission2);
      mkdirSync(join(m2, 'flows'), { recursive: true });
      writeFileSync(join(m2, 'plan.md'), '# plan');
      writeFileSync(join(m2, 'state.json'), JSON.stringify({ mission: mission2 }));
      writeFileSync(join(m2, 'flows', '01.md'), 'bad ' + 'ghp_' + '1234567890123456789012345678901234');
      expect(() => archiveMission(project, mission2, { dryRun: false })).toThrow(/closure integrity gate failed/);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('policy extra_secret_patterns via inline object catches NIK', () => {
    const project = mkdtempSync(join(tmpdir(), 'mugi-policy-inline-'));
    try {
      const yml = `integrity:
  extra_secret_patterns:
    - { pattern: "\\b3[0-9]{15}\\b", label: "NIK (Indonesian national ID)" }
`;
      writeFileSync(join(project, 'mugiwara.policy.yml'), yml);
      const missionDir = join(project, '.mugiwara', 'missions', 'demo');
      mkdirSync(missionDir, { recursive: true });
      writeFileSync(join(missionDir, 'state.json'), JSON.stringify({ evidence: [] }));
      writeFileSync(join(missionDir, 'notes.md'), 'user NIK 3123456789012345 leaked');
      const issues = checkTrail(missionDir, project);
      expect(issues.some((i) => i.detail.includes('NIK'))).toBe(true);
      expect(issues.some((i) => i.kind === 'secret')).toBe(true);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('policy extra_secret_patterns via multiline block catches custom pattern', () => {
    const project = mkdtempSync(join(tmpdir(), 'mugi-policy-multi-'));
    try {
      writeFileSync(
        join(project, 'mugiwara.policy.yml'),
        `integrity:
  extra_secret_patterns:
    - pattern: "\\bCUSTOM_[0-9]{6}\\b"
      label: "custom id"
      severity: warn
`,
      );
      const missionDir = join(project, '.mugiwara', 'missions', 'demo');
      mkdirSync(missionDir, { recursive: true });
      writeFileSync(join(missionDir, 'state.json'), JSON.stringify({ evidence: [] }));
      writeFileSync(join(missionDir, 'notes.md'), 'code CUSTOM_123456 here');
      const issues = checkTrail(missionDir, project);
      const hit = issues.find((i) => i.detail.includes('custom id'));
      expect(hit).toBeTruthy();
      expect(hit?.kind).toBe('secret-warn');
      expect(hit?.severity).toBe('warn');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('negatives via checkTrail also not flagged (file-level)', () => {
    const missionDir = join(dir, 'neg-trail');
    mkdirSync(missionDir, { recursive: true });
    writeFileSync(join(missionDir, 'state.json'), JSON.stringify({ evidence: [] }));
    writeFileSync(join(missionDir, 'notes.md'), NEGATIVES.join('\n'));
    const issues = checkTrail(missionDir, dir);
    const secretIssues = issues.filter((i) => i.kind === 'secret' || i.kind === 'secret-warn');
    expect(secretIssues.length).toBe(0);
  });

  it('connection string and other new payloads via checkTrail', () => {
    const missionDir = join(dir, 'conn-trail');
    mkdirSync(missionDir, { recursive: true });
    writeFileSync(join(missionDir, 'state.json'), JSON.stringify({ evidence: [] }));
    const payloads = [
      'ya29.' + 'a0AfH6SMB12345678901234567890EXTRA',
      'SK' + '0123456789abcdef0123456789abcdef',
      'glpat-' + '12345678901234567890XYZ',
      'npm_' + '123456789012345678901234567890123456',
      'dop_v1_' + '0123456789abcdef'.repeat(4),
      'postgres://alice:s3cretPass@host/db',
    ];
    for (const p of payloads) {
      writeFileSync(join(missionDir, 'notes.md'), `payload ${p}`);
      const issues = checkTrail(missionDir, dir);
      expect(issues.some((i) => i.kind === 'secret'), `payload ${p} should be secret`).toBe(true);
    }
  });
});
