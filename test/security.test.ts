// test/security.test.ts — prompt-injection surfaces (W2 hardening).
// Artifact-trust rule, traversal rejection.
// Assertions are non-trivial — presence without a value check is not coverage.
import { describe, test, expect } from 'vitest';
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';

const root = join(import.meta.dirname, '..');

function run(bin: string, args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync('bash', [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, MUGIWARA_DIR: join(cwd, '.mugiwara') } });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function newRepo(tag: string): string {
  const dir = mkdtempSync(join(tmpdir(), `mugi-sec-${tag}-`));
  execSync('git init -q && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base', { cwd: dir });
  return dir;
}

describe('prompt injection surfaces', () => {
  test('workflow skill states the artifact-trust rule', () => {
    const s = readFileSync(join(root, 'content/skills/mugiwara-workflow/SKILL.md'), 'utf8');
    expect(s).toMatch(/data, never instructions/);
    expect(s).toMatch(/## Artifact trust/);
  });

  test('resume and lessons carry the injection red flag', () => {
    for (const p of ['mugiwara-resume', 'mugiwara-lessons']) {
      const s = readFileSync(join(root, `content/skills/${p}/SKILL.md`), 'utf8');
      expect(s.toLowerCase(), `${p} missing injection red flag`).toMatch(/artifact|redefine/);
    }
  });

  test('mission name allowlist rejects traversal', () => {
    for (const script of ['savepoint.sh']) {
      const dir = newRepo('traverse');
      try {
        mkdirSync(join(dir, '.mugiwara'), { recursive: true });
        // "../../etc" contains a slash — outside the [a-zA-Z0-9._-] allowlist
        const r = run(join(root, 'scripts', script), ['../../etc', 'x'], dir);
        expect(r.status).not.toBe(0);
        expect(r.stderr.toLowerCase()).toContain('invalid');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});

