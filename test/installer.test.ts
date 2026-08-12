// test/installer.test.ts
import { test, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter } from '../src/frontmatter.ts';
import { resetMission } from '../src/mission.ts';
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

test('collectContent includes shared references from root references/', () => {
  const { sharedRefs } = collectContent();
  expect(sharedRefs.length).toBeGreaterThanOrEqual(5);
  const names = sharedRefs.map(r => r.relPath).sort();
  expect(names).toContain('source-grounding.md');
  expect(names).toContain('definition-of-done.md');
  expect(names).toContain('skill-versioning.md');
  expect(names).toContain('token-budget.md');
  expect(names).toContain('multi-actor.md');
});

test('installTo writes shared references to _shared/references/ (tier 1)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-shared-'));
  // fakeTarget has no tier, defaults to tier 1 path
  const r = installTo(fakeTarget, { ...opts, projectDir: dir });
  const sourceGrounding = join(dir, 'sk', '_shared', 'references', 'source-grounding.md');
  const dod = join(dir, 'sk', '_shared', 'references', 'definition-of-done.md');
  expect(existsSync(sourceGrounding)).toBe(true);
  expect(existsSync(dod)).toBe(true);
  expect(readFileSync(sourceGrounding, 'utf8')).toContain('source');
  expect(r.written).toContain(sourceGrounding);
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
  expect(r1.written.length).toBeGreaterThanOrEqual(35); // 25 skills + 15 agents + refs
  expect(existsSync(join(projectDir, 'sk', 'mugiwara-workflow', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(projectDir, 'ag', 'luffy-orchestrator.md'))).toBe(true);
  const r2 = installTo(fakeTarget, opts);
  expect(r2.written.length).toBe(0);
  expect(r2.skipped.length).toBeGreaterThanOrEqual(r1.written.length - 2);
});

test('conflicting file not overwritten without force; backed up with force', () => {
  const f = join(projectDir, 'sk', 'mugiwara-workflow', 'SKILL.md');
  writeFileSync(f, 'USER EDIT');
  const r1 = installTo(fakeTarget, opts);
  expect(readFileSync(f, 'utf8')).toBe('USER EDIT');
  expect(r1.notes.some(n => n.includes('conflict'))).toBe(true);
  const r2 = installTo(fakeTarget, { ...opts, force: true });
  expect(readFileSync(f, 'utf8')).not.toBe('USER EDIT');
  expect(r2.backedUp.length).toBeGreaterThanOrEqual(1);
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

test('session-start hook carries default-on doctrine, directs to mugiwara-orchestration', () => {
  const hook = readFileSync(join(import.meta.dirname, '..', 'hooks', 'session-start.ts'), 'utf8');
  expect(hook).toContain('mugiwara off');
  expect(hook).toContain('mugiwara-orchestration');
  expect(hook).toContain('Wave 0 triage');
  expect(hook).toContain('Lane 0');
});

test('mode-tracker hook can parse /mugiwara guided|semi|auto via regex', () => {
  const hook = readFileSync(join(import.meta.dirname, '..', 'hooks', 'mugiwara-mode-tracker.ts'), 'utf8');
  expect(hook).toContain('parseModeChange');
  expect(hook).toContain('/mugiwara');
  expect(hook).toContain('VALID_MODES');
  expect(hook).toContain('applyModeChange');
});

test('hooks.json has SessionStart and UserPromptSubmit', () => {
  const raw = readFileSync(join(import.meta.dirname, '..', 'hooks', 'hooks.json'), 'utf8');
  const hooks = JSON.parse(raw);
  expect(hooks.hooks.SessionStart).toBeDefined();
  expect(hooks.hooks.UserPromptSubmit).toBeDefined();
  expect(hooks.hooks.UserPromptSubmit[0].hooks[0].command).toContain('mugiwara-mode-tracker');
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
  expect(readFileSync(hook, 'utf8')).toContain('mugiwara off');
  expect(r.written).toContain(hook);
  const mode = statSync(hook).mode;
  expect(mode & 0o111).not.toBe(0);
});

test('claude postInstall dryRun does not write hook', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-cldry-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-chdry-'));
  const r = installTo(targets['claude'], { scope: 'project', projectDir: dir, home, dryRun: true, force: false });
  const hook = join(dir, '.claude', 'hooks', 'session-start.ts');
  expect(existsSync(hook)).toBe(false);
  expect(r.written).not.toContain(hook);
});

test('copilot install writes .instructions.md skills and agent .md files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-copilot-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-cphome-'));
  const r = installTo(targets['copilot'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const skillFile = join(dir, '.github', 'instructions', 'mugiwara-workflow.instructions.md');
  expect(existsSync(skillFile)).toBe(true);
  expect(readFileSync(skillFile, 'utf8')).toContain('Inline by default');
  expect(readFileSync(skillFile, 'utf8')).toContain('applyTo: **/*');
  const agentFile = join(dir, '.github', 'agents', 'luffy-orchestrator.md');
  expect(existsSync(agentFile)).toBe(true);
  expect(r.written.length).toBeGreaterThanOrEqual(35);
});

test('copilot transformSkill wraps with applyTo glob', () => {
  const { skills } = collectContent();
  const wf = skills.find(s => s.name === 'mugiwara-workflow')!;
  const out = targets['copilot'].transformSkill(wf.data, wf.body);
  expect(out!.relPath).toContain('.instructions.md');
  expect(out!.text).toMatch(/^description: /m);
  expect(out!.text).toMatch(/applyTo: \*\*\/\*/);
});

test('codex tier-2 writes full body skills and bootstrap AGENTS.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-codex-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-cxhome-'));
  const r = installTo(targets['codex'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const skill = join(dir, '.codex', 'mugiwara', 'mugiwara-workflow.md');
  expect(existsSync(skill)).toBe(true);
  expect(readFileSync(skill, 'utf8')).toContain('Inline by default');
  const bootstrap = join(dir, 'AGENTS.md');
  expect(existsSync(bootstrap)).toBe(true);
  expect(readFileSync(bootstrap, 'utf8')).toContain('Mugiwara crew installed');
  expect(r.written).toContain(bootstrap);
});

test('codex bootstrap does not overwrite existing AGENTS.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-cxexist-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-cxeh-'));
  writeFileSync(join(dir, 'AGENTS.md'), 'EXISTING');
  const r = installTo(targets['codex'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toBe('EXISTING');
  expect(r.notes.some(n => n.includes('AGENTS.md'))).toBe(true);
});

test('claude postInstall skips hook if already exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-clexist-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-clexh-'));
  // first install creates hook, second install skips it
  installTo(targets['claude'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const hook = join(dir, '.claude', 'hooks', 'session-start.ts');
  expect(existsSync(hook)).toBe(true);
  const original = readFileSync(hook, 'utf8');
  const r2 = installTo(targets['claude'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  expect(r2.written).not.toContain(hook);
  expect(readFileSync(hook, 'utf8')).toBe(original);
});

test('gemini tier-2 writes full body + bootstrap GEMINI.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-gem-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-gemh-'));
  const r = installTo(targets['gemini'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const skill = join(dir, '.gemini', 'mugiwara', 'mugiwara-workflow.md');
  expect(existsSync(skill)).toBe(true);
  expect(readFileSync(skill, 'utf8')).toContain('Inline by default');
  const bootstrap = join(dir, 'GEMINI.md');
  expect(existsSync(bootstrap)).toBe(true);
  expect(readFileSync(bootstrap, 'utf8')).toContain('Mugiwara crew installed');
});

test('windsurf tier-3 writes stubs only, full body in .mugiwara/refs/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-wind-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-wh-'));
  const r = installTo(targets['windsurf'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const stub = join(dir, '.devin', 'rules', 'mugiwara-workflow.md');
  expect(existsSync(stub)).toBe(true);
  const stubText = readFileSync(stub, 'utf8');
  expect(stubText).toContain('Skip when');
  expect(stubText).toContain('.mugiwara/refs/mugiwara-workflow.md');
  expect(stubText).not.toContain('Inline by default');
  const full = join(dir, '.mugiwara', 'refs', 'mugiwara-workflow.md');
  expect(existsSync(full)).toBe(true);
  expect(readFileSync(full, 'utf8')).toContain('Inline by default');
});

test('cline tier-3 writes stubs into .clinerules/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-cline-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-clh-'));
  installTo(targets['cline'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const stub = join(dir, '.clinerules', 'mugiwara-workflow.md');
  expect(existsSync(stub)).toBe(true);
  expect(readFileSync(stub, 'utf8')).toContain('Skip when');
});

test('kilo tier-3 writes stubs + kilo.jsonc bootstrap', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-kilo-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-kh-'));
  const r = installTo(targets['kilo'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const stub = join(dir, '.kilo', 'rules', 'mugiwara-workflow.md');
  expect(existsSync(stub)).toBe(true);
  expect(readFileSync(stub, 'utf8')).toContain('Skip when');
  const cfg = join(dir, 'kilo.jsonc');
  expect(existsSync(cfg)).toBe(true);
  expect(readFileSync(cfg, 'utf8')).toContain('.kilo/rules/*.md');
  expect(r.written).toContain(cfg);
});

test('antigravity tier-3 writes stubs into .agents/rules/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-ag-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-agh-'));
  installTo(targets['antigravity'], { scope: 'project', projectDir: dir, home, dryRun: false, force: false });
  const stub = join(dir, '.agents', 'rules', 'mugiwara-workflow.md');
  expect(existsSync(stub)).toBe(true);
  expect(readFileSync(stub, 'utf8')).toContain('Skip when');
});

test('generic target globalscope throws for non-native targets', () => {
  for (const id of ['codex', 'gemini', 'windsurf', 'cline', 'kilo', 'antigravity']) {
    expect(() => targets[id].paths({ scope: 'global', projectDir: '/tmp', home: '/home' }))
      .toThrow(/project scope only/);
  }
});

test('all plugin manifests exist at expected paths', () => {
  const root = join(import.meta.dirname, '..');
  const manifests = [
    ['.claude-plugin/plugin.json', 'metadata'],
    ['.claude-plugin/marketplace.json', 'plugins'],
    ['.codex-plugin/plugin.json', 'skills'],
    ['.cursor-plugin/plugin.json', 'skills'],
    ['.kimi-plugin/plugin.json', 'skills'],
    ['.agents/plugins/marketplace.json', 'plugins'],
    ['gemini-extension.json', 'contextFileName'],
    ['plugin.json', 'name'],
  ];
  for (const [path, key] of manifests) {
    const file = join(root, path);
    expect(existsSync(file), `${path} must exist`).toBe(true);
    const raw = readFileSync(file, 'utf8');
    const obj = JSON.parse(raw);
    expect(obj, `${path} must be valid JSON with ${key}`).toHaveProperty(key);
  }
});

test('gemini-extension.json points to GEMINI.md', () => {
  const root = join(import.meta.dirname, '..');
  const ext = JSON.parse(readFileSync(join(root, 'gemini-extension.json'), 'utf8'));
  expect(ext.contextFileName).toBe('GEMINI.md');
  expect(existsSync(join(root, 'GEMINI.md'))).toBe(true);
});

test('npm package list matches files array (no stale entries, no missing manifests)', () => {
  const root = join(import.meta.dirname, '..');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const files: string[] = pkg.files;
  expect(files).toContain('dist');
  expect(files).toContain('content');
  expect(files).toContain('.opencode');
  expect(files).toContain('.claude-plugin');
  expect(files).toContain('.codex-plugin');
  expect(files).toContain('.cursor-plugin');
  expect(files).toContain('.kimi-plugin');
  expect(files).toContain('.agents');
  expect(files).toContain('gemini-extension.json');
  expect(files).toContain('GEMINI.md');
  expect(files).toContain('AGENTS.md');
  expect(files).toContain('plugin.json');
});

test('parseFrontmatter rejects missing fence', () => {
  expect(() => parseFrontmatter('no frontmatter here')).toThrow('Missing frontmatter fence');
});

test('parseFrontmatter rejects bad line', () => {
  expect(() => parseFrontmatter('---\nbadline\n---\nbody')).toThrow('Bad frontmatter line');
});

test('resetMission blocks when active actor exists without force', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-mission-'));
  mkdirSync(join(dir, '.mugiwara'), { recursive: true });
  writeFileSync(join(dir, '.mugiwara', 'state.json'), JSON.stringify({ actor: 'testuser' }));
  const result = resetMission(dir, false);
  expect(result.blocked).toContain('testuser');
  expect(result.removed).toHaveLength(0);
});

test('resetMission with force bypasses actor guard', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-missionf-'));
  mkdirSync(join(dir, '.mugiwara', 'plans'), { recursive: true });
  writeFileSync(join(dir, '.mugiwara', 'plans', 'dummy.md'), 'plan');
  writeFileSync(join(dir, '.mugiwara', 'state.json'), JSON.stringify({ actor: 'testuser' }));
  const result = resetMission(dir, false, true);
  expect(result.blocked).toBeUndefined();
  expect(result.removed).toContain('plans');
});

test('resetMission on missing .mugiwara returns empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-nomugi-'));
  const result = resetMission(dir, false);
  expect(result.removed).toHaveLength(0);
  expect(result.kept).toHaveLength(0);
});

test('resetMission preserve keeps logs when keepLogs is true', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-missionk-'));
  mkdirSync(join(dir, '.mugiwara', 'logs'), { recursive: true });
  writeFileSync(join(dir, '.mugiwara', 'logs', 'lessons.md'), 'learned');
  const result = resetMission(dir, true, true);
  expect(result.kept).toContain('logs');
  expect(result.removed).not.toContain('logs');
});
