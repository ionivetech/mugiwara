import { test, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Files that are installed into user repos must point at the current layout
// (.mugiwara/missions/<m>/), not the pre-0.7 state/, results/ and review/ dirs.
const ROOTS = ['.claude', '.opencode', '.agents', 'content', 'evals/cases'];
const OLD = /\.mugiwara\/(state|results|review)\//;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(md|json)$/.test(e)) out.push(p);
  }
  return out;
}

test('installed commands, skills and eval cases do not name the legacy layout', () => {
  const bad = ROOTS.flatMap((r) => walk(join(import.meta.dir, '..', r))).filter((f) => OLD.test(readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});
