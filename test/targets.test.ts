// test/targets.test.ts
import { test, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
    // Any target that defines transformSkillFull ships a stub to the rules
    // glob and the body to refs; everyone else embeds the body inline.
    // Copilot joined the stub side (A1): it injects every matching
    // instruction file into every request, so the corpus is per-request cost.
    const hasStub = t.transformSkillFull?.(skill, 'BODY\n') != null;
    if (!hasStub) expect(out!.text.includes('BODY'), `${t.id} embeds body`).toBe(true);
    if (t.tier === 3) {
      expect(t.transformSkillFull, `${t.id}: tier 3 must define transformSkillFull`).toBeDefined();
    }
    const full = t.transformSkillFull?.(skill, 'BODY\n') ?? null;
    expect(t.tier !== 3 || full !== null, `${t.id} tier 3 full ref`).toBe(true);
    // Targets with a full-ref transform ship a stub; the body lives in refs.
    expect(full === null || full.text.includes('BODY'), `${t.id} full ref embeds body`).toBe(true);
    expect(full === null || !out!.text.includes('BODY'), `${t.id} stub must not embed body`).toBe(true);
  }
  const claudeOut = targets.claude.transformSkill(skill, 'BODY\n');
  expect(parseFrontmatter(claudeOut!.text).data.name).toBe('mugiwara-workflow');
});

test('L1: claude transformAgent restricts tools only for internal agents', () => {
  const userFacing = targets.claude.transformAgent(
    { name: 'usopp-brainstorm', description: 'x', 'write-scope': 'artifacts' } as never,
    'BODY\n'
  )!;
  const internal = targets.claude.transformAgent(
    { name: 'skeptic-verifier', description: 'x', 'internal-agent': 'true', 'write-scope': 'artifacts' } as never,
    'BODY\n'
  )!;
  const source = targets.claude.transformAgent(
    { name: 'zoro-execution', description: 'x', 'write-scope': 'source' } as never,
    'BODY\n'
  )!;
  const u = parseFrontmatter(userFacing.text).data;
  const i = parseFrontmatter(internal.text).data;
  const s = parseFrontmatter(source.text).data;
  expect(u.tools).toBeUndefined(); // user-facing crew keep default toolset incl. Edit
  expect(i.tools).toBe('Read, Grep, Glob, Write, Bash, WebFetch, WebSearch');
  expect(i.tools).not.toContain('Edit');
  expect(s.tools).toBeUndefined();
});

test('L1: claude transformAgent keeps explicit tools frontmatter over generated', () => {
  const out = targets.claude.transformAgent(
    { name: 'skeptic-verifier', description: 'x', 'internal-agent': 'true', 'write-scope': 'artifacts', tools: 'Read' } as never,
    'BODY\n'
  )!;
  expect(parseFrontmatter(out.text).data.tools).toBe('Read');
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
    expect(stub).toContain('.mugiwara/refs/mugiwara-workflow/mugiwara-workflow.md');

    const full = readFileSync(join(dir, '.mugiwara', 'refs', 'mugiwara-workflow', 'mugiwara-workflow.md'), 'utf8');
    expect(full.length, `${id} full body in refs`).toBeGreaterThan(2000);

    const agentStub = readFileSync(join(skillsDir, 'agent-luffy-orchestrator.md'), 'utf8');
    expect(agentStub).toContain('.mugiwara/refs/luffy-orchestrator/luffy-orchestrator.md');
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

test('write-boundary: opencode user-facing crew get no permission block (rules-based)', () => {
  const out = targets.opencode.transformAgent(
    { name: 'usopp-brainstorm', description: 'x', 'write-scope': 'artifacts' } as never,
    'BODY\n'
  )!;
  expect(out.text).not.toContain('permission:');
  expect(out.text).toContain('mode: all');
  expect(out.text).toContain("color:");
});

test('write-boundary: opencode internal agents keep permission from write-scope (cases 2+4)', () => {
  const out = targets.opencode.transformAgent(
    { name: 'skeptic-verifier', description: 'x', 'internal-agent': 'true', 'write-scope': 'artifacts' } as never,
    'BODY\n'
  )!;
  expect(out.text).toContain('[INTERNAL] x');
  expect(out.text).toContain('permission:');
  expect(out.text).toContain('edit:');
  expect(out.text).toContain('"*": deny');
  expect(out.text).toContain('".mugiwara/**": allow');
});

test('write-boundary: opencode internal source agent gets full edit allow (case 5)', () => {
  const out = targets.opencode.transformAgent(
    { name: 'skeptic-verifier', description: 'x', 'internal-agent': 'true', 'write-scope': 'source' } as never,
    'BODY\n'
  )!;
  expect(out.text).toContain('edit: allow');
});

test('write-boundary: opencode user-facing source agent gets no permission block', () => {
  const out = targets.opencode.transformAgent(
    { name: 'zoro-execution', description: 'x', 'write-scope': 'source' } as never,
    'BODY\n'
  )!;
  expect(out.text).not.toContain('permission:');
});

test('L1: claude internal agent with non-artifacts write-scope gets no generated tools', () => {
  const out = targets.claude.transformAgent(
    { name: 'skeptic-verifier', description: 'x', 'internal-agent': 'true', 'write-scope': 'source' } as never,
    'BODY\n'
  )!;
  expect(parseFrontmatter(out.text).data.tools).toBeUndefined();
});

test('claude postInstall merges hooks into an existing settings.json, preserving user keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-wire-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-wirehome-'));
  const claudeDir = join(dir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({ foo: 'bar' }));
  const r = targets.claude.postInstall!({ scope: 'project', projectDir: dir, home, dryRun: false, files: [] });
  const settings = JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf8'));
  expect(settings.foo).toBe('bar'); // user key preserved through merge
  expect(settings.hooks.SessionStart).toBeTruthy();
  expect(r.notes.some(n => n.includes('settings.json'))).toBe(true);
});

test('claude postInstall is idempotent: re-registering an existing hook leaves settings alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-wire2-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-wire2home-'));
  const claudeDir = join(dir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({ foo: 'bar' }));
  targets.claude.postInstall!({ scope: 'project', projectDir: dir, home, dryRun: false, files: [] });
  const first = readFileSync(join(claudeDir, 'settings.json'), 'utf8');
  const r = targets.claude.postInstall!({ scope: 'project', projectDir: dir, home, dryRun: false, files: [] });
  expect(readFileSync(join(claudeDir, 'settings.json'), 'utf8')).toBe(first);
  expect(r.notes.some(n => n.includes('settings.json'))).toBe(false);
});

test('claude postInstall dryRun returns empty without touching disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-dry-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-dryhome-'));
  const r = targets.claude.postInstall!({ scope: 'project', projectDir: dir, home, dryRun: true, files: [] });
  expect(r.written).toEqual([]);
  expect(r.notes).toEqual([]);
  expect(existsSync(join(dir, '.claude'))).toBe(false);
});

test('claude postUninstall un-merges only mugiwara hooks from settings.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-unwire-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-unwirehome-'));
  const claudeDir = join(dir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  const settings = {
    foo: 'bar',
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: JSON.stringify(join(claudeDir, 'hooks', 'session-start.js')), timeout: 10 }] }],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: JSON.stringify(join(claudeDir, 'hooks', 'mugiwara-mode-tracker.js')), timeout: 5 }] }],
      Stop: [{ hooks: [{ type: 'command', command: '/some/other/hook.js', timeout: 5 }] }],
    },
  };
  writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify(settings));
  const r = targets.claude.postUninstall!({ scope: 'project', projectDir: dir, home, dryRun: false });
  expect(r.changed).toContain(join(claudeDir, 'settings.json'));
  const after = JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf8'));
  expect(after.foo).toBe('bar'); // user key preserved
  expect(after.hooks.SessionStart).toBeUndefined(); // mugiwara hook removed
  expect(after.hooks.UserPromptSubmit).toBeUndefined();
  expect(after.hooks.Stop).toHaveLength(1); // user hook kept
  expect(after.hooks.Stop[0].hooks[0].command).toContain('/some/other/hook.js');
});

test('claude postUninstall leaves settings.json untouched when it has no mugiwara hooks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-unwire2-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-unwire2home-'));
  const claudeDir = join(dir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({ foo: 'bar' }));
  const r = targets.claude.postUninstall!({ scope: 'project', projectDir: dir, home, dryRun: false });
  expect(r.changed).toEqual([]);
  expect(JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf8')).foo).toBe('bar');
});

test('claude postInstall keeps an existing command file and notes it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-cmd-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-cmdhome-'));
  const cmdsDir = join(dir, '.claude', 'commands');
  mkdirSync(cmdsDir, { recursive: true });
  writeFileSync(join(cmdsDir, 'mugiwara-continue.md'), '# user override\n');
  const r = targets.claude.postInstall!({ scope: 'project', projectDir: dir, home, dryRun: false, files: [] });
  expect(readFileSync(join(cmdsDir, 'mugiwara-continue.md'), 'utf8')).toBe('# user override\n');
  expect(r.notes.some(n => n.includes('existing command kept'))).toBe(true);
});

test('claude postUninstall dryRun returns empty without touching settings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-unwire3-'));
  const home = mkdtempSync(join(tmpdir(), 'mugi-unwire3home-'));
  const claudeDir = join(dir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ command: 'x' }] }] } }));
  const r = targets.claude.postUninstall!({ scope: 'project', projectDir: dir, home, dryRun: true });
  expect(r.changed).toEqual([]);
  expect(JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf8')).hooks.SessionStart).toBeTruthy();
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




