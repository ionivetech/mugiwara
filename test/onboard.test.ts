import { describe, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig, buildConfig } from '../src/onboard.ts';
import { readMode } from '../.opencode/mugiwara-helpers.mjs';

describe('onboard config writing', () => {
  test('buildConfig writes all 11 canonical keys in order, INI format', () => {
    const out = buildConfig(new Map(), {
      mode: 'auto',
      branch: '{issue}-{slug}',
      commit: '{issue}: {title}',
      coverage_new: '90',
      coverage_modified: '80',
      review_depth: 'full',
      quality_depth: 'full',
    });
    const lines = out.trim().split('\n');
    expect(lines).toEqual([
      'mode=auto',
      'branch={issue}-{slug}',
      'commit={issue}: {title}',
      'auto_commit=on',
      'coverage_new=90',
      'coverage_modified=80',
      'review_depth=full',
      'quality_depth=full',
      'delegate_threshold=60',
      'heal_max_cycles=3',
      'verbosity=normal',
    ]);
  });

  test('buildConfig preserves unasked keys from existing config', () => {
    const existing = parseConfig([
      '# existing',
      'mode=guided',
      'auto_commit=off',
      'delegate_threshold=80',
      'heal_max_cycles=5',
      'verbosity=full',
      'custom_key=keep-me',
    ]);
    const out = buildConfig(existing, { mode: 'semi', branch: 'feat/{slug}' });
    const lines = out.trim().split('\n');
    expect(lines).toContain('mode=semi');
    expect(lines).toContain('auto_commit=off');
    expect(lines).toContain('delegate_threshold=80');
    expect(lines).toContain('heal_max_cycles=5');
    expect(lines).toContain('verbosity=full');
    expect(lines).toContain('custom_key=keep-me');
    // no dead keys
    expect(lines.join('\n')).not.toContain('branch_pattern');
  });

  test('written config is readable by the runtime readMode (INI parser)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-onboard-'));
    try {
      const body = buildConfig(new Map(), {
        mode: 'auto',
        branch: 'feature/{type}-{issue}-{slug}',
        commit: 'conventional',
        coverage_new: '90',
        coverage_modified: '80',
        review_depth: 'full',
        quality_depth: 'full',
      });
      mkdirSync(join(dir, '.mugiwara'), { recursive: true });
      writeFileSync(join(dir, '.mugiwara', 'config'), `# header comment\n${body}`);
      expect(readMode({ projectDir: dir, home: join(tmpdir(), 'mugi-onboard-none') })).toBe('auto');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('parseConfig ignores comments and blank lines, first occurrence wins', () => {
    const map = parseConfig(['# comment', '', 'mode=guided', 'mode=auto', 'branch = feat/{slug}']);
    expect(map.get('mode')).toBe('guided');
    expect(map.get('branch')).toBe('feat/{slug}');
    expect(map.size).toBe(2);
  });
});