// test/installer.test.ts
import { test, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectContent, installTo, removeInstalled, type Target, type InstallOptions } from '../src/installer.ts';
import { targets } from '../src/targets/index.ts';

const fakeTarget: Target = {
  id: 'fake', label: 'Fake', native: true,
  paths: ({ scope, projectDir, home }) => ({
    skillsDir: join(scope === 'global' ? home : projectDir, 'sk'),
    agentsDir: join(scope === 'global' ? home : projectDir, 'ag'),
  }),
  transformSkill: (d, b) => ({ relPath: join(d.name, 'SKILL.md'), text: `S:${d.name}\n${b}` }),
  transformAgent: (d, b) => ({ relPath: `${d.name}.md`, text: `A:${d.name}\n${b}` }),
  refsDir: ({ projectDir }) => join(projectDir, 'refs'),
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

test('references/ files are collected from content', () => {
  const { skills } = collectContent();
  const frontend = skills.find(s => s.name === 'mugiwara-frontend')!;
  expect(frontend.refs.some(r => r.relPath === 'checklist.md')).toBe(true);
  expect(frontend.refs.some(r => r.text.includes('WCAG'))).toBe(true);
});

test('installTo writes references/ into the target refs dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-refs-'));
  const r = installTo(fakeTarget, { ...opts, projectDir: dir });
  const checklist = join(dir, 'refs', 'checklist.md');
  expect(existsSync(checklist)).toBe(true);
  expect(readFileSync(checklist, 'utf8')).toContain('WCAG');
  expect(r.written).toContain(checklist);
});

test('claude install writes references under the skill dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-refclaude-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-refchome-'));
  installTo(targets['claude'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const checklist = join(dir, '.claude', 'skills', 'mugiwara-frontend', 'references', 'checklist.md');
  expect(existsSync(checklist)).toBe(true);
  expect(readFileSync(checklist, 'utf8')).toContain('WCAG');
});

test('generic install keeps references outside the rules glob', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-refgen-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-refghome-'));
  installTo(targets['gemini'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const rulesDir = join(dir, '.gemini', 'mugiwara');
  expect(existsSync(join(rulesDir, 'mugiwara-frontend.md'))).toBe(true);
  expect(existsSync(join(dir, '.mugiwara', 'refs', 'checklist.md'))).toBe(true);
  expect(existsSync(join(rulesDir, 'mugiwara-frontend', 'references', 'checklist.md'))).toBe(false);
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

test('session-start hook carries inline doctrine, no "dispatch crew" language', () => {
  const hook = readFileSync(join(import.meta.dirname, '..', 'hooks', 'session-start.ts'), 'utf8');
  expect(hook).toContain('inline');
  expect(hook).toContain('Never Task-dispatch a crew member');
  expect(hook).not.toMatch(/dispatch.*using-mugiwara/);
});

test('CLI install targets never force background mode on agents (opencode agents get mode: all for native config)', () => {
  const { agents } = collectContent();
  const luffy = agents.find(a => a.name === 'luffy-orchestrator')!;
  for (const id of ['claude', 'copilot']) {
    const out = targets[id].transformAgent(luffy.data, luffy.body);
    expect(out, `${id} transformAgent output`).not.toBeNull();
    expect(out!.text).not.toMatch(/^mode:/m);
  }
  const opencodeOut = targets['opencode'].transformAgent(luffy.data, luffy.body);
  expect(opencodeOut, `opencode transformAgent output`).not.toBeNull();
  expect(opencodeOut!.text).toMatch(/^mode: all/m);
});

test('generic target installs workflow skill with inline doctrine', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-gen-'));
  const { skills, agents } = collectContent();
  const workflow = skills.find(s => s.name === 'mugiwara-workflow')!;
  const out = targets['gemini'].transformSkill(workflow.data, workflow.body);
  expect(out).not.toBeNull();
  expect(out!.text).toContain('Inline by default');
  const luffy = agents.find(a => a.name === 'luffy-orchestrator')!;
  const agentOut = targets['gemini'].transformAgent(luffy.data, luffy.body);
  expect(agentOut!.text).toContain('Agent: luffy-orchestrator');
});

test('claude target postInstall wires the SessionStart hook', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-claude-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-chome-'));
  const r = installTo(targets['claude'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const hook = join(dir, '.claude', 'hooks', 'session-start.ts');
  expect(existsSync(hook)).toBe(true);
  expect(readFileSync(hook, 'utf8')).toContain('Never Task-dispatch a crew member');
  expect(r.written).toContain(hook);
});
