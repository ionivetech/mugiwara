// test/manifest.test.ts
import { test, expect } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manifestPath, readManifest, writeManifest, type Manifest } from '../src/manifest.ts';
import { fingerprint } from '../src/evidence.ts';

const home = mkdtempSync(join(tmpdir(), 'mugi-home-'));
const proj = mkdtempSync(join(tmpdir(), 'mugi-proj-'));

test('manifestPath project vs global', () => {
  expect(manifestPath({ scope: 'project', projectDir: proj, home })).toBe(join(proj, '.mugiwara', 'manifest.json'));
  expect(manifestPath({ scope: 'global', projectDir: proj, home })).toBe(join(home, '.mugiwara', 'manifest.json'));
});

test('readManifest returns null when absent', () => {
  expect(readManifest(join(proj, 'nope.json'))).toBeNull();
});

test('write then read roundtrip', () => {
  const file = manifestPath({ scope: 'project', projectDir: proj, home });
  const data: Manifest = { version: '0.1.0', scope: 'project', installedAt: 'x', targets: ['claude'], files: ['/a/b.md'] };
  writeManifest(file, data);
  expect(readManifest(file)).toEqual(data);
});

test('fingerprint is sha256 hex (exact value)', () => {
  expect(fingerprint('x')).toBe('2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881');
});

test('hashes round-trip exact', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'mugi-hash-')), 'manifest.json');
  const data: Manifest = {
    version: '0.9.3', scope: 'project', installedAt: '2026-09-17T00:00:00Z',
    targets: ['claude'], files: ['/a/b.md'],
    hashes: { '/a/b.md': '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881' },
  };
  writeManifest(file, data);
  const back = readManifest(file);
  expect(back?.hashes).toEqual({ '/a/b.md': '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881' });
});

test('hash-less manifest reads as staleness-unknown (no hashes key)', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'mugi-nohash-')), 'manifest.json');
  const data: Manifest = { version: '0.9.3', scope: 'project', installedAt: 'y', targets: ['claude'], files: ['/a/b.md'] };
  writeManifest(file, data);
  const back = readManifest(file);
  expect(back?.files).toEqual(['/a/b.md']);
  expect(back?.hashes).toBeUndefined();
});
