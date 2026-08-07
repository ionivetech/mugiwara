import test from 'node:test';
import assert from 'node:assert/strict';
import { targets, TARGET_IDS } from '../src/targets/index.js';
import { parseFrontmatter } from '../src/frontmatter.js';

test('registry has 9 targets', () => {
  assert.deepEqual(TARGET_IDS, ['claude', 'opencode', 'copilot', 'gemini', 'codex', 'windsurf', 'cline', 'kilo', 'antigravity']);
});

test('every adapter has the full interface', () => {
  for (const t of Object.values(targets)) {
    assert.ok(t.id && t.label);
    assert.equal(typeof t.native, 'boolean');
    assert.equal(typeof t.paths, 'function');
    assert.equal(typeof t.transformSkill, 'function');
    assert.equal(typeof t.transformAgent, 'function');
  }
});

test('native adapters resolve project and global scopes', () => {
  for (const id of ['claude', 'opencode', 'copilot']) {
    const p = targets[id].paths({ scope: 'project', projectDir: '/p', home: '/h' });
    const g = targets[id].paths({ scope: 'global', projectDir: '/p', home: '/h' });
    assert.ok(p.skillsDir && p.agentsDir && g.skillsDir && g.agentsDir, id);
  }
});

test('tier-2 adapters reject global scope', () => {
  for (const id of ['gemini', 'codex', 'windsurf', 'cline', 'kilo', 'antigravity']) {
    assert.throws(() => targets[id].paths({ scope: 'global', projectDir: '/p', home: '/h' }), /project scope only/i, id);
  }
});

test('transforms produce relPath + text; native skills keep parseable frontmatter', () => {
  const skill = { name: 'mugiwara-workflow', description: 'Use at mission start for the crew pipeline.' };
  for (const t of Object.values(targets)) {
    const out = t.transformSkill(skill, 'BODY\n');
    assert.ok(out.relPath.endsWith('.md'), t.id);
    assert.ok(out.text.includes('BODY'), t.id);
  }
  const claudeOut = targets.claude.transformSkill(skill, 'BODY\n');
  assert.equal(parseFrontmatter(claudeOut.text).data.name, 'mugiwara-workflow');
});
