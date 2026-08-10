// test/targets.test.ts
import { test, expect } from 'vitest';
import { targets, TARGET_IDS } from '../src/targets/index.ts';
import { parseFrontmatter } from '../src/frontmatter.ts';

test('registry has 9 targets', () => {
  expect(TARGET_IDS).toEqual(['claude', 'opencode', 'copilot', 'gemini', 'codex', 'windsurf', 'cline', 'kilo', 'antigravity']);
});

test('every adapter has the full interface', () => {
  for (const t of Object.values(targets)) {
    expect(t.id && t.label).toBeTruthy();
    expect(typeof t.native).toBe('boolean');
    expect(typeof t.paths).toBe('function');
    expect(typeof t.transformSkill).toBe('function');
    expect(typeof t.transformAgent).toBe('function');
  }
});

test('native adapters resolve project and global scopes', () => {
  for (const id of ['claude', 'opencode', 'copilot']) {
    const p = targets[id].paths({ scope: 'project', projectDir: '/p', home: '/h' });
    const g = targets[id].paths({ scope: 'global', projectDir: '/p', home: '/h' });
    expect(p.skillsDir && p.agentsDir && g.skillsDir && g.agentsDir).toBeTruthy();
  }
});

test('tier-2 adapters reject global scope', () => {
  for (const id of ['gemini', 'codex', 'windsurf', 'cline', 'kilo', 'antigravity']) {
    expect(() => targets[id].paths({ scope: 'global', projectDir: '/p', home: '/h' })).toThrow(/project scope only/i);
  }
});

test('transforms produce relPath + text; native skills keep parseable frontmatter', () => {
  const skill = { name: 'mugiwara-workflow', description: 'Use at mission start for the crew pipeline.' };
  for (const t of Object.values(targets)) {
    const out = t.transformSkill(skill, 'BODY\n');
    expect(out!.relPath.endsWith('.md')).toBe(true);
    expect(out!.text.includes('BODY')).toBe(true);
  }
  const claudeOut = targets.claude.transformSkill(skill, 'BODY\n');
  expect(parseFrontmatter(claudeOut!.text).data.name).toBe('mugiwara-workflow');
});
