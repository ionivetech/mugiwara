// test/installer.test.ts
import { test, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectContent, installTo, removeInstalled, type Target, type InstallOptions } from '../src/installer.ts';

const fakeTarget: Target = {
  id: 'fake', label: 'Fake', native: true,
  paths: ({ scope, projectDir, home }) => ({
    skillsDir: join(scope === 'global' ? home : projectDir, 'sk'),
    agentsDir: join(scope === 'global' ? home : projectDir, 'ag'),
  }),
  transformSkill: (d, b) => ({ relPath: join(d.name, 'SKILL.md'), text: `S:${d.name}\n${b}` }),
  transformAgent: (d, b) => ({ relPath: `${d.name}.md`, text: `A:${d.name}\n${b}` }),
};

const projectDir = mkdtempSync(join(tmpdir(), 'mugi-t-'));
const home = mkdtempSync(join(tmpdir(), 'mugi-h-'));
const opts: InstallOptions = { scope: 'project', projectDir, home, dryRun: false, force: false };

test('collectContent includes all skills and agents', () => {
  const { skills, agents } = collectContent();
  expect(skills.some(s => s.name === 'mugiwara-frontend')).toBe(true);
  expect(skills.some(s => s.name === 'mugiwara-backend')).toBe(true);
  expect(agents.some(a => a.name === 'luffy-orchestrator')).toBe(true);
  expect(skills.length).toBeGreaterThanOrEqual(20);
  expect(agents.length).toBeGreaterThanOrEqual(14);
});

test('installTo writes skills and agents, rerun skips identical', () => {
  const r1 = installTo(fakeTarget, opts);
  expect(r1.written.length).toBeGreaterThanOrEqual(35); // 25 skills + 15 agents
  expect(existsSync(join(projectDir, 'sk', 'mugiwara-workflow', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(projectDir, 'ag', 'luffy-orchestrator.md'))).toBe(true);
  const r2 = installTo(fakeTarget, opts);
  expect(r2.written.length).toBe(0);
  expect(r2.skipped.length).toBe(r1.written.length);
});

test('conflicting file not overwritten without force; backed up with force', () => {
  const f = join(projectDir, 'sk', 'mugiwara-workflow', 'SKILL.md');
  writeFileSync(f, 'USER EDIT');
  const r1 = installTo(fakeTarget, opts);
  expect(readFileSync(f, 'utf8')).toBe('USER EDIT');
  expect(r1.notes.some(n => n.includes('conflict'))).toBe(true);
  const r2 = installTo(fakeTarget, { ...opts, force: true });
  expect(readFileSync(f, 'utf8')).not.toBe('USER EDIT');
  expect(r2.backedUp.length).toBe(1);
});

test('dryRun writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-dry-'));
  const r = installTo(fakeTarget, { ...opts, projectDir: dir, dryRun: true });
  expect(r.written.length).toBeGreaterThan(0);
  expect(existsSync(join(dir, 'sk'))).toBe(false);
});

test('removeInstalled deletes exactly manifest files + prunes empty dirs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-rm-'));
  const r = installTo(fakeTarget, { ...opts, projectDir: dir });
  removeInstalled({ files: r.written }, {});
  expect(existsSync(join(dir, 'sk'))).toBe(false);
  expect(existsSync(join(dir, 'ag'))).toBe(false);
});
