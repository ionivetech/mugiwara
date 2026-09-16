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

// ── Triggers + safety set (T3) ─────────────────────────────────────────────
// Every resolver reads ONLY caller-supplied `changedFiles` (git diff
// --name-only output), config keys, or declared intent flags. Cost ceiling
// (D10): O(diff) globs or O(1) key/flag reads. A resolver needing a model
// call or a full-tree scan is deleted here, not shipped.

import { globToRegExp } from './policy.ts';

/**
 * Sensitive-path alternatives, mirrored VERBATIM from
 * scripts/lib/patterns.sh SENSITIVE_PATS (split on '|'). Parity test fails
 * when the two drift — edit both or neither.
 */
export const SENSITIVE_PATTERNS: string[] = ['auth/', 'oauth2?/', 'payment/', 'payments/', 'billing/', 'crypto/', 'secrets/', 'credential', 'sessions?/', 'tokens?/', 'rbac', 'permissions?/', 'acls?/', 'iam/', '\\.env$', '\\.env\\.', 'config/.*key', '\\.p12$', '\\.key$', '\\.pem$', 'migration/', 'migrations/', 'migrate/', '\\.sql$', 'schema\\.', '\\.prisma$', '\\.terraform', '\\.tf$', 'Dockerfile', 'docker-compose', '\\.github/workflows/', 'webhooks?/', 'secret/', 'secrets?\\.ya?ml$', '\\.tfvars$'];

const SENSITIVE_RE = new RegExp(SENSITIVE_PATTERNS.join('|'));

// Frontend defaults (A1) — fixed generic globs, tuning keys OUT of mission.
const FRONTEND_GLOBS = ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.svelte', '**/*.css', '**/*.scss', '**/*.less', '**/tailwind.config.*'];
// Backend defaults (A1).
const BACKEND_GLOBS = ['src/**', 'api/**', 'server/**', 'prisma/**', '**/*.sql', '**/migrations/**'];
// Migration trigger: schema/data diff + migration seed path in diff.
const MIGRATION_GLOBS = ['**/*migration*', '**/*migrate*', '**/*.sql', '**/schema.*', '**/*.prisma', 'prisma/**'];
// Boundary diff (A3): public-surface paths + policy/config keys.
const BOUNDARY_GLOBS = ['src/policy.ts', 'src/config.ts', 'mugiwara.policy.yml', 'api/**', 'server/**', 'src/**/routes/**', '**/*.openapi.*', 'content/**'];

/** Non-removable while firing — removal of a firing member aborts loudly. */
export const SAFETY: ReadonlySet<string> = new Set(['security', 'contract-first']);

/** Declared intents — O(1) caller-supplied flags, never inferred by scan. */
export type ResolveIntent = {
  close?: boolean;
  tests?: boolean;
  vague?: boolean;
  bug?: boolean;
  gitOp?: boolean;
  failure?: boolean;
  gatesPass?: boolean;
  interrupted?: boolean;
  meta?: boolean;
  /** Crew roster size when known (O(1) caller-supplied count, never scanned). */
  rosterSize?: number;
};

function anyMatch(files: string[], globs: string[]): boolean {
  const res = globs.map(globToRegExp);
  return files.some((f) => res.some((re) => re.test(f)));
}

function fires(token: string, changedFiles: string[], config: Record<string, string>, intents: ResolveIntent): boolean {
  switch (token) {
    case 'ship': return intents.close === true; // O(1) state key
    case 'migration': return anyMatch(changedFiles, MIGRATION_GLOBS); // O(diff) globs
    case 'contract-first': return anyMatch(changedFiles, BOUNDARY_GLOBS); // O(diff) globs
    case 'testcases': return intents.tests === true; // O(1) intent
    case 'frontend': return anyMatch(changedFiles, FRONTEND_GLOBS); // O(diff) globs
    case 'backend': return anyMatch(changedFiles, BACKEND_GLOBS); // O(diff) globs
    case 'team': return config.team === 'on' || (intents.rosterSize ?? 0) > 1; // O(1) config/roster, read-only
    case 'lessons-write': return false; // hard-OFF (D5) — enablement OUT
    case 'sign': return false; // default OFF, regulated-only (unchanged)
    case 'security': return changedFiles.some((f) => SENSITIVE_RE.test(f)); // O(diff) globs
    case 'brainstorm': return intents.vague === true; // O(1) intent
    case 'healing': return intents.failure === true; // O(1) state
    case 'review': return intents.gatesPass === true; // O(1) state
    case 'root-cause': return intents.bug === true; // O(1) intent
    case 'git': return intents.gitOp === true; // O(1) intent
    case 'resume': return intents.interrupted === true; // O(1) stat
    case 'workflow': return intents.meta === true; // O(1) intent
    default: return false;
  }
}

/**
 * Resolve the active extension tokens. Absent `features=` key ≡ all
 * (status quo). Unknown token throws (fail-closed). Removing a firing
 * SAFETY member throws. Null/undefined `changedFiles` (unreadable trigger
 * source) aborts loudly, never silent-skips. Returns tokens in table order.
 */
export function resolveFeatures(opts: {
  config: Record<string, string>;
  changedFiles: string[] | null | undefined;
  intents?: ResolveIntent;
}): string[] {
  const { config, changedFiles, intents = {} } = opts;
  if (changedFiles == null) throw new Error('trigger source unreadable — aborting lane, never silent skip');
  const raw = config.features;
  if (raw === undefined) return Object.keys(EXTENSION_TABLE);
  const parsed = parseFeatures(raw);
  if (parsed.base === 'all') return Object.keys(EXTENSION_TABLE);
  const on = new Set<string>();
  for (const [token, row] of Object.entries(EXTENSION_TABLE)) {
    if (row.default === 'core') on.add(token);
    else if (row.default === 'auto' && fires(token, changedFiles, config, intents)) on.add(token);
  }
  for (const token of parsed.add) on.add(token);
  for (const token of parsed.remove) {
    if (SAFETY.has(token) && fires(token, changedFiles, config, intents)) {
      throw new Error(`safety set "${token}" fires and cannot be disabled`);
    }
    on.delete(token);
  }
  return Object.keys(EXTENSION_TABLE).filter((t) => on.has(t));
}
