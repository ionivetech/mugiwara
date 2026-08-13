// test/targets.test.ts
import { test, expect } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { targets, TARGET_IDS } from '../src/targets/index.ts';
import { parseFrontmatter } from '../src/frontmatter.ts';
import { installTo } from '../src/installer.ts';

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
    if (t.tier !== 3) expect(out!.text.includes('BODY'), `${t.id} embeds body`).toBe(true);
    if (t.transformSkillFull) {
      const full = t.transformSkillFull(skill, 'BODY\n');
      if (t.tier === 3) {
        expect(full, `${t.id} full ref`).not.toBeNull();
        expect(full!.text.includes('BODY'), `${t.id} full ref embeds body`).toBe(true);
      }
    }
  }
  const claudeOut = targets.claude.transformSkill(skill, 'BODY\n');
  expect(parseFrontmatter(claudeOut!.text).data.name).toBe('mugiwara-workflow');
});

test('L1: claude transformAgent generates tools from write-scope', () => {
  const artifacts = targets.claude.transformAgent(
    { name: 'usopp-brainstorm', description: 'x', 'write-scope': 'artifacts' } as never,
    'BODY\n'
  )!;
  const source = targets.claude.transformAgent(
    { name: 'zoro-execution', description: 'x', 'write-scope': 'source' } as never,
    'BODY\n'
  )!;
  const a = parseFrontmatter(artifacts.text).data;
  const s = parseFrontmatter(source.text).data;
  expect(a.tools).toBe('Read, Grep, Glob, Write, Bash');
  expect(a.tools).not.toContain('Edit');
  expect(s.tools).toBeUndefined();
});

test('0-8 conformance: every target install lands skills, agents, and references', () => {
  for (const id of TARGET_IDS) {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-conf-' + id + '-'));
    const home = mkdtempSync(join(tmpdir(), 'mugi-confhome-' + id + '-'));
    const t = targets[id];
    const r = installTo(t, { scope: 'project', projectDir: dir, home, dryRun: false, force: false });

    // files were written for real
    expect(r.written.length, `${id}: wrote files`).toBeGreaterThan(0);
    const { skillsDir, agentsDir } = t.paths({ scope: 'project', projectDir: dir, home });
    expect(existsSync(skillsDir), `${id}: skills dir exists`).toBe(true);

    // skill files land under the skills dir
    const skillFiles = readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() || e.name.endsWith('.md'))
      .map(e => e.name);
    expect(skillFiles.some(n => n.includes('mugiwara-workflow')), `${id}: workflow skill present`).toBe(true);
    expect(skillFiles.some(n => n.includes('mugiwara-frontend')), `${id}: frontend skill present`).toBe(true);

    // agents land
    if (agentsDir && agentsDir !== skillsDir && existsSync(agentsDir)) {
      const agentFiles = readdirSync(agentsDir);
      expect(agentFiles.some(n => n.includes('luffy-orchestrator')), `${id}: luffy agent present`).toBe(true);
    }

    // references/ land per target refsDir (0-7)
    if (t.refsDir) {
      const refsRoot = t.refsDir({ scope: 'project', projectDir: dir, home }, 'mugiwara-frontend');
      const checklist = join(refsRoot, 'checklist.md');
      expect(existsSync(checklist), `${id}: frontend checklist reference installed`).toBe(true);
      expect(statSync(checklist).isFile(), `${id}: checklist is a real file`).toBe(true);
    }
  }
});

test('0-8 conformance: native targets expose parseable frontmatter on installed skills', () => {
  for (const id of ['claude', 'opencode', 'copilot']) {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-fm-' + id + '-'));
    const home = mkdtempSync(join(tmpdir(), 'mugi-fmhome-' + id + '-'));
    installTo(targets[id], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
    const { skillsDir } = targets[id].paths({ scope: 'project', projectDir: dir, home });
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    const dirNames = entries.filter(e => e.isDirectory()).map(e => e.name);
    const fileNames = entries.filter(e => e.isFile()).map(e => e.name);
    expect(dirNames.concat(fileNames).some(n => n.includes('mugiwara-workflow')), `${id}: workflow present`).toBe(true);
    for (const n of dirNames.slice(0, 5)) {
      const file = join(skillsDir, n, 'SKILL.md');
      if (!existsSync(file)) continue;
      const { data } = parseFrontmatter(require('node:fs').readFileSync(file, 'utf8'));
      expect(data.name, `${id}/${n} frontmatter name`).toBe(n);
    }
  }
});

test('2-16 tier-3 targets emit stubs to the rules glob and full bodies to refs', () => {
  for (const id of ['kilo', 'windsurf', 'cline', 'antigravity']) {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-tier3-' + id + '-'));
    const home = mkdtempSync(join(tmpdir(), 'mugi-tier3home-' + id + '-'));
    const t = targets[id];
    expect(t.tier, `${id} is tier 3`).toBe(3);
    const r = installTo(t, { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
    expect(r.written.length, `${id}: wrote files`).toBeGreaterThan(0);
    const { skillsDir } = t.paths({ scope: 'project', projectDir: dir, home });

    const stub = readFileSync(join(skillsDir, 'mugiwara-workflow.md'), 'utf8');
    expect(stub.length, `${id} stub is small`).toBeLessThan(400);
    expect(stub).toContain('.mugiwara/refs/mugiwara-workflow.md');

    const full = readFileSync(join(dir, '.mugiwara', 'refs', 'mugiwara-workflow.md'), 'utf8');
    expect(full.length, `${id} full body in refs`).toBeGreaterThan(2000);

    const agentStub = readFileSync(join(skillsDir, 'agent-luffy-orchestrator.md'), 'utf8');
    expect(agentStub).toContain('.mugiwara/refs/luffy-orchestrator.md');
  }
});

test('2-16 tier-2 targets keep full bodies in the rules dir (bootstrap pointer)', () => {
  for (const id of ['gemini', 'codex']) {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-tier2-' + id + '-'));
    const home = mkdtempSync(join(tmpdir(), 'mugi-tier2home-' + id + '-'));
    const t = targets[id];
    expect(t.tier, `${id} is tier 2`).toBe(2);
    installTo(t, { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
    const { skillsDir } = t.paths({ scope: 'project', projectDir: dir, home });
    const body = readFileSync(join(skillsDir, 'mugiwara-workflow.md'), 'utf8');
    expect(body.length, `${id} full body in rules dir`).toBeGreaterThan(2000);
  }
});

test('write-boundary: opencode artifacts agent gets deny-all-edit except .mugiwara/** (cases 2+4)', () => {
  const out = targets.opencode.transformAgent(
    { name: 'usopp-brainstorm', description: 'x', 'write-scope': 'artifacts' } as never,
    'BODY\n'
  )!;
  expect(out.text).toContain('permission:');
  expect(out.text).toContain('edit:');
  expect(out.text).toContain('"*": deny');
  expect(out.text).toContain('".mugiwara/**": allow');
});

test('write-boundary: opencode source agent gets full edit allow (case 5)', () => {
  const out = targets.opencode.transformAgent(
    { name: 'zoro-execution', description: 'x', 'write-scope': 'source' } as never,
    'BODY\n'
  )!;
  expect(out.text).toContain('edit: allow');
});

test('write-boundary: tier-3 agent stub carries the prose refusal (case 3)', () => {
  // tier-3 targets (windsurf/cline/kilo/antigravity) emit agent stubs; the
  // generic transform hardcodes the source-write refusal in the stub.
  // tier-2 targets (gemini/codex) emit full agent bodies (not stubs), so the
  // refusal line lives only in the tier-3 stub branch.
  for (const id of ['windsurf', 'cline', 'kilo', 'antigravity']) {
    const t = targets[id];
    const out = t.transformAgent({ name: 'usopp-brainstorm', description: 'x', skills: 'mugiwara-brainstorm' } as never, 'BODY\n')!;
    expect(out.text, `${id} refusal line`).toContain('Only zoro-execution and brook-healing may modify source code');
  }
});
