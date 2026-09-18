// test/list-check.test.ts — `list --check` stale=N detector (T2).
// Read-only: reports drift, never repairs. Hash-less manifests keep the old
// missing=N-only row; files without a hash entry are staleness-unknown.
import { describe, expect, test, vi, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.ts';
import { fingerprint } from '../src/evidence.ts';

class ExitSignal extends Error {
  code: number;
  constructor(code: number) { super(`exit ${code}`); this.code = code; }
}
const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new ExitSignal(code); }) as never);
afterEach(() => exitSpy.mockClear());

async function capture(args: string[], dir?: string): Promise<{ out: string; err: string }> {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await run(dir ? [...args, '--project', dir] : args);
  } catch (e) {
    if (!(e instanceof ExitSignal)) throw e;
  }
  const out = log.mock.calls.map((c) => c.join(' ')).join('\n');
  const err = errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  log.mockRestore();
  errSpy.mockRestore();
  return { out, err };
}

function manifestDir(manifest: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-listcheck-'));
  mkdirSync(join(dir, '.mugiwara'), { recursive: true });
  writeFileSync(join(dir, '.mugiwara', 'manifest.json'), JSON.stringify(manifest));
  return dir;
}

describe('list --check stale detector', () => {
  test('tampered file prints stale=1 (exact row)', async () => {
    const dir = manifestDir({ version: '0.9.3', scope: 'project', installedAt: '2026-09-17T00:00:00Z', targets: ['claude'], files: [] });
    const f = join(dir, 'skill.md');
    writeFileSync(f, 'original');
    writeFileSync(
      join(dir, '.mugiwara', 'manifest.json'),
      JSON.stringify({ version: '0.9.3', scope: 'project', installedAt: '2026-09-17T00:00:00Z', targets: ['claude'], files: [f], hashes: { [f]: fingerprint('original') } }),
    );
    writeFileSync(f, 'tampered');
    try {
      const { out } = await capture(['list', '--check'], dir);
      expect(out).toMatch(/stale=1/);
      expect(out).toContain(`project: v0.9.3 targets=claude files=1 missing=0 stale=1 installed=2026-09-17T00:00:00Z`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('untouched file prints stale=0', async () => {
    const dir = manifestDir({ version: '0.9.3', scope: 'project', installedAt: '2026-09-17T00:00:00Z', targets: ['claude'], files: [] });
    const f = join(dir, 'skill.md');
    writeFileSync(f, 'original');
    writeFileSync(
      join(dir, '.mugiwara', 'manifest.json'),
      JSON.stringify({ version: '0.9.3', scope: 'project', installedAt: '2026-09-17T00:00:00Z', targets: ['claude'], files: [f], hashes: { [f]: fingerprint('original') } }),
    );
    try {
      const { out } = await capture(['list', '--check'], dir);
      expect(out).toContain('missing=0 stale=0');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('absent file counts as missing, not stale', async () => {
    const f = join(tmpdir(), 'mugi-listcheck-gone.md');
    const dir = manifestDir({
      version: '0.9.3', scope: 'project', installedAt: '2026-09-17T00:00:00Z', targets: ['claude'],
      files: [f], hashes: { [f]: fingerprint('original') },
    });
    try {
      const { out } = await capture(['list', '--check'], dir);
      expect(out).toContain('missing=1 stale=0');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('hash-less manifest keeps missing=N row with no stale= field, no crash', async () => {
    const dir = manifestDir({
      version: '0.7.0', scope: 'project', installedAt: '2026-08-29T00:00:00Z', targets: ['claude'],
      files: ['/tmp/does-not-exist-mugi'],
    });
    try {
      const { out } = await capture(['list', '--check'], dir);
      expect(out).toContain('missing=1');
      expect(out).not.toContain('stale=');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('file without a hash entry is staleness-unknown (uncounted)', async () => {
    const dir = manifestDir({ version: '0.9.3', scope: 'project', installedAt: '2026-09-17T00:00:00Z', targets: ['claude'], files: [] });
    const f = join(dir, 'skill.md');
    writeFileSync(f, 'whatever');
    writeFileSync(
      join(dir, '.mugiwara', 'manifest.json'),
      JSON.stringify({ version: '0.9.3', scope: 'project', installedAt: '2026-09-17T00:00:00Z', targets: ['claude'], files: [f], hashes: {} }),
    );
    try {
      const { out } = await capture(['list', '--check'], dir);
      expect(out).toContain('missing=0 stale=0');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
