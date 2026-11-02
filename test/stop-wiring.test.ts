import { describe, test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cap } from './helpers/cli-capture.ts';
import { doctor } from '../src/doctor.ts';

type Settings = { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
const commandsOf = (s: Settings, event: string): string[] => (s.hooks[event] ?? []).flatMap((g) => g.hooks.map((h) => h.command));

async function installed(): Promise<{ dir: string; settings: Settings }> {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-wiring-'));
  await cap(['install', '--yes', '--target', 'claude', '--project', dir]);
  return { dir, settings: JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8')) as Settings };
}

describe('hook wiring from a CLI install', () => {
  test('pipeline-guard runs at Stop and at SubagentStop; auto-savepoint stays at Stop', async () => {
    const { settings } = await installed();
    expect(commandsOf(settings, 'Stop').some((c) => c.includes('pipeline-guard.js'))).toBe(true);
    expect(commandsOf(settings, 'Stop').some((c) => c.includes('auto-savepoint.js'))).toBe(true);
    expect(commandsOf(settings, 'SubagentStop').some((c) => c.includes('pipeline-guard.js'))).toBe(true);
  });

  test('update repairs an install that wired the guard only to SubagentStop, without duplicating', async () => {
    const { dir, settings } = await installed();
    settings.hooks.Stop = settings.hooks.Stop.map((g) => ({ ...g, hooks: g.hooks.filter((h) => !h.command.includes('pipeline-guard.js')) })).filter((g) => g.hooks.length);
    writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify(settings));
    const broken = doctor(dir, dir, { lane: false, globalCli: () => '1' }).find((c) => c.name === 'hooks wired (claude)');
    expect(broken?.status).toBe('fail');
    expect(broken?.detail).toContain('not wired to Stop');
    await cap(['update', '--yes', '--target', 'claude', '--project', dir]);
    const fixed = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8')) as Settings;
    expect(commandsOf(fixed, 'Stop').filter((c) => c.includes('pipeline-guard.js'))).toHaveLength(1);
    expect(commandsOf(fixed, 'SubagentStop').filter((c) => c.includes('pipeline-guard.js'))).toHaveLength(1);
    expect(doctor(dir, dir, { lane: false, globalCli: () => '1' }).find((c) => c.name === 'hooks wired (claude)')?.status).toBe('ok');
  });

  test('a user hook on Stop is kept', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-wiring-user-'));
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] } }));
    await cap(['install', '--yes', '--target', 'claude', '--project', dir]);
    const s = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8')) as Settings;
    expect(commandsOf(s, 'Stop')).toContain('echo mine');
    expect(commandsOf(s, 'Stop').some((c) => c.includes('pipeline-guard.js'))).toBe(true);
  });
});
