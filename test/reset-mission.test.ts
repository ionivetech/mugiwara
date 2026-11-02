import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cap } from './helpers/cli-capture.ts';

describe('mugiwara reset <mission>', () => {
  function project() {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-reset-one-'));
    for (const m of ['a', 'b']) {
      mkdirSync(join(dir, '.mugiwara', 'missions', m), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'missions', m, 'state.json'), '{}');
    }
    writeFileSync(join(dir, '.mugiwara', 'lessons.md'), '# lessons\n');
    return dir;
  }
  test('removes only the named mission', async () => {
    const dir = project();
    const { out, code } = await cap(['reset', 'a', '--project', dir]);
    expect(code).toBe(0);
    expect(out).toContain('removed mission: a');
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'a'))).toBe(false);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'b'))).toBe(true);
    expect(existsSync(join(dir, '.mugiwara', 'lessons.md'))).toBe(true);
  });
  test('unknown or path-like names exit 1 and delete nothing', async () => {
    const dir = project();
    for (const name of ['nope', '../x']) {
      const { err, code } = await cap(['reset', name, '--project', dir]);
      expect(code).toBe(1);
      expect(err).toContain('no mission named');
    }
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'b'))).toBe(true);
  });
});
