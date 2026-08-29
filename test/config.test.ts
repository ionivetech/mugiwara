import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG, readConfig, ensureConfig, readInvestigationConfig } from '../src/config.ts';

function tmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugiwara-config-'));
  mkdirSync(join(dir, '.mugiwara'), { recursive: true });
  return dir;
}

describe('DEFAULT_CONFIG', () => {
  it('contains the documented default keys', () => {
    expect(DEFAULT_CONFIG).toContain('mode=guided');
    expect(DEFAULT_CONFIG).toContain('branch=feature/{type}-{issue}-{slug}');
    expect(DEFAULT_CONFIG).toContain('auto_commit=on');
    expect(DEFAULT_CONFIG).toContain('coverage_new=90');
    expect(DEFAULT_CONFIG).toContain('coverage_modified=80');
    expect(DEFAULT_CONFIG).toContain('heal_max_cycles=3');
    expect(DEFAULT_CONFIG).toContain('verbosity=normal');
  });
});

describe('readConfig', () => {
  let dir: string;
  const realHome = process.env.HOME;
  beforeEach(() => {
    dir = tmpProject();
    // isolate from a real ~/.mugiwara/config on the developer's machine:
    // readConfig merges the global config (src/config.ts), so point HOME at a
    // fresh dir with none. Restored in afterEach.
    process.env.HOME = join(tmpdir(), `mugiwara-home-${Date.now()}`);
  });
  afterEach(() => {
    if (realHome === undefined) delete process.env.HOME; else process.env.HOME = realHome;
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses key=value lines, trims values', () => {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=guided\nverbosity = full\n');
    const cfg = readConfig(dir);
    expect(cfg.mode).toBe('guided');
    expect(cfg.verbosity).toBe('full');
  });

  it('skips comments and blanks', () => {
    writeFileSync(join(dir, '.mugiwara', 'config'), '# comment\n\nbranch=feat/x\n');
    const cfg = readConfig(dir);
    expect(cfg.branch).toBe('feat/x');
    expect(Object.keys(cfg).length).toBe(1);
  });

  it('returns empty object when no config exists', () => {
    expect(readConfig(dir)).toEqual({});
  });

  it('handles Windows line endings', () => {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\r\ncommit=conventional\r\n');
    const cfg = readConfig(dir);
    expect(cfg.mode).toBe('auto');
    expect(cfg.commit).toBe('conventional');
  });
});

describe('readInvestigationConfig', () => {
  let dir: string;
  beforeEach(() => { dir = tmpProject(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns defaults (2/5/2) when keys are absent', () => {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=guided\n');
    expect(readInvestigationConfig(dir)).toEqual({ max_passes: 2, max_unrelated_files: 5, repeated_read_threshold: 2 });
  });

  it('parses explicit values (4/9/3)', () => {
    writeFileSync(
      join(dir, '.mugiwara', 'config'),
      'investigation_max_passes=4\ninvestigation_max_unrelated_files=9\ninvestigation_repeated_read_threshold=3\n',
    );
    expect(readInvestigationConfig(dir)).toEqual({ max_passes: 4, max_unrelated_files: 9, repeated_read_threshold: 3 });
  });

  it('falls back to defaults for non-numeric or zero values (2/5/2)', () => {
    writeFileSync(
      join(dir, '.mugiwara', 'config'),
      'investigation_max_passes=abc\ninvestigation_max_unrelated_files=0\ninvestigation_repeated_read_threshold=-3\n',
    );
    expect(readInvestigationConfig(dir)).toEqual({ max_passes: 2, max_unrelated_files: 5, repeated_read_threshold: 2 });
  });
});

describe('ensureConfig', () => {
  let dir: string;
  beforeEach(() => { dir = tmpProject(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('writes DEFAULT_CONFIG when config is missing', () => {
    const wrote = ensureConfig(dir);
    expect(wrote).toBe(true);
    const body = readFileSync(join(dir, '.mugiwara', 'config'), 'utf8');
    expect(body).toBe(DEFAULT_CONFIG);
  });

  it('never overwrites an existing config', () => {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
    const wrote = ensureConfig(dir);
    expect(wrote).toBe(false);
    expect(readFileSync(join(dir, '.mugiwara', 'config'), 'utf8')).toBe('mode=auto\n');
  });

  it('returns false when config is a symlink (never follows)', () => {
    const target = join(dir, '.mugiwara', 'real-config');
    writeFileSync(target, 'mode=auto\n');
    try {
      symlinkSync(target, join(dir, '.mugiwara', 'config'));
    } catch {
      return; // symlinks unsupported on this platform — skip
    }
    const wrote = ensureConfig(dir);
    expect(wrote).toBe(false);
    expect(existsSync(join(dir, '.mugiwara', 'config'))).toBe(true);
  });
});
