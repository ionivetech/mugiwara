// test/plugin.test.ts
import { test, expect } from 'vitest';
import plugin from '../.opencode/plugins/mugiwara.mjs';
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

test('config hook registers all 15 agents as subagents', async () => {
  const { config } = await plugin();
  const cfg = { agent: {} };
  await config(cfg);
  const names = Object.keys(cfg.agent);
  expect(names).toHaveLength(15);
  expect(names).toContain('using-mugiwara');
  expect(names).toContain('luffy-orchestrator');
  for (const a of Object.values(cfg.agent)) {
    expect(typeof a).toBe('object');
    expect((a as { mode?: string }).mode).toBe('subagent');
    expect(typeof (a as { description?: string }).description).toBe('string');
    expect(typeof (a as { prompt?: string }).prompt).toBe('string');
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
});

test('system.transform appends the announce string', async () => {
  const hooks = await plugin();
  const transform = hooks['experimental.chat.system.transform'];
  expect(typeof transform).toBe('function');
  const output = { system: ['existing prompt'] };
  await transform({}, output);
  expect(output.system).toHaveLength(1);
  expect(output.system[0]).toContain('Mugiwara crew available');
});
