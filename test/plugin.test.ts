// test/plugin.test.ts
import { test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import plugin from '../.opencode/plugins/mugiwara.mjs';
import { readMode, parseModeChange, applyModeChange, ensureDefaultConfig } from '../.opencode/mugiwara-helpers.mjs';
import { CONTENT_DIR } from '../src/installer.ts';

const contentDir = CONTENT_DIR.replace(/[\\/]+$/, '');

test('plugin module exports a function', () => {
  expect(typeof plugin).toBe('function');
});

test('dispose hook present (no-op, prevents plugin dispose error)', async () => {
  const hooks = await plugin();
  expect(hooks.dispose).toBeDefined();
  expect(typeof hooks.dispose).toBe('function');
  hooks.dispose();
});

test('config hook registers skills path (absolute, deduped)', async () => {
  const { config } = await plugin();
  const cfg = { skills: { paths: ['/fake/pre-existing'] } };
  await config(cfg);
  expect(cfg.skills.paths).toContain(contentDir + '/skills');
  expect(cfg.skills.paths.filter(p => p === contentDir + '/skills')).toHaveLength(1);
  expect(cfg.skills.paths).toContain('/fake/pre-existing');
});

test('config hook registers all 15 agents: internal -> subagent mode, user-facing -> all mode', async () => {
  const { config } = await plugin();
  const cfg = { agent: {} };
  await config(cfg);
  const names = Object.keys(cfg.agent);
  expect(names).toHaveLength(15);
  expect(names).toContain('luffy-orchestrator');
  const internal = ['skeptic-verifier', 'eval-runner', 'memory-keeper'];
  for (const [name, a] of Object.entries(cfg.agent)) {
    expect(typeof a).toBe('object');
    expect(typeof (a as { description?: string }).description).toBe('string');
    expect(typeof (a as { prompt?: string }).prompt).toBe('string');
    if (internal.includes(name)) {
      expect((a as { mode?: string }).mode).toBe('subagent');
      expect((a as { description?: string }).description).toMatch(/^\[INTERNAL\] /);
    } else {
      expect((a as { mode?: string }).mode).toBe('all');
      expect((a as { description?: string }).description).not.toMatch(/^\[INTERNAL\] /);
    }
  }
});

test('internal flag: eval-runner is subagent + [INTERNAL] prefix, zoro-execution is all + no prefix', async () => {
  const { config } = await plugin();
  const cfg: { agent: Record<string, Record<string, unknown>> } = { agent: {} };
  await config(cfg);
  const internal = cfg.agent['eval-runner'];
  expect(internal.mode).toBe('subagent');
  expect(internal.description).toMatch(/^\[INTERNAL\] /);
  const userFacing = cfg.agent['zoro-execution'];
  expect(userFacing.mode).toBe('all');
  expect(userFacing.description).not.toMatch(/^\[INTERNAL\] /);
});

test('path-boundary agents get glob-scoped edit permission (write-scope is the gate)', async () => {
  const { config } = await plugin();
  const cfg: { agent: Record<string, Record<string, unknown>> } = { agent: {} };
  await config(cfg);
  const auditSet = ['chopper-checkpoint', 'sanji-quality', 'franky-gates', 'robin-reviewer', 'jinbe-security', 'skeptic-verifier'];
  for (const name of auditSet) {
    const a = cfg.agent[name];
    expect(a).toBeDefined();
    // artifacts scope -> edit denied everywhere except .mugiwara/**
    expect((a as { permission?: unknown }).permission).toEqual({ edit: { '*': 'deny', '.mugiwara/**': 'allow' } });
  }
  // internal artifact agent is dispatch-only, never user-selectable
  expect((cfg.agent['skeptic-verifier'] as { mode?: string }).mode).toBe('subagent');
});

test('config hook applies per-agent opencode tuning (color/temp/steps + scope permission)', async () => {
  const { config } = await plugin();
  const cfg: { agent: Record<string, Record<string, unknown>> } = { agent: {} };
  await config(cfg);
  const luffy = cfg.agent['luffy-orchestrator'];
  expect(luffy.color).toBe('#ef4444');
  expect(luffy.temperature).toBe(0.2);
  const chopper = cfg.agent['chopper-checkpoint'];
  expect((chopper as { permission?: unknown }).permission).toEqual({ edit: { '*': 'deny', '.mugiwara/**': 'allow' } });
  expect(typeof chopper.steps).toBe('number');
});

test('config hook never clobbers a user-defined agent', async () => {
  const { config } = await plugin();
  const mine = { description: 'mine', mode: 'subagent', prompt: 'keep me' };
  const cfg = { agent: { 'luffy-orchestrator': mine } };
  await config(cfg);
  expect(cfg.agent['luffy-orchestrator']).toBe(mine);
  expect((mine as { mode?: string }).mode).toBe('subagent');
});

test('announce string carries inline doctrine and flow contract', async () => {
  const hooks = await plugin();
  const transform = hooks['experimental.chat.system.transform'];
  const output = { system: ['existing prompt'] };
  await transform({}, output);
  expect(output.system[0]).toContain('Mugiwara crew available');
  expect(output.system[0]).toContain('Never Task-dispatch a crew member');
  expect(output.system[0]).toContain('auto-activates');
});

test('system.transform appends the announce string once (dedupes on repeat)', async () => {
  const hooks = await plugin();
  const transform = hooks['experimental.chat.system.transform'];
  expect(typeof transform).toBe('function');
  const output = { system: ['existing prompt'] };
  await transform({}, output);
  expect(output.system).toHaveLength(2);
  expect(output.system[0]).toContain('Mugiwara crew available');
  expect(output.system[1]).toContain('Active mode:');
  await transform({}, output);
  expect(output.system).toHaveLength(2);
});

const makeCfg = () => mkdtempSync(join(tmpdir(), 'mugi-mode-'));

test('mode reader: no config files -> guided', () => {
  expect(readMode({ projectDir: makeCfg(), home: makeCfg() })).toBe('guided');
});

test('mode reader: project config wins over global', () => {
  const proj = makeCfg(); const home = makeCfg();
  writeConfig(proj, 'mode=semi');
  writeConfig(home, 'mode=auto');
  expect(readMode({ projectDir: proj, home })).toBe('semi');
});

test('mode reader: global auto read when no project config', () => {
  const home = makeCfg();
  writeConfig(home, 'mode=auto');
  expect(readMode({ projectDir: makeCfg(), home })).toBe('auto');
});

test('mode reader: invalid value falls back to guided', () => {
  const proj = makeCfg();
  writeConfig(proj, 'mode=chaos');
  expect(readMode({ projectDir: proj, home: makeCfg() })).toBe('guided');
});

test('mode reader: CRLF line endings still parse', () => {
  const proj = makeCfg();
  const dir = join(proj, '.mugiwara');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config'), 'mode=auto\r\n');
  expect(readMode({ projectDir: proj, home: makeCfg() })).toBe('auto');
});

test('mode reader: comment and blank lines before mode line are skipped', () => {
  const proj = makeCfg();
  const dir = join(proj, '.mugiwara');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config'), '# generated by installer\n\nmode=auto\n');
  expect(readMode({ projectDir: proj, home: makeCfg() })).toBe('auto');
});

test('mode reader: no mode line in project config falls through to global', () => {
  const proj = makeCfg(); const home = makeCfg();
  writeConfig(proj, 'branch=feature/{type}-{issue}-{slug}');
  writeConfig(home, 'mode=semi');
  expect(readMode({ projectDir: proj, home })).toBe('semi');
});

function writeConfig(dir: string, line: string) {
  const d = join(dir, '.mugiwara');
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'config'), line + '\n');
}

test('ensureDefaultConfig: writes full default config on first use, idempotent, never clobbers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-default-'));
  try {
    expect(ensureDefaultConfig({ projectDir: dir })).toBe(true);
    const file = join(dir, '.mugiwara', 'config');
    const body = readFileSync(file, 'utf8');
    for (const key of [
      'mode=guided',
      'branch=feature/{type}-{issue}-{slug}',
      'commit=conventional',
      'base=main',
      'coverage_new=90',
      'coverage_modified=80',
      'review_depth=full',
      'quality_depth=full',
    ]) {
      expect(body).toContain(key);
    }
    // idempotent: second call returns false, leaves file unchanged
    expect(ensureDefaultConfig({ projectDir: dir })).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(body);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureDefaultConfig: never overwrites a pre-existing config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-default-'));
  try {
    writeConfig(dir, 'mode=auto');
    expect(ensureDefaultConfig({ projectDir: dir })).toBe(false);
    expect(readFileSync(join(dir, '.mugiwara', 'config'), 'utf8')).toContain('mode=auto');
    expect(readFileSync(join(dir, '.mugiwara', 'config'), 'utf8')).not.toContain('mode=guided');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('parseModeChange: /mugiwara-mode semi expands and parses', () => {
  expect(parseModeChange('/mugiwara-mode semi')).toBe('semi');
  expect(parseModeChange('Set mugiwara mode: auto\nValid levels...')).toBe('auto');
  expect(parseModeChange('mugiwara mode guided')).toBe('guided');
});

test('parseModeChange: invalid level no-op, no command no-op', () => {
  expect(parseModeChange('/mugiwara-mode chaos')).toBe(null);
  expect(parseModeChange('hello world')).toBe(null);
  expect(parseModeChange('')).toBe(null);
});

test('parseModeChange: mid-message mention never flips autonomy', () => {
  expect(parseModeChange('see this email about /mugiwara-mode auto attached')).toBe(null);
  expect(parseModeChange('note: mugiwara mode auto mentioned here')).toBe(null);
});

test('parseModeChange: quoted input unwraps', () => {
  expect(parseModeChange('"mugiwara mode auto"')).toBe('auto');
});

test('parseModeChange: uppercase input is case-insensitive', () => {
  expect(parseModeChange('MUGIWARA MODE SEMI')).toBe('semi');
});

test('parseModeChange: invalid mode returns null', () => {
  expect(parseModeChange('mugiwara mode fast')).toBe(null);
});

test('parseModeChange: mode mention not at message start returns null', () => {
  expect(parseModeChange('can you set mugiwara mode:semi now')).toBe(null);
});

test('applyModeChange writes project config and flips readMode', () => {
  const proj = makeCfg(); const home = makeCfg();
  applyModeChange('semi', { projectDir: proj, home });
  expect(readMode({ projectDir: proj, home })).toBe('semi');
  applyModeChange('auto', { projectDir: proj, home });
  expect(readMode({ projectDir: proj, home })).toBe('auto');
});

test('applyModeChange preserves other config keys', () => {
  const proj = makeCfg();
  writeConfig(proj, 'branch=feature/{type}-{issue}-{slug}');
  applyModeChange('auto', { projectDir: proj, home: makeCfg() });
  const config = readFileSync(join(proj, '.mugiwara', 'config'), 'utf8');
  expect(config).toContain('mode=auto');
  expect(config).toContain('branch=feature/{type}-{issue}-{slug}');
});

test('applyModeChange refuses symlinked config (no overwrite of target)', () => {
  const proj = makeCfg();
  const dir = join(proj, '.mugiwara');
  mkdirSync(dir, { recursive: true });
  const victim = join(makeCfg(), 'victim.txt');
  writeFileSync(victim, 'precious');
  try {
    symlinkSync(victim, join(dir, 'config'));
  } catch {
    return; // platform without symlink perms — skip
  }
  expect(() => applyModeChange('auto', { projectDir: proj, home: makeCfg() })).toThrow(/symlink/);
  expect(readFileSync(victim, 'utf8')).toBe('precious');
});

test('chat.message hook parses "/mugiwara auto" from string output and applies mode', async () => {
  const { 'chat.message': chat } = await plugin();
  const proj = makeCfg();
  const dir = join(proj, '.mugiwara');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config'), 'mode=guided\n');
  const origCwd = process.cwd();
  try {
    process.chdir(proj); // hook resolves .mugiwara/config via cwd
    await chat({}, '/mugiwara auto');
  } finally {
    process.chdir(origCwd);
  }
  expect(readMode({ projectDir: proj, home: makeCfg() })).toBe('auto');
});

test('chat.message hook parses mode from parts array output', async () => {
  const { 'chat.message': chat } = await plugin();
  const proj = makeCfg();
  const dir = join(proj, '.mugiwara');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config'), 'mode=auto\n');
  const origCwd = process.cwd();
  try {
    process.chdir(proj);
    await chat({}, { parts: [{ text: '/mugiwara semi' }] });
  } finally {
    process.chdir(origCwd);
  }
  expect(readMode({ projectDir: proj, home: makeCfg() })).toBe('semi');
});

test('chat.message hook ignores non-mode output', async () => {
  const { 'chat.message': chat } = await plugin();
  const proj = makeCfg();
  const dir = join(proj, '.mugiwara');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config'), 'mode=guided\n');
  const origCwd = process.cwd();
  try {
    process.chdir(proj);
    await chat({}, 'just a normal reply about the plan');
    await chat({}, { messages: [{ text: 'no mode switch here' }] });
  } finally {
    process.chdir(origCwd);
  }
  expect(readMode({ projectDir: proj, home: makeCfg() })).toBe('guided');
});

test('system.transform hook injects crew announce + active mode once', async () => {
  const { 'experimental.chat.system.transform': transform } = await plugin();
  const proj = makeCfg();
  const dir = join(proj, '.mugiwara');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config'), 'mode=guided\n');
  const origCwd = process.cwd();
  let output: { system: string[] };
  try {
    process.chdir(proj);
    output = { system: ['existing context'] };
    await transform({}, output);
  } finally {
    process.chdir(origCwd);
  }
  expect(output.system[0]).toContain('existing context');
  expect(output.system.some((s) => s.includes('Mugiwara crew available'))).toBe(true);
  expect(output.system.some((s) => s.includes('Active mode: guided'))).toBe(true);
  // idempotent — second run does not duplicate
  const before = output.system.length;
  await transform({}, output);
  expect(output.system.length).toBe(before);
});

test('system.transform hook handles empty system array', async () => {
  const { 'experimental.chat.system.transform': transform } = await plugin();
  const output: { system: string[] } = { system: [] };
  await transform({}, output);
  expect(output.system.some((s) => s.includes('Mugiwara crew available'))).toBe(true);
});
