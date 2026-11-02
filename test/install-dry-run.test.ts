import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cap } from './helpers/cli-capture.ts';

test('dry run on Claude and opencode says the count leaves out the last-step files; nothing is written', async () => {
  for (const target of ['claude', 'opencode']) {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-dry-'));
    const r = await cap(['install', '--yes', '--target', target, '--project', dir, '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('the count leaves out hook, script, command and settings files');
    expect(existsSync(join(dir, '.mugiwara'))).toBe(false);
  }
});

test('dry run on a target without a last step has no such note', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-dry-'));
  const r = await cap(['install', '--yes', '--target', 'codex', '--project', dir, '--dry-run']);
  expect(r.out).not.toContain('the count leaves out');
});
