import { describe, test, expect } from 'bun:test';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

/** A private copy of everything retrieval-eval reads, so a test can add case files safely. */
function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-retrieval-'));
  for (const p of ['scripts/retrieval-eval.ts', 'src/frontmatter.ts', 'content/skills', 'evals/cases', 'evals/floor.json']) {
    cpSync(join(root, p), join(dir, p), { recursive: true });
  }
  return dir;
}
const evalIn = (dir: string) => spawnSync('bun', ['scripts/retrieval-eval.ts'], { cwd: dir, encoding: 'utf8' });

// R3: a copied probe inflates the count and the rank-1 rate, so the eval refuses it.
describe('retrieval-eval uniqueness gate', () => {
  test('the current case files have no duplicate probe', () => {
    const r = evalIn(sandbox());
    expect(r.stderr).not.toContain('duplicate retrieval probes');
    expect(r.status).toBe(0);
  }, 60_000);
  test('a probe in two case files fails and names both files', () => {
    const dir = sandbox();
    const probe = { prompt: 'zz duplicate probe for the uniqueness gate', top_k: 3 };
    for (const name of ['dup-a', 'dup-b']) {
      mkdirSync(join(dir, 'evals', 'cases'), { recursive: true });
      writeFileSync(join(dir, 'evals', 'cases', `${name}.json`), JSON.stringify({ name, skill: 'mugiwara-orchestration', trigger: { positive: [probe] } }));
    }
    const r = evalIn(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('duplicate retrieval probes: 1');
    expect(r.stderr).toMatch(/in dup-[ab]\.json and dup-[ab]\.json/);
  }, 60_000);
});
