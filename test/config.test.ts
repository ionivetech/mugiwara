import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG, readConfig, ensureConfig } from '../src/config.ts';

function tmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugiwara-config-'));
  mkdirSync(join(dir, '.mugiwara'), { recursive: true });
  return dir;
}

describe('DEFAULT_CONFIG', () => {
  it('contains the documented default keys', () => {
    expect(DEFAULT_CONFIG).toContain('mode=guided');
    expect(DEFAULT_CONFIG).toContain('branch=feature/{type}-{issue}-{slug}');
    expect(DEFAULT_CONFIG).toContain('auto_commit=off');
    // one `coverage` key; legacy coverage_new/coverage_modified are not advertised
    expect(DEFAULT_CONFIG).toContain('coverage=85');
    expect(DEFAULT_CONFIG).not.toContain('coverage_new');
    expect(DEFAULT_CONFIG).not.toContain('coverage_modified');
    // keys with no behavioral consumer are not advertised (still read silently)
    expect(DEFAULT_CONFIG).not.toContain('verify_merged');
    expect(DEFAULT_CONFIG).not.toContain('investigation_');
    expect(DEFAULT_CONFIG).toContain('# enforce=warn');
    expect(DEFAULT_CONFIG).toContain('heal_max_cycles=3');
    expect(DEFAULT_CONFIG).toContain('independent_review=on');
    expect(DEFAULT_CONFIG).toContain('verbosity=normal');
  });

  it('documents the features= grammar as a bare commented option', () => {
    expect(DEFAULT_CONFIG).toContain('# features=core+auto');
    expect(DEFAULT_CONFIG.split('\n')).toContain('# features=core+auto');
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

  it('is side-effect free: does not create .mugiwara/config when missing', () => {
    expect(existsSync(join(dir, '.mugiwara', 'config'))).toBe(false);
    const cfg = readConfig(dir);
    expect(cfg).toEqual({});
    expect(existsSync(join(dir, '.mugiwara', 'config'))).toBe(false);
  });

  it('handles Windows line endings', () => {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\r\ncommit=conventional\r\n');
    const cfg = readConfig(dir);
    expect(cfg.mode).toBe('auto');
    expect(cfg.commit).toBe('conventional');
  });

  it('returns features when set (generic flat map, no per-key parser)', () => {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=guided\nfeatures=core+auto,ship\n');
    const cfg = readConfig(dir);
    expect(cfg.features).toBe('core+auto,ship');
  });

  it('yields no features key when absent (≡ all, zero migration)', () => {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=guided\n');
    const cfg = readConfig(dir);
    expect('features' in cfg).toBe(false);
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
