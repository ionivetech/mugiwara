import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALIASES, EXTENSION_TABLE, parseFeatures, resolveFeatures, SAFETY, SENSITIVE_PATTERNS } from '../src/features.ts';

// Expected placements: 14 skills (5 core + 9 auto).
const CORE: Record<string, string> = {
  orchestration: 'mugiwara-orchestration',
  planning: 'mugiwara-planning',
  execution: 'mugiwara-execution',
  checkpoint: 'mugiwara-checkpoint',
  quality: 'mugiwara-quality',
};

const AUTO: Record<string, string> = {
  ship: 'mugiwara-ship',
  migration: 'mugiwara-migration',
  'contract-first': 'mugiwara-contract-first',
  frontend: 'mugiwara-frontend',
  backend: 'mugiwara-backend',
  security: 'mugiwara-security',
  brainstorm: 'mugiwara-brainstorm',
  healing: 'mugiwara-healing',
  review: 'mugiwara-review',
};

// Tokens of merged skills: still accepted, normalized to the owner token.
const ALIAS_OWNER: Record<string, string> = {
  gates: 'quality',
  testcases: 'quality',
  git: 'execution',
  'root-cause': 'healing',
  resume: 'orchestration',
  lessons: 'orchestration',
  workflow: 'orchestration',
};

describe('EXTENSION_TABLE placements', () => {
  it('pins the 5 core always-on skills by exact token string', () => {
    for (const [token, skill] of Object.entries(CORE)) {
      expect(EXTENSION_TABLE[token].skills).toEqual([skill]);
      expect(EXTENSION_TABLE[token].default).toBe('core');
    }
  });

  it('pins the 9 auto trigger-loaded skills by exact token string', () => {
    for (const [token, skill] of Object.entries(AUTO)) {
      expect(EXTENSION_TABLE[token].skills).toEqual([skill]);
      expect(EXTENSION_TABLE[token].default).toBe('auto');
    }
  });

  it('keeps every old token as an alias to its merged owner', () => {
    expect(ALIASES).toEqual(ALIAS_OWNER);
    for (const [alias, owner] of Object.entries(ALIAS_OWNER)) {
      expect(alias in EXTENSION_TABLE).toBe(false);
      expect(owner in EXTENSION_TABLE).toBe(true);
    }
  });

  it('covers exactly 14 distinct skill dirs (5 core + 9 auto)', () => {
    const skills = Object.values(EXTENSION_TABLE).flatMap((row) => row.skills);
    expect(new Set(skills).size).toBe(14);
    expect(skills.filter((s) => s === 'mugiwara-orchestration').length).toBe(2); // core + lessons-write
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

  it('lessons-write maps to mugiwara-orchestration and ships OFF', () => {
    expect(EXTENSION_TABLE['lessons-write'].skills).toEqual(['mugiwara-orchestration']);
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
    expect(parseFeatures('core+auto,-review')).toEqual({ base: 'core+auto', add: [], remove: ['review'] });
  });

  it('parses core+auto with mixed adds and removals', () => {
    expect(parseFeatures('core+auto,ship,-review')).toEqual({ base: 'core+auto', add: ['ship'], remove: ['review'] });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseFeatures('  core+auto , ship , -review ')).toEqual({ base: 'core+auto', add: ['ship'], remove: ['review'] });
  });

  it('normalizes old tokens to the merged owner (add) and ignores their removal', () => {
    for (const [alias, owner] of Object.entries(ALIAS_OWNER)) {
      expect(parseFeatures(`core+auto,${alias}`)).toEqual({ base: 'core+auto', add: [owner], remove: [] });
      expect(parseFeatures(`core+auto,-${alias}`)).toEqual({ base: 'core+auto', add: [], remove: [] });
    }
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

describe('resolveFeatures + SAFETY', () => {
  it('pins the safety set exactly', () => {
    expect([...SAFETY].sort()).toEqual(['contract-first', 'security']);
  });

  it('absent key resolves every token (≡ all, status quo)', () => {
    expect(resolveFeatures({ config: {}, changedFiles: [] })).toEqual(Object.keys(EXTENSION_TABLE));
  });

  it('explicit all equals absent', () => {
    expect(resolveFeatures({ config: { features: 'all' }, changedFiles: [] }))
      .toEqual(resolveFeatures({ config: {}, changedFiles: [] }));
  });

  it('core+auto on an empty diff resolves exactly the 5 core tokens', () => {
    expect(resolveFeatures({ config: { features: 'core+auto' }, changedFiles: [] }))
      .toEqual(['orchestration', 'planning', 'execution', 'checkpoint', 'quality']);
  });

  it('security force-on: sensitive diff includes it and resists removal', () => {
    const opts = { config: { features: 'core+auto' }, changedFiles: ['src/auth/login.ts'] };
    expect(resolveFeatures(opts)).toContain('security');
    expect(() => resolveFeatures({ config: { features: 'core+auto,-security' }, changedFiles: ['src/auth/login.ts'] }))
      .toThrow('safety set "security" fires and cannot be disabled');
  });

  it('contract-first force-on: boundary diff includes it and resists removal', () => {
    const opts = { config: { features: 'core+auto' }, changedFiles: ['src/policy.ts'] };
    expect(resolveFeatures(opts)).toContain('contract-first');
    expect(() => resolveFeatures({ config: { features: 'core+auto,-contract-first' }, changedFiles: ['src/policy.ts'] }))
      .toThrow('safety set "contract-first" fires and cannot be disabled');
  });

  it('removing a non-firing safety member is allowed', () => {
    const resolved = resolveFeatures({ config: { features: 'core+auto,-security' }, changedFiles: ['README.md'] });
    expect(resolved).not.toContain('security');
    expect(resolved).toContain('orchestration');
  });

  it('unknown token throws through the resolver (fail-closed)', () => {
    expect(() => resolveFeatures({ config: { features: 'core+auto,bogus' }, changedFiles: [] }))
      .toThrow('unknown feature token "bogus"');
  });

  it('unreadable trigger source aborts loudly, never silent-skips', () => {
    expect(() => resolveFeatures({ config: {}, changedFiles: null })).toThrow('trigger source unreadable');
    expect(() => resolveFeatures({ config: {}, changedFiles: undefined })).toThrow('trigger source unreadable');
  });

  it('explicit add forces a token on without its trigger', () => {
    const resolved = resolveFeatures({ config: { features: 'core+auto,ship' }, changedFiles: [] });
    expect(resolved).toContain('ship');
  });

  it('intent flags fire their tokens (ship/healing/review)', () => {
    const resolved = resolveFeatures({
      config: { features: 'core+auto' }, changedFiles: [],
      intents: { close: true, failure: true, gatesPass: true, bug: true },
    });
    expect(resolved).toContain('ship');
    expect(resolved).toContain('healing');
    expect(resolved).toContain('review');
    expect(resolveFeatures({ config: { features: 'core+auto' }, changedFiles: [], intents: { bug: true } })).toContain('healing');
  });

  it('off-default tokens never auto-fire, even with every signal lit', () => {
    const resolved = resolveFeatures({
      config: { features: 'core+auto', team: 'on' },
      changedFiles: ['src/auth/login.ts', 'api/routes/x.ts', 'ui/App.tsx'],
      intents: { close: true, tests: true, vague: true, bug: true, gitOp: true, failure: true, gatesPass: true, interrupted: true, meta: true },
    });
    expect(resolved).not.toContain('lessons-write');
    expect(resolved).not.toContain('sign');
    expect(resolved).toContain('team');
  });

  it('team reads the team key only: team=on includes team-scoped behavior', () => {
    const resolved = resolveFeatures({ config: { features: 'core+auto', team: 'on' }, changedFiles: [], intents: {} });
    expect(resolved).toContain('team');
  });

  it('team fires on roster > 1 without the team key, stays off while solo', () => {
    const teamed = resolveFeatures({ config: { features: 'core+auto' }, changedFiles: [], intents: { rosterSize: 2 } });
    expect(teamed).toContain('team');
    const solo = resolveFeatures({ config: { features: 'core+auto' }, changedFiles: [], intents: { rosterSize: 1 } });
    expect(solo).not.toContain('team');
  });

  it('resolver has no write path (reads team key/roster only)', () => {
    const src = readFileSync(join(import.meta.dirname, '..', 'src', 'features.ts'), 'utf8');
    expect(src).not.toContain('writeFileSync');
    expect(src).not.toContain('writeFile(');
  });

  it('lessons-write stays OFF even with closure intent present (D5)', () => {
    const resolved = resolveFeatures({ config: { features: 'core+auto' }, changedFiles: [], intents: { close: true } });
    expect(resolved).not.toContain('lessons-write');
    expect(resolved).toContain('ship');
  });

  it('sensitive patterns mirror scripts/lib/patterns.sh SENSITIVE_PATS verbatim', () => {
    const sh = readFileSync(join(import.meta.dirname, '..', 'scripts', 'lib', 'patterns.sh'), 'utf8');
    const m = sh.match(/^SENSITIVE_PATS="([^"]*)"/m);
    expect(m).not.toBeNull();
    expect(m![1].split('|')).toEqual(SENSITIVE_PATTERNS);
  });

  it('no resolver needs a model call or tree walk (cost ceiling, D10)', () => {
    const src = readFileSync(join(import.meta.dirname, '..', 'src', 'features.ts'), 'utf8');
    expect(src).not.toContain('node:fs');
    expect(src).not.toContain('child_process');
    expect(src).not.toContain('fetch(');
  });
});
