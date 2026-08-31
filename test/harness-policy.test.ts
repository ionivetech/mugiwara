import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parsePolicyYaml, loadPolicy, detectHarness, isEnforcedHarness, getHarnessEnforcementError, enforceHarnessPolicy } from '../src/policy.ts';

function tmpDir(tag: string) { return mkdtempSync(join(tmpdir(), `mugi-harness-${tag}-`)); }

describe('harness.require_enforcement policy', () => {
  let dir: string;
  const HARNESS_KEYS = ['OPENCODE','OPENCODE_TOKENS_FILE','CLAUDECODE','CLAUDE_CODE_ENTRYPOINT','ANTHROPIC_MODEL','CURSOR','VSCODE_GIT_ASKPASS_NODE'] as const;
  const saved: Record<string, string|undefined> = {};

  beforeEach(() => {
    dir = tmpDir('policy');
    for (const k of HARNESS_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of HARNESS_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k] as string;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses harness.require_enforcement true/false via parsePolicyYaml', () => {
    const yTrue = parsePolicyYaml('harness:\n  require_enforcement: true\n');
    expect((yTrue.harness as Record<string, unknown>).require_enforcement).toBe(true);
    const yFalse = parsePolicyYaml('harness:\n  require_enforcement: false\n');
    expect((yFalse.harness as Record<string, unknown>).require_enforcement).toBe(false);
  });

  it('loadPolicy normalizes harness boolean and ignores non-boolean', () => {
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: true\n');
    const p = loadPolicy(dir);
    expect(p?.harness?.require_enforcement).toBe(true);
    rmSync(join(dir, 'mugiwara.policy.yml'));
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: false\n');
    expect(loadPolicy(dir)?.harness?.require_enforcement).toBe(false);
    rmSync(join(dir, 'mugiwara.policy.yml'));
    // non-boolean ignored (no harness field)
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: "yes"\n');
    expect(loadPolicy(dir)?.harness).toBeUndefined();
  });

  it('harness is a known root — no throw, unknown still throws', () => {
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: true\n');
    expect(() => loadPolicy(dir)).not.toThrow();
    rmSync(join(dir, 'mugiwara.policy.yml'));
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'badkey: 1\n');
    expect(() => loadPolicy(dir)).toThrow(/unknown policy key/);
  });

  it('detectHarness / isEnforcedHarness via env', () => {
    // opencode via env
    process.env.OPENCODE = '1';
    expect(detectHarness(dir)).toBe('opencode');
    expect(isEnforcedHarness(dir)).toBe(true);
    delete process.env.OPENCODE;

    // claude via CLAUDECODE takes precedence over opencode
    process.env.CLAUDECODE = '1';
    process.env.OPENCODE = '1';
    expect(detectHarness(dir)).toBe('claude');
    expect(isEnforcedHarness(dir)).toBe(false);
    delete process.env.CLAUDECODE;
    delete process.env.OPENCODE;

    // claude via ANTHROPIC_MODEL
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4';
    expect(detectHarness(dir)).toBe('claude');
    expect(isEnforcedHarness(dir)).toBe(false);
    delete process.env.ANTHROPIC_MODEL;

    // unknown when no env/file
    expect(detectHarness(dir)).toBe('unknown');
    expect(isEnforcedHarness(dir)).toBe(false);
  });

  it('detectHarness via .opencode/config.json file', () => {
    mkdirSync(join(dir, '.opencode'), { recursive: true });
    writeFileSync(join(dir, '.opencode', 'config.json'), '{}');
    expect(detectHarness(dir)).toBe('opencode');
    expect(isEnforcedHarness(dir)).toBe(true);
  });

  it('getHarnessEnforcementError pure helper', () => {
    // no policy → null
    expect(getHarnessEnforcementError(dir)).toBeNull();
    // policy false → null
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: false\n');
    expect(getHarnessEnforcementError(dir)).toBeNull();
    rmSync(join(dir, 'mugiwara.policy.yml'));
    // required true but opencode → null
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: true\n');
    process.env.OPENCODE = '1';
    expect(getHarnessEnforcementError(dir)).toBeNull();
    delete process.env.OPENCODE;
    // required true and rules-based → error string contains required phrase
    process.env.CLAUDECODE = '1';
    const err = getHarnessEnforcementError(dir);
    expect(err).toContain('harness enforcement required but current harness is rules-based only');
    expect(err).toContain('use opencode or set harness.require_enforcement:false');
    delete process.env.CLAUDECODE;
  });

  it('enforceHarnessPolicy is no-op when not required', () => {
    // no policy
    expect(() => enforceHarnessPolicy(dir)).not.toThrow();
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: false\n');
    expect(() => enforceHarnessPolicy(dir)).not.toThrow();
  });

  it('CLI: mugiwara status refused when required true and rules-based, passes under opencode (spawn)', () => {
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'harness:\n  require_enforcement: true\n');
    const cli = join(import.meta.dirname, '..', 'src', 'cli.ts');
    // rules-based → exit 1
    const r1 = spawnSync('bun', [cli, 'status', '--project', dir], {
      encoding: 'utf8',
      env: { ...process.env, CLAUDECODE: '1', OPENCODE: '' },
    });
    expect(r1.status).toBe(1);
    expect((r1.stderr + r1.stdout)).toContain('harness enforcement required but current harness is rules-based only');

    // opencode → passes (status may print "No mission state" but exit 0)
    const r2 = spawnSync('bun', [cli, 'status', '--project', dir], {
      encoding: 'utf8',
      env: { ...process.env, OPENCODE: '1', CLAUDECODE: '' },
    });
    expect(r2.status).toBe(0);
    expect((r2.stderr + r2.stdout)).not.toContain('harness enforcement required');
  });
});
