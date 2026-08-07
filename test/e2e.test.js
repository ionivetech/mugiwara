// test/e2e.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BIN = join(import.meta.dirname, '..', 'bin', 'mugiwara.js');
const runCli = args => execFileSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });

test('install claude project scope, then uninstall clean', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'claude', '--type', 'frontend', '--yes']);
  assert.ok(existsSync(join(proj, '.claude', 'skills', 'mugiwara-workflow', 'SKILL.md')));
  assert.ok(existsSync(join(proj, '.claude', 'agents', 'luffy-orchestrator.md')));
  assert.ok(existsSync(join(proj, '.claude', 'skills', 'mugiwara-frontend', 'SKILL.md')));
  assert.ok(existsSync(join(proj, '.mugiwara', 'manifest.json')));
  runCli(['uninstall', '--project', proj, '--yes']);
  assert.ok(!existsSync(join(proj, '.claude', 'skills', 'mugiwara-workflow')));
  assert.ok(!existsSync(join(proj, '.mugiwara', 'manifest.json')));
});

test('backend type excludes frontend skill', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'opencode', '--type', 'backend', '--yes']);
  assert.ok(!existsSync(join(proj, '.opencode', 'skills', 'mugiwara-frontend')));
  assert.ok(existsSync(join(proj, '.opencode', 'skills', 'mugiwara-planning', 'SKILL.md')));
});

test('tier-2 target installs flat rule files (project scope)', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'cline', '--type', 'general', '--yes']);
  assert.ok(existsSync(join(proj, '.clinerules', 'mugiwara-workflow.md')));
  assert.ok(existsSync(join(proj, '.clinerules', 'agent-luffy-orchestrator.md')));
});

test('dry-run writes nothing', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'claude', '--type', 'general', '--yes', '--dry-run']);
  assert.ok(!existsSync(join(proj, '.claude')));
});

test('version and unknown flag behavior', () => {
  assert.match(runCli(['--version']), /mugiwara \d+\.\d+\.\d+/);
  assert.throws(() => runCli(['--bogus']), /Unknown flag/i);
});
