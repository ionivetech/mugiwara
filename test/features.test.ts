import { describe, it, expect } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { EXTENSION_TABLE, parseFeatures } from '../src/features.ts';

// Expected placements per plan §21-skill placement (sums 21: 7 core + 11 auto + 3 conditional).
const CORE: Record<string, string> = {
  orchestration: 'mugiwara-orchestration',
  planning: 'mugiwara-planning',
  execution: 'mugiwara-execution',
  checkpoint: 'mugiwara-checkpoint',
  gates: 'mugiwara-gates',
  quality: 'mugiwara-quality',
  lessons: 'mugiwara-lessons',
};

const AUTO: Record<string, string> = {
  ship: 'mugiwara-ship',
  migration: 'mugiwara-migration',
  'contract-first': 'mugiwara-contract-first',
  testcases: 'mugiwara-testcases',
  frontend: 'mugiwara-frontend',
  backend: 'mugiwara-backend',
  security: 'mugiwara-security',
  brainstorm: 'mugiwara-brainstorm',
  healing: 'mugiwara-healing',
  review: 'mugiwara-review',
  'root-cause': 'mugiwara-root-cause',
};

const CONDITIONAL: Record<string, string> = {
  git: 'mugiwara-git',
  resume: 'mugiwara-resume',
  workflow: 'mugiwara-workflow',
};

describe('EXTENSION_TABLE placements', () => {
  it('pins the 7 core always-on skills by exact token string', () => {
    for (const [token, skill] of Object.entries(CORE)) {
      expect(EXTENSION_TABLE[token].skills).toEqual([skill]);
      expect(EXTENSION_TABLE[token].default).toBe('core');
    }
  });

  it('pins the 11 auto trigger-loaded skills by exact token string', () => {
    for (const [token, skill] of Object.entries(AUTO)) {
      expect(EXTENSION_TABLE[token].skills).toEqual([skill]);
      expect(EXTENSION_TABLE[token].default).toBe('auto');
    }
  });

  it('pins the 3 conditional-auto skills by exact token string', () => {
    for (const [token, skill] of Object.entries(CONDITIONAL)) {
      expect(EXTENSION_TABLE[token].skills).toEqual([skill]);
      expect(EXTENSION_TABLE[token].default).toBe('auto');
    }
  });

  it('covers exactly 21 distinct skill dirs (7 core + 11 auto + 3 conditional)', () => {
    const skills = Object.values(EXTENSION_TABLE).flatMap((row) => row.skills);
    expect(new Set(skills).size).toBe(21);
    expect(skills.filter((s) => s === 'mugiwara-lessons').length).toBe(2); // read-half + lessons-write
  });

  it('every skill dir in the table exists under content/skills/', () => {
    const onDisk = new Set(readdirSync(join(import.meta.dirname, '..', 'content', 'skills')));
    for (const row of Object.values(EXTENSION_TABLE)) {
      for (const skill of row.skills) expect(onDisk.has(skill)).toBe(true);
    }
  });

  it('team and sign tokens exist with no skill payload (config/CLI concerns, not skills)', () => {
    expect(EXTENSION_TABLE['team'].skills).toEqual([]);
    expect(EXTENSION_TABLE['sign'].skills).toEqual([]);
  });

  it('lessons-write maps to mugiwara-lessons and ships OFF', () => {
    expect(EXTENSION_TABLE['lessons-write'].skills).toEqual(['mugiwara-lessons']);
    expect(EXTENSION_TABLE['lessons-write'].default).toBe('off');
  });

  it('has no skeptic token (skeptic is a role, not an extension)', () => {
    expect('skeptic' in EXTENSION_TABLE).toBe(false);
  });
});

describe('parseFeatures grammar', () => {
  it('parses all', () => {
    expect(parseFeatures('all')).toEqual({ base: 'all', add: [], remove: [] });
  });

  it('parses bare core+auto', () => {
    expect(parseFeatures('core+auto')).toEqual({ base: 'core+auto', add: [], remove: [] });
  });

  it('parses core+auto with adds', () => {
    expect(parseFeatures('core+auto,ship')).toEqual({ base: 'core+auto', add: ['ship'], remove: [] });
  });

  it('parses core+auto with removals', () => {
    expect(parseFeatures('core+auto,-lessons')).toEqual({ base: 'core+auto', add: [], remove: ['lessons'] });
  });

  it('parses core+auto with mixed adds and removals', () => {
    expect(parseFeatures('core+auto,ship,-lessons')).toEqual({ base: 'core+auto', add: ['ship'], remove: ['lessons'] });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseFeatures('  core+auto , ship , -lessons ')).toEqual({ base: 'core+auto', add: ['ship'], remove: ['lessons'] });
  });

  it('throws unknown feature token with the offending name', () => {
    expect(() => parseFeatures('ship,custom')).toThrow('unknown feature token "custom"');
  });

  it('throws on unknown removal tokens too (fail-closed both ways)', () => {
    expect(() => parseFeatures('core+auto,-custom')).toThrow('unknown feature token "custom"');
  });

  it('rejects skeptic with a pointer to the checkpoint role, never a silent ignore', () => {
    expect(() => parseFeatures('core+auto,skeptic')).toThrow('mugiwara-checkpoint');
    expect(() => parseFeatures('core+auto,skeptic')).toThrow('references/adversarial.md');
  });

  it('rejects an empty value instead of guessing', () => {
    expect(() => parseFeatures('')).toThrow('must be "all"');
    expect(() => parseFeatures('   ')).toThrow('must be "all"');
  });

  it('rejects a bare unknown base', () => {
    expect(() => parseFeatures('everything')).toThrow('unknown feature token "everything"');
  });
});
