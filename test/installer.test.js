// test/installer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectContent, installTo, removeInstalled } from '../src/installer.js';

const fakeTarget = {
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
const opts = { scope: 'project', projectDir, home, type: 'frontend', dryRun: false, force: false };

test('collectContent includes frontend for frontend type', () => {
  const { skills, agents } = collectContent({ includeFrontend: true });
  assert.ok(skills.some(s => s.name === 'mugiwara-frontend'));
  assert.ok(agents.some(a => a.name === 'luffy-orchestrator'));
});

test('collectContent excludes frontend when gated', () => {
  const { skills } = collectContent({ includeFrontend: false });
  assert.ok(!skills.some(s => s.name === 'mugiwara-frontend'));
});

test('installTo writes skills and agents, rerun skips identical', () => {
  const r1 = installTo(fakeTarget, opts);
  assert.ok(r1.written.length >= 21); // 11 skills (frontend incl) + 10 agents
  assert.ok(existsSync(join(projectDir, 'sk', 'mugiwara-workflow', 'SKILL.md')));
  assert.ok(existsSync(join(projectDir, 'ag', 'luffy-orchestrator.md')));
  const r2 = installTo(fakeTarget, opts);
  assert.equal(r2.written.length, 0);
  assert.equal(r2.skipped.length, r1.written.length);
});

test('conflicting file not overwritten without force; backed up with force', () => {
  const f = join(projectDir, 'sk', 'mugiwara-workflow', 'SKILL.md');
  writeFileSync(f, 'USER EDIT');
  const r1 = installTo(fakeTarget, opts);
  assert.equal(readFileSync(f, 'utf8'), 'USER EDIT');
  assert.ok(r1.notes.some(n => n.includes('conflict')));
  const r2 = installTo(fakeTarget, { ...opts, force: true });
  assert.notEqual(readFileSync(f, 'utf8'), 'USER EDIT');
  assert.equal(r2.backedUp.length, 1);
});

test('dryRun writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-dry-'));
  const r = installTo(fakeTarget, { ...opts, projectDir: dir, dryRun: true });
  assert.ok(r.written.length > 0);
  assert.ok(!existsSync(join(dir, 'sk')));
});

test('removeInstalled deletes exactly manifest files + prunes empty dirs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-rm-'));
  const r = installTo(fakeTarget, { ...opts, projectDir: dir });
  removeInstalled({ files: r.written }, {});
  assert.ok(!existsSync(join(dir, 'sk')));
  assert.ok(!existsSync(join(dir, 'ag')));
});
