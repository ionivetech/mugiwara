// test/plugin.test.ts
import { test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import plugin, { readMode } from '../.opencode/plugins/mugiwara.mjs';
import { CONTENT_DIR } from '../src/installer.ts';

const contentDir = CONTENT_DIR.replace(/[\\/]+$/, '');

test('plugin module exports a function', () => {
  expect(typeof plugin).toBe('function');
});

test('config hook registers skills path (absolute, deduped)', async () => {
  const { config } = await plugin();
  const cfg = { skills: { paths: ['/fake/pre-existing'] } };
  await config(cfg);
  expect(cfg.skills.paths).toContain(contentDir + '/skills');
  expect(cfg.skills.paths.filter(p => p === contentDir + '/skills')).toHaveLength(1);
  expect(cfg.skills.paths).toContain('/fake/pre-existing');
});

test('config hook registers all 15 agents with mode all (main-thread tabs)', async () => {
  const { config } = await plugin();
  const cfg = { agent: {} };
  await config(cfg);
  const names = Object.keys(cfg.agent);
  expect(names).toHaveLength(15);
  expect(names).toContain('using-mugiwara');
  expect(names).toContain('luffy-orchestrator');
  for (const a of Object.values(cfg.agent)) {
    expect(typeof a).toBe('object');
    expect((a as { mode?: string }).mode).toBe('all');
    expect(typeof (a as { description?: string }).description).toBe('string');
    expect(typeof (a as { prompt?: string }).prompt).toBe('string');
  }
});

test('audit/deny permission fields preserved with mode all', async () => {
  const { config } = await plugin();
  const cfg: { agent: Record<string, Record<string, unknown>> } = { agent: {} };
  await config(cfg);
  const denySet = ['chopper-checkpoint', 'sanji-quality', 'franky-gates', 'robin-reviewer', 'jinbe-security', 'skeptic-verifier'];
  for (const name of denySet) {
    const a = cfg.agent[name];
    expect(a).toBeDefined();
    expect((a as { permission?: unknown }).permission).toEqual({ edit: 'deny' });
    expect((a as { mode?: string }).mode).toBe('all');
  }
});

test('config hook applies per-agent opencode tuning (color/temp/permission/steps)', async () => {
  const { config } = await plugin();
  const cfg: { agent: Record<string, Record<string, unknown>> } = { agent: {} };
  await config(cfg);
  const luffy = cfg.agent['luffy-orchestrator'];
  expect(luffy.color).toBe('#ef4444');
  expect(luffy.temperature).toBe(0.2);
  const chopper = cfg.agent['chopper-checkpoint'];
  expect(chopper.permission).toEqual({ edit: 'deny' });
  expect(typeof chopper.steps).toBe('number');
});

test('config hook never clobbers a user-defined agent', async () => {
  const { config } = await plugin();
  const mine = { description: 'mine', mode: 'subagent', prompt: 'keep me' };
  const cfg = { agent: { 'using-mugiwara': mine } };
  await config(cfg);
  expect(cfg.agent['using-mugiwara']).toBe(mine);
  expect((mine as { mode?: string }).mode).toBe('subagent');
});

test('announce string carries inline doctrine and flow contract', async () => {
  const hooks = await plugin();
  const transform = hooks['experimental.chat.system.transform'];
  const output = { system: ['existing prompt'] };
  await transform({}, output);
  expect(output.system[0]).toContain('Mugiwara crew available');
  expect(output.system[0]).toContain('Never Task-dispatch a crew member');
  expect(output.system[0]).toContain('Luffy delegates');
});

test('system.transform appends the announce string', async () => {
  const hooks = await plugin();
  const transform = hooks['experimental.chat.system.transform'];
  expect(typeof transform).toBe('function');
  const output = { system: ['existing prompt'] };
  await transform({}, output);
  expect(output.system).toHaveLength(2);
  expect(output.system[0]).toContain('Mugiwara crew available');
  expect(output.system[1]).toContain('Active mode:');
});

const makeCfg = (mode?: string) => mkdtempSync(join(tmpdir(), 'mugi-mode-'));

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

function writeConfig(dir: string, line: string) {
  const d = join(dir, '.mugiwara');
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'config'), line + '\n');
}
