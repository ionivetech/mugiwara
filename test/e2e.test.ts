// test/e2e.test.ts
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist', 'mugiwara.js');
if (!existsSync(DIST)) {
  execFileSync('bun', ['build', 'src/cli.ts', '--outfile', 'dist/mugiwara.js', '--target', 'node', '--format', 'esm'], { cwd: join(import.meta.dirname, '..') });
}

const runCli = (args: string[]) => execFileSync(process.execPath, [DIST, ...args], { encoding: 'utf8' });

test('install claude project scope, then uninstall clean', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'claude', '--yes']);
  expect(existsSync(join(proj, '.claude', 'skills', 'mugiwara-workflow', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(proj, '.claude', 'agents', 'luffy-orchestrator.md'))).toBe(true);
  expect(existsSync(join(proj, '.claude', 'skills', 'mugiwara-frontend', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(proj, '.mugiwara', 'manifest.json'))).toBe(true);
  runCli(['uninstall', '--project', proj, '--yes']);
  expect(existsSync(join(proj, '.claude', 'skills', 'mugiwara-workflow'))).toBe(false);
  expect(existsSync(join(proj, '.mugiwara', 'manifest.json'))).toBe(false);
});

test('all skills installed for opencode project scope', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'opencode', '--yes']);
  expect(existsSync(join(proj, '.opencode', 'skills', 'mugiwara-frontend', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(proj, '.opencode', 'skills', 'mugiwara-planning', 'SKILL.md'))).toBe(true);
});

test('tier-2 target installs flat rule files (project scope)', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'cline', '--yes']);
  expect(existsSync(join(proj, '.clinerules', 'mugiwara-workflow.md'))).toBe(true);
  expect(existsSync(join(proj, '.clinerules', 'agent-luffy-orchestrator.md'))).toBe(true);
});

test('dry-run writes nothing', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'claude', '--yes', '--dry-run']);
  expect(existsSync(join(proj, '.claude'))).toBe(false);
});

test('version and unknown flag behavior', () => {
  expect(runCli(['--version'])).toMatch(/mugiwara \d+\.\d+\.\d+/);
  expect(() => runCli(['--bogus'])).toThrow(/Unknown flag/i);
});

test('skills command lists skills with skills.sh install hint', () => {
  const out = runCli(['skills']);
  expect(out).toMatch(/mugiwara-workflow/);
  expect(out).toMatch(/mugiwara-dynamic-workflow/);
  expect(out).toMatch(/npx skills add ionivetech\/mugiwara/);
});
