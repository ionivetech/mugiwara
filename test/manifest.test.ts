// test/manifest.test.ts
import { test, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manifestPath, readManifest, writeManifest, type Manifest } from '../src/manifest.ts';

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
  const data: Manifest = { version: '0.1.0', scope: 'project', type: 'general', installedAt: 'x', targets: ['claude'], files: ['/a/b.md'] };
  writeManifest(file, data);
  expect(readManifest(file)).toEqual(data);
});
