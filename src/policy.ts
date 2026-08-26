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
  evidence?: { required?: string[] };
};

const POLICY_FILES = ['mugiwara.policy.yml', 'mugiwara.policy.yaml'];
const KNOWN_ROOTS = ['lanes', 'gates', 'evidence'];

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

export function loadPolicy(projectDir: string): MugiwaraPolicy | null {
  for (const name of POLICY_FILES) {
    const file = join(projectDir, name);
    if (!existsSync(file)) continue;
    return normalize(parsePolicyYaml(readFileSync(file, 'utf8')));
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
  if (evidence && Array.isArray(evidence.required)) out.evidence = { required: strings(evidence.required) };
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
