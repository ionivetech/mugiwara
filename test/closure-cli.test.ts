import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

vi.setConfig({ testTimeout: 30000 });
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stalenessLine } from '../src/cli.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANE = join(root, 'scripts', 'lane.sh');

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mugi-stale-'));
  // -b main pins the initial branch: CI runners may default to master
  execSync(
    'git init -q -b main && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base && git checkout -q -b feat-w',
    { cwd: dir },
  );
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('staleness detection', () => {
  it('reports how far main moved past the recorded base', () => {
    const base = execSync('git rev-parse main', { cwd: dir, encoding: 'utf8' }).trim();
    expect(stalenessLine(dir, base)).toBeNull(); // main has not moved
    execSync('git checkout -q main && git commit --allow-empty -qm newer', { cwd: dir });
    const line = stalenessLine(dir, base);
    expect(line).toContain('⚠ stale base:');
    expect(line).toContain('1 commit(s) ahead');
  });

  it('unknown or missing base is never called stale', () => {
    expect(stalenessLine(dir, 'unknown')).toBeNull();
    expect(stalenessLine(dir, '')).toBeNull();
  });

  it('a repo without main/master reports nothing', () => {
    const bare = mkdtempSync(join(tmpdir(), 'mugi-nogit-'));
    try {
      expect(stalenessLine(bare, 'deadbeef')).toBeNull();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe('policy force_full through lane.sh', () => {
  function docsOnlyCommits(): void {
    // >8 doc files → count says full, docs-only downgrade says standard
    for (let i = 0; i < 10; i++) {
      writeFileSync(join(dir, `doc${i}.md`), 'x\n');
    }
    execSync('git add -A && git commit -qm docs', { cwd: dir });
  }

  it('docs-only heavy diff downgrades to standard without a policy', () => {
    docsOnlyCommits();
    const out = spawnSync('bash', [LANE, 'main'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
    expect(out.split(/\r?\n/)[0]).toBe('standard');
  });

  it('mugiwara.policy.yml force_full raises it back to full — upward only', () => {
    docsOnlyCommits();
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'lanes:\n  force_full:\n    - "*.md"\n');
    const r = spawnSync('bash', [LANE, 'main', '--json'], { cwd: dir, encoding: 'utf8' });
    const json = JSON.parse(r.stdout) as { lane: string; reason: string };
    expect(json.lane).toBe('full');
    expect(json.reason).toContain('policy force_full');
  });

  it('no policy file means today’s behavior (control)', () => {
    mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
    writeFileSync(join(dir, 'src', 'auth', 'sensitive.ts'), 'x\n'); // sensitive path → full anyway
    execSync('git add -A && git commit -qm s', { cwd: dir });
    const r = spawnSync('bash', [LANE, 'main', '--json'], { cwd: dir, encoding: 'utf8' });
    const json = JSON.parse(r.stdout) as { lane: string };
    expect(json.lane).toBe('full'); // via sensitive paths, not policy
  });
});

describe('policy parser edge: list under nested map key', () => {
  it('force_full stays an array inside lanes', async () => {
    writeFileSync(join(dir, 'p.yml'), 'lanes:\n  force_full:\n    - "src/**"\ngates:\n  coverage:\n    new: 95\n');
    const { parsePolicyYaml } = await import('../src/policy.ts');
    const y = parsePolicyYaml(readP(join(dir, 'p.yml')));
    expect((y.lanes as Record<string, unknown>).force_full).toEqual(['src/**']);
    const gates = y.gates as Record<string, unknown>;
    expect((gates.coverage as Record<string, unknown>).new).toBe(95);
  });

  it('effectiveThreshold only raises', async () => {
    const { effectiveThreshold } = await import('../src/policy.ts');
    expect(effectiveThreshold(80, undefined)).toBe(80);
    expect(effectiveThreshold(80, 95)).toBe(95);
    expect(effectiveThreshold(95, 80)).toBe(95); // never downward
  });
});

// tiny helper so the import above stays at top-level semantics
import { readFileSync as readPF } from 'node:fs';
function readP(p: string): string {
  return readPF(p, 'utf8');
}

// keep mkdirSync referenced for future fixtures
void mkdirSync;
