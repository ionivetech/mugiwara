// src/features.ts
// `features=` extension mechanism (p16): single trigger table + grammar parser
// + cheap trigger resolvers, owned next to DEFAULT_CONFIG. Vocabulary drift
// fix: one table, one test (test/features.test.ts pins all 21 placements).

export type FeatureDefault = 'core' | 'auto' | 'off';

export type ExtensionRow = {
  /** Skill dirs this token loads (empty for config/CLI concerns like team/sign). */
  skills: string[];
  /** Cheap pre-execution signal that fires this token (all O(diff)/O(1) — D10). */
  trigger: string;
  default: FeatureDefault;
};

/**
 * Token → skill dir(s) + trigger + default. 21 skill placements, binding:
 * 7 core always-on + 11 auto trigger-loaded + 3 conditional-auto.
 * Tokens are extension names, never raw skill dir names. `skeptic` is
 * deliberately absent (role, not extension — see parseFeatures).
 */
export const EXTENSION_TABLE: Record<string, ExtensionRow> = {
  // ── core always-on (7) ──────────────────────────────────────────────
  orchestration: { skills: ['mugiwara-orchestration'], trigger: 'always on', default: 'core' },
  planning: { skills: ['mugiwara-planning'], trigger: 'always on', default: 'core' },
  execution: { skills: ['mugiwara-execution'], trigger: 'always on', default: 'core' },
  checkpoint: { skills: ['mugiwara-checkpoint'], trigger: 'always on', default: 'core' },
  gates: { skills: ['mugiwara-gates'], trigger: 'always on', default: 'core' },
  quality: { skills: ['mugiwara-quality'], trigger: 'always on', default: 'core' },
  lessons: { skills: ['mugiwara-lessons'], trigger: 'always on (read-half)', default: 'core' },
  // ── auto trigger-loaded (11) ────────────────────────────────────────
  ship: { skills: ['mugiwara-ship'], trigger: 'close/archive intent, Flow 8', default: 'auto' },
  migration: { skills: ['mugiwara-migration'], trigger: 'schema/data/framework diff', default: 'auto' },
  'contract-first': { skills: ['mugiwara-contract-first'], trigger: 'boundary diff', default: 'auto' },
  testcases: { skills: ['mugiwara-testcases'], trigger: 'user declares tests/e2e', default: 'auto' },
  frontend: { skills: ['mugiwara-frontend'], trigger: 'UI globs in diff', default: 'auto' },
  backend: { skills: ['mugiwara-backend'], trigger: 'server globs in diff', default: 'auto' },
  security: { skills: ['mugiwara-security'], trigger: 'sensitive-path predicate fires', default: 'auto' },
  brainstorm: { skills: ['mugiwara-brainstorm'], trigger: 'vague/exploratory class at triage', default: 'auto' },
  healing: { skills: ['mugiwara-healing'], trigger: 'failure ledger non-empty / prior flow FAIL', default: 'auto' },
  review: { skills: ['mugiwara-review'], trigger: 'gates PASS on diff-bearing mission', default: 'auto' },
  'root-cause': { skills: ['mugiwara-root-cause'], trigger: 'bug/crash report', default: 'auto' },
  // ── conditional-auto (3) ────────────────────────────────────────────
  git: { skills: ['mugiwara-git'], trigger: 'git-op intent', default: 'auto' },
  resume: { skills: ['mugiwara-resume'], trigger: 'interruption marker (continue.json pending)', default: 'auto' },
  workflow: { skills: ['mugiwara-workflow'], trigger: 'meta mission, with orchestration', default: 'auto' },
  // ── non-skill tokens (config/CLI concerns) ──────────────────────────
  team: { skills: [], trigger: 'team=on in config or roster > 1 (read-only)', default: 'auto' },
  sign: { skills: [], trigger: 'regulated mission / attestation policy / keys present', default: 'off' },
  'lessons-write': { skills: ['mugiwara-lessons'], trigger: 'closure + new lesson found', default: 'off' },
};

export type ParsedFeatures = {
  base: 'all' | 'core+auto';
  add: string[];
  remove: string[];
};

const SKEPTIC_HINT =
  'skeptic is a role, not an extension — see mugiwara-checkpoint + references/adversarial.md';

function checkToken(token: string): void {
  if (token === 'skeptic' || token === '-skeptic') throw new Error(`unknown feature token "skeptic": ${SKEPTIC_HINT}`);
  const name = token.startsWith('-') ? token.slice(1) : token;
  if (!(name in EXTENSION_TABLE)) throw new Error(`unknown feature token "${name}"`);
}

/**
 * Parse a `features=` value: `all` | `core+auto[,token...][,-token...]`.
 * A bare token list implies base `core+auto`. Unknown token = hard error
 * (fail-closed), never ignore. `skeptic` redirects to the checkpoint role.
 */
export function parseFeatures(raw: string): ParsedFeatures {
  const input = raw.trim();
  if (input === '') throw new Error('features= must be "all" or "core+auto[,token...][,-token...]" — absent key means all (status quo)');
  if (input === 'all') return { base: 'all', add: [], remove: [] };
  const parts = input.split(',').map((p) => p.trim()).filter((p) => p !== '');
  let rest = parts;
  if (parts[0] === 'core+auto') {
    rest = parts.slice(1);
  } else if (parts[0] === 'all') {
    throw new Error('features= "all" takes no tokens — use "all" alone or "core+auto[,token...]"');
  }
  const add: string[] = [];
  const remove: string[] = [];
  for (const token of rest) {
    checkToken(token);
    if (token.startsWith('-')) {
      const name = token.slice(1);
      if (!remove.includes(name)) remove.push(name);
    } else {
      if (!add.includes(token)) add.push(token);
    }
  }
  return { base: 'core+auto', add, remove };
}
