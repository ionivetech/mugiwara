// src/policy.ts
// mugiwara.policy.yml — org rules that override crew judgement.
//
// One optional file at the repo root; absent means today's
// behavior everywhere. Policy only ever pushes UP (more scrutiny), never down:
// lanes forced to full, coverage thresholds raised, paths flagged for human
// approval.
//
// The parser is a deliberate YAML subset — nested maps, string arrays,
// scalars — enough for the documented schema and nothing more. No dependency:
// a governance file that needs an npm install to read would not be read.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type MugiwaraPolicy = {
  lanes?: { force_full?: string[] };
  gates?: {
    coverage?: { new?: number; modified?: number };
    require_human_approval?: string[];
  };
  evidence?: {
    required?: string[];
    /** Lanes where an empty evidence set blocks archive instead of warning. (B7) */
    require_nonempty_for_lanes?: string[];
  };
  integrity?: { extra_secret_patterns?: Array<{ pattern: string; label: string; severity?: 'block' | 'warn' }> };
  attestation?: {
    required?: boolean;
    trusted_keys?: Array<{ id: string; pubkey: string; added?: string }>;
    revoked?: Array<{ id: string; revoked?: string; reason?: string; pubkey?: string }>;
  };
  harness?: { require_enforcement?: boolean };
};

const POLICY_FILES = ['mugiwara.policy.yml', 'mugiwara.policy.yaml'];
const KNOWN_ROOTS = ['lanes', 'gates', 'evidence', 'integrity', 'attestation', 'harness'];

/**
 * Minimal YAML subset: maps, `- item` string lists, scalars.
 *
 * A `key:` with no value stays pending on its scope until a deeper line turns
 * it into a map (first mapping child) or a list (first `- ` child). Scopes are
 * keyed by the indent of their own key line; any line at indent <= a scope's
 * key indent leaves that scope. Enough for the documented schema, nothing more.
 */
export function parsePolicyYaml(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  type Scope = { keyIndent: number; obj: Record<string, unknown>; pending?: { key: string; indent: number } };
  const stack: Scope[] = [{ keyIndent: -1, obj: root }];
  const lines = text.split(/\r?\n/);

  const process = (i: number): void => {
    if (i >= lines.length) return;
    const noComment = lines[i].replace(/(^|\s)#.*$/, '');
    if (!noComment.trim()) return process(i + 1);
    const indent = noComment.length - noComment.trimStart().length;
    const line = noComment.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].keyIndent) stack.pop();
    const top = stack[stack.length - 1];

    // A pending `parent:` whose first child this line is → become a map scope,
    // then dispatch this same line into the new scope. A `- ` child instead
    // turns the pending key into a LIST below — it must not materialize a map.
    if (top.pending && !line.startsWith('- ') && indent > top.pending.indent && !Array.isArray(top.obj[top.pending.key])) {
      const { key, indent: pIndent } = top.pending;
      delete top.pending;
      const created: Record<string, unknown> = {};
      top.obj[key] = created;
      stack.push({ keyIndent: pIndent, obj: created });
      return process(i);
    }

    if (line.startsWith('- ')) {
      if (top.pending) {
        const existing = top.obj[top.pending.key];
        const arr: unknown[] = Array.isArray(existing) ? existing : [];
        arr.push(scalar(line.slice(2)));
        top.obj[top.pending.key] = arr;
      }
      // stray items outside a pending key are ignored in this subset
      return process(i + 1);
    }

    const colon = line.indexOf(':');
    if (colon === -1) return process(i + 1); // not a mapping line in this subset
    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();
    if (rest === '') {
      top.pending = { key, indent };
    } else {
      top.obj[key] = scalar(rest);
      delete top.pending;
    }
    process(i + 1);
  };

  process(0);
  return root;
}

function scalar(v: string): unknown {
  const t = v.trim().replace(/^["']|["']$/g, '');
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  return t;
}

/**
 * Dedicated extractor for integrity.extra_secret_patterns list-of-maps.
 * The minimal YAML subset parser only handles scalar lists; this scans the raw
 * text line-by-line for map items so both forms work:
 *   - { pattern: "\\b...\\b", label: "NIK" }
 *   - - pattern: "\\b...\\b"
 *     label: "NIK"
 *     severity: warn
 */
export function extractExtraSecretPatterns(text: string): Array<{ pattern: string; label: string; severity?: string }> {
  const lines = text.split(/\r?\n/);
  let inBlock = false;
  let baseIndent = -1;
  const out: Array<Record<string, string>> = [];
  let current: Record<string, string> | null = null;
  let currentIndent = -1;
  for (const rawLine of lines) {
    const noComment = rawLine.replace(/(^|\s)#.*$/, '');
    if (!noComment.trim()) continue;
    const indent = noComment.length - noComment.trimStart().length;
    const trimmed = noComment.trim();
    if (!inBlock) {
      if (trimmed.startsWith('extra_secret_patterns:')) {
        inBlock = true;
        baseIndent = indent;
        continue;
      }
    } else {
      // exit if a sibling key at same or shallower indent (not a list item) appears
      if (indent <= baseIndent && !trimmed.startsWith('-') && trimmed.includes(':')) {
        break;
      }
      if (trimmed.startsWith('-')) {
        if (current) out.push(current);
        current = {};
        currentIndent = indent;
        const afterDash = trimmed.slice(1).trim();
        if (!afterDash) continue;
        if (afterDash.startsWith('{') && afterDash.endsWith('}')) {
          const inner = afterDash.slice(1, -1);
          for (const part of inner.split(',')) {
            const colon = part.indexOf(':');
            if (colon === -1) continue;
            const k = part.slice(0, colon).trim();
            const v = part.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
            if (k && v) current[k] = v;
          }
        } else if (afterDash.includes(':')) {
          const colon = afterDash.indexOf(':');
          const k = afterDash.slice(0, colon).trim();
          const v = afterDash.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
          if (k && v) current[k] = v;
        } else {
          const v = afterDash.replace(/^["']|["']$/g, '');
          if (v) current['pattern'] = v;
        }
      } else if (current && trimmed.includes(':')) {
        if (indent > currentIndent) {
          const colon = trimmed.indexOf(':');
          const k = trimmed.slice(0, colon).trim();
          const v = trimmed.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
          if (k && v) current[k] = v;
        } else if (indent <= baseIndent) {
          break;
        }
      }
    }
  }
  if (current) out.push(current);
  return out.filter((o) => typeof o.pattern === 'string' && typeof o.label === 'string' && o.pattern.length > 0) as Array<{ pattern: string; label: string; severity?: string }>;
}

/**
 * Extract attestation block: handles both inline `{ id: "...", pubkey: "ed25519:..." }`
 * and multiline lists. Scans inside `attestation:` indented block so
 * `evidence: required:` is not confused.
 */
export function extractAttestation(text: string): {
  required?: boolean;
  trusted_keys?: Array<Record<string, string>>;
  revoked?: Array<Record<string, string>>;
} | null {
  const lines = text.split(/\r?\n/);
  let attBase = -1;
  let inAtt = false;
  let required: boolean | undefined;
  const trusted: Array<Record<string, string>> = [];
  const revoked: Array<Record<string, string>> = [];
  // collection state
  let collecting: 'trusted' | 'revoked' | null = null;
  let collectBase = -1;
  let current: Record<string, string> | null = null;
  let curIndent = -1;

  const flush = () => {
    if (!current) return;
    if (collecting === 'trusted') trusted.push(current);
    else if (collecting === 'revoked') revoked.push(current);
    current = null;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const noComment = rawLine.replace(/(^|\s)#.*$/, '');
    if (!noComment.trim()) continue;
    const indent = noComment.length - noComment.trimStart().length;
    const trimmed = noComment.trim();

    if (!inAtt) {
      if (trimmed === 'attestation:' || trimmed.startsWith('attestation:')) {
        // handle `attestation: { ... }` inline — not used, but parse required if present
        const after = trimmed.slice('attestation:'.length).trim();
        if (after.startsWith('{')) {
          // inline map form not needed for MVP
          return null;
        }
        inAtt = true;
        attBase = indent;
        // if there is a value after colon on same line (e.g., attestation: foo) ignore
        continue;
      }
      continue;
    }

    // inside attestation block
    // exit attestation when sibling root key at same/shallower indent
    if (indent <= attBase && !trimmed.startsWith('-') && trimmed.includes(':')) {
      flush();
      break;
    }

    // handle collecting state first
    if (collecting) {
      // exiting collection to sibling key inside attestation (e.g., revoked: after trusted_keys:)
      if (indent <= collectBase && !trimmed.startsWith('-') && trimmed.includes(':')) {
        flush();
        collecting = null;
        // fall through to process this line as att child
      } else if (trimmed.startsWith('-')) {
        flush();
        current = {};
        curIndent = indent;
        const afterDash = trimmed.slice(1).trim();
        if (!afterDash) continue;
        if (afterDash.startsWith('{') && afterDash.endsWith('}')) {
          const inner = afterDash.slice(1, -1);
          for (const part of inner.split(',')) {
            const colon = part.indexOf(':');
            if (colon === -1) continue;
            const k = part.slice(0, colon).trim();
            const v = part.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
            if (k && v) current[k] = v;
          }
        } else if (afterDash.includes(':')) {
          const colon = afterDash.indexOf(':');
          const k = afterDash.slice(0, colon).trim();
          const v = afterDash.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
          if (k && v) current[k] = v;
        } else {
          const v = afterDash.replace(/^["']|["']$/g, '');
          if (v) current['id'] = v;
        }
        continue;
      } else if (current && trimmed.includes(':')) {
        if (indent > curIndent) {
          const colon = trimmed.indexOf(':');
          const k = trimmed.slice(0, colon).trim();
          const v = trimmed.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
          if (k && v) current[k] = v;
          continue;
        }
      }
      // if still collecting but line is not part of current item, skip?
      if (collecting) continue;
    }

    // not collecting (or just exited) — look for att children
    if (trimmed.startsWith('required:')) {
      const v = trimmed.slice('required:'.length).trim().replace(/^["']|["']$/g, '');
      if (v === 'true') required = true;
      else if (v === 'false') required = false;
      continue;
    }
    if (trimmed.startsWith('trusted_keys:')) {
      const after = trimmed.slice('trusted_keys:'.length).trim();
      // handle inline empty `[]`
      if (after === '[]') continue;
      collecting = 'trusted';
      collectBase = indent;
      current = null;
      // if inline list with one map on same line? e.g., trusted_keys: [{ id: "a", pubkey: "x" }]
      // MVP not needed; empty case already handled
      continue;
    }
    if (trimmed.startsWith('revoked:')) {
      const after = trimmed.slice('revoked:'.length).trim();
      if (after === '[]') continue;
      collecting = 'revoked';
      collectBase = indent;
      current = null;
      continue;
    }
  }
  flush();
  if (required === undefined && trusted.length === 0 && revoked.length === 0) return null;
  const out: { required?: boolean; trusted_keys?: Array<Record<string, string>>; revoked?: Array<Record<string, string>> } = {};
  if (required !== undefined) out.required = required;
  if (trusted.length) out.trusted_keys = trusted;
  if (revoked.length) out.revoked = revoked;
  return out;
}

export function loadPolicy(projectDir: string): MugiwaraPolicy | null {
  for (const name of POLICY_FILES) {
    const file = join(projectDir, name);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const raw = parsePolicyYaml(text);
    const extra = extractExtraSecretPatterns(text);
    if (extra.length) {
      if (!raw.integrity || typeof raw.integrity !== 'object' || Array.isArray(raw.integrity)) raw.integrity = {};
      (raw.integrity as Record<string, unknown>).extra_secret_patterns = extra;
    }
    const att = extractAttestation(text);
    if (att) {
      if (!raw.attestation || typeof raw.attestation !== 'object' || Array.isArray(raw.attestation)) raw.attestation = {};
      const a = raw.attestation as Record<string, unknown>;
      if (att.required !== undefined) a.required = att.required;
      if (att.trusted_keys) a.trusted_keys = att.trusted_keys;
      if (att.revoked) a.revoked = att.revoked;
    }
    return normalize(raw);
  }
  return null;
}

function normalize(raw: Record<string, unknown>): MugiwaraPolicy {
  // A typo'd root key would otherwise silently disable the rule it carried.
  for (const k of Object.keys(raw)) {
    if (!KNOWN_ROOTS.includes(k)) throw new Error(`unknown policy key "${k}" (known: ${KNOWN_ROOTS.join(', ')})`);
  }
  const out: MugiwaraPolicy = {};
  const lanes = raw.lanes as Record<string, unknown> | undefined;
  if (lanes && Array.isArray(lanes.force_full)) out.lanes = { force_full: strings(lanes.force_full) };
  const gates = raw.gates as Record<string, unknown> | undefined;
  if (gates) {
    out.gates = {};
    const cov = gates.coverage as Record<string, unknown> | undefined;
    if (cov) {
      out.gates.coverage = {};
      if (typeof cov.new === 'number') out.gates.coverage.new = cov.new;
      if (typeof cov.modified === 'number') out.gates.coverage.modified = cov.modified;
    }
    if (Array.isArray(gates.require_human_approval))
      out.gates.require_human_approval = strings(gates.require_human_approval);
  }
  const evidence = raw.evidence as Record<string, unknown> | undefined;
  if (evidence) {
    const ev: NonNullable<MugiwaraPolicy['evidence']> = {};
    if (Array.isArray(evidence.required)) ev.required = strings(evidence.required);
    else if (typeof evidence.required === 'string' && (evidence.required as string).trim().startsWith('[')) {
      try { const p = JSON.parse(evidence.required as string); if (Array.isArray(p)) ev.required = strings(p); } catch { /* ignore */ }
    }
    if (Array.isArray(evidence.require_nonempty_for_lanes)) ev.require_nonempty_for_lanes = strings(evidence.require_nonempty_for_lanes);
    else if (typeof evidence.require_nonempty_for_lanes === 'string' && (evidence.require_nonempty_for_lanes as string).trim().startsWith('[')) {
      try { const p = JSON.parse(evidence.require_nonempty_for_lanes as string); if (Array.isArray(p)) ev.require_nonempty_for_lanes = strings(p); } catch { /* ignore */ }
    }
    if (ev.required || ev.require_nonempty_for_lanes) out.evidence = ev;
  }
  const integrity = raw.integrity as Record<string, unknown> | undefined;
  if (integrity && Array.isArray(integrity.extra_secret_patterns)) {
    const arr = integrity.extra_secret_patterns as unknown[];
    const cleaned: Array<{ pattern: string; label: string; severity?: 'block' | 'warn' }> = [];
    for (const e of arr) {
      if (!e || typeof e !== 'object') continue;
      const rec = e as Record<string, unknown>;
      if (typeof rec.pattern !== 'string' || typeof rec.label !== 'string') continue;
      const sev = rec.severity === 'warn' ? 'warn' as const : rec.severity === 'block' ? 'block' as const : undefined;
      const entry: { pattern: string; label: string; severity?: 'block' | 'warn' } = { pattern: rec.pattern, label: rec.label };
      if (sev) entry.severity = sev;
      cleaned.push(entry);
    }
    if (cleaned.length) out.integrity = { extra_secret_patterns: cleaned };
  }
  const att = raw.attestation as Record<string, unknown> | undefined;
  if (att) {
    const a: NonNullable<MugiwaraPolicy['attestation']> = {};
    if (typeof att.required === 'boolean') a.required = att.required;
    if (Array.isArray(att.trusted_keys)) {
      const cleanedTk: Array<{ id: string; pubkey: string; added?: string }> = [];
      for (const e of att.trusted_keys as unknown[]) {
        if (!e || typeof e !== 'object') continue;
        const rec = e as Record<string, unknown>;
        if (typeof rec.id !== 'string' || typeof rec.pubkey !== 'string') continue;
        if (!rec.id.trim() || !rec.pubkey.trim()) continue;
        const entry: { id: string; pubkey: string; added?: string } = { id: rec.id.trim(), pubkey: rec.pubkey.trim() };
        if (typeof rec.added === 'string' && rec.added.trim()) entry.added = rec.added.trim();
        cleanedTk.push(entry);
      }
      if (cleanedTk.length) a.trusted_keys = cleanedTk;
    }
    if (Array.isArray(att.revoked)) {
      const cleanedRv: Array<{ id: string; revoked?: string; reason?: string; pubkey?: string }> = [];
      for (const e of att.revoked as unknown[]) {
        if (!e || typeof e !== 'object') continue;
        const rec = e as Record<string, unknown>;
        if (typeof rec.id !== 'string' || !rec.id.trim()) continue;
        const entry: { id: string; revoked?: string; reason?: string; pubkey?: string } = { id: rec.id.trim() };
        if (typeof rec.revoked === 'string' && rec.revoked.trim()) entry.revoked = rec.revoked.trim();
        if (typeof rec.reason === 'string' && rec.reason.trim()) entry.reason = rec.reason.trim();
        if (typeof rec.pubkey === 'string' && rec.pubkey.trim()) entry.pubkey = rec.pubkey.trim();
        cleanedRv.push(entry);
      }
      if (cleanedRv.length) a.revoked = cleanedRv;
    }
    if (a.required !== undefined || a.trusted_keys || a.revoked) out.attestation = a;
  }
  const harness = raw.harness as Record<string, unknown> | undefined;
  if (harness && typeof harness.require_enforcement === 'boolean') {
    out.harness = { require_enforcement: harness.require_enforcement };
  }
  return out;
}

function strings(a: unknown[]): string[] {
  return a.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/** Glob → RegExp: `**` crosses separators, `*` stays within one. */
export function globToRegExp(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const src = esc.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${src}$`);
}

/** Any changed path matching any policy glob? Returns the matching globs. */
export function matchedGlobs(paths: string[], globs: string[]): string[] {
  return globs.filter((g) => paths.some((p) => globToRegExp(g).test(p)));
}

/**
 * Coverage thresholds: the max of the .mugiwara/config value (or its
 * fallback) and any policy raise. Policy pushes up, never down.
 */
export function effectiveThreshold(configured: number, policyValue: number | undefined): number {
  return Math.max(configured, policyValue ?? 0);
}

// ── Harness enforcement (D8) ────────────────────────────────────────────────
// Only opencode has runtime write-scope enforcement; the other 11 harnesses
// are rules-based. `harness.require_enforcement: true` refuses to run where
// the harness is not enforced.

/** Detect current harness. Mirrors savepoint.sh logic. */
export function detectHarness(projectDir?: string): string {
  const e = process.env;
  const has = (v: string | undefined) => v !== undefined && v !== '';
  if (has(e.CLAUDECODE) || has(e.CLAUDE_CODE_ENTRYPOINT) || (typeof e.ANTHROPIC_MODEL === 'string' && /claude/i.test(e.ANTHROPIC_MODEL))) return 'claude';
  if (has(e.OPENCODE) || has(e.OPENCODE_TOKENS_FILE)) return 'opencode';
  const candidates = [
    projectDir ? join(projectDir, '.opencode', 'config.json') : null,
    join(process.cwd(), '.opencode', 'config.json'),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try { if (existsSync(p)) return 'opencode'; } catch { /* ignore */ }
  }
  if (has(e.CURSOR) || has(e.VSCODE_GIT_ASKPASS_NODE)) return 'cursor';
  return 'unknown';
}

/** Only opencode is runtime-enforced. */
export function isEnforcedHarness(projectDir?: string): boolean {
  return detectHarness(projectDir) === 'opencode';
}

/** Pure check: returns error message when policy requires enforcement but harness is rules-based, else null. */
export function getHarnessEnforcementError(projectDir: string): string | null {
  let policy: MugiwaraPolicy | null;
  try { policy = loadPolicy(projectDir); } catch (e) { throw e; }
  if (!policy?.harness?.require_enforcement) return null;
  if (isEnforcedHarness(projectDir)) return null;
  const h = detectHarness(projectDir);
  return `harness enforcement required but current harness is rules-based only \u2014 use opencode or set harness.require_enforcement:false (detected: ${h})`;
}

/** Fail closed when policy requires enforcement but harness is rules-based. */
export function enforceHarnessPolicy(projectDir: string): void {
  const err = getHarnessEnforcementError(projectDir);
  if (!err) return;
  console.error(`\u2717 ${err}`);
  process.exit(1);
}

/** Alias for CLI import convenience. */
export const checkHarnessEnforcement = enforceHarnessPolicy;

// ── Lane-aware gates (T3) ───────────────────────────────────────────────────
// Direct → minimal (typecheck+build only), lean → +validate-content, standard+
// → +evals/retrieval/conformance/benchmark. Single source for gate-selftest
// and the franky-gates skill doc. Full = 12 steps, direct = 3 steps.
export const GATE_STEPS_BY_LANE: Record<string, string[]> = {
  direct: ['build-hooks:check', 'typecheck', 'build'],
  lean: ['build-hooks:check', 'typecheck', 'build', 'validate-content', 'lane-base', 'check-doc-links'],
  standard: ['build-hooks:check', 'typecheck', 'build', 'validate-content', 'lane-base', 'check-doc-links', 'test:coverage', 'coverage-gate', 'verify-install'],
  full: ['build-hooks:check', 'typecheck', 'build', 'validate-content', 'lane-base', 'check-doc-links', 'test:coverage', 'coverage-gate', 'verify-install', 'run-evals', 'retrieval-eval', 'conformance'],
};

export function gatesForLane(lane: string): string[] {
  return GATE_STEPS_BY_LANE[lane] ?? GATE_STEPS_BY_LANE.full;
}

export function isLaneAwareGateStep(step: string, lane: string): boolean {
  return gatesForLane(lane).includes(step);
}
