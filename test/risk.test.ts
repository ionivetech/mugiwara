import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { riskTerm, riskReminder, reviewNextStep } from '../src/risk.ts';
import { closingPending } from '../src/active-mission.ts';
import { archiveMission } from '../src/mission.ts';

describe('riskTerm', () => {
  const hits: Array<[string, string]> = [
    ['add login to the admin page', 'login'],
    ['fix the password reset flow', 'password'],
    ['rotate the api tokens', 'tokens'],
    ['change the role permissions', 'role'],
    ['issue a refund', 'refund'],
    ['tambah izin untuk admin', 'izin'],
    ['ubah hak akses pengguna', 'hak akses'],
    ['perbaiki otorisasi API', 'otorisasi'],
    ['perbaiki autentikasi', 'autentikasi'],
    ['halaman masuk akun error', 'masuk akun'],
    ['buat fitur pembayaran', 'pembayaran'],
    ['laporan penagihan bulanan', 'penagihan'],
    ['proses pengembalian dana', 'pengembalian dana'],
    ['reset kata sandi', 'kata sandi'],
    ['ganti sandi default', 'sandi'],
    ['simpan rahasia di vault', 'rahasia'],
    ['rotasi kunci api', 'kunci api'],
    ['dukungan penyewa baru', 'penyewa'],
    ['support multi-tenant', 'multi-tenant'],
    ['jalankan migrasi database', 'migrasi'],
    ['ubah skema tabel', 'skema'],
    ['edit src/payments/charge.ts', 'payments'],
    ['look at db/migrations/001.sql', 'migrations'],
    // path-only: the word match misses these because "_" is a word character
    ['edit src/user_permissions.ts', 'src/user_permissions.ts'],
    ['open config/my_secrets/dev.yml', 'config/my_secrets/dev.yml'],
    ['tweak app/user_rbac.ts', 'app/user_rbac.ts'],
    ['refactor lib/api_billing/', 'lib/api_billing/'],
    ['check db/001_payment.sql', 'db/001_payment.sql'],
  ];
  for (const [prompt, term] of hits) test(`hit: ${prompt}`, () => expect(riskTerm(prompt)).toBe(term));

  const misses = [
    'rename the button label', 'perbaiki typo di README', 'tambah tombol simpan', 'update docs/guide/intro.md',
    'ubah warna header', 'fix the layout in src/ui/header.ts', '',
  ];
  for (const prompt of misses) test(`miss: "${prompt}"`, () => expect(riskTerm(prompt)).toBeNull());

  test('non-string input is no risk', () => expect(riskTerm(undefined as unknown as string)).toBeNull());
});

describe('riskReminder', () => {
  test('names the term and the separate review agents', () => {
    const r = riskReminder('/mugiwara tambah pembayaran') as string;
    expect(r).toContain('"pembayaran"');
    expect(r).toContain('robin-reviewer');
    expect(r).toContain('jinbe-security');
  });
  test('the command word itself is not scanned; no risk gives null', () => {
    expect(riskReminder('/mugiwara rename a button')).toBeNull();
  });
});

describe('reviewNextStep', () => {
  test('names both agents and the archive command by default', () => {
    const s = reviewNextStep('m1');
    expect(s).toContain('Robin (robin-reviewer) and Jinbe (jinbe-security)');
    expect(s).toContain('`mugiwara archive m1`');
  });
  test('names only the missing agent', () => {
    const s = reviewNextStep('m1', new Set(['robin-reviewer']));
    expect(s).toContain('Jinbe (jinbe-security)');
    expect(s).not.toContain('Robin');
  });
  test('falls back to a generic phrase when both ran', () => {
    expect(reviewNextStep('m1', new Set(['robin-reviewer', 'jinbe-security']))).toContain('the reviewers');
  });
});

function project(): string { return mkdtempSync(join(tmpdir(), 'mugi-risk-')); }
function mission(dir: string, name: string, files: Record<string, string>): string {
  const m = join(dir, '.mugiwara', 'missions', name);
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(m, f, '..'), { recursive: true });
    writeFileSync(join(m, f), body);
  }
  return m;
}

describe('closingPending', () => {
  test('live state + closing file + no report.md is pending', () => {
    const dir = project();
    try {
      mission(dir, 'm1', { 'state.json': '{"mission":"m1"}', 'flows/06-closure.md': '# c' });
      expect(closingPending(dir)).toBe('m1');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('report.md, no closing file, no state, or no missions dir is not pending', () => {
    const dir = project();
    try {
      expect(closingPending(dir)).toBeNull();
      mission(dir, 'done', { 'state.json': '{}', 'flows/06-closure.md': '#', 'report.md': '#' });
      mission(dir, 'early', { 'state.json': '{}', 'flows/01-execution.md': '#' });
      mission(dir, 'archived', { 'flows/07-pr-verdict.md': '#' });
      mission(dir, 'cont', { 'continue.json': '{}', 'flows/06-closure.md': '#' });
      expect(closingPending(dir)).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('picks the most recent of several', () => {
    const dir = project();
    try {
      mission(dir, 'old', { 'state.json': '{}', 'flows/06-closure.md': '#' });
      const t = new Date(Date.now() + 5000);
      mission(dir, 'new', { 'state.json': '{}', 'flows/07-pr-verdict.md': '#' });
      require('node:fs').utimesSync(join(dir, '.mugiwara/missions/new/flows/07-pr-verdict.md'), t, t);
      expect(closingPending(dir)).toBe('new');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('archive without optional evidence', () => {
  test('writes report.md and says review and security were not verified', () => {
    const dir = project();
    try {
      const m = mission(dir, 'lean-m', { 'state.json': '{"mission":"lean-m","lane":"lean"}', 'decisions.md': '# d\n\nchose X', 'flows/06-closure.md': '# Closed\n\nDone.' });
      const r = archiveMission(dir, 'lean-m', { attestationChecked: true });
      expect(r.report).toBe(join('missions', 'lean-m', 'report.md'));
      const rep = readFileSync(join(m, 'report.md'), 'utf8');
      expect(rep).toContain('## Not verified');
      expect(rep).toContain('No review.md and no security.md');
      expect(existsSync(join(m, 'state.json'))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('an empty mission still gets a report.md with Not verified', () => {
    const dir = project();
    try {
      const m = mission(dir, 'empty-m', { 'notes.txt': 'x' });
      archiveMission(dir, 'empty-m', { attestationChecked: true });
      expect(readFileSync(join(m, 'report.md'), 'utf8')).toContain('## Not verified');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('risk_words config', () => {
  test('a project word triggers a risk hit', () => {
    expect(riskTerm('add the kyc check', 'kyc, ledger')).toBe('kyc');
    expect(riskReminder('/mugiwara change the ledger export', 'kyc,ledger')).toContain('"ledger"');
  });
  test('whole words only, empty config is ignored', () => {
    expect(riskTerm('rename skycap', 'kyc')).toBeNull();
    expect(riskTerm('add the kyc check', '')).toBeNull();
  });
  test('regex characters in a word are literal', () => {
    expect(riskTerm('touch a.b now', 'a.b')).toBe('a.b');
    expect(riskTerm('touch axb now', 'a.b')).toBeNull();
  });
});

describe('closingPending without flows/', () => {
  test('review.md and security.md together mean closing, even with no flows/ file', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'mugi-closing-'));
    const m = join(cwd, '.mugiwara', 'missions', 'm1');
    mkdirSync(m, { recursive: true });
    writeFileSync(join(m, 'state.json'), '{}');
    expect(closingPending(cwd)).toBeNull();
    writeFileSync(join(m, 'review.md'), '# r\n');
    expect(closingPending(cwd)).toBeNull();
    writeFileSync(join(m, 'security.md'), '# s\n');
    expect(closingPending(cwd)).toBe('m1');
    writeFileSync(join(m, 'report.md'), '# done\n');
    expect(closingPending(cwd)).toBeNull();
  });
  test('a dispatch in the ledger alone is not closing: the reviewers may still be running', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'mugi-closing-ledger-'));
    const m = join(cwd, '.mugiwara', 'missions', 'm1');
    mkdirSync(m, { recursive: true });
    writeFileSync(join(m, 'state.json'), '{}');
    const row = (agent: string) => JSON.stringify({ agent, at: new Date().toISOString(), session_id: 's', mission: 'm1' }) + '\n';
    writeFileSync(join(cwd, '.mugiwara', 'review-dispatch.jsonl'), row('robin-reviewer') + row('jinbe-security'));
    expect(closingPending(cwd)).toBeNull();
  });
});
