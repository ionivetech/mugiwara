import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manifestPath, readManifest, writeManifest } from '../src/manifest.js';

const home = mkdtempSync(join(tmpdir(), 'mugi-home-'));
const proj = mkdtempSync(join(tmpdir(), 'mugi-proj-'));

test('manifestPath project vs global', () => {
  assert.equal(manifestPath({ scope: 'project', projectDir: proj, home }), join(proj, '.mugiwara', 'manifest.json'));
  assert.equal(manifestPath({ scope: 'global', projectDir: proj, home }), join(home, '.mugiwara', 'manifest.json'));
});

test('readManifest returns null when absent', () => {
  assert.equal(readManifest(join(proj, 'nope.json')), null);
});

test('write then read roundtrip', () => {
  const file = manifestPath({ scope: 'project', projectDir: proj, home });
  const data = { version: '0.1.0', scope: 'project', type: 'general', installedAt: 'x', targets: ['claude'], files: ['/a/b.md'] };
  writeManifest(file, data);
  assert.deepEqual(readManifest(file), data);
});
